# Memory — Living State & Execution Log

> **This file is the project's memory loop. It is never written once and forgotten.**

---

## 1. Mandatory Operating Protocol

**On task start (before any code):**
1. Read [`CHALLENGE5_MAX_SCORE_RULES.md`](./CHALLENGE5_MAX_SCORE_RULES.md) — zero violations
   across the 6 high-impact parameters.
2. Read this file's **Current System State** and **Remaining Tasks** below.

**After every feature / API route / component / refactor:**
1. Update **Completed Features Log** (check it off).
2. Append to **Decisions Log** if a technical choice was made.
3. Refresh **Current System State & Schemas** if data shape or API contract changed.
4. Reconcile **Remaining Tasks** against [`Phases.md`](./Phases.md).
5. Run the phase gate (`lint → tsc → test`).

**Log entry format:**
```
### [YYYY-MM-DD] <feature name> — Phase <n>
- Built: <files/routes/components>
- Decisions: <notable choices> | None
- State change: <schema/API deltas> | None
- Tests: <what covers it / pending>
- Next: <immediate next task>
```

---

## 2. Project Context

| Key | Value |
|---|---|
| App | AI-Powered Celebration & Event Planner (Challenge 5) |
| Verticals | Weddings · Birthdays · Community Events |
| Stack | Next.js 16 (App Router, Server Actions, Route Handlers, Turbopack), TypeScript strict, Tailwind v4, Shadcn/Radix, Vercel AI SDK (`generateObject`), Zod, Zustand, Vitest, Playwright, jspdf, json2csv |
| Architecture | Backend-first, hybrid Rules Engine + LLM |
| Branch constraint | **Single branch, public repo, < 10 MB, max 3 attempts** |
| Docs source of truth | `docs/` (7 files) — read rules before acting, update this file after acting |

## 3. Decisions Log

| # | Decision | Rationale | Status |
|---|---|---|---|
| D1 | **Hybrid Rules Engine + GenAI** over pure LLM | Math/dates must be exact and free (0 tokens): engine owns allocations & countdowns; LLM only does qualitative work (themes, tips, localized advice). Pure LLM = hallucinated sums + cost per computation. | Accepted |
| D2 | `generateObject()` + Zod over markdown/regex parsing | Typed JSON contract; no brittle parsing; malformed output caught at the boundary with retry → deterministic fallback. | Accepted |
| D3 | Prompt Guard as a mandatory server-side stage | Injection defense, token caps, `<user_input>` delimiter isolation before any model call. | Accepted |
| D4 | Context-aware contingency triggers in the **engine** (not the LLM) | `isOutdoor → rain tasks`, `budget < $2000 → DIY templates` must fire 100 % of the time — rules, not suggestions. | Accepted |
| D5 | Exports rendered **client-side** from the store (`ExportButtons` + jspdf/json2csv) | Store is the single source of truth → screen ≡ export by construction; zero round-trip; zero token cost. | Accepted |
| D6 | Anti-AI-slop UI: dense, bordered, Linear/Vercel-style | Scoring alignment + usability; banned: glassmorphism, rounded-3xl pastel cards, glow, hero art. | Accepted |
| D7 | Dual theme via CSS variables + `next-themes` class strategy | Native light/dark, WCAG AA verified per token pair, no theme flash. | Accepted |

---

## 4. Completed Features Log

> Update after **every** build. Nothing is "done" until its phase gate passes.

**Phase 1 — Core Backend & Security**
- [ ] 1.1 Next.js 16 scaffold (TS strict, Tailwind v4, Turbopack)
- [ ] 1.2 Zod schemas (`lib/genai/schemas.ts`)
- [ ] 1.3 Rules Engine: budget / timeline / checklist / contingency triggers
- [ ] 1.4 Prompt Guard (`lib/security/prompt-guard.ts`)
- [ ] 1.5 GenAI layer: client, prompts, generateObject + retry/fallback + LRU cache
- [ ] 1.6 `POST /api/plan` route handler (full pipeline)
- [ ] 1.7 Server Actions for mutations
- [ ] 1.8 `.env.example` + `server-only` verification → **Gate 1**

**Phase 2 — Data Processing & Testing**
- [ ] 2.1 Vitest config (`npm test`)
- [ ] 2.2 `tests/unit/rules-engine.test.ts`
- [ ] 2.3 `tests/unit/prompt-guard.test.ts`
- [ ] 2.4 `tests/integration/api-plan.test.ts` (mocked LLM)
- [ ] 2.5 Edge cases → **Gate 2**

