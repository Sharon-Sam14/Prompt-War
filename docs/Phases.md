# Phases — Implementation Strategy & Execution Order

Strict backend-first sequence ordered by **High-Impact scoring weight** (see
[`CHALLENGE5_MAX_SCORE_RULES.md`](./CHALLENGE5_MAX_SCORE_RULES.md)). Do not start a phase
before the previous phase's **gate** passes.

> **Operating loop:** read the score rules → do the phase task → run its gate → update
> [`Memory.md`](./Memory.md) → next task.

**Global validation order (always):** `lint → typecheck → test → build`

```bash
npm run lint          # eslint
npx tsc --noEmit      # strict TypeScript
npm test              # vitest run — MUST pass before any push
npm run build         # Next.js production build (Webpack) must be green
```

---

## Phase 1 — Core Backend & Security _(Problem Statement Alignment + Security + Code Quality)_

Goal: the full pipeline works headlessly before any UI exists.

| #   | Task                                                                                                                                                                                                                   | Files                                                                                                               |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1.1 | Scaffold Next.js 16 app (App Router, TS strict, Tailwind v4, Turbopack)                                                                                                                                                | `package.json`, `tsconfig.json`, `app/layout.tsx`, `app/globals.css`                                                |
| 1.2 | **Zod schemas first** — `PlanInput`, `Plan`, `Budget`, `Task`, `VendorItem`, `Idea`, enums for 3 verticals                                                                                                             | `lib/genai/schemas.ts`                                                                                              |
| 1.3 | Rules Engine: budget allocation % per vertical × band; reverse-countdown date math; baseline checklists; contingency triggers (`isOutdoor → rain tasks`, `budget < 2000 → DIY templates`) — pure functions, zero I/O   | `lib/config/{budget,timeline,checklist}.ts` (templates) + `lib/rules-engine/{budget,timeline,checklist}.ts` (logic) |
| 1.4 | Prompt Guard: length cap, control-char strip, `<user_input>` delimiting, injection hardening, escaping                                                                                                                 | `lib/security/prompt-guard.ts`                                                                                      |
| 1.5 | GenAI layer: server-only provider client, versioned prompt templates, `generateObject()` + Zod parse + at most 2 retries with exponential backoff/jitter under one timeout + deterministic fallback + server LRU cache | `lib/genai/client.ts`, `lib/genai/prompts.ts`                                                                       |
| 1.6 | Route Handler orchestrating: rate limit → guard → rules engine → cache → LLM → hydration merge → Zod re-validate                                                                                                       | `app/api/plan/route.ts`                                                                                             |
| 1.7 | Server Actions for mutations (save slice, toggle task, recalculate budget)                                                                                                                                             | colocated server actions                                                                                            |
| 1.8 | Env hygiene: `.env.example` redacted, `server-only` guard verified, `npm run build` must not leak key-shaped strings                                                                                                   | `.env.example`                                                                                                      |

**Gate 1:** `curl POST /api/plan` with a sample wedding payload returns a Zod-valid hydrated
Plan; `tsc --noEmit` clean; build green; no secret in bundle output.

---

## Phase 2 — Data Processing & Testing _(Testing)_

Goal: prove the deterministic core and the LLM boundary without spending tokens.

| #   | Task                                                                                                                                                                        | Files                                |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 2.1 | Vitest config + scripts (`npm test`)                                                                                                                                        | `vitest.config.ts`, `package.json`   |
| 2.2 | Unit tests — budget splits (sum = 100 %, cents exact), timeline backwards math (14-day and 12-month runways, past-date guard), contingency triggers, checklist per vertical | `tests/unit/rules-engine.test.ts`    |
| 2.3 | Unit tests — prompt guard: injection strings neutralized, length cap enforced, delimiters present, control chars stripped                                                   | `tests/unit/prompt-guard.test.ts`    |
| 2.4 | Integration tests — route handler with **mocked** AI SDK: happy path, malformed LLM output → retry → fallback, rate-limit `429`, invalid body → `400` with field issues     | `tests/integration/api-plan.test.ts` |
| 2.5 | Edge cases as explicit tests: zero/oversized budget, past event date, guest count extremes, empty input, provider timeout                                                   | same files                           |

**Gate 2:** `npm test` 100 % green, no real API key required to run the suite. Commit.

---

## Phase 3 — Accessible Dashboard UI _(Code Quality + Accessibility + Alignment)_

Goal: present the backend's output in the dense, dual-theme dashboard from
[`Design.md`](./Design.md). Each component consumes only the Zod-validated store shape.

