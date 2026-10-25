import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";
import { AskResponseSchema, type AskContext } from "@/lib/genai/schemas";

/**
 * Integration tests for POST /api/ask (docs/Phases.md 4.7).
 *
 * The AI SDK is MOCKED: no network, no API key, no token spend. Real code
 * under test: route orchestration, rate limiter, Zod validation, engine
 * responder, LLM retry/fallback and response labeling.
 */

vi.mock("ai", () => ({ generateObject: vi.fn() }));

import { generateObject } from "ai";

type GenerateObjectMock = Mock<(opts: { prompt: string }) => Promise<{ object: unknown }>>;
const generateObjectMock = generateObject as unknown as GenerateObjectMock;

const { POST } = await import("@/app/api/ask/route");

const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

function validContext(overrides: Partial<AskContext> = {}): AskContext {
  return {
    vertical: "wedding",
    eventDate: future(180),
    guestCount: 100,
    budgetTotalCents: 5_000_000,
    currency: "USD",
    budgetBand: "standard",
    isOutdoor: false,
    contingencyPct: 8,
    categories: [
      { label: "Venue", plannedCents: 2_000_000, actualCents: null },
      { label: "Catering", plannedCents: 1_500_000, actualCents: null },
    ],
    tasks: [
      { title: "Book the venue", dueDate: future(120), offsetDays: 120, done: false },
      { title: "Send invitations", dueDate: future(21), offsetDays: 21, done: false },
    ],
    vendors: [{ category: "Venue", label: "Banquet hall", status: "to_contact" }],
    ideaTitles: [],
    ...overrides,
  };
}

/** Each test gets a unique client IP: the route limiter is module state. */
let ipCounter = 0;
function nextIp(): string {
  ipCounter += 1;
  return `10.11.1.${ipCounter}`;
}

function post(body: unknown, ip = nextIp(), raw = false): Promise<Response> {
  return POST(
    new NextRequest("http://localhost/api/ask", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: raw ? String(body) : JSON.stringify(body),
    }),
  );
}

function askBody(question: string, context = validContext()): unknown {
  return { question, context };
}

const LLM_ANSWER = { answer: "Your next task is sending invitations, due three weeks out." };

beforeEach(() => {
  generateObjectMock.mockReset();
  vi.stubEnv("OPENAI_API_KEY", "sk-test-not-a-real-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/ask — keyless engine mode (Gate 1/2)", () => {
  it("no OPENAI_API_KEY → deterministic engine answer, model never invoked", async () => {
    vi.unstubAllEnvs();
    delete process.env.OPENAI_API_KEY;

    const res = await post(askBody("How much is catering?"));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-answer-source")).toBe("engine");
    expect(generateObjectMock).not.toHaveBeenCalled();

    const body = await res.json();
    const parsed = AskResponseSchema.safeParse(body);
    expect(parsed.success, JSON.stringify(parsed.error?.issues ?? [])).toBe(true);
    expect(body.source).toBe("engine");
    expect(body.answer).toContain("Catering");
    expect(body.answer).toContain("$15,000");
  });

  it("falls back to the engine answer when the model fails twice", async () => {
    generateObjectMock.mockRejectedValue(new Error("NoObjectGenerated"));

    const res = await post(askBody("What's next?"));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-answer-source")).toBe("engine");
    expect(generateObjectMock).toHaveBeenCalledTimes(3); // 2 retries, then stop

    const body = await res.json();
    expect(body.answer).toContain("Next up:");
  });
});

describe("POST /api/ask — model mode (mocked LLM)", () => {
  it("returns the model answer labeled as llm", async () => {
    generateObjectMock.mockResolvedValue({ object: LLM_ANSWER });

    const res = await post(askBody("What should I do first?"));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-answer-source")).toBe("llm");

    const body = await res.json();
    expect(AskResponseSchema.safeParse(body).success).toBe(true);
    expect(body.source).toBe("llm");
    expect(body.answer).toBe(LLM_ANSWER.answer);
    expect(generateObjectMock).toHaveBeenCalledTimes(1);
  });

  it("identical question + snapshot is a cache hit (zero extra tokens)", async () => {
    generateObjectMock.mockResolvedValue({ object: LLM_ANSWER });
    const context = validContext();

    const first = await post(askBody("What should I do first?", context));
    expect(first.headers.get("x-cache-hit")).toBeNull();
    await first.json();

    const second = await post(askBody("What should I do first?", context));
    expect(second.status).toBe(200);
    expect(second.headers.get("x-cache-hit")).toBe("true");
    expect(generateObjectMock).toHaveBeenCalledTimes(1);
    await second.json();
  });

  it("uses recent history, asks one clarifying question, and returns contextual suggestions", async () => {
    generateObjectMock.mockResolvedValue({ object: LLM_ANSWER });
    const res = await post({
      question: "What about decor?",
      history: [
        { role: "user", text: "We are planning a celebration" },
        { role: "assistant", text: "I can help with this plan." },
      ],
      context: validContext({ isOutdoor: true }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.followUp).toBe("What theme or mood are you aiming for?");
    expect(body.suggestions).toHaveLength(3);
    expect(body.suggestions[0]).toBe("What is my rain plan?");
    expect(generateObjectMock.mock.calls[0][0].prompt).toContain("Recent conversation");
    expect(generateObjectMock.mock.calls[0][0].prompt).toContain(
      "user: We are planning a celebration",
    );
  });
});

describe("POST /api/ask — validation (400s, never 500)", () => {
  it("empty / oversized question → 400 with field-level issues", async () => {
    for (const question of ["", "   ", "x".repeat(501)]) {
      const res = await post(askBody(question));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("validation_failed");
    }
  });

  it("invalid context (bad vertical, zero guests) → 400", async () => {
    const bad = [
      validContext({ vertical: "funeral" as unknown as AskContext["vertical"] }),
      validContext({ guestCount: 0 }),
      validContext({ categories: [] }),
    ];
    for (const context of bad) {
      const res = await post(askBody("hello", context));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("validation_failed");
    }
  });

  it("malformed JSON body → 400, not a crash", async () => {
    const res = await post("{not json", nextIp(), true);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("validation_failed");
  });

  it("rejects more than three history messages", async () => {
    const history = Array.from({ length: 4 }, (_, index) => ({
      role: "user",
      text: `Turn ${index}`,
    }));
    const res = await post({ question: "What's next?", history, context: validContext() });
    expect(res.status).toBe(400);
    expect((await res.json()).issues).toContain("history");
  });
});

describe("POST /api/ask — rate limiting", () => {
  it("31st request from one IP → 429 with Retry-After; others unaffected", async () => {
    vi.unstubAllEnvs();
    delete process.env.OPENAI_API_KEY; // fast engine path
    const ip = nextIp();

    const statuses: number[] = [];
    for (let i = 0; i < 31; i++) {
      const res = await post(askBody("What's next?"), ip);
      if (res.status === 429) {
        expect(res.headers.get("retry-after")).toBeTruthy();
      }
      statuses.push(res.status);
      await res.arrayBuffer();
    }

    expect(statuses.slice(0, 30).every((s) => s === 200)).toBe(true);
    expect(statuses[30]).toBe(429);

    const other = await post(askBody("What's next?"));
    expect(other.status).toBe(200);
    await other.arrayBuffer();
  });
});
