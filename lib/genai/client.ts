import "server-only";

import { createHash } from "node:crypto";
import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import {
  LlmAskSchema,
  LlmEnrichmentSchema,
  type AskContext,
  type AskHistoryMessage,
  type LlmEnrichment,
  type PlanInput,
} from "@/lib/genai/schemas";
import {
  ASK_SYSTEM_PROMPT,
  PLAN_SYSTEM_PROMPT,
  SYSTEM_PROMPT_VERSION,
  buildAskPrompt,
  buildPlanPrompt,
} from "@/lib/genai/prompts";
import { deriveFacts } from "@/lib/rules-engine/ask";
import { looksLikeInjection, sanitizeUserField } from "@/lib/security/prompt-guard";

/**
 * Server-only GenAI layer (docs/Architecture.md §3/§4):
 * - `import "server-only"` makes any client-bundle import a BUILD FAILURE → zero key
 *   exposure in the browser.
 * - LRU response cache: identical sanitized context costs 0 tokens.
 * - At most 2 retries with backoff/jitter under one request timeout, then deterministic fallback.
 *
 * This module never renders UI and never mutates the store.
 */

const LRU_MAX_ENTRIES = 200;
const LRU_TTL_MS = 15 * 60 * 1000;
const LLM_TIMEOUT_MS = 20_000;
const MAX_LLM_RETRIES = 2;
const RETRY_BASE_MS = 200;
const RETRY_JITTER_MS = 100;
const MAX_OUTPUT_TOKENS = 4_000;
const DEFAULT_OPENAI_MODEL = "gpt-6-luna";

/** Exponential backoff with jitter, capped by the shared request deadline. */
async function pauseBeforeRetry(
  attempt: number,
  deadline: number,
  signal: AbortSignal,
): Promise<boolean> {
  if (signal.aborted) return false;
  const requested = RETRY_BASE_MS * 2 ** attempt + Math.random() * RETRY_JITTER_MS;
  const delayMs = Math.min(requested, deadline - Date.now());
  if (delayMs <= 0) return false;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, delayMs);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
  return !signal.aborted;
}

/** Simple size-bounded, TTL'd LRU for generated enrichments. */
class LruCache<T> {
  private readonly map = new Map<string, { value: T; expiresAt: number }>();

  constructor(
    private readonly maxEntries: number,
    private readonly ttlMs: number,
  ) {}

  get(key: string): T | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    // Refresh recency.
    this.map.delete(key);
    this.map.set(key, hit);
    return hit.value;
  }

  set(key: string, value: T): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  get size(): number {
    return this.map.size;
  }
}

interface CachedEntry {
  enrichment: LlmEnrichment;
}

const enrichmentCache = new LruCache<CachedEntry>(LRU_MAX_ENTRIES, LRU_TTL_MS);
const askCache = new LruCache<{ answer: string }>(LRU_MAX_ENTRIES, LRU_TTL_MS);

/** Exposed for tests/metrics only. */
export function cacheStats(): { entries: number } {
  return { entries: enrichmentCache.size };
}

/** Lazily-created provider. Throws a clear error when the key is missing. */
function getModel() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Server-side env only — never expose this in client code.",
    );
  }
  const openai = createOpenAI({ apiKey });
  return openai(process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL);
}

/** GPT-6 Luna is reasoning-capable; low effort suits bounded event planning turns. */
function getProviderOptions() {
  const modelId = process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL;
  return modelId.startsWith("gpt-6-") ? { openai: { reasoningEffort: "low" as const } } : undefined;
}

/** Cache key: kind + schema version + prompt version + sanitized prompt hash. */
function cacheKey(kind: "enrichment" | "answer", prompt: string): string {
  const hash = createHash("sha256").update(`${SYSTEM_PROMPT_VERSION}|${prompt}`).digest("hex");
  return `${kind}:${hash}`;
}

export interface GenerateEnrichmentResult {
  /** null → caller must use the deterministic fallback (LLM unavailable/invalid). */
  enrichment: LlmEnrichment | null;
  cacheHit: boolean;
  /** Injection heuristic fired (input still passed through delimiters). */
  injectionFlagged: boolean;
}

/**
 * Generate qualitative enrichment for a plan. Never throws: on any failure the
 * caller receives `enrichment: null` and builds the baseline-only fallback plan.
 */
