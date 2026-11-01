import { describe, expect, it } from "vitest";
import { formatDate } from "@/lib/format";
import { answerFromPlan, buildAskContext, deriveFacts } from "@/lib/rules-engine/ask";
import { hydratePlan } from "@/lib/rules-engine/hydrate";
import { createRateLimit } from "@/lib/security/rate-limit";
import type { AskContext, PlanInput } from "@/lib/genai/schemas";

/**
 * Unit tests for the deterministic assistant responder (Phases 4.7).
 * Every assertion pins a figure that MUST come from the snapshot — proof that
 * the keyless assistant cannot hallucinate numbers.
 */

const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
const numbersIn = (text: string) =>
  (text.match(/[\d][\d,]*/g) ?? []).map((number) => number.replace(/,+$/, ""));

function ctx(overrides: Partial<AskContext> = {}): AskContext {
  return {
    vertical: "wedding",
    eventDate: future(180),
    guestCount: 100,
    budgetTotalCents: 5_000_000, // $50,000
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
    vendors: [
      { category: "Venue", label: "Banquet hall", status: "to_contact" },
      { category: "Catering", label: "Caterer A", status: "booked" },
    ],
    ideaTitles: [],
    ...overrides,
  };
}

describe("answerFromPlan — budget & categories", () => {
  it("quotes the snapshot total, band and reserve for budget questions", () => {
    const a = answerFromPlan("What's my budget?", ctx());
    expect(a).toContain("$50,000");
    expect(a).toContain("standard band");
    expect(a).toContain("8%");
  });

  it("answers a named category with its planned amount and share", () => {
    const a = answerFromPlan("How much is catering?", ctx());
    expect(a).toContain("Catering");
    expect(a).toContain("$15,000"); // 1_500_000 cents — engine figure only
    expect(a).toContain("30%"); // 1.5M / 5M — computed here, never by a model
  });

  it("reports over-budget health once actuals exist", () => {
    const withActuals = ctx({
      categories: [
        { label: "Venue", plannedCents: 2_000_000, actualCents: 4_000_000 },
        { label: "Catering", plannedCents: 1_500_000, actualCents: 1_500_000 },
      ],
    }); // actuals sum 5_500_000 > 5_000_000 total → over by $5,000
    const a = answerFromPlan("Is my budget okay?", withActuals);
    expect(a).toContain("over budget");
  });
});

describe("answerFromPlan — timeline, progress, vendors", () => {
  it("lists the soonest open tasks for time questions", () => {
    const a = answerFromPlan("What's next?", ctx());
    expect(a).toContain("Next up:");
    expect(a).toContain("Send invitations"); // T−21 is sooner than T−120
    expect(a).toContain("Book the venue"); // both open tasks fit the top-3 window
  });

  it("reports missing timeline data instead of claiming every task is done", () => {
    const answer = answerFromPlan("What's next?", ctx({ tasks: [] }));
    expect(answer).toContain("doesn't include timeline information");
    expect(numbersIn(answer)).toEqual([]);
  });

  it("handles incomplete snapshots with empty plan collections", () => {
    const sparse = ctx({
      tasks: [],
      categories: [],
      vendors: [],
      ideaTitles: [],
      guestCount: 1,
      budgetTotalCents: 0,
      contingencyPct: 0,
    });
    const next = answerFromPlan("What's next?", sparse);
    const ideas = answerFromPlan("Give me ideas", sparse);

    expect(next).toContain("doesn't include timeline information");
    expect(ideas).toContain("engine-only mode");
    expect(numbersIn(next)).toEqual([]);
    expect(numbersIn(ideas)).toEqual([]);
  });

  it("answers progress with task and vendor counts", () => {
    const a = answerFromPlan("How many tasks are left?", ctx());
    expect(a).toBe("0 of 2 tasks done and 1 of 2 vendors booked.");
  });

  it("summarizes vendor statuses and nudges the next one", () => {
    const a = answerFromPlan("Who should I book first?", ctx());
    expect(a).toContain("2 vendors tracked");
    expect(a).toContain("1 booked");
    expect(a).toContain("Banquet hall");
  });

  it("greets with a capability statement", () => {
    const a = answerFromPlan("hello", ctx());
    expect(a).toContain("budget, timeline and vendor checklist");
  });
});

