import { NextRequest, NextResponse } from "next/server";
import { generateAnswer } from "@/lib/genai/client";
import {
  AskRequestSchema,
  AskResponseSchema,
  type AskContext,
  type AskHistoryMessage,
} from "@/lib/genai/schemas";
import { answerFromPlan } from "@/lib/rules-engine/ask";
import { looksLikeInjection, sanitizeUserField } from "@/lib/security/prompt-guard";
import { createRateLimit } from "@/lib/security/rate-limit";

/**
 * POST /api/ask — the conversational assistant endpoint (Design.md §4.9).
 *
 * Pipeline: rate limit → Zod validate → prompt-guard sanitize → engine
 * responder (always computed — it is the fallback) → optional LLM answer
 * (1 retry inside generateAnswer) → Zod-validated response with `source`.
 *
 * Controls mirror /api/plan: fixed-window per-IP limit (30/min — questions are
 * cheap and interactive), untrusted body parsed with Zod, no internals leaked
 * on failure. Keyless installs answer from the deterministic engine only.
 */

const limiter = createRateLimit(30, 60_000);

function parseBody(
  raw: unknown,
):
  | { ok: true; question: string; history: AskHistoryMessage[]; context: AskContext }
  | { ok: false; issues: string } {
  const result = AskRequestSchema.safeParse(raw);
  if (result.success)
    return {
      ok: true,
      question: result.data.question,
      history: result.data.history,
      context: result.data.context,
    };
  const issues = result.error.issues
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
  return { ok: false, issues };
}

function sanitizeContext(context: AskContext): { context: AskContext; flagged: boolean } {
  let flagged = false;
  const clean = (name: string, value: string) => {
    flagged ||= looksLikeInjection(value);
    return sanitizeUserField(name, value).value;
  };
  return {
    flagged,
    context: {
      ...context,
      theme: context.theme ? clean("theme", context.theme) : undefined,
      location: context.location ? clean("location", context.location) : undefined,
      categories: context.categories.map((category) => ({
        ...category,
        label: clean("category", category.label),
      })),
      tasks: context.tasks.map((task) => ({ ...task, title: clean("task", task.title) })),
      vendors: context.vendors.map((vendor) => ({
        ...vendor,
        category: clean("vendor", vendor.category),
        label: clean("vendor", vendor.label),
      })),
      ideaTitles: context.ideaTitles.map((title) => clean("ideaTitle", title)),
    },
  };
}

function suggestionsFor(context: AskContext): [string, string, string] {
  return [
    context.isOutdoor ? "What is my rain plan?" : "What is my next deadline?",
    context.theme
      ? `How can I use ${context.theme} in the decor?`
      : "What theme should I consider?",
    context.budgetBand === "micro" ? "Which ideas can save money?" : "How is my budget allocated?",
  ];
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const limit = limiter.check(ip);
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

  const question = sanitizeUserField("question", parsed.question).value;
  const history = parsed.history.map((turn) => ({
    role: turn.role,
    text: sanitizeUserField("history", turn.text).value,
  }));
  const { context, flagged: contextFlagged } = sanitizeContext(parsed.context);
  const injectionFlagged =
    looksLikeInjection(parsed.question) ||
    parsed.history.some((turn) => looksLikeInjection(turn.text)) ||
    contextFlagged;

  try {
    // Engine answer is always computed: it is both the keyless answer and the
    // deterministic fallback if the LLM path fails or is unavailable.
    const engineAnswer = answerFromPlan(question, context);
    const { answer: llmAnswer, cacheHit } = await generateAnswer(question, context, history);
    const needsTheme =
      !context.theme && /\b(decor|decoration|flowers|colour|color|style)\b/i.test(question);

    const response = AskResponseSchema.parse({
      answer: llmAnswer ?? engineAnswer,
      source: llmAnswer ? "llm" : "engine",
      ...(needsTheme ? { followUp: "What theme or mood are you aiming for?" } : {}),
      suggestions: suggestionsFor(context),
    });

    return NextResponse.json(response, {
      headers: {
        "X-Answer-Source": response.source,
        ...(cacheHit ? { "X-Cache-Hit": "true" } : {}),
        // Metrics only: whether the injection heuristic fired on the question.
        ...(injectionFlagged ? { "X-Prompt-Flag": "injection-heuristic" } : {}),
      },
    });
  } catch {
    // Never leak internals (keys, stack traces) to the client.
    return NextResponse.json({ error: "plan_failed" }, { status: 500 });
  }
}
