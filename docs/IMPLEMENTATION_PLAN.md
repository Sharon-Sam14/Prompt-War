# Implementation Plan — Challenge 5 Entry

**Version:** 1.0 · **Status:** Active · **Updated:** 2026-10-26
**Repo:** `Sharon-Sam14/Prompt-War` · **Branch:** `main` · **Size limit:** < 10 MB · **Attempts:** ≤ 3

---

## 1. Phase Overview (from `docs/Phases.md`)

| Phase | Name                               | Status         | Target     | Notes                                              |
| ----- | ---------------------------------- | -------------- | ---------- | -------------------------------------------------- |
| 0     | Documentation & Setup              | ✅ Done        | —          | PRD, Architecture, Design, Rules, Memory, Phases   |
| 1     | Core Backend & Security            | ✅ Done        | —          | Engine, schemas, prompt-guard, rate-limit, store   |
| 2     | Data Processing & Testing          | ✅ Done        | —          | Unit tests, integration tests, mocked LLM          |
| 3     | Dashboard UI + Rebrand             | ✅ Done        | —          | 6-tab dashboard, editorial-premium, imagery        |
| 4     | Exports, Assistant, E2E, README    | 🟡 In Progress | —          | PDF/CSV/MD, `/api/ask`, Playwright, Lighthouse     |
| 5     | **Dual Theme + Component Library** | 🟡 **Current** | 2026-10-27 | ThemeToggle, contrast test 8 scenarios, features/* |
| 6     | Onboarding Wizard + Landing        | ⏳ Pending     | —          | `/onboarding`, split form, NL prompt input         |
| 7     | Route Migration                    | ⏳ Pending     | —          | `/dashboard`, `/dashboard/[eventId]/*` sub-routes  |
| 8     | Gemini Integration                 | ⏳ Pending     | —          | Provider, responseSchema, plan review, copilot     |
| 9     | Polish & Verification              | ⏳ Pending     | —          | Motion, a11y, security headers, final gates        |
| 10    | Submission Prep                    | ⏳ Pending     | —          | Size check, secret scan, README, screenshots       |

---

## 2. Current Phase: 5 — Dual Theme + Component Library

### 2.1 Completed This Phase

- [x] Dual theme tokens in `app/globals.css` (light + dark, 8 contrast scenarios)
- [x] Contrast test extended to 8 scenarios (368 tests passing)
- [x] `ThemeProvider` + `ThemeToggle` (Light/Dark/System Select)
- [x] `ThemeToggle` mounted in landing header + dashboard header
- [x] Build passes (Turbopack)
- [x] Component library skeleton: `components/features/`
  - [x] States: `EmptyState`, `LoadingSkeleton`, `ErrorBoundary`
  - [x] Forms: `FormField` (input/textarea/select)
  - [x] Dialogs: `ConfirmDialog`
  - [x] Data: `ChartContainer` (chart + table alternative)
  - [x] AI: `AISourceBadge`, `PlanSourceBadge`
  - [x] Shell: `PageHeader`, `Breadcrumbs`, `EventSwitcher`, `CommandMenu`
- [x] Docs skeleton: `DESIGN_SYSTEM.md`

### 2.2 Remaining This Phase

- [ ] `IMPLEMENTATION_PLAN.md` (this file)
- [ ] `AI_INTEGRATION.md`
- [ ] Update `Memory.md` with D45 entry
- [ ] Update `README.md` test counts (228 → 368)
- [ ] Update `AGENTS.md` theme note (remove "dark mode removed")
- [ ] Run E2E tests (Playwright, keyless)
- [ ] Run Lighthouse CI (`npx lhci autorun`)
- [ ] Verify repo size < 10 MB

---

## 3. Milestone Tracker

| Milestone                       | Criteria                                                       | Status |
| ------------------------------- | -------------------------------------------------------------- | ------ |
| **M1: Keyless foundation**      | Runs with `npm install && npm run dev`, no API key             | ✅     |
| **M2: Three verticals working** | Wedding, Birthday, Community all generate plans                | ✅     |
| **M3: Dashboard complete**      | 6 tabs (overview, budget, timeline, checklist, ideas, exports) | ✅     |
| **M4: Dual theme verified**     | 8 contrast scenarios pass, toggle works, no FOUC               | 🟡     |
| **M5: Component library**       | `components/features` exports all shared components            | 🟡     |
| **M6: Route migration**         | `/dashboard/[eventId]/*` sub-routes replace tab panels         | ⏳     |
| **M7: Gemini integration**      | `GEMINI_API_KEY` enables enrichment, honest badges             | ⏳     |
| **M8: All gates green**         | lint, tsc, test, build, e2e, lhci all pass                     | ⏳     |
| **M9: Submission ready**        | < 10 MB, single branch, secret scan clean, ≤ 3 attempts        | ⏳     |

---

## 4. Outstanding Work (Prioritized)

### High Priority (Block Submission)

1. **E2E + Lighthouse verification** — Must pass before any push
2. **Memory.md D45 entry** — Decision log for dual theme restoration
3. **README/AGENTS updates** — Stale test counts and theme documentation
4. **AI_INTEGRATION.md** — Document provider interface, prompts, schemas

### Medium Priority (Before Route Migration)

5. **Component library tests** — Unit tests for ConfirmDialog, FormField, ChartContainer
6. **FormField integration** — Replace inline form fields in event-setup-form
7. **ConfirmDialog integration** — Use for delete/expense/vendor actions
8. **ChartContainer integration** — Replace inline Recharts in BudgetTable/OverviewPanel

### Low Priority (Nice to Have)

9. **CommandMenu wiring** — Connect ⌘K in dashboard header
10. **EventSwitcher wiring** — Multi-event support in dashboard
11. **PageHeader/Breadcrumbs** — Apply to all dashboard sub-routes

---

## 5. Risk Register

| Risk                                | Likelihood | Impact   | Mitigation                                                    |
| ----------------------------------- | ---------- | -------- | ------------------------------------------------------------- |
| E2E flakiness at 320px/200% zoom    | Medium     | High     | Serial workers, reuseExistingServer, explicit waits           |
| Lighthouse a11y < 0.95 in dark      | Low        | High     | Contrast test proves AA; manual audit if needed               |
| Repo size > 10 MB                   | Low        | Critical | Compress images, `git gc`, audit `node_modules` not committed |
| Secret leak in history              | Low        | Critical | `git log -p` scan before push; `.env*` gitignored             |
| Next.js 16 Turbopack CSS regression | Medium     | Medium   | Verified build output; fallback to `--webpack` if needed      |

---

## 6. Gate Checklist (Per Push)

```bash
# All must pass before git push
npm run lint              # eslint, 0 errors
npm run format:check      # prettier
npx tsc --noEmit          # strict TS
npm test                  # vitest: 368 tests, node env, LLM mocked
npm run build             # Next 16 Turbopack production build
npm run test:e2e          # Playwright: 3 tests, keyless, axe + keyboard + 320px/200%
npx lhci autorun          # Lighthouse: a11y ≥ .95, best-practices ≥ .90
```

---

## 7. Attempts Log

| Attempt | Date       | Description                              | Outcome        |
| ------- | ---------- | ---------------------------------------- | -------------- |
| 1       | 2026-10-26 | Initial implementation (phases 0-4)      | ✅ Complete    |
| 2       | 2026-10-26 | Dual theme + component library (phase 5) | 🟡 In Progress |
| 3       | —          | Route migration + Gemini (phases 6-8)    | ⏳             |

**Maximum 3 attempts allowed per competition rules.**

---

## 8. Next Actions (Immediate)

1. Complete `AI_INTEGRATION.md` and `IMPLEMENTATION_PLAN.md`
2. Add D45 entry to `Memory.md`
3. Update `README.md` and `AGENTS.md` test counts
4. Run `npm run test:e2e` and `npx lhci autorun`
5. Verify `git count-objects -vH` < 10 MB
6. Commit and push (attempt 2 of 3)
