import { describe, expect, it } from "vitest";
import {
  buildBudget,
  buildBudgetWithWeights,
  getAllocation,
  totalVarianceCents,
  varianceCents,
} from "@/lib/rules-engine/budget";
import {
  buildTimeline,
  dueDateFor,
  mergeTasks,
  runwayDays,
  TIMELINE_TEMPLATES,
} from "@/lib/rules-engine/timeline";
import { buildChecklist } from "@/lib/rules-engine/checklist";
import { buildIdeas } from "@/lib/rules-engine/ideas";
import { hydratePlan } from "@/lib/rules-engine/hydrate";
import { IdeaSchema, PlanInputSchema, PlanSchema, type PlanInput } from "@/lib/genai/schemas";

/**
 * Unit tests for the deterministic core (docs/Phases.md Phase 2.2/2.5).
 * No LLM, no network, no env keys — pure math & dates.
 */

const VERTICALS = ["wedding", "birthday", "community"] as const;
const BANDS = ["micro", "standard", "premium"] as const;

const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

function makeInput(overrides: Partial<PlanInput> = {}): PlanInput {
  return PlanInputSchema.parse({
    vertical: "wedding",
    eventDate: future(180),
    guestCount: 100,
    budgetTotalCents: 5_000_000,
    budgetBand: "standard",
    ...overrides,
  });
}

describe("rules-engine/budget", () => {
  describe("getAllocation", () => {
    it("weights always sum to exactly 100 for every vertical × band", () => {
      for (const v of VERTICALS) {
        for (const b of BANDS) {
          const a = getAllocation(v, b);
          const sum = a.weights.reduce((acc, w) => acc + w.pct, 0);
          expect(sum, `${v}/${b} sums to ${sum}`).toBe(100);
          expect(a.weights.every((w) => w.pct >= 0)).toBe(true);
          expect(a.weights.every((w) => w.key.length > 0 && w.label.length > 0)).toBe(true);
        }
      }
    });

    it("contingency stays within sane bounds per vertical/band", () => {
      for (const v of VERTICALS) {
        for (const b of BANDS) {
          const pct = getAllocation(v, b).contingencyPct;
          expect(pct).toBeGreaterThanOrEqual(0);
          expect(pct).toBeLessThanOrEqual(30);
        }
      }
    });
  });

  describe("buildBudget", () => {
    it("category cents sum EXACTLY to the total — no drift (framing, rounding, edge totals)", () => {
      const totals = [0, 1, 99, 100, 12_345, 199_999, 5_000_000, 999_999_999];
      for (const v of VERTICALS) {
        for (const b of BANDS) {
          for (const total of totals) {
            const budget = buildBudget(v, b, total);
            const sum = budget.categories.reduce((acc, c) => acc + c.plannedCents, 0);
            expect(sum, `${v}/${b}/${total} => ${sum}`).toBe(total);
            // Contingency row exists and matches the declared pct (±1 cent rounding).
            const contingency = budget.categories.find((c) => c.key === "contingency");
            expect(contingency).toBeDefined();
            const expected = Math.round((total * budget.contingencyPct) / 100);
            expect(Math.abs((contingency?.plannedCents ?? 0) - expected)).toBeLessThanOrEqual(1);
          }
        }
      }
    });

    it("rejects non-integer or negative totals (float cents are a data bug)", () => {
      expect(() => buildBudget("wedding", "standard", 10.5)).toThrow();
      expect(() => buildBudget("wedding", "standard", -1)).toThrow();
    });

    it("every row is a non-negative integer with a label", () => {
      const budget = buildBudget("community", "premium", 1_234_567);
      for (const c of budget.categories) {
        expect(Number.isInteger(c.plannedCents)).toBe(true);
        expect(c.plannedCents).toBeGreaterThanOrEqual(0);
        expect(c.label.length).toBeGreaterThan(0);
      }
    });
  });

  describe("buildBudgetWithWeights (LLM percentage proposals)", () => {
    it("normalizes arbitrary model percentages and still sums exactly to the total", () => {
      const cases = [
        [
          { key: "venue", label: "Venue", pct: 50 },
          { key: "catering", label: "Catering", pct: 50 },
        ],
        [
          { key: "a", label: "A", pct: 1 },
          { key: "b", label: "B", pct: 99 },
        ],
        // Wild model output: doesn't sum to 100, has zero and above-100 values.
        [
          { key: "x", label: "X", pct: 0 },
          { key: "y", label: "Y", pct: 250 },
          { key: "z", label: "Z", pct: 7 },
        ],
      ];
      for (const rows of cases) {
        for (const total of [0, 1, 777, 3_000_000]) {
          const budget = buildBudgetWithWeights(rows, 10, total);
          const sum = budget.categories.reduce((acc, c) => acc + c.plannedCents, 0);
          expect(sum).toBe(total);
        }
      }
    });

    it("falls back to canonical labels from the provided map", () => {
      const budget = buildBudgetWithWeights(
        [{ key: "venue", label: "!!!", pct: 100 }],
        0,
        100_000,
        new Map([["venue", "Venue"]]),
      );
      expect(budget.categories[0]?.label).toBe("Venue");
    });

    it("throws on empty weights", () => {
      expect(() => buildBudgetWithWeights([], 10, 1000)).toThrow();
    });
  });

  describe("variance", () => {
    it("varianceCents: null actual → 0; under → negative; over → positive", () => {
      expect(varianceCents(1000, null)).toBe(0);
      expect(varianceCents(1000, 900)).toBe(-100);
      expect(varianceCents(1000, 1100)).toBe(100);
    });

    it("totalVarianceCents aggregates rows with actuals only", () => {
      const budget = buildBudget("wedding", "standard", 1_000_000);
      budget.categories[0]!.actualCents = budget.categories[0]!.plannedCents + 5_000;
      budget.categories[1]!.actualCents = budget.categories[1]!.plannedCents - 2_000;
      expect(totalVarianceCents(budget)).toBe(3_000);
      expect(totalVarianceCents(buildBudget("wedding", "standard", 1_000_000))).toBe(0);
    });
  });
});