| #   | Task                                                                                                                        | Files                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 3.1 | shadcn UI init; theme contract: CSS variables, `next-themes` class strategy, no FOUC, both themes WCAG AA                   | `app/globals.css`, `components/ui/*`, theme provider in `app/layout.tsx` |
| 3.2 | Setup form (event type, date, guests, budget, location, style) — labeled inputs, inline Zod errors, `role="alert"`          | `app/page.tsx`, `components/forms/*`                                     |
| 3.3 | Zustand store wired to `POST /api/plan` + persistence                                                                       | `lib/store/use-planner-store.ts`                                         |
| 3.4 | Dashboard route + shell (sidebar/header, tab nav)                                                                           | `app/plan/[id]/page.tsx`                                                 |
| 3.5 | **BudgetTable + VarianceBar** — editable cells, tabular numerals, totals via `aria-live`, over-budget = color + text + icon | `components/planner/BudgetTable.tsx`                                     |
| 3.6 | **TimelineView** — reverse countdown rail, roving-tabindex keyboard nav (`↑↓ Home End Space Enter`), overdue/imminent chips | `components/planner/TimelineView.tsx`                                    |
| 3.7 | **VendorChecklist** — categories, inquiry questions, document trackers, status transitions                                  | `components/planner/VendorChecklist.tsx`                                 |
| 3.8 | **IdeasView** — LLM-enriched personalized recommendations from store                                                        | `components/planner/IdeasView.tsx`                                       |
| 3.9 | Zero-error polish pass: focus rings, landmarks, heading order, reduced motion, 320 px + 200 % zoom                          | all                                                                      |

**Gate 3:** axe/Lighthouse — zero critical/serious issues **in both themes**; full critical
path reachable by keyboard alone; `npm run lint && npx tsc --noEmit` green. Commit.

---

## Phase 4 — Export & Usability _(Testing + repo hygiene → submission)_

