"use server";

import { BudgetSchema, PlanInputSchema, type Budget, type PlanInput } from "@/lib/genai/schemas";
import { headers } from "next/headers";
import { buildBudget, totalVarianceCents } from "@/lib/rules-engine/budget";
import { createRateLimit } from "@/lib/security/rate-limit";

/**
 * Server Actions for mutations (docs/Architecture.md §3).
 *
 * Next.js 16 security (see node_modules/next/dist/docs — server-actions guide):
 * every action is reachable by direct POST, so each one re-validates its arguments
 * with Zod. Nothing here trusts the client, and no action returns raw internal state.
 *
 * There is no database in v1 (PRD out-of-scope): actions act as the *server authority*
 * for canonical math — the client store adopts their results instead of recomputing
 * its own.
 */

export type ActionResult<T> = { ok: true; data: T } | { ok: false; issues: string };

const actionLimiter = createRateLimit(60, 60_000);

async function actionRateLimitError<T>(): Promise<ActionResult<T> | null> {
  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const result = actionLimiter.check(ip);
  return result.allowed
    ? null
    : { ok: false, issues: `rate_limited: retry in ${result.retryAfterSec} seconds` };
}

/**
 * Recompute the canonical budget for an input (e.g. user changed budget/guests).
 * The engine — not the client — owns allocation math (Architecture §2 rule 1).
 */
export async function recalculateBudget(rawInput: unknown): Promise<ActionResult<Budget>> {
  const limited = await actionRateLimitError<Budget>();
  if (limited) return limited;
  const parsed = PlanInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    };
  }
  const input: PlanInput = parsed.data;
  try {
    const budget = buildBudget(input.vertical, input.budgetBand, input.budgetTotalCents);
    return {
      ok: true,
      data: { ...budget, categories: budget.categories }, // plain serializable object
    };
  } catch {
    return { ok: false, issues: "budget: failed to allocate" };
  }
}

/**
 * Server-side variance totals for a budget the client holds (authoritative check).
 */
export async function computeVariance(rawBudget: unknown): Promise<ActionResult<number>> {
  const limited = await actionRateLimitError<number>();
  if (limited) return limited;
  const parsed = BudgetSchema.safeParse(rawBudget);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    };
  }
  return { ok: true, data: totalVarianceCents(parsed.data) };
}
