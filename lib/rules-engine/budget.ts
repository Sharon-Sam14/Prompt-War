import type { Budget, BudgetBand, Vertical } from "@/lib/genai/schemas";
import { BAND_FACTORS, BASE_WEIGHTS, CATEGORY_LABELS, CONTINGENCY_PCT } from "@/lib/config/budget";

/**
 * Deterministic budget allocation (docs/Architecture.md §2 rule 1).
 * Pure TypeScript: no I/O, no LLM, no React. All arithmetic happens here, in integer
 * cents. The model only ever sees percentages.
 */

export interface Allocation {
  contingencyPct: number;
  /** Main category weights, normalized to sum to exactly 100. */
  weights: ReadonlyArray<{ key: string; label: string; pct: number }>;
}

/**
 * Normalize a weight map to integer percentages summing to exactly 100.
 * Remainder from rounding is assigned to the largest weights (descending order),
 * 1 cent of percentage at a time — guarantees `sum === 100` with no drift.
 */
function normalizeTo100(entries: ReadonlyArray<{ key: string; label: string; w: number }>): Array<{
  key: string;
  label: string;
  pct: number;
}> {
  const total = entries.reduce((acc, e) => acc + e.w, 0);
  if (total <= 0) throw new Error("weights must sum to a positive value");

  const scaled = entries.map((e) => ({
    key: e.key,
    label: e.label,
    pct: Math.floor((e.w / total) * 100),
  }));

  let remainder = 100 - scaled.reduce((acc, e) => acc + e.pct, 0);
  const byLargest = [...entries]
    .map((e, i) => ({ i, frac: (e.w / total) * 100 - Math.floor((e.w / total) * 100) }))
    .sort((a, b) => b.frac - a.frac);

  for (let k = 0; remainder > 0 && k < byLargest.length * 10; k++) {
    scaled[byLargest[k % byLargest.length].i].pct += 1;
    remainder -= 1;
  }
  return scaled;
}

/** Allocation table for a vertical × band. Percentages always sum to 100. */
export function getAllocation(vertical: Vertical, band: BudgetBand): Allocation {
  const labels = CATEGORY_LABELS[vertical];
  const base = BASE_WEIGHTS[vertical];
  const factors = BAND_FACTORS[band];

  const weighted = labels.map(({ key, label }) => ({
    key,
    label,
    w: base[key] * (factors[key] ?? 1),
  }));

  return {
    contingencyPct: CONTINGENCY_PCT[vertical][band],
    weights: normalizeTo100(weighted).map(({ key, label, pct }) => ({ key, label, pct })),
  };
}

/**
 * Convert a percentage split into cent-denominated budget rows.
 * Guarantees: sum(categories) + contingencyCents === totalCents (exact, no drift).
 */
export function buildBudget(vertical: Vertical, band: BudgetBand, totalCents: number): Budget {
  if (!Number.isInteger(totalCents) || totalCents < 0) {
    throw new Error("totalCents must be a non-negative integer");
  }
  const { contingencyPct, weights } = getAllocation(vertical, band);

  const contingencyCents = Math.round((totalCents * contingencyPct) / 100);
  const distributable = totalCents - contingencyCents;

  const rows = weights.map((w) => ({
    key: w.key,
    label: w.label,
    plannedCents: Math.floor((distributable * w.pct) / 100),
    actualCents: null,
  }));

  // Assign rounding remainder to the largest row so the plan sums to the exact total.
  const assigned = rows.reduce((acc, r) => acc + r.plannedCents, 0);
  const remainder = distributable - assigned;
  if (remainder !== 0) {
    const largest = rows.reduce((a, b) => (b.plannedCents > a.plannedCents ? b : a));
    largest.plannedCents += remainder;
  }

  rows.push({
    key: "contingency",
    label: "Contingency",
    plannedCents: contingencyCents,
    actualCents: null,
  });

  return { categories: rows, contingencyPct };
}

/**
 * Convert caller-supplied weights (e.g. LLM budgetPct proposals) into cent rows.
 * Weights are normalized to 100 first, so the model never needs correct math.
 * Guarantees: sum(categories) === totalCents exactly.
 */
export function buildBudgetWithWeights(
  weights: ReadonlyArray<{ key: string; label: string; pct: number }>,
  contingencyPct: number,
  totalCents: number,
  labels: ReadonlyMap<string, string> = new Map(),
): Budget {
  if (!Number.isInteger(totalCents) || totalCents < 0) {
    throw new Error("totalCents must be a non-negative integer");
  }
  if (weights.length === 0) throw new Error("weights must not be empty");

  const normalized = normalizeTo100(
    weights.map((w) => ({ key: w.key, label: w.label || w.key, w: Math.max(0, w.pct) })),
  );

  const contingencyCents = Math.round((totalCents * contingencyPct) / 100);
  const distributable = totalCents - contingencyCents;

  const rows = normalized.map((w) => ({
    key: w.key,
    label: labels.get(w.key) ?? w.label,
    plannedCents: Math.floor((distributable * w.pct) / 100),
    actualCents: null,
  }));

  const assigned = rows.reduce((acc, r) => acc + r.plannedCents, 0);
  const remainder = distributable - assigned;
  if (remainder !== 0) {
    const largest = rows.reduce((a, b) => (b.plannedCents > a.plannedCents ? b : a));
    largest.plannedCents += remainder;
  }

  rows.push({
    key: "contingency",
    label: "Contingency",
    plannedCents: contingencyCents,
    actualCents: null,
  });

  return { categories: rows, contingencyPct };
}

/** Variance for one row: negative = under budget, positive = over budget. */
export function varianceCents(plannedCents: number, actualCents: number | null): number {
  if (actualCents === null) return 0;
  return actualCents - plannedCents;
}

/** Total variance across all rows with an actual value recorded. */
export function totalVarianceCents(budget: Budget): number {
  return budget.categories.reduce(
    (acc, c) => acc + varianceCents(c.plannedCents, c.actualCents),
    0,
  );
}
