/**
 * Prompt Guard (docs/Architecture.md §4) — mandatory boundary between user text and
 * any LLM prompt. Pure TypeScript, stdlib only: no AI SDK, no store, no React.
 *
 * Threats handled:
 * - Prompt injection: user text is wrapped in strict delimiters and the system prompt
 *   (lib/genai/prompts.ts) instructs the model to treat delimited content as data only.
 * - Token blowups: hard length caps before anything reaches the model.
 * - Control-character smuggling: stripped/normalized.
 * - Output XSS: escapeHtml for anything rendered from model content.
 */

export const MAX_PROMPT_INPUT_CHARS = 2_000;
export const MAX_FIELD_CHARS: Readonly<Record<string, number>> = {
  location: 200,
  theme: 200,
  culturalNotes: 1_000,
  name: 120,
  description: 600,
};

export interface GuardResult {
  /** Sanitized value safe for prompt interpolation. */
  value: string;
  /** True when the input was altered (truncated or cleaned). */
  truncated: boolean;
  cleaned: boolean;
}

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g;

/** Sanitize one user-provided field: normalize, strip control chars, enforce max length. */
export function sanitizeField(input: unknown, maxChars: number): GuardResult {
  const raw = typeof input === "string" ? input : String(input ?? "");
  const noZeroWidth = raw.replace(ZERO_WIDTH, "");
  const noControl = noZeroWidth.replace(CONTROL_CHARS, " ");
  const collapsed = noControl.replace(/\s+/g, " ").trim();
  const fits = collapsed.slice(0, maxChars);

  return {
    value: fits,
    truncated: fits.length < collapsed.length,
    cleaned: fits !== raw,
  };
}

/** Sanitize with the default cap for a known field, or the global prompt cap. */
export function sanitizeUserField(name: string, input: unknown): GuardResult {
  return sanitizeField(input, MAX_FIELD_CHARS[name] ?? MAX_PROMPT_INPUT_CHARS);
}

/**
 * Wrap already-sanitized user text in boundary delimiters. Content is treated as
 * opaque data by the model: closing tags are neutralized so input cannot break out.
 */
export function delimit(content: string, tag = "user_input"): string {
  const neutralized = content
    .replaceAll(`<${tag}>`, `&lt;${tag}&gt;`)
    .replaceAll(`</${tag}>`, `&lt;/${tag}&gt;`);
  return `<${tag}>\n${neutralized}\n</${tag}>`;
}

/** Escape for safe HTML-context rendering of LLM output (no dangerouslySetInnerHTML). */
export function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Detect obvious injection attempts in the ORIGINAL input (before sanitization),
 * for logging/metrics — never used to block legitimate event text (words like
 * "ignore previous" can appear in themes). Defense-in-depth lives in the delimiters
 * + system prompt, not in keyword filtering.
 */
export function looksLikeInjection(input: string): boolean {
  const probe = input.toLowerCase();
  return (
    probe.includes("ignore previous instructions") ||
    probe.includes("disregard all prior") ||
    probe.includes("you are now") ||
    probe.includes("system prompt:")
  );
}
