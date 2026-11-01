import { NextRequest, NextResponse } from "next/server";
import { generateEnrichment } from "@/lib/genai/client";
import { PlanInputSchema, type PlanInput } from "@/lib/genai/schemas";
import { hydratePlan } from "@/lib/rules-engine/hydrate";
import { getAllocation } from "@/lib/rules-engine/budget";
import { runwayDays } from "@/lib/rules-engine/timeline";
import { sanitizeUserField } from "@/lib/security/prompt-guard";

/**
 * POST /api/plan — the only LLM route handler (docs/Architecture.md §3).
 *
 * Pipeline: rate limit → Zod validate → rules engine (baseline context) →
 * prompt-guarded LLM call (LRU-cached) → hydration merge → Zod re-validate → 200.
 *
 * Next.js 16 notes:
 * - POST route handlers are never cached by default.
 * - This is an untrusted entry point: every input is parsed with Zod, never trusted by cast.
 * - If OPENAI_API_KEY is absent, the deterministic fallback plan is returned (Gate 1 keyless).
 */

/** Fixed-window in-memory rate limit: 10 generations / minute / IP. */
const RATE_LIMIT = 10;
const WINDOW_MS = 60_000;
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimit(ip: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfterSec: 0 };
  }
  entry.count += 1;
  if (entry.count > RATE_LIMIT) {
    return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfterSec: 0 };
}

/** Opportunistic cleanup so the map cannot grow without bound. */
function pruneRateLimit(): void {
  const now = Date.now();
  for (const [ip, entry] of hits) {
    if (entry.resetAt < now) hits.delete(ip);
  }
}

/**
 * Defensive parse: unknown JSON → 400 with field-level issues (never a 500),
 * oversized/malformed body → 400 before it can reach the guard.
 */
function parseBody(raw: unknown): { ok: true; input: PlanInput } | { ok: false; issues: string } {
  const result = PlanInputSchema.safeParse(raw);
  if (result.success) return { ok: true, input: result.data };
  const issues = result.error.issues
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
  return { ok: false, issues };
}

/** Optional free-text fields re-sanitized for the stored/echoed plan input. */
const ECHO_FIELDS = ["name", "location", "theme", "culturalNotes", "description"] as const;

/**
 * Sanitize one free-text field in place: prompt-guard cap + control-char
 * stripping, with an empty result dropped — `name` must never collapse to ""
 * and fail PlanSchema's min(1) downstream.
 */
function sanitizeEchoField(input: PlanInput, key: (typeof ECHO_FIELDS)[number]): void {
  const raw = input[key];
  if (raw) input[key] = sanitizeUserField(key, raw).value || undefined;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  pruneRateLimit();

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const limit = rateLimit(ip);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfter: limit.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: "validation_failed", issues: "body must be valid JSON" },
      { status: 400 },
    );
  }

  const parsed = parseBody(raw);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.issues },
      { status: 400 },
    );
  }

  const input = parsed.input;
  const runway = runwayDays(input.eventDate);
  if (runway === 0) {
    return NextResponse.json(
      { error: "validation_failed", issues: "eventDate: must be in the future" },
      { status: 400 },
    );
  }

  try {
    // 1) Rules Engine: canonical allocation keys double as the model's allowed key list.
    const allocation = getAllocation(input.vertical, input.budgetBand);
    const categoryKeys = allocation.weights.map((w) => w.key);

    // 2) Prompt Guard is applied inside buildPlanPrompt/generateEnrichment
    //    (sanitize → delimit); free-text fields are re-sanitized here for the input echo.
    for (const key of ECHO_FIELDS) sanitizeEchoField(input, key);

    // 3) LLM layer (server-only, cached, 1 retry → null fallback).
    const { enrichment, cacheHit, injectionFlagged } = await generateEnrichment(
      input,
      categoryKeys,
      runway,
    );

    // 4) Hydration: engine math wins; LLM contributes qualitative enrichment only.
    const plan = hydratePlan({ input, enrichment, cacheHit });

    return NextResponse.json(plan, {
      headers: {
        "Content-Type": "application/json",
        "X-Plan-Source": plan.meta.source,
        "X-Cache-Hit": String(cacheHit),
        ...(injectionFlagged ? { "X-Prompt-Flag": "injection-heuristic" } : {}),
      },
    });
  } catch {
    // Never leak internals (keys, stack traces) to the client.
    return NextResponse.json({ error: "plan_failed" }, { status: 500 });
  }
}