describe("rules-engine/ideas", () => {
  it("always returns vertical-specific ideas and labels them as rules", () => {
    for (const vertical of VERTICALS) {
      const ideas = buildIdeas(makeInput({ vertical }));
      expect(ideas.length).toBeGreaterThan(0);
      expect(ideas.every((idea) => idea.source === "rules")).toBe(true);
      expect(
        ideas.some((idea) =>
          idea.title
            .toLowerCase()
            .includes(
              vertical === "community"
                ? "neighborhood"
                : vertical === "birthday"
                  ? "milestone"
                  : "shared story",
            ),
        ),
      ).toBe(true);
    }
  });

  it("conditions ideas on budget, guest count, outdoor status and personalization", () => {
    const ideas = buildIdeas(
      makeInput({
        budgetBand: "micro",
        guestCount: 200,
        isOutdoor: true,
        theme: "garden",
        culturalNotes: "family traditions",
      }),
    );
    expect(ideas.map((idea) => idea.title)).toEqual(
      expect.arrayContaining([
        "Make one detail together",
        "Prepare a clear rain-plan cue",
        "Set a simple arrival flow",
        "Carry your theme into one signature moment",
      ]),
    );
    expect(ideas.find((idea) => idea.title.includes("signature"))?.rationale).toContain("garden");
  });
});

describe("saved plan validation", () => {
  it("accepts imported plans for past events while generation input remains future-only", () => {
    const plan = hydratePlan({ input: makeInput(), enrichment: null, cacheHit: false });
    const savedPlan = { ...plan, input: { ...plan.input, eventDate: future(-10) } };
    expect(PlanInputSchema.safeParse(savedPlan.input).success).toBe(false);
    expect(PlanSchema.safeParse(savedPlan).success).toBe(true);
  });

  it("migrates legacy model ideas without provenance as model-enriched", () => {
    const result = IdeaSchema.parse({
      id: "00000000-0000-4000-8000-000000000001",
      title: "A small moment",
      rationale: "Tie it to the event theme.",
      tags: ["Personal touches"],
    });
    expect(result.source).toBe("llm");
  });
});