describe("answerFromPlan — guests, weather, ideas, fallback", () => {
  it("computes per-guest spend from the snapshot", () => {
    const a = answerFromPlan("How much per guest?", ctx());
    expect(a).toContain("100 guests");
    expect(a).toContain("$500"); // 5_000_000 / 100
  });

  it("counts weather tasks only when the event is outdoor", () => {
    const outdoor = ctx({
      isOutdoor: true,
      tasks: [
        { title: "Book a tent", dueDate: future(30), offsetDays: 30, done: false },
        { title: "Indoor backup walkthrough", dueDate: future(7), offsetDays: 7, done: false },
      ],
    });
    expect(answerFromPlan("What about rain?", outdoor)).toContain("1 weather-contingency task");
    expect(answerFromPlan("What about rain?", ctx())).toContain("marked indoor");
  });

  it("is honest when there are no ideas (keyless mode)", () => {
    const a = answerFromPlan("Give me theme ideas", ctx());
    expect(a).toContain("engine-only mode");
    expect(a).toContain("API key");
  });

  it("falls back to capability help instead of inventing an answer", () => {
    const a = answerFromPlan("What is the airspeed velocity of a swallow?", ctx());
    expect(a).toContain("I can answer from this plan");
    expect(a).toContain("What's next?");
    expect(numbersIn(a)).toEqual([]);
  });

  it("uses snapshot numbers in budget and guest answers", () => {
    const snapshot = ctx({ guestCount: 42, budgetTotalCents: 420_000 });
    const budget = answerFromPlan("What's my budget?", snapshot);
    const guests = answerFromPlan("How much per guest?", snapshot);
    expect(budget).toContain("$4,200");
    expect(guests).toContain("42 guests");
    expect(guests).toContain("$100");
  });

  it("never quotes a number that is not in the snapshot", () => {
    const questions = [
      "Tell me about the venue",
      "What's next?",
      "How many tasks are left?",
      "random gibberish question",
    ];
    const snapshotNumbers = new Set([
      // money + percentages (regex captures digits without the % sign) + counts
      "50,000",
      "20,000",
      "15,000",
      "30",
      "40",
      "8",
      "2",
      "1",
      "0",
      "100",
      "500",
      "21",
      "120",
    ]);
    // Timeline answers legitimately quote due dates that ARE in the snapshot.
    const c = ctx();
    for (const t of c.tasks) {
      for (const m of numbersIn(formatDate(t.dueDate))) snapshotNumbers.add(m);
    }
    for (const q of questions) {
      const answer = answerFromPlan(q, c);
      for (const n of numbersIn(answer)) {
        expect(snapshotNumbers.has(n), `"${n}" in answer to "${q}"`).toBe(true);
      }
    }
  });

  it("accepts a comma-terminated day number from an upcoming task date", () => {
    const dueDate = new Date(2026, 10, 22, 12).toISOString();
    const snapshot = ctx({
      tasks: [{ title: "Confirm venue access", dueDate, offsetDays: 1, done: false }],
    });
    const answer = answerFromPlan("What's next?", snapshot);
    const evidence = new Set([...numbersIn(formatDate(dueDate)), "1"]);

    expect(answer).toContain("Confirm venue access");
    expect(numbersIn(answer)).toContain("22");
    for (const number of numbersIn(answer)) expect(evidence.has(number)).toBe(true);
  });
});

describe("deriveFacts & buildAskContext", () => {
  it("derives per-guest, next task and counts for the LLM prompt", () => {
    const facts = deriveFacts(ctx());
    expect(facts.join("\n")).toContain("per_guest: $500");
    expect(facts.join("\n")).toContain("next_task: Send invitations");
    expect(facts.join("\n")).toContain("tasks: 0 done, 2 open of 2");
    expect(facts.join("\n")).toContain("vendors: 1 booked of 2");
  });

  it("builds a Zod-valid snapshot from a hydrated fallback plan", () => {
    const input: PlanInput = {
      vertical: "community",
      eventDate: future(60),
      guestCount: 250,
      budgetTotalCents: 2_000_000,
      currency: "USD",
      budgetBand: "micro",
      isOutdoor: true,
    } as PlanInput;
    const plan = hydratePlan({ input, enrichment: null, cacheHit: false });

    const snapshot = buildAskContext(plan);
    expect(snapshot.categories.length).toBe(plan.budget.categories.length);
    expect(snapshot.tasks.length).toBe(plan.timeline.length);
    expect(snapshot.vendors.length).toBeGreaterThan(0);
    expect(snapshot.vertical).toBe("community");

    // The responder works end-to-end on the built snapshot.
    expect(answerFromPlan("What's next?", snapshot)).toContain("Next up:");
  });
});

describe("createRateLimit factory", () => {
  it("allows up to the limit, then blocks with Retry-After", () => {
    const limiter = createRateLimit(3, 60_000);
    expect(limiter.check("1.1.1.1").allowed).toBe(true);
    expect(limiter.check("1.1.1.1").allowed).toBe(true);
    expect(limiter.check("1.1.1.1").allowed).toBe(true);
    const blocked = limiter.check("1.1.1.1");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    // Other IPs are unaffected.
    expect(limiter.check("2.2.2.2").allowed).toBe(true);
  });

  it("resets after the window expires", async () => {
    const limiter = createRateLimit(1, 50);
    expect(limiter.check("3.3.3.3").allowed).toBe(true);
    expect(limiter.check("3.3.3.3").allowed).toBe(false);
    await new Promise((r) => setTimeout(r, 60));
    expect(limiter.check("3.3.3.3").allowed).toBe(true);
  });

  it("keeps instances isolated (no shared module state)", () => {
    const a = createRateLimit(1, 60_000);
    const b = createRateLimit(1, 60_000);
    expect(a.check("4.4.4.4").allowed).toBe(true);
    expect(a.check("4.4.4.4").allowed).toBe(false);
    expect(b.check("4.4.4.4").allowed).toBe(true);
  });
});
