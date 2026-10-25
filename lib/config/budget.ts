import type { BudgetBand, Vertical } from "@/lib/genai/schemas";

/**
 * Budget templates (v2 spec §2.2 — all templates live in config/data files,
 * the engine only reads them): per-vertical category labels and base weights,
 * per-band re-weighting factors, contingency reserve percentages, and the
 * low-budget threshold that triggers DIY contingency content. Pure data.
 */

export interface BandFactors {
  [key: string]: number;
}

export const CATEGORY_LABELS: Record<Vertical, ReadonlyArray<{ key: string; label: string }>> = {
  wedding: [
    { key: "venue", label: "Venue" },
    { key: "catering", label: "Catering" },
    { key: "decor", label: "Décor" },
    { key: "entertainment", label: "Entertainment" },
    { key: "attire", label: "Attire" },
    { key: "photography", label: "Photography" },
    { key: "transport", label: "Transport" },
  ],
  birthday: [
    { key: "venue", label: "Venue" },
    { key: "catering", label: "Catering" },
    { key: "decor", label: "Décor" },
    { key: "entertainment", label: "Entertainment" },
    { key: "photography", label: "Photography" },
    { key: "transport", label: "Transport" },
  ],
  community: [
    { key: "venue", label: "Venue" },
    { key: "catering", label: "Catering" },
    { key: "decor", label: "Décor" },
    { key: "entertainment", label: "Program & Entertainment" },
    { key: "transport", label: "Transport & Logistics" },
    { key: "marketing", label: "Outreach & Marketing" },
  ],
};

/** Base weights per vertical; each list sums to 100 before band factors. */
export const BASE_WEIGHTS: Record<Vertical, Record<string, number>> = {
  wedding: {
    venue: 34,
    catering: 28,
    decor: 11,
    entertainment: 8,
    attire: 7,
    photography: 7,
    transport: 5,
  },
  birthday: { venue: 30, catering: 35, decor: 14, entertainment: 13, photography: 5, transport: 3 },
  community: { venue: 30, catering: 30, decor: 10, entertainment: 15, transport: 8, marketing: 7 },
};

/**
 * Band factors re-weight the base split: micro bands push money into essentials
 * (venue/catering) and out of discretionary lines; premium does the reverse.
 * Factors are renormalized to 100 afterwards, so any factors work.
 */
export const BAND_FACTORS: Record<BudgetBand, BandFactors> = {
  micro: {
    venue: 1.1,
    catering: 1.15,
    decor: 0.8,
    entertainment: 0.8,
    attire: 0.7,
    photography: 0.7,
    marketing: 0.9,
  },
  standard: {},
  premium: {
    venue: 0.9,
    catering: 0.95,
    decor: 1.4,
    entertainment: 1.3,
    attire: 1.3,
    photography: 1.3,
    marketing: 1.2,
  },
};

/** Contingency reserve per vertical × band (outdoor/band-adjusted elsewhere). */
export const CONTINGENCY_PCT: Record<Vertical, Record<BudgetBand, number>> = {
  wedding: { micro: 5, standard: 8, premium: 10 },
  birthday: { micro: 5, standard: 5, premium: 8 },
  community: { micro: 8, standard: 10, premium: 12 },
};

/** Low-budget threshold for DIY contingency templates: $2,000 = 200_000 cents. */
export const LOW_BUDGET_CENTS = 200_000;