export async function generateEnrichment(
  input: PlanInput,
  categoryKeys: ReadonlyArray<string>,
  runway: number,
): Promise<GenerateEnrichmentResult> {
  // Sanitize free-text fields AGAIN at this boundary (defense in depth) and detect
  // injection attempts for metrics. Blocked nothing here: delimiting is the control.
  const theme = input.theme ? sanitizeUserField("theme", input.theme) : null;
  const culturalNotes = input.culturalNotes
    ? sanitizeUserField("culturalNotes", input.culturalNotes)
    : null;
  const injectionFlagged = looksLikeInjection(
    `${input.theme ?? ""} ${input.culturalNotes ?? ""} ${input.location ?? ""}`,
  );

  const prompt = buildPlanPrompt(
    { ...input, theme: theme?.value, culturalNotes: culturalNotes?.value },
    categoryKeys,
    runway,
  );

  const key = cacheKey("enrichment", prompt);
  const cached = enrichmentCache.get(key);
  if (cached) {
    return { enrichment: cached.enrichment, cacheHit: true, injectionFlagged };
  }

  if (!process.env.OPENAI_API_KEY) {
    // Deterministic path: no key configured → baseline plan (Gate 1 works keyless).
    return { enrichment: null, cacheHit: false, injectionFlagged };
  }

  const deadline = Date.now() + LLM_TIMEOUT_MS;
  const signal = AbortSignal.timeout(LLM_TIMEOUT_MS);
  const providerOptions = getProviderOptions();
  for (let attempt = 0; attempt <= MAX_LLM_RETRIES; attempt++) {
    try {
      const result = await generateObject({
        model: getModel(),
        schema: LlmEnrichmentSchema,
        system: PLAN_SYSTEM_PROMPT,
        prompt,
        abortSignal: signal,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        ...(providerOptions ? { providerOptions } : {}),
      });
      enrichmentCache.set(key, { enrichment: result.object });
      return { enrichment: result.object, cacheHit: false, injectionFlagged };
    } catch {
      if (attempt >= MAX_LLM_RETRIES || !(await pauseBeforeRetry(attempt, deadline, signal))) break;
    }
  }

  return { enrichment: null, cacheHit: false, injectionFlagged };
}

export interface GenerateAnswerResult {
  /** null → caller must use the deterministic engine responder (keyless/failed). */
  answer: string | null;
  cacheHit: boolean;
  injectionFlagged: boolean;
}

const ASK_MAX_OUTPUT_TOKENS = 300;

/**
 * Answer one assistant question from a plan snapshot (Design.md §4.9).
 * The prompt hands the model precomputed derived figures (deriveFacts) so the
 * model never performs arithmetic. Never throws: on any failure the caller
 * receives `answer: null` and answers with the engine responder instead.
 */
export async function generateAnswer(
  question: string,
  ctx: AskContext,
  history: readonly AskHistoryMessage[] = [],
): Promise<GenerateAnswerResult> {
  const injectionFlagged =
    looksLikeInjection(question) || history.some((turn) => looksLikeInjection(turn.text));
  const prompt = buildAskPrompt(question, ctx, deriveFacts(ctx), history);

  const key = cacheKey("answer", prompt);
  const cached = askCache.get(key);
  if (cached) {
    return { answer: cached.answer, cacheHit: true, injectionFlagged };
  }

  if (!process.env.OPENAI_API_KEY) {
    // Deterministic path: no key → the engine responder answers (Gate 1 keyless).
    return { answer: null, cacheHit: false, injectionFlagged };
  }

  const deadline = Date.now() + LLM_TIMEOUT_MS;
  const signal = AbortSignal.timeout(LLM_TIMEOUT_MS);
  const providerOptions = getProviderOptions();
  for (let attempt = 0; attempt <= MAX_LLM_RETRIES; attempt++) {
    try {
      const result = await generateObject({
        model: getModel(),
        schema: LlmAskSchema,
        system: ASK_SYSTEM_PROMPT,
        prompt,
        abortSignal: signal,
        maxOutputTokens: ASK_MAX_OUTPUT_TOKENS,
        ...(providerOptions ? { providerOptions } : {}),
      });
      const answer = result.object.answer.trim();
      if (answer) {
        askCache.set(key, { answer });
        return { answer, cacheHit: false, injectionFlagged };
      }
    } catch {
      if (attempt >= MAX_LLM_RETRIES || !(await pauseBeforeRetry(attempt, deadline, signal))) break;
    }
  }

  return { answer: null, cacheHit: false, injectionFlagged };
}