describe("rules-engine/timeline", () => {
  it("all due dates are ≤ event date, offsets ≥ 0, sorted descending", () => {
    for (const v of VERTICALS) {
      const eventDate = future(200);
      const tasks = buildTimeline(v, eventDate);
      const eventTs = new Date(eventDate).getTime();
      let prev = Number.POSITIVE_INFINITY;
      expect(tasks.length).toBeGreaterThanOrEqual(TIMELINE_TEMPLATES[v].length);
      for (const t of tasks) {
        expect(new Date(t.dueDate).getTime()).toBeLessThanOrEqual(eventTs);
        expect(t.offsetDays).toBeGreaterThanOrEqual(0);
        expect(t.id).toMatch(/^[0-9a-f-]{36}$/i);
        expect(t.offsetDays).toBeLessThanOrEqual(prev);
        prev = t.offsetDays;
      }
    }
  });

  it("runway clamping: a 14-day wedding runway never yields T > 14, but keeps all tasks", () => {
    const eventDate = future(14);
    const tasks = buildTimeline("wedding", eventDate);
    expect(tasks.every((t) => t.offsetDays <= 14)).toBe(true);
    expect(tasks.length).toBeGreaterThanOrEqual(TIMELINE_TEMPLATES.wedding.length);
    // Clamped tasks collapse onto "as soon as possible" (T-14) rather than vanishing.
    expect(tasks.some((t) => t.offsetDays === 14)).toBe(true);
  });

  it("past or same-day event throws (cannot plan backwards from now)", () => {
    expect(() => buildTimeline("wedding", future(-1))).toThrow();
    expect(runwayDays(future(-1))).toBe(0);
  });

  it("outdoor contingency triggers exactly when isOutdoor", () => {
    const eventDate = future(60);
    const outdoor = buildTimeline("birthday", eventDate, { isOutdoor: true });
    const indoor = buildTimeline("birthday", eventDate, { isOutdoor: false });
    expect(outdoor.some((t) => t.title.includes("rain backup"))).toBe(true);
    expect(indoor.some((t) => t.title.includes("rain backup"))).toBe(false);
    expect(outdoor.length).toBeGreaterThan(indoor.length);
  });

  it("short runway (< 14 days) injects the compressed-planning task", () => {
    const tasks = buildTimeline("community", future(10));
    expect(tasks.some((t) => t.title.includes("Compress planning"))).toBe(true);
    expect(
      buildTimeline("community", future(60)).some((t) => t.title.includes("Compress planning")),
    ).toBe(false);
  });

  it("dueDateFor computes exact offset math", () => {
    const eventDate = future(100);
    expect(new Date(dueDateFor(eventDate, 30)).getTime()).toBe(
      new Date(eventDate).getTime() - 30 * 86_400_000,
    );
    expect(dueDateFor(eventDate, 0)).toBe(new Date(eventDate).toISOString());
  });

  it("mergeTasks dedupes model proposals against baseline and caps additions", () => {
    const eventDate = future(120);
    const base = buildTimeline("wedding", eventDate);
    const duplicate = base.map((t) => ({
      title: t.title,
      offsetDays: t.offsetDays,
      phase: t.phase,
    }));
    const merged = mergeTasks(eventDate, base, duplicate);
    expect(merged.length).toBe(base.length); // identical titles+offsets deduped

    const extras = Array.from({ length: 100 }, (_, i) => ({
      title: `Model idea ${i}`,
      offsetDays: 10 + i,
      phase: "planning" as const,
    }));
    const capped = mergeTasks(eventDate, base, extras, 40);
    expect(capped.length).toBe(base.length + 40);
    // Dates still engine-computed and within runway after merge.
    const eventTs = new Date(eventDate).getTime();
    expect(capped.every((t) => new Date(t.dueDate).getTime() <= eventTs)).toBe(true);
  });
});