**Phase 3 — Accessible Dashboard UI**
- [ ] 3.1 shadcn + theme contract
- [ ] 3.2 Setup form (`components/forms/`)
- [ ] 3.3 Zustand store (`lib/store/use-planner-store.ts`)
- [ ] 3.4 Dashboard route `app/plan/[id]/page.tsx`
- [ ] 3.5 `BudgetTable.tsx` + variance bar
- [ ] 3.6 `TimelineView.tsx` (keyboard nav)
- [ ] 3.7 `VendorChecklist.tsx`
- [ ] 3.8 `IdeasView.tsx`
- [ ] 3.9 A11y polish → **Gate 3**

**Phase 4 — Export & Usability**
- [ ] 4.1 `ExportButtons.tsx` (PDF/CSV/MD)
- [ ] 4.2 Persist review
- [ ] 4.3 Playwright E2E
- [ ] 4.4 Efficiency pass
- [ ] 4.5 README
- [ ] 4.6 Repo hygiene audit → **Gate 4 (pre-submission)**

**Execution log** (newest first):

```
### [2026-10-22] Documentation set — Phase 0
- Built: docs/ all 7 files (rules, PRD, architecture, design, phases, memory, rules)
- Decisions: D1–D7 recorded; canonical directory layout fixed in Architecture.md
- State change: docs-only — no code exists yet
- Tests: none (no code)
- Next: Phase 1.1 — scaffold Next.js 16 app
```

---

## 5. Current System State & Schemas

**Code status: Phase 0 complete (docs only). No application code yet.**

**Data models (planned, authoritative source will be `lib/genai/schemas.ts`):**

```ts
Vertical   = "wedding" | "birthday" | "community"
BudgetBand = "micro" | "standard" | "premium"
Currency   = string (ISO 4217, len 3)         // amounts stored as integer cents

PlanInput  = { vertical, eventDate (future ISO), guestCount, budgetTotalCents,
               currency, budgetBand, location?, theme?, culturalNotes?, isOutdoor? }

Budget     = { categories: [{ key, label, plannedCents, actualCents? }], contingencyPct }
Task       = { id, title, dueDate, phase, done }        // dueDate = eventDate − offset
Checklist  = [{ category, items: [{ id, label, status, questions[], docs[] }] }]
Idea       = { id, title, rationale, tags[] }
Plan       = { input, budget, timeline: Task[], checklist, ideas,
               meta: { generatedAt, source: "llm" | "fallback", cacheHit } }
```

**API contract:**
- `POST /api/plan` → body `PlanInputSchema` → `200 Plan` | `400` field issues | `429` rate-limited
- Server Actions: `savePlanSlice`, `toggleTask`, `updateVendorItem`, `recalculateBudget`
- Client exports: `ExportButtons` ← store (jspdf / json2csv / markdown)

**Zustand store shape (`lib/store/use-planner-store.ts`, persist key `planner-plan` v1):**
```ts
{ input, plan, status: "idle"|"loading"|"ready"|"error", error?,
  ui: { theme, activeTab, focusTaskId },
  actions: { generate, patchBudget, toggleTask, setVendorStatus, reset } }
```

**Budget allocation baseline (engine, per vertical × band)** — percentages must total 100;
exact tables live in `lib/rules-engine/budget.ts` once implemented (keep this summary in sync).

---

## 6. Known Constraints & Gate Checkpoints

| Constraint | Checkpoint |
|---|---|
| **Single branch** | `git branch` shows exactly one branch at submission |
| **< 10 MB repo** | `git count-objects -vH` before final push; images compressed, no binaries |
| **Public repo** | GitHub visibility verified |
| **≤ 3 attempts** | Track attempts here: **0 used** |
| **Zero committed secrets** | `.env` gitignored; `git log -p` grep for `sk-`/`API_KEY`/`TOKEN` clean; only `.env.example` shipped |
| **Server-only API keys** | `lib/genai/client.ts` has `import "server-only"`; client bundle scan shows no key material |
| **All tests pass** | `npm test` green before every push |
| **A11y gate** | axe: zero critical/serious; keyboard-only pass; AA contrast both themes |
| **Score rules compliance** | [`CHALLENGE5_MAX_SCORE_RULES.md`](./CHALLENGE5_MAX_SCORE_RULES.md) checklist walked before submission |
