import { randomUUID } from "node:crypto";
import {
  type Budget,
  type ChecklistCategory,
  type Idea,
  type LlmEnrichment,
  type Plan,
  type PlanInput,
} from "@/lib/genai/schemas";
import { buildBudget, buildBudgetWithWeights, getAllocation } from "@/lib/rules-engine/budget";
import { buildChecklist } from "@/lib/rules-engine/checklist";
import { buildIdeas } from "@/lib/rules-engine/ideas";
import { buildTimeline, mergeTasks } from "@/lib/rules-engine/timeline";
import { LOW_BUDGET_CENTS } from "@/lib/config/budget";

/**
 * State hydration (docs/Architecture.md §2 step 4): merge the deterministic baseline
 * with LLM enrichment into the single Zod-valid Plan shape the store accepts.
 *
 * Merge rules:
 * - Engine wins on math: budget rows are priced by the engine from model percentages;
 *   timeline dates are computed from offsets; the model never supplies cents or dates.
 * - Contingency triggers (isOutdoor, low budget) always fire regardless of the model.
 * - On `enrichment === null` the baseline stands alone (deterministic fallback plan).
 */

export interface HydrateOptions {
  input: PlanInput;
  enrichment: LlmEnrichment | null;
  cacheHit: boolean;
}

function toIdeas(enrichment: LlmEnrichment | null): Idea[] {
  if (!enrichment) return [];
  return enrichment.ideas.map((i) => ({
    id: randomUUID(),
    title: i.title,
    rationale: i.rationale,
    tags: i.tags,
    source: "llm" as const,
  }));
}

/**
 * Build the complete plan. Pure and synchronous: given the same input and
 * enrichment it produces the same structure (ids aside), which keeps tests simple.
 */
export function hydratePlan({ input, enrichment, cacheHit }: HydrateOptions): Plan {
  const { vertical, budgetBand, budgetTotalCents, isOutdoor } = input;
  const lowBudget = budgetTotalCents < LOW_BUDGET_CENTS;

  // --- Budget: engine prices either its own baseline or model percentages. ---
  // Robustness: a schema-valid but useless proposal (all zeros / empty) must not
  // break generation — fall back to the deterministic baseline instead.
  const proposals = enrichment ? enrichment.budgetPct.filter((p) => p.pct > 0) : [];
  let budget: Budget;
  if (proposals.length > 0) {
    const baseline = getAllocation(vertical, budgetBand);
    const labels = new Map(baseline.weights.map((w) => [w.key, w.label]));
    // Model proposals that reference unknown keys keep their given label (safe);
    // known keys get the canonical label so the UI groups consistently.
    budget = buildBudgetWithWeights(
      proposals.map((p) => ({
        key: p.key,
        label: labels.get(p.key) ?? p.key,
        pct: p.pct,
      })),
      baseline.contingencyPct,
      budgetTotalCents,
      labels,
    );
  } else {
    budget = buildBudget(vertical, budgetBand, budgetTotalCents);
  }

  // --- Timeline: engine computes every date; model may only add proposals. ---
  const baselineTimeline = buildTimeline(vertical, input.eventDate, { isOutdoor });
  const timeline = enrichment
    ? mergeTasks(input.eventDate, baselineTimeline, enrichment.tasks)
    : baselineTimeline;

  // --- Checklist: always includes engine contingency triggers (never model-gated). ---
  const checklist: ChecklistCategory[] = buildChecklist(vertical, { isOutdoor, lowBudget });

  return {
    id: randomUUID(),
    input,
    budget,
    timeline,
    checklist,
    ideas: [...buildIdeas(input), ...toIdeas(enrichment)].slice(0, 30),
    meta: {
      generatedAt: new Date().toISOString(),
      source: enrichment ? "llm" : "fallback",
      cacheHit,
      schemaVersion: 1,
    },
  };
}
