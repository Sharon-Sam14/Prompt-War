import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";
import { PlanSchema, type PlanInput } from "@/lib/genai/schemas";

/**
 * Integration tests for POST /api/plan (docs/Phases.md Phase 2.4/2.5).
 *
 * The AI SDK is MOCKED: no network, no API key, no token spend — required by Gate 2.
 * Real code under test: route orchestration, rate limiter, Zod validation,
 * client retry/fallback, LRU cache, hydration merge.
 */

vi.mock("ai", () => ({ generateObject: vi.fn() }));

import { generateObject } from "ai";

type GenerateObjectMock = Mock<
  (opts: {
    prompt: string;
    model: { modelId: string };
    providerOptions?: { openai?: { reasoningEffort?: string } };
  }) => Promise<{ object: unknown }>
>;
const generateObjectMock = generateObject as unknown as GenerateObjectMock;

const { POST } = await import("@/app/api/plan/route");

const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

function validInput(overrides: Partial<PlanInput> = {}): PlanInput {
  return {
    vertical: "wedding",
    eventDate: future(180),
    guestCount: 120,
    budgetTotalCents: 4_000_000,
    currency: "USD",
    budgetBand: "standard",
    isOutdoor: false,
    ...overrides,
  } as PlanInput;
}

/** Each test gets a unique client IP: the rate limiter is module-level state. */
let ipCounter = 0;
function nextIp(): string {
  ipCounter += 1;
  return `10.9.9.${ipCounter}`;
}

function post(body: unknown, ip = nextIp(), raw = false): Promise<Response> {
  return POST(
    new NextRequest("http://localhost/api/plan", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: raw ? String(body) : JSON.stringify(body),
    }),
  );
}

const VALID_ENRICHMENT = {
  budgetPct: [
    { key: "venue", pct: 55 },
    { key: "catering", pct: 45 },
  ],
  tasks: [{ title: "Book the string quartet", offsetDays: 60, phase: "booking" }],
  ideas: [
    {
      title: "Weekday garden ceremony",
      rationale: "Weekday venue rates run 20% lower.",
      tags: ["saving"],
    },
  ],
};

