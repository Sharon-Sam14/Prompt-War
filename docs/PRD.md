# PRD — Celebration & Event Planner (Challenge 5)

**Status:** Approved baseline · **Owner:** Solo builder + AI agent · **Stack:** Next.js 16 App Router, TypeScript (strict), Tailwind v4, Shadcn/Radix, Vercel AI SDK, Zod, Zustand

> **Alignment rule:** Every feature below maps to a High-Impact scoring parameter in
> [`CHALLENGE5_MAX_SCORE_RULES.md`](./CHALLENGE5_MAX_SCORE_RULES.md). Read that file before
> starting any task.

---

## 1. Problem & Objective

People planning weddings, birthdays, and community events juggle budgets, deadlines, vendors,
and ideas across scattered notes and spreadsheets. Existing tools are static templates; generic
chatbots hallucinate costs and miss deadlines.

**Objective:** a GenAI-powered planning assistant that produces *grounded, structured, editable*
plans: a budget with real math, a reverse countdown timeline, vendor checklists, and
personalized ideas — all in one dense, accessible dashboard.

**Success = Problem Statement Alignment (High Impact):** all six core capabilities in §3 must be
demonstrably working for all three verticals in §2.

---

## 2. Verticals (pick one persona; support all three event types)

| Vertical | Persona / context | Typical budget band | Guest range | Distinct needs |
|---|---|---|---|---|
| **Wedding** | Couple or family organizer, 6–12 month runway | $5k – $100k+ (band: micro / standard / premium) | 50–500 | Vendor contracts, deposits, rehearsal + ceremony + reception segments, cultural/religious rituals |
| **Birthday** | Parent, friend, or self-hosted party | $100 – $3k | 10–80 | Theme/persona, food + cake + entertainment split, short runway (2–6 weeks) |
| **Community Event** | Volunteer lead / NGO / neighborhood organizer | $200 – $10k | 30–1000 | Permits, sponsors, volunteers, venue + AV, free/low-cost options |

Each vertical ships with its own: default budget allocation ratios, timeline templates
(task + offset from event date), vendor checklist set, and idea generators.

---

## 3. Core Requirements

### FR-1 — GenAI-Powered Assistant (conversational + structured generation)
- Chat-style intake: event type, date, guest count, budget, location, theme/cultural preferences.
- Two modes: **conversational** (Q&A, ideation) and **structured** (`generateObject()` returning
  Zod-validated plan JSON).
- Every LLM output passes Zod schema validation; invalid output triggers one retry, then a
  deterministic fallback built by the Rules Engine.
- **Acceptance:** a first-time user gets a complete draft plan (budget + timeline + checklist +
  ideas) in one flow without editing raw JSON.

### FR-2 — Dynamic Budgeting
- Categories: Venue, Catering, Décor, Entertainment, Attire, Photography, Transport, Contingency
  (vertical-specific additions allowed).
- Allocation from Rules Engine baseline percentages (per vertical + budget band), LLM-enriched
  line items, user-editable amounts.
- Variance tracking: planned vs. actual, per-category and total, with over/under flags.
- **Acceptance:** edits recompute totals and variance instantly (client) and never diverge from
  server math for allocation defaults (server).

### FR-3 — Reverse Countdown Timelines
- Tasks generated **backwards from the event date** (e.g., "book venue: T-180d", "send invites:
  T-21d").
- Sources: deterministic template per vertical + LLM enrichment (personalization, filtering by
  runway length).
- Past-due and imminent tasks flagged; tasks checkable with completion state persisted.
- **Acceptance:** given event date D, every task has an absolute due date ≤ D; timeline renders
  correctly for runways of 14 days and 12 months.

### FR-4 — Vendor Checklists
- Category-wise checklists (Venue, Catering, Décor, Photography, Entertainment…).
- Per vendor: inquiry questions (what to ask), required documents (license, insurance, contract),
  and status tracking (To contact → Contacted → Booked).
- **Acceptance:** checklist items are per-vertical, editable, and exportable (FR-6).

### FR-5 — Personalization Engine
- Context inputs: guest count, budget band, event type, location, theme/cultural preferences,
  season.
- Hybrid output: Rules Engine produces the deterministic base (what must always be true), LLM
  adds contextual ideas (themes, cost-saving tips, menu/activity suggestions).
- All recommendations must be derivable from stated context — no generic filler.
- **Acceptance:** changing budget band or guest count visibly changes recommendations.

### FR-6 — Export & Portability
- One-click export: **Markdown** (plan document), **PDF** (`jspdf`), **CSV** (`json2csv` — budget
  rows and task rows).
- Exports are generated from canonical client state; no second data source.
- **Acceptance:** exported files open cleanly and match on-screen values exactly.

---

## 4. Non-Functional Requirements

| Area | Requirement |
|---|---|
| Performance | Cached LLM responses (server LRU); no API call repeated for identical inputs; streaming or loading states for slow generations; debounced client triggers |
| Security | API keys server-side only; all user input sanitized before prompt interpolation; LLM output escaped before render; rate-limited generation endpoints |
| Accessibility | WCAG 2.1 AA: keyboard-operable everything, visible focus, labeled inputs, `aria-live` for chat/generation updates, AA contrast in both themes |
| Themes | Native light + dark (`next-themes`, class strategy), no flash of wrong theme |
| Reliability | LLM failure → deterministic fallback plan; malformed LLM output never reaches UI unvalidated |
| Testing | Vitest unit tests (rules engine, schemas, guards) + mocked-LLM integration tests + Playwright E2E critical path |
| Repo hygiene | Public repo, **single branch**, **< 10 MB**, zero secrets in history, **max 3 attempts** |

---

## 5. Out of Scope (v1)

- Real payments, real vendor directories/booking, live price APIs
- User accounts / auth (state is local: Zustand + `localStorage` persistence)
- Multi-user collaboration, comments, notifications
- Mobile-native apps (responsive web only)

---

## 6. Acceptance ↔ Scoring Mapping

| Requirement | Primary scoring parameter |
|---|---|
| FR-1 … FR-6 across 3 verticals | Problem Statement Alignment |
| Layered modules, Zod, strict TS | Code Quality |
| Key custody, guardrails, escaping | Security |
| Caching, token caps, debounced calls | Efficiency |
| Vitest + mocked LLM + Playwright | Testing |
| Keyboard, ARIA, AA contrast, dual theme | Accessibility |
