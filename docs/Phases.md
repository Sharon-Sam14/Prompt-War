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
npm run build         # next build (Turbopack) must be green
```

---

## Phase 1 — Core Backend & Security *(Problem Statement Alignment + Security + Code Quality)*

Goal: the full pipeline works headlessly before any UI exists.

| # | Task | Files |
|---|---|---|
| 1.1 | Scaffold Next.js 16 app (App Router, TS strict, Tailwind v4, Turbopack) | `package.json`, `tsconfig.json`, `app/layout.tsx`, `app/globals.css` |
| 1.2 | **Zod schemas first** — `PlanInput`, `Plan`, `Budget`, `Task`, `VendorItem`, `Idea`, enums for 3 verticals | `lib/genai/schemas.ts` |
| 1.3 | Rules Engine: budget allocation % per vertical × band; reverse-countdown date math; baseline checklists; contingency triggers (`isOutdoor → rain tasks`, `budget < 2000 → DIY templates`) — pure functions, zero I/O | `lib/rules-engine/budget.ts`, `timeline.ts`, `checklist.ts` |
| 1.4 | Prompt Guard: length cap, control-char strip, `<user_input>` delimiting, injection hardening, escaping | `lib/security/prompt-guard.ts` |
| 1.5 | GenAI layer: server-only provider client, versioned prompt templates, `generateObject()` + Zod parse + 1 retry + deterministic fallback + server LRU cache | `lib/genai/client.ts`, `lib/genai/prompts.ts` |
| 1.6 | Route Handler orchestrating: rate limit → guard → rules engine → cache → LLM → hydration merge → Zod re-validate | `app/api/plan/route.ts` |
| 1.7 | Server Actions for mutations (save slice, toggle task, recalculate budget) | colocated server actions |
| 1.8 | Env hygiene: `.env.example` redacted, `server-only` guard verified, `npm run build` must not leak key-shaped strings | `.env.example` |

**Gate 1:** `curl POST /api/plan` with a sample wedding payload returns a Zod-valid hydrated
Plan; `tsc --noEmit` clean; build green; no secret in bundle output.

---

## Phase 2 — Data Processing & Testing *(Testing)*

Goal: prove the deterministic core and the LLM boundary without spending tokens.

| # | Task | Files |
|---|---|---|
| 2.1 | Vitest config + scripts (`npm test`) | `vitest.config.ts`, `package.json` |
| 2.2 | Unit tests — budget splits (sum = 100 %, cents exact), timeline backwards math (14-day and 12-month runways, past-date guard), contingency triggers, checklist per vertical | `tests/unit/rules-engine.test.ts` |
| 2.3 | Unit tests — prompt guard: injection strings neutralized, length cap enforced, delimiters present, control chars stripped | `tests/unit/prompt-guard.test.ts` |
| 2.4 | Integration tests — route handler with **mocked** AI SDK: happy path, malformed LLM output → retry → fallback, rate-limit `429`, invalid body → `400` with field issues | `tests/integration/api-plan.test.ts` |
| 2.5 | Edge cases as explicit tests: zero/oversized budget, past event date, guest count extremes, empty input, provider timeout | same files |

**Gate 2:** `npm test` 100 % green, no real API key required to run the suite. Commit.

---

## Phase 3 — Accessible Dashboard UI *(Code Quality + Accessibility + Alignment)*

Goal: present the backend's output in the dense, dual-theme dashboard from
[`Design.md`](./Design.md). Each component consumes only the Zod-validated store shape.

| # | Task | Files |
|---|---|---|
| 3.1 | shadcn UI init; theme contract: CSS variables, `next-themes` class strategy, no FOUC, both themes WCAG AA | `app/globals.css`, `components/ui/*`, theme provider in `app/layout.tsx` |
| 3.2 | Setup form (event type, date, guests, budget, location, style) — labeled inputs, inline Zod errors, `role="alert"` | `app/page.tsx`, `components/forms/*` |
| 3.3 | Zustand store wired to `POST /api/plan` + persistence | `lib/store/use-planner-store.ts` |
| 3.4 | Dashboard route + shell (sidebar/header, tab nav) | `app/plan/[id]/page.tsx` |
| 3.5 | **BudgetTable + VarianceBar** — editable cells, tabular numerals, totals via `aria-live`, over-budget = color + text + icon | `components/planner/BudgetTable.tsx` |
| 3.6 | **TimelineView** — reverse countdown rail, roving-tabindex keyboard nav (`↑↓ Home End Space Enter`), overdue/imminent chips | `components/planner/TimelineView.tsx` |
| 3.7 | **VendorChecklist** — categories, inquiry questions, document trackers, status transitions | `components/planner/VendorChecklist.tsx` |
| 3.8 | **IdeasView** — LLM-enriched personalized recommendations from store | `components/planner/IdeasView.tsx` |
| 3.9 | Zero-error polish pass: focus rings, landmarks, heading order, reduced motion, 320 px + 200 % zoom | all |

**Gate 3:** axe/Lighthouse — zero critical/serious issues **in both themes**; full critical
path reachable by keyboard alone; `npm run lint && npx tsc --noEmit` green. Commit.

---

## Phase 4 — Export & Usability *(Testing + repo hygiene → submission)*

| # | Task | Files |
|---|---|---|
| 4.1 | `ExportButtons`: PDF via `jspdf`, CSV via `json2csv` (budget rows + task rows), Markdown via string template — all read from store | `components/ExportButtons.tsx` |
| 4.2 | Zustand persist reviewed: versioned key, migration path, no PII beyond plan data | `lib/store/use-planner-store.ts` |
| 4.3 | Playwright E2E: setup → generate (mocked LLM) → edit budget → toggle task → export CSV/MD | `tests/e2e/*.spec.ts` |
| 4.4 | Efficiency pass: LRU hit rate, debounced triggers, no per-keystroke calls, `maxOutputTokens` set | `lib/genai/client.ts`, `app/api/plan/route.ts` |
| 4.5 | README: chosen vertical, approach & logic, how it works, assumptions, screenshots (compressed) | `README.md` |
| 4.6 | **Repo hygiene audit:** single branch, public, < 10 MB (`git count-objects -vH`), `git log -p` secret scan, `.env` untracked, lockfile committed, no dead code/debug logs | repo root |

**Gate 4 (pre-submission):** walk the full checklist in
[`CHALLENGE5_MAX_SCORE_RULES.md`](./CHALLENGE5_MAX_SCORE_RULES.md) §8 — every box checked,
`npm test` green, then push (attempt count ≤ 3). Update [`Memory.md`](./Memory.md) with final
state.

---

## Why this order

- **Backend first** means the three highest-impact parameters (Alignment, Security, Code
  Quality) are locked in before any pixel exists — UI regressions can't invalidate them.
- **Tests before UI** means the deterministic engine is proven while its surface is still small.
- **Export/E2E last** means they validate *finished* behavior instead of chasing a moving target.