beforeEach(() => {
  generateObjectMock.mockReset();
  vi.stubEnv("OPENAI_API_KEY", "sk-test-not-a-real-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/plan — happy path (mocked LLM)", () => {
  it("returns a Zod-valid hydrated plan with engine-exact budget math", async () => {
    generateObjectMock.mockResolvedValue({ object: VALID_ENRICHMENT });
    const input = validInput({ location: "Pune", theme: "garden" });

    const res = await post(input);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-plan-source")).toBe("llm");
    expect(res.headers.get("x-cache-hit")).toBe("false");

    const plan = await res.json();
    const parsed = PlanSchema.safeParse(plan);
    expect(parsed.success, JSON.stringify(parsed.error?.issues ?? [])).toBe(true);

    const sum = plan.budget.categories.reduce(
      (a: number, c: { plannedCents: number }) => a + c.plannedCents,
      0,
    );
    expect(sum).toBe(input.budgetTotalCents);
    // Engine-computed dates for model offsets + engine baseline present.
    expect(plan.timeline.length).toBeGreaterThan(5);
    expect(plan.meta.schemaVersion).toBe(1);
    expect(plan.ideas.some((idea: { source: string }) => idea.source === "rules")).toBe(true);
    expect(plan.ideas.some((idea: { source: string }) => idea.source === "llm")).toBe(true);
    expect(generateObjectMock.mock.calls[0][0].model.modelId).toBe("gpt-6-luna");
    expect(generateObjectMock.mock.calls[0][0].providerOptions?.openai?.reasoningEffort).toBe(
      "low",
    );
    expect(generateObjectMock).toHaveBeenCalledTimes(1);
  });

  it("second identical request is a cache hit (zero extra tokens)", async () => {
    generateObjectMock.mockResolvedValue({ object: VALID_ENRICHMENT });
    const input = validInput({ location: "cache-probe-city" });

    const first = await post(input);
    expect(first.headers.get("x-cache-hit")).toBe("false");
    await first.json();

    const second = await post(input);
    expect(second.status).toBe(200);
    expect(second.headers.get("x-cache-hit")).toBe("true");
    expect(generateObjectMock).toHaveBeenCalledTimes(1); // no second LLM call
    await second.json();
  });
});

describe("POST /api/plan — malformed LLM output (bounded retries → fallback)", () => {
  it("retries at most twice, then falls back to the deterministic plan", async () => {
    generateObjectMock.mockRejectedValue(new Error("NoObjectGenerated: schema mismatch"));
    const res = await post(validInput({ location: "retry-city" }));

    expect(res.status).toBe(200);
    expect(res.headers.get("x-plan-source")).toBe("fallback");
    expect(generateObjectMock).toHaveBeenCalledTimes(3); // 2 retries, then stop

    const plan = await res.json();
    expect(PlanSchema.safeParse(plan).success).toBe(true);
    const sum = plan.budget.categories.reduce(
      (a: number, c: { plannedCents: number }) => a + c.plannedCents,
      0,
    );
    expect(sum).toBe(plan.input.budgetTotalCents);
  });

  it("succeeds when the retry succeeds", async () => {
    generateObjectMock
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce({ object: VALID_ENRICHMENT });
    const res = await post(validInput({ location: "second-attempt-city" }));

    expect(res.status).toBe(200);
    expect(res.headers.get("x-plan-source")).toBe("llm");
    expect(generateObjectMock).toHaveBeenCalledTimes(2);
    await res.json();
  });

  it.each([
    [
      "provider authentication errors",
      Object.assign(new Error("Unauthorized"), { statusCode: 401 }),
    ],
    ["provider rate limits", Object.assign(new Error("Too many requests"), { statusCode: 429 })],
    ["provider timeouts", Object.assign(new Error("Request timed out"), { name: "TimeoutError" })],
  ])("labels %s as engine fallback without exposing provider details", async (_label, error) => {
    generateObjectMock.mockRejectedValue(error);

    const res = await post(validInput({ location: "provider-failure-city" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-plan-source")).toBe("fallback");
    expect(generateObjectMock).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(await res.json())).not.toMatch(
      /Unauthorized|Too many requests|timed out/,
    );
  });
});

describe("POST /api/plan — keyless mode (Gate 1/2 must run without any key)", () => {
  it("no OPENAI_API_KEY → deterministic fallback, model never invoked", async () => {
    vi.unstubAllEnvs();
    delete process.env.OPENAI_API_KEY;

    const res = await post(validInput({ location: "keyless-city" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-plan-source")).toBe("fallback");
    expect(generateObjectMock).not.toHaveBeenCalled();

    const plan = await res.json();
    expect(PlanSchema.safeParse(plan).success).toBe(true);
    expect(plan.checklist.length).toBeGreaterThan(0);
    expect(plan.ideas.length).toBeGreaterThan(0);
    expect(plan.ideas.every((idea: { source: string }) => idea.source === "rules")).toBe(true);
  });
});

describe("POST /api/plan — validation (400s, never 500)", () => {
  it("past event date → 400 with field-level issues", async () => {
    const res = await post(validInput({ eventDate: future(-1) }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("validation_failed");
    expect(body.issues).toContain("eventDate");
  });

  it("unknown vertical / zero guests / negative budget → 400", async () => {
    const bad = [
      { ...validInput(), vertical: "funeral" },
      { ...validInput(), guestCount: 0 },
      { ...validInput(), budgetTotalCents: -1 },
      { ...validInput(), currency: "dollars" },
    ];
    for (const input of bad) {
      const res = await post(input);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("validation_failed");
    }
  });

  it("guest count boundary: 10,000 accepted, 10,001 → 400", async () => {
    generateObjectMock.mockResolvedValue({ object: VALID_ENRICHMENT });
    const max = await post(validInput({ guestCount: 10_000 }));
    expect(max.status).toBe(200);
    expect((await max.json()).input.guestCount).toBe(10_000);

    const over = await post(validInput({ guestCount: 10_001 }));
    expect(over.status).toBe(400);
    expect((await over.json()).error).toBe("validation_failed");
  });

  it("malformed JSON body → 400, not a crash", async () => {
    const res = await post("{not json", nextIp(), true);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("validation_failed");
  });
});

describe("POST /api/plan — rate limiting", () => {
  it("11th request from one IP → 429 with Retry-After; others unaffected", async () => {
    generateObjectMock.mockRejectedValue(new Error("whatever")); // fast fallback path
    const ip = nextIp();

    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const res = await post(validInput({ location: `rate-city-${i}` }), ip);
      if (res.status === 429) {
        expect(res.headers.get("retry-after")).toBeTruthy();
      }
      statuses.push(res.status);
      await res.arrayBuffer();
    }

    expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
    expect(statuses[10]).toBe(429);

    // A different IP is still served.
    const other = await post(validInput({ location: "other-ip-city" }));
    expect(other.status).toBe(200);
    await other.arrayBuffer();
  });
});