| #    | Task                                                                                                                                                                                                                                                                                                                                      | Files                                                                                                                                                 |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.1  | `ExportButtons`: PDF via `jspdf`, CSV via `json2csv` (budget rows + task rows), Markdown via string template — all read from store                                                                                                                                                                                                        | `components/ExportButtons.tsx`                                                                                                                        |
| 4.2  | Zustand persist reviewed: versioned key, migration path, no PII beyond plan data                                                                                                                                                                                                                                                          | `lib/store/use-planner-store.ts`                                                                                                                      |
| 4.3  | Playwright E2E: setup → generate (mocked LLM) → edit budget → toggle task → export CSV/MD                                                                                                                                                                                                                                                 | `tests/e2e/*.spec.ts`                                                                                                                                 |
| 4.4  | Efficiency pass: LRU hit rate, debounced triggers, no per-keystroke calls, `maxOutputTokens` set                                                                                                                                                                                                                                          | `lib/genai/client.ts`, `app/api/plan/route.ts`                                                                                                        |
| 4.5  | README: chosen vertical, approach & logic, how it works, assumptions, screenshots (compressed)                                                                                                                                                                                                                                            | `README.md`                                                                                                                                           |
| 4.6  | **Repo hygiene audit:** single branch, public, < 10 MB (`git count-objects -vH`), `git log -p` secret scan, `.env` untracked, lockfile committed, no dead code/debug logs                                                                                                                                                                 | repo root                                                                                                                                             |
| 4.7  | **Conversational assistant:** `POST /api/ask` (rate-limited, Zod, prompt-guard) with plan-context snapshot; keyless = deterministic engine responder, keyed = LLM answer (bounded retries → engine); Overview "Ask your planner" panel with `aria-live`                                                                                   | `app/api/ask/route.ts`, `lib/rules-engine/ask.ts`, `components/planner/assistant-panel.tsx`                                                           |
| 4.8  | **Landing shell** (user brief): sticky top nav (HOME·FEATURES·HOW IT WORKS·CREATE EVENT, gilt-underline active, local-first chip), "Bespoke Event Planning Engine" hero + CURATE YOUR EVENT CTA, 3-card feature grid with mono preview lines, 3-step strip with input-preview boxes; form stays at `#create`; no dead nav links           | `components/landing-page.tsx`, `app/page.tsx`, `components/forms/event-setup-form.tsx`                                                                |
| 4.9  | **Cancelled (D38): persistent app shell.** The v2 spec (§1.2) is canonical for navigation; the root-layout header + horizontal tab-bar variant was never coded, and `components/app-shell.tsx` was never created. Landing keeps the anchor nav, the dashboard keeps its sidebar tablist.                                                  | —                                                                                                                                                     |
| 4.10 | **Rules-based personalized ideas**: pure ideas across vertical/context signals, visible source badges, model ideas additive; PlanSchema source validation and engine tests                                                                                                                                                                | `lib/config/ideas.ts`, `lib/rules-engine/ideas.ts`, `lib/rules-engine/hydrate.ts`, `lib/genai/schemas.ts`, `components/planner/ideas-view.tsx`, tests |
| 4.11 | **JSON portability**: export complete plan, import on another device after PlanSchema validation, preserve past-event plans                                                                                                                                                                                                               | `components/planner/exports-panel.tsx`, `components/planner/import-plan-control.tsx`, `lib/store/use-planner-store.ts`, `lib/genai/schemas.ts`        |
| 4.12 | **Context-following assistant**: send only the last three sanitized turns; ask one clarifying follow-up when plan context is missing; return three context-aware suggestion buttons                                                                                                                                                       | `lib/genai/schemas.ts`, `lib/genai/prompts.ts`, `lib/genai/client.ts`, `app/api/ask/route.ts`, `components/planner/assistant-panel.tsx`               |
| 4.13 | **Responsible-AI guidance**: show consistent vendor/pricing note in Budget, Checklist, Exports and landing footer; document data sent/stored and limitations                                                                                                                                                                              | `components/planner/vendor-disclaimer.tsx`, planner panels, `components/landing-page.tsx`, `README.md`                                                |
| 4.14 | **A11y automation**: axe on landing/dashboard in light and dark, 320 px and 200% zoom overflow checks, reduced-motion browser preference                                                                                                                                                                                                  | `tests/e2e/planner.spec.ts`, `playwright.config.ts`                                                                                                   |
| 4.15 | **Persisted boundary validation**: Zod-parse API responses and localStorage plans; safely default provenance for v1 model ideas                                                                                                                                                                                                           | `lib/store/use-planner-store.ts`, `lib/genai/schemas.ts`, tests                                                                                       |
| 4.16 | **Bounded model retries**: allow at most two exponential-backoff retries with jitter within a single 20-second deadline for plan and assistant requests                                                                                                                                                                                   | `lib/genai/client.ts`, tests                                                                                                                          |
| 4.17 | **Server Action abuse controls**: per-IP rate limit every public mutation action and return a bounded user-facing error                                                                                                                                                                                                                   | `app/actions.ts`, `lib/security/rate-limit.ts`, tests                                                                                                 |
| 4.18 | **Security response headers**: configure CSP, nosniff, referrer policy and frame protection; verify headers on page responses                                                                                                                                                                                                             | `next.config.ts`, `tests/e2e/planner.spec.ts`                                                                                                         |
| 4.19 | **Motion layer (§1.7)**: filtered React Bits subset as owned code — adopt/strip `CountUp-TS-TW`, write zero-dependency `Reveal`; reject gsap-based variants (45.4 KB gzip) and `AnimatedList`; role tokens only; reduced-motion instant in CSS **and** JS; first-mount only; total added JS < 30 KB gzip with before/after sizes recorded | `components/motion/*`, `docs/Memory.md` D34, `README.md` §8                                                                                           |
| 4.20 | **Formatting + Lighthouse gates (§5)**: `prettier --check .` at 0 issues wired into CI; `lhci autorun` asserting accessibility ≥ 0.95 and best-practices ≥ 0.90 with the scores recorded in the README                                                                                                                                    | `.prettierrc.json`, `.prettierignore`, `.lighthouserc.json`, `.github/workflows/quality.yml`, `README.md`                                             |
| 4.21 | **Keyboard-only end-to-end QA (§1.6)**: the whole critical path driven with Tab/arrows/Enter/Space and no pointer, failing if focus escapes to `<body>`; recorded step by step in the README QA matrix                                                                                                                                    | `tests/e2e/planner.spec.ts`, `README.md` §5                                                                                                           |

**Gate 4 (pre-submission):** walk the full checklist in
[`CHALLENGE5_MAX_SCORE_RULES.md`](./CHALLENGE5_MAX_SCORE_RULES.md) §8 — every box checked,
`npm test` green, then push (attempt count ≤ 3). Update [`Memory.md`](./Memory.md) with final
state.

---

## Why this order

- **Backend first** means the three highest-impact parameters (Alignment, Security, Code
  Quality) are locked in before any pixel exists — UI regressions can't invalidate them.
- **Tests before UI** means the deterministic engine is proven while its surface is still small.
- **Export/E2E last** means they validate _finished_ behavior instead of chasing a moving target.
