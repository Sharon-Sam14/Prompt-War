# Rules — Coding Rules & Continuous Compliance

Binding rules for every AI agent session and every human commit in this repository.

---

## 1. Core AI Directive (MANDATORY)

1. **READ BEFORE ACTION** — before generating, refactoring, or debugging _any_ code, read
   [`CHALLENGE5_MAX_SCORE_RULES.md`](./CHALLENGE5_MAX_SCORE_RULES.md). Zero violations across
   the 6 high-impact parameters: **Code Quality, Security, Efficiency, Testing, Accessibility,
   Problem Statement Alignment.**
2. **UPDATE AFTER COMPLETION** — after every feature, API route, or component is built, update
   [`Memory.md`](./Memory.md): what completed, key decisions, state/schema changes, remaining
   tasks. Context is never lost across turns.
3. **BUILD IN ORDER** — follow [`Phases.md`](./Phases.md); don't open a new phase before the
   current gate passes. Backend before UI.
4. **HONOR THE CONTRACTS** — data shapes come from `lib/genai/schemas.ts`; flows from
   [`Architecture.md`](./Architecture.md); visuals from [`Design.md`](./Design.md). Conflicts?
   Executable config beats prose; Zod schema beats everything.
5. If a rule here conflicts with a score rule, **the score rules win** — and fix the conflict
   in `Memory.md`'s log.

---

## 2. Next.js 16 Code Quality Rules

- **Strict TypeScript, everywhere.** `strict: true`; **no `any`** (use `unknown` + narrow);
  no unchecked `@ts-ignore`/`@ts-expect-error` without a comment justifying it.
- **Server-first execution.** Components are Server Components by default; `"use client"` only
  where interaction/state requires it (form, budget editing, timeline toggles, ExportButtons,
  theme toggle).
- **Server Actions for mutations**, Route Handlers only for the LLM pipeline
  (`app/api/plan/route.ts`). Never reintroduce `pages/` API patterns or client-side secret calls.
- **Modular prompt isolation.** All prompts live in `lib/genai/prompts.ts`, versioned; no prompt
  strings inline in components or route handlers.
- **Zod at every boundary.** Request bodies, LLM output, and persisted state are parsed — never
  trusted by cast.
- **Rules Engine purity.** `lib/rules-engine/*` stays pure TS: no I/O, no LLM, no React — this
  is what unit tests cheaply prove.
- **Import boundaries respected** (see [`Architecture.md`](./Architecture.md) §1 table).
  Client code never imports `lib/genai`.
- **Lint clean on touched files;** no dead code, no commented-out blocks, no `console.log` in
  shipped code (use the project logger or nothing).
- **Reusable first:** prefer existing `components/ui` primitives over new one-offs; keep files
  focused — split before ~800 lines.
- **State:** server state flows through the Zod-validated store only; components never
  fabricate plan-shaped objects.

## 3. Security Rules (non-negotiable)

- **No API keys in client code, ever.** Keys exist in `.env.local` server-side only;
  `lib/genai/client.ts` carries `import "server-only"`. `.env` is gitignored; ship a redacted
  `.env.example` only.
- **Prompt Guard is mandatory** before any user text reaches the prompt: length cap, control-char
  strip, `<user_input>` delimiter isolation, injection hardening. No direct string interpolation
  of user input into prompts — ever.
- **Escape LLM output before render.** No `dangerouslySetInnerHTML`/`innerHTML` on model
  content.
- **Validate + rate-limit:** Zod-validate bodies (`400` with field issues), rate-limit
  generation (`429` + `Retry-After`), use one overall LLM timeout, and allow at most 2 retries
  with exponential backoff and jitter before deterministic fallback.
- **No secrets in history:** before any push, `git log -p | grep -iE "sk-|api[_-]?key|token"`
  must come back clean. Never commit `.env*`.
- Dependencies: keep the tree lean; no new dependency without checking necessity and license.

## 4. Testing Gate

- **`npm test` (Vitest) must pass before every push and before final submission.** Red tests =
  stop everything.
- Every rules-engine function has unit tests (budget sums = 100 %, countdown math, contingency
  triggers, edge cases: zero/huge budget, past date, empty input).
- The LLM boundary is tested **mocked** (`tests/integration/api-plan.test.ts`): happy path,
  malformed output → fallback, `400`, `429`.
- New feature = new test in the same commit. Logic without test coverage is not "done".
- Full gate order: `npm run lint → npx tsc --noEmit → npm test → npm run build`.

## 5. Accessibility Gate

- **Zero critical/serious axe violations; Lighthouse a11y ≥ 95** in **both** themes.
- **Full keyboard operability** of the critical path: form → generate → edit budget →
  timeline toggle → export. Visible focus everywhere; no traps; roving tabindex in the timeline.
- **WCAG AA contrast** (≥ 4.5:1 text, ≥ 3:1 UI) for every token pair in light **and** dark.
- Every input has an explicit visible label; errors via `aria-invalid` + `aria-describedby`;
  dynamic updates (totals, chat, export) announced through `aria-live`.
- No state conveyed by color alone (over-budget = color + text + icon). Respect
  `prefers-reduced-motion`.

## 6. Submission & Repo Rules

- **Public** GitHub repo, **one branch only**, **< 10 MB** (`git count-objects -vH`),
  **≤ 3 attempts** (tracked in [`Memory.md`](./Memory.md) §6).
- Commit incrementally with meaningful messages; run the full gate before each push.
- README must state: chosen vertical, approach & logic, how the solution works, assumptions.
- Pre-push self-audit (score-rule checklist in
  [`CHALLENGE5_MAX_SCORE_RULES.md`](./CHALLENGE5_MAX_SCORE_RULES.md) §8) — every box checked.

---

## 7. Continuous Compliance Checklist

Copy this to the top of your working notes for every task:

- [ ] Read `CHALLENGE5_MAX_SCORE_RULES.md` before starting
- [ ] Change follows `Phases.md` order and the current phase's scope
- [ ] Types strict, no `any`, Zod at boundaries, prompts isolated
- [ ] No key/secret near client code; input guarded; output escaped
- [ ] Tests added/updated — `npm test` green
- [ ] Keyboard + AA contrast verified for touched UI (`theme-contrast.test.ts` green for all verticals)
- [ ] `Memory.md` updated: completed, decisions, state changes, next task
- [ ] Gate order run: lint → tsc → test → build