describe("rules-engine/checklist", () => {
  it("every vertical gets categories with items, questions and docs", () => {
    for (const v of VERTICALS) {
      const checklist = buildChecklist(v);
      expect(checklist.length).toBeGreaterThanOrEqual(3);
      for (const cat of checklist) {
        expect(cat.category.length).toBeGreaterThan(0);
        expect(cat.items.length).toBeGreaterThan(0);
        for (const item of cat.items) {
          expect(item.id).toMatch(/^[0-9a-f-]{36}$/i);
          expect(item.status).toBe("to_contact");
          expect(item.questions.length).toBeGreaterThan(0);
          expect(item.docs.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("low budget (< $2000) injects DIY template; outdoor injects weather plan", () => {
    const low = buildChecklist("wedding", { lowBudget: true });
    expect(low.some((c) => c.category === "DIY & Budget Options")).toBe(true);
    expect(
      buildChecklist("wedding", { lowBudget: false }).some(
        (c) => c.category === "DIY & Budget Options",
      ),
    ).toBe(false);

    const outdoor = buildChecklist("community", { isOutdoor: true });
    expect(outdoor.some((c) => c.category === "Weather Contingency")).toBe(true);
    expect(
      buildChecklist("community", { isOutdoor: false }).some(
        (c) => c.category === "Weather Contingency",
      ),
    ).toBe(false);
  });
});

describe("rules-engine/hydrate (baseline ⊕ enrichment merge)", () => {
  it("fallback plan (no LLM): valid, complete, source=fallback", () => {
    const input = makeInput();
    const plan = hydratePlan({ input, enrichment: null, cacheHit: false });
    expect(plan.meta.source).toBe("fallback");
    expect(plan.meta.schemaVersion).toBe(1);
    const sum = plan.budget.categories.reduce((a, c) => a + c.plannedCents, 0);
    expect(sum).toBe(input.budgetTotalCents);
    expect(plan.timeline.length).toBeGreaterThan(0);
    expect(plan.checklist.length).toBeGreaterThan(0);
    expect(plan.ideas.length).toBeGreaterThan(0);
    expect(plan.ideas.every((idea) => idea.source === "rules")).toBe(true);
  });

  it("engine wins on math: LLM budget percentages are re-priced to exact cents", () => {
    const input = makeInput({ budgetTotalCents: 777_777 });
    const plan = hydratePlan({
      input,
      enrichment: {
        // Deliberately wrong-on-purpose model math: sums to 300, has zeros and junk keys.
        budgetPct: [
          { key: "venue", pct: 150 },
          { key: "catering", pct: 100 },
          { key: "made_up_key", pct: 50 },
        ],
        tasks: [],
        ideas: [{ title: "T", rationale: "R", tags: [] }],
      },
      cacheHit: false,
    });
    expect(plan.meta.source).toBe("llm");
    const sum = plan.budget.categories.reduce((a, c) => a + c.plannedCents, 0);
    expect(sum).toBe(input.budgetTotalCents);
    // Canonical label restored for known key.
    expect(plan.budget.categories.find((c) => c.key === "venue")?.label).toBe("Venue");
    expect(plan.ideas.some((idea) => idea.title === "T" && idea.source === "llm")).toBe(true);
    expect(plan.ideas.some((idea) => idea.source === "rules")).toBe(true);
  });

  it("all-zero model budget proposal degrades to baseline instead of throwing", () => {
    const input = makeInput();
    const plan = hydratePlan({
      input,
      enrichment: { budgetPct: [{ key: "venue", pct: 0 }], tasks: [], ideas: [] },
      cacheHit: false,
    });
    const sum = plan.budget.categories.reduce((a, c) => a + c.plannedCents, 0);
    expect(sum).toBe(input.budgetTotalCents);
    expect(plan.meta.source).toBe("llm");
  });

  it("engine contingency triggers fire regardless of what the model returned", () => {
    const input = makeInput({ vertical: "birthday", budgetTotalCents: 150_000, isOutdoor: true });
    const plan = hydratePlan({
      input,
      enrichment: { budgetPct: [], tasks: [], ideas: [] },
      cacheHit: false,
    });
    expect(plan.checklist.some((c) => c.category === "DIY & Budget Options")).toBe(true);
    expect(plan.checklist.some((c) => c.category === "Weather Contingency")).toBe(true);
    expect(plan.timeline.some((t) => t.title.includes("rain backup"))).toBe(true);
  });

  it("model task proposals land with engine-computed dates within the runway", () => {
    const input = makeInput({ eventDate: future(90) });
    const plan = hydratePlan({
      input,
      enrichment: {
        budgetPct: [],
        tasks: [{ title: "Book the surprise singer", offsetDays: 45, phase: "booking" }],
        ideas: [],
      },
      cacheHit: true,
    });
    const found = plan.timeline.find((t) => t.title === "Book the surprise singer");
    expect(found).toBeDefined();
    expect(found!.offsetDays).toBe(45);
    expect(new Date(found!.dueDate).getTime()).toBeLessThanOrEqual(
      new Date(input.eventDate).getTime(),
    );
    expect(plan.meta.cacheHit).toBe(true);
  });
});
