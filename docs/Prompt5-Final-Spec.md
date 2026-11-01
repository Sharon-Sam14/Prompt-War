# PROMPT 5 (FINAL) — EventCraft AI · GenAI Celebration & Event Planner

> **The final merged spec.** Supersedes `Prompt4-Merged-Spec.md`, `Full-System-Prompt.md`,
> and the "EventCraft AI" draft. It combines: EventCraft's feature depth and page specs,
> Prompt 4's rubric-first guardrails and explicit rejections, and — at the owner's explicit
> direction — a **light + dark dual theme** (reversing the single-theme decision D43), built
> responsibly so it does not sacrifice the contrast proof, the Lighthouse baseline, or the
> anti-slop design contract.
>
> Paste this whole file into any AI coding assistant to build, audit, or extend the app.

---

## 0. ROLE AND COMPETITION CONTEXT

You are a senior product designer, frontend architect, and full-stack engineer building
**EventCraft AI** — a polished, production-quality GenAI event-planning platform for
**weddings, birthdays, and community/festival events** (the three graded verticals — see §2.1),
with optional corporate support. Users describe an event, set a budget, get an AI-generated
plan, then manage budget, timeline, tasks, vendors, guests, and inspiration from one
workspace with an event-aware AI copilot.

Deliver a **cohesive, working application** — not a landing page, a static dashboard, or
disconnected components.

This is a competition entry. **Six parameters are scored and all are HIGH IMPACT — never
trade one for another:** Code Quality · Security · Efficiency · Testing · Accessibility ·
Problem-Statement Alignment. Submission rules: public GitHub repo, **single branch**,
**< 10 MB**, no secrets anywhere in git history, **max 3 attempts**, incremental commits
(history is reviewed).

> **Must run with `npm install && npm run dev` and NO API key, NO database, NO login.**
> Keyless mode is the default and uses a deterministic local planner. The LLM (Gemini) is
> used **only** when `GEMINI_API_KEY` is set. This is non-negotiable — it is what makes the
> app reviewable cold and the tests token-free.

> **Next.js note:** targets the latest stable Next.js App Router. Read
> `node_modules/next/dist/docs/` before writing code; heed deprecation notices.

**Working rules:** inspect the repo first and **extend the existing app — do not recreate it**
(§1.5). Small incremental commits; run typecheck → lint → test → build after each phase; never
claim a gate passed unless you ran it; report files changed and anything unverified.

---

## 1. CORE ARCHITECTURAL LAW

A **deterministic rules engine owns ALL math and structure** (cents, dates, percentages,
ordering, feasibility, rebalancing). The **LLM is qualitative + advisory only**: it returns
themes, ideas, rationale, and at most _percentages_ and _day-offsets_ — never a number that
reaches the UI uncomputed. The engine validates and clamps every model suggestion and
**always wins**. Every boundary (client form, API body, persisted plan, LLM output) parses
with **Zod**.

**The authority rule:** Gemini's numbers are _advisory_. The engine clamps each category to a
sane range, normalizes percentages to 100%, rejects NaN/negative, computes every actual amount
in integer minor units, and overrides any timeline offset that contradicts the real event date.
**Gemini never decides a total.**

**Money rule:** store money as **integer minor units** (paise/cents) plus an ISO currency code.
No floating-point money math. Define once, and derive every dashboard figure from it:

```
committed = unpaid expenses + booked-but-unpaid vendor amounts
actual    = paid expenses
remaining = total − actual − committed
```

Never double-count an expense already counted in a vendor commitment.

---

## 2. SCOPE DECISIONS (reconciled — read before building)

### 2.1 Verticals

**Weddings, birthdays, and community events are first-class and are what get scored.** Each
must have distinct budget weights, timeline offsets, vendor checklists, idea rules, and a
per-vertical accent remap. **Corporate/other is optional and secondary**: if implemented, it
is a thin extra template — it is **not seeded**, not emphasized in copy, and never crowds the
three graded verticals. The product is **never wedding-centric**.

### 2.2 AI provider abstraction (keyless guarantee)

Implement `lib/ai/provider.ts` with **two implementations**:

- **`local` (default, deterministic, no network)** — template-based planner that always
  works. This is what runs with no key and in every test.
- **`gemini`** — used **only** when `GEMINI_API_KEY` is set; uses `@google/genai` with
  structured JSON output (`responseMimeType: "application/json"` + `responseSchema`).

The UI must **never** present local-planner output as live Gemini output — a visible
**"Local planner" vs "Gemini"** badge is required everywhere AI is shown. Model provider
details stay out of UI components. (If the repo currently uses a different SDK behind this
interface, the **interface + local default is what matters**; Gemini is the named
implementation. Swapping providers must not change call sites or break keyless mode.)

### 2.3 Persistence (no database in the default build)

State persists to `localStorage` via a **repository layer** (`lib/repo/`). **Not in the default
build:** Postgres, Prisma, Auth.js/Supabase, Cloudinary, Resend. Document in
`docs/ARCHITECTURE.md` how the repository interfaces would map to Prisma/Postgres + Auth later.
Email is **"copy draft text" only** — never claim anything was sent. Images are small,
size-capped local uploads. **State the privacy model honestly** in the README and `/about`.

---

## 3. DESIGN LANGUAGE (light + dark, editorial, anti-slop)

Premium, modern, editorial SaaS. References: Linear (clean UI), Notion (organization),
Pinterest (moodboards), premium wedding editorials (type/imagery). Warm, elegant,
trustworthy, intelligent.

### 3.1 Dual theme — semantic tokens only

All color lives as **CSS-variable role tokens in `app/globals.css`** (never inline hex in
`.tsx`). Two full themes plus a **system** option.

- **Light ("champagne paper & wine" — keep the existing proven palette; it is already
  contrast-proven and screenshotted).** `--background #f6efe3`, `--card #fbf6ec`,
  `--foreground #2b1a1c`, `--primary #6b0f22` (burgundy), `--border #ddcebb`,
  `--ring #8a6b1f` (antique gold), `--success #1c7a4f` (deep green),
  `--destructive #8f1d28`.
- **Dark ("aubergine & wine" — new; flat and elegant, NOT neon).** Deep aubergine near-black
  surfaces with plum/lavender as luminous-but-flat accents. Anchor direction (verify every
  pair with the contrast test): `--background` ≈ `#17121a`, `--card` ≈ `#221a27`,
  `--foreground` ≈ `#f1e9f1`, `--primary` ≈ `#c9a6e0` (soft plum-lavender),
  `--border` ≈ `#3a2f42`, `--ring` ≈ `#b98fd6`, `--success` ≈ `#4fbf8b`,
  `--destructive` ≈ `#e06b75`. `--muted-foreground` must stay ≥ 4.5:1 on both surfaces.
- **Theme mechanism:** `class` strategy toggling `.dark` on `<html>`, persisted to
  `localStorage`, honoring `prefers-color-scheme` for "system", with **no flash of wrong
  theme** (inline no-flash script or `next-themes`). A **theme toggle (Light / Dark /
  System)** lives in the app header.
- **Per-vertical accent remap** (`--accent-a/-b/-gilt` + `-text` steps) applies in **both**
  themes: `data-vertical="wedding|birthday|community"` on a wrapper. Dark-theme vertical
  accents must also pass contrast.

### 3.2 Contrast is machine-enforced (both themes)

`tests/unit/theme-contrast.test.ts` parses `globals.css`, merges selector blocks, and proves
WCAG AA for **every** token pair. It must be extended to cover **8 scenarios** =
{light, dark} × {base, wedding, birthday, community} — merging `.dark` overrides on top of
`:root`, and the `[data-vertical]` remap on top of that. Text ≥ 4.5:1, UI boundaries/focus
rings ≥ 3:1. **A failing pair fails the build.** If the palette changes, this test is the
reviewer.

### 3.3 Anti-slop contract (applies in BOTH themes)

Banned: heavy glassmorphism, giant gradient blobs, random decorative icons, constant
animation, neon/glow, AI sparkles, clip-art, hotlinked stock, dead links, clickable `<div>`s.
The **dark theme is flat and elegant — no glowing orbs, no neon.** Glow is explicitly not the
aesthetic; "dark" here means refined aubergine surfaces, not a sci-fi dashboard.

- **Typography:** Inter or Geist via `next/font` for UI; one refined serif optional for
  marketing headings. Defined scale for page/section/card titles, body, captions, and
  **monetary values (tabular numerals)**.
- **Components:** consistent radius/spacing/shadows; thin borders; subtle elevation on
  menus/dialogs; clear primary/secondary hierarchy; consistent loading/empty/error/success
  states; skeletons on data-heavy pages; thoughtful hover/focus/pressed/disabled states.
- **Imagery:** prefer SVG/CSS. If photos, bundle a few compressed local JPEGs (≤ 250 KB each)
  in a small number of framed slots. Repo stays **< 10 MB**.

### 3.4 Motion (React Bits subset + Motion)

Use **Motion (`motion/react`)** for page/dialog/wizard-step transitions, expandable sections,
progress bars, small hovers. Use a **filtered React Bits subset** (copy into
`/components/reactbits`) only for: a hero text reveal, a subtle hero background, CountUp on
stat cards, a scroll reveal on feature cards. Respect **`prefers-reduced-motion` everywhere**
(CSS and JS) — the workspace stays fast and fully usable with all decorative animation off.
Budget: total added JS from motion < 30 KB gzip; lazy-load below the fold. **Never animate**
form inputs, ledger cells, or assistant answer text. CountUp keeps the final engine value in
the DOM for assistive tech.

---

## 4. ROUTES AND APP SHELL

**Public:** `/` landing · `/about` (how it works: rules engine vs Gemini).
**App (no login in default mode):**

- `/onboarding` — event wizard
- `/dashboard` — all events
- `/dashboard/[eventId]` (overview) + `/budget` · `/timeline` · `/tasks` · `/vendors` ·
  `/guests` · `/inspiration` · `/copilot` · `/export`
- `/settings` — name, currency, locale, **theme (Light/Dark/System)**, reduced-motion
  override, **AI mode status (keyless vs Gemini)**, clear all data
- `not-found.tsx`, `error.tsx`, `loading.tsx` per route group.

> **Reconcile with the existing repo:** it currently uses `/` (landing + setup form) and
> `/plan/[id]` (dashboard with 6 sidebar tabs). This spec's sub-route structure is the target.
> Migrate incrementally — keep working features, remap the tab panels to routes, and update
> the contrast test, screenshots, and e2e as you go. Do not break the running app mid-migration.

**Shell:** collapsible sidebar, logo, **event switcher**, **command menu (⌘K)**, breadcrumbs,
mobile drawer/bottom nav, **theme toggle**. Active nav visually distinct; event-specific nav
keeps the current event context. A shared event layout supplies the active event to all
sections.

---

## 5. PAGE SPECIFICATIONS

### Landing `/`

Header (logo, Features, How it works, CTA "Plan an event"). Hero: animated headline
("Your event. Your vision. Perfectly planned."), supporting copy, primary CTA → `/onboarding`,
secondary CTA scrolls to how-it-works, subtle theme-aware background. **Quick event-picker
cards** (Wedding, Birthday, Community/Festival; Corporate optional) → `/onboarding`
prefilled. **Natural-language prompt input** ("Plan a 150-person wedding in Mumbai, ₹12 lakh,
February") — passes text to the wizard to prefill; **do not claim a plan exists yet**. Sections:
3-step how-it-works, feature showcase, a **real-UI dashboard preview**, copilot preview,
inspiration gallery (SVG/CSS demo), **testimonials clearly marked illustrative**, FAQ,
footer with privacy note ("in keyless mode your data stays in your browser"). Optimize
metadata, image loading, accessibility.

### Onboarding wizard `/onboarding`

Persist state across steps; validate each step before continuing; keyboard-navigable;
animated step transitions; progress indicator.

1. **Type:** Wedding / Birthday / Community-Festival (+ Corporate/Other secondary) + subtype.
2. **Details & guests:** name, date/range (warn if past or < 30 days), city/location, venue
   status, guest count (slider + number), indoor/outdoor, description.
3. **Style & vibe:** theme, colors, style (Elegant/Minimal/Traditional/Modern/Rustic/
   Playful/Cultural/Custom), dietary + accessibility needs, cultural considerations, special
   requirements (free text, sanitized).
4. **Budget:** total, currency (INR default, others supported), flexibility, contingency %,
   top-3 priority categories.
5. **Generate & review:** calls `/api/generate-plan`, shows a loading state, then renders the
   result as **editable cards** — summary, recommended themes (with palettes), budget
   allocation, phase-wise timeline, vendor checklist with key questions, personalized
   suggestions, **risks/assumptions/missing info**. **Regenerate any section individually**;
   edit before saving. Visible **"Local planner" vs "Gemini"** badge. The event is created
   **only on user confirmation** (preserving original inputs + generated plan), then redirect
   to `/dashboard/[eventId]`.

### Dashboard `/dashboard`

Metrics derived from stored data: active events, upcoming, combined planned budget,
outstanding tasks, tasks due soon. **Event cards:** name/type, date/location, **countdown**,
budget & spend progress, task completion %, status, quick link. Panels: upcoming deadlines,
recently updated, pending vendor decisions, RSVP progress, recent activity, AI recommendations
from real data. **Quick actions** (create event, add task, record expense, add vendor, add
guest) — each opens a working dialog/route. First-run empty state with CTA and a **"Load
sample events"** button (clearly labeled demo data, removable in one click).

### Event workspace `/dashboard/[eventId]`

**Top bar:** event name, date, **live countdown**, quick summary cards (budget, tasks done,
vendors booked, RSVPs) with CountUp, edit details, duplicate, export. Secondary tabs for every
section. **Overview:** high-level metrics, **budget donut (Recharts) with table alternative**,
urgent upcoming tasks, vendor booking status, RSVP summary, saved inspiration, AI suggestions —
updates live on data change.

### Timeline `/timeline`

Grouped by timeframe (6+ months, 3 months, 1 month, 1 week, **Day-of run-of-show** hour-by-
hour). Each item: checkbox, due date, owner, category, priority, notes. Generated from event
type/date/status (Gemini's `dueOffsetDays` is **advisory**; the engine validates it against the
real date). Past/short-notice events surface overdue/urgent items honestly. Per-phase progress
bars; overdue shown with **text, not color alone**. Calendar-month view toggle.

### Tasks `/tasks`

Title, description, status (Todo/In progress/Done), priority, due date, assignee (free text),
category, **dependencies**, notes, timestamps. **List + kanban (drag-and-drop with keyboard
alternative) + calendar** views; search, filters, add/edit dialogs, bulk ops, **dependency
validation preventing cycles/invalid moves**. AI can generate checklists, break tasks into
subtasks, prioritize overdue items; **major schedule changes need confirmation**; user-created
tasks are never modified without explicit request.

### Budget `/budget`

- Summary: total, actual, **committed**, remaining, utilization % (per the money rule).
- **Budgeted-vs-actual table with a per-category progress bar.** Configurable + custom
  categories, **category locking**, inline-editable planned/actual, over-budget warnings with
  **engine-suggested trade-offs**. Add/edit/delete expenses (delete confirmed): category,
  vendor link, amount, date, payment status, notes, mark paid.
- Charts: allocation donut, planned-vs-actual bars, spending distribution — all with **table
  alternatives**. **"What-if" total-budget slider** (debounced).
- **AI Budget Rebalancer button:** the **engine** computes the proposed reallocation
  (respecting locks and the total); Gemini/local **explains the trade-offs in words**. Show
  before/after + assumptions; **applying requires confirmation**. Also supports "reduce my
  budget by 15%" / "where am I overspending?" using real data.
- Currency-aware formatting, no negative amounts, clear empty states.

### Vendors `/vendors`

List + card views. Categories: venue, caterer, photographer, videographer, decorator, florist,
entertainment, makeup/styling, transportation, accommodation.

- **Status workflow:** Shortlisted → Contacted → Quoted → Booked → Paid (with contract status).
  Fields: name, category, contact, website, location, quoted price, negotiated price, notes,
  follow-up date.
- Per category: **key questions to ask + contract checklist** (from the plan's
  `vendorChecklist`), required/optional flag.
- Quote comparison, shortlisting, budget integration (quotes vs category budget with warnings).
- **"Generate AI Vendor Inquiry Draft"** → modal with tailored outreach text (event type, date,
  guests, budget range, key questions); copy button; editable; **never claims it was sent**.
- AI comparison summaries separate known facts from missing info. **Never invent prices,
  contacts, availability, or ratings.** Only user-entered records + clearly labeled samples.

### Guests `/guests`

Name, contact (optional), household/group, invitation status, RSVP status, plus-ones, dietary,
accessibility, meal preference, notes. TanStack table with search/filter, add/edit, RSVP
updates, household grouping, **validated + size-capped CSV import (with error report) and CSV
export**, headcount/RSVP summaries. "Copy invitation/RSVP reminder text" — never claim
sending. **Guest data is private: local only, excluded from AI prompts unless the user opts in,
never logged.**

### Inspiration `/inspiration`

Moodboards, masonry/grid gallery, theme/palette cards, category filters, notes,
reorder/remove, **small local image upload (type+size validated)**, convert an item into a task
or budget draft. Demo assets are SVG/CSS-generated or user uploads — **no broken external
URLs**. AI inspiration returns **text only**: descriptions, palettes, styles, next steps.

### AI Copilot `/copilot`

Event-aware chat: bounded history, streaming where supported, loading/error states, structured
response cards, action buttons, contextual event summary, **"Local planner" vs "Gemini" badge**.
**Prompt chips:** "Optimize my budget", "Suggest budget-friendly return gifts", "Draft a guest
RSVP reminder", "Create 5 theme ideas", "What should I finish this week?", "Create my event-day
schedule", "Compare my vendor quotes", "Improve the guest experience". **Controlled actions
only** (create task draft, suggest task updates, create expense draft, generate milestone
draft, summarize vendor quotes, suggest budget reallocation): each validates params, is scoped
to the current event, and **requires confirmation for financial changes, deletions, and bulk
edits**. The model never silently overwrites user data and never gets arbitrary storage access.

### Export `/export`

Print stylesheet, JSON + CSV download (budget, tasks, vendors, guests), copy-as-text for
WhatsApp. All renderers lazy-`import()`ed on click; exports read the store (screen ≡ file).

---

## 6. ENGINE (`lib/engine/`) — deterministic, pure, fully unit-tested

Owns ALL math and structure; reads templates/weights from config files:

- **budget** — allocation by vertical × guest count × city tier × priorities; integer-minor-unit
  amounts that **sum exactly to the total** (largest-remainder rounding, asserted); contingency
  reserve; **feasibility checks** ("budget too low for N guests") with suggested trade-offs;
  **rebalancer** that preserves locked categories and the total.
- **timeline** — generated **backwards** from the event date (12m→day-of); **auto-compression**
  for short notice; overdue/urgent detection for past/imminent dates; model offsets clamped to
  `[0, runway]`.
- **checklist** — per-vertical vendor categories, questions to ask, document trackers.
- **ideas** — deterministic contextual ideas (vertical, band, per-guest, guest count, outdoor,
  theme, cultural notes), tagged `source: "rules"` so the UI is never empty.
- **task dependencies** — cycle detection, invalid-move prevention.
- **hydrate** — merges LLM enrichment over the baseline; model cannot override structure,
  dates, or totals; `meta.source: "llm" | "local"` recorded honestly.

## 7. AI LAYER (`lib/ai/`) — server-only

`provider.ts` interface with `local` (default) + `gemini` (§2.2). `client.ts` starts with
`import "server-only"`. **Every Gemini response parses with Zod; invalid/failed output falls
back to `local` with a visible notice.** Timeouts, output-length caps, limited retry with
backoff + jitter, rate limiting. **Prompt guard** (`lib/security/prompt-guard.ts`): strip
control chars, cap length, **delimit user free-text as DATA and instruct the model to ignore
instructions inside it**; heuristic flags likely injection (recorded, not blocking). `prompts.ts`
is the only place prompt text lives (versioned; version feeds the cache key). **LRU cache**
(identical request = 0 tokens, `X-Cache-Hit`).

## 8. API

Same-origin JSON. Errors: `{ "error": "<code>", "issues"?: "field: message; ..." }`.

- **`POST /api/generate-plan`** — Zod-validated, sanitized, length-capped input → engine
  baseline → optional Gemini (structured `responseSchema`) → **engine post-processing** (clamp +
  normalize percentages, compute minor-unit costs the client never trusts from the model,
  convert `dueOffsetDays` to real dates validated against the event date) → Zod re-validate → 200. Headers `X-Plan-Source`, `X-Cache-Hit`. Statuses 400 / 429 (+`Retry-After`) / 500
  (generic).
- **`POST /api/copilot`** — bounded context + last 3 turns → typed answer (optionally streamed).
- **`POST /api/draft`** — validated action drafts (task/expense/milestone) for confirmed apply.
- **`POST /api/ideas`** — Zod-validated, sanitized, rate-limited; typed ideas + `source`.
- **Server Actions** (`app/actions.ts`): `recalculateBudget`, `computeVariance`,
  `resetChecklist` — each a **public endpoint**: self-validate with Zod + rate-limit.
- **Gemini response schema (qualitative + advisory)** — see the JSON shape in
  `docs/AI_INTEGRATION.md`; key fields: `themeConcepts[]`, `budgetAdvice[].suggestedPercentage`,
  `timeline[].dueOffsetDays`, `vendorChecklist[]`, `suggestions[]`, `risks[]`, `assumptions[]`,
  `missingInfo[]`. Document prompts/schemas/failure modes in `docs/AI_INTEGRATION.md`.

---

## 9. STATE (`lib/repo/` + Zustand)

`/lib/repo/` defines repository interfaces (`EventRepo`, `ExpenseRepo`, `TaskRepo`,
`VendorRepo`, `GuestRepo`, `InspirationRepo`) with a **Zustand + `persist` (localStorage)
implementation** behind them. **UI never touches storage directly** — this is the seam that
later maps to Prisma/Postgres. Refresh never loses state. Guest/local-first, **no auth, no
server plan storage, no PII**; a plan URL opened elsewhere shows an honest "No saved plan
here" + **Import plan (JSON)**.

---

## 10. SECURITY

Zod on client and server; length caps; strip HTML; **no `dangerouslySetInnerHTML`/`innerHTML`**
(a test fails the build if either appears); no secrets in the client bundle; `.env*` gitignored
with `!.env.example`; **security headers** in `next.config` (CSP, `X-Content-Type-Options`,
`Referrer-Policy`, `frame-ancestors 'none'`); **per-IP rate limiting** + generic errors on all
routes/actions; upload + CSV validation; **prompt-injection handling**; `npm audit` run and
documented. Model output renders as escaped text only. State the privacy model honestly.

## 11. EFFICIENCY

Server Components by default; dynamic-import charts/heavy visuals; `next/font`; optimized
images; paginate/virtualize long lists; memoize engine calls; debounce sliders/search; bounded
chat history; **one LLM call per generation (0 keyless / cache hit)**, none per keystroke; token
caps; **report build output sizes in the README**. Repo < 10 MB; lean bundle.

## 12. ACCESSIBILITY (WCAG 2.2 AA)

Semantic landmarks, skip link, **one `h1` per page**, visible focus, labels with
`aria-describedby` errors, **`aria-live`** announcements, focus management in wizard/dialogs,
**keyboard alternative for drag-and-drop**, **contrast ≥ 4.5:1 in BOTH themes** (§3.2, machine-
enforced), status never by color alone, chart **text/table alternatives**, touch-friendly
targets, responsive tables or card fallbacks, **`prefers-reduced-motion`**. No browser
`alert()`. `@axe-core/playwright` on every main page; serious/critical fail the e2e run.

## 13. UX STATES + RESPONSIVENESS

Every major route handles loading, empty, success, validation error, server error, not-found.
Toasts (sonner) for success/recoverable errors; **confirmation before destructive actions**;
skeletons; inline validation; double-submit prevention; optimistic updates only with rollback.
Desktop: full sidebar, multi-column, detailed tables/charts. Tablet: collapsible nav, adaptive
grids. Mobile: drawer/bottom nav, single column, scrollable tabs, cards over wide tables, **no
horizontal overflow**. Verify at representative widths (320 px + 200% zoom included).

## 14. SAMPLE DATA

Clearly labeled sample events (**one per graded vertical** — wedding, birthday, community;
Corporate optional) with varied budgets, tasks in different states, expenses, vendors at
different workflow stages, guests with varied RSVPs, inspiration, milestones. Loaded **only by
an explicit button**, never silently, removable in one click. **No fake reviews, confirmed
bookings, or fabricated AI activity.**

## 15. TESTING (LLM fully mocked, zero tokens)

- **Unit (Vitest):** budget math (exact sums, committed vs actual, no double-count), rebalancer
  (locks, totals), **percentage normalization/clamping of Gemini advice**, offset→date
  conversion incl. past/short-notice, overdue status, dependency cycles, feasibility warnings,
  currency/minor-unit conversion, Zod schemas, **Gemini response parsing + fallback (mocked
  client)**, CSV parsing, edge cases (0 guests, huge budgets, negatives, NaN).
- **Theme:** contrast proof across **{light, dark} × {base, wedding, birthday, community}**.
- **Integration:** repository CRUD, event creation, expense/task/vendor/guest mutations, API
  validation + rate limit, AI failure handling.
- **Component (RTL):** wizard validation, budget editor, task dialog, confirmation flows,
  vendor-inquiry modal.
- **E2E (Playwright, keyless):** landing prompt → wizard → plan review → save → add expense →
  complete a timeline task → move a vendor through the workflow → generate inquiry draft → add
  guest → copilot chip → export. **Axe scans on every main page.** One motion-enabled test
  asserting content settles visible.
- **Meaningful assertions only** (assert the operation worked, not that a button exists).
  **≥ 80% coverage on `/lib`.** Scripts: `test`, `test:e2e`, `lint`, `typecheck`; CI runs all.

## 16. QUALITY GATES (all green before each push)

```
npm run lint              # eslint, 0 errors
npm run format:check      # prettier
npx tsc --noEmit          # strict TS
npm test                  # vitest (LLM mocked)
npm run build             # production build
npm run test:e2e          # Playwright, keyless, includes axe
npx lhci autorun          # Lighthouse: a11y ≥ .95, best-practices ≥ .90
```

---

## 17. WHAT TO REJECT (do NOT implement) — with reasons

| Rejected ask                                                              | Why                                                                                                              |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Auth / login / sessions / server DB in the default build**              | Breaks keyless, adds PII + scope for zero rubric points. Document the Prisma/Auth migration path instead (§2.3). |
| **Cloudinary/Resend/email-sending**                                       | Out of scope; "copy draft text" only, never claim sent.                                                          |
| **Gradients, neon, glow, giant blobs, glassmorphism**                     | Reads as AI slop; hurts contrast + the anti-slop contract — **in both themes** (§3.3).                           |
| **LLM emitting final costs/dates/totals**                                 | Hallucinates and breaks math. Model = percentages/offsets/rationale only; engine owns arithmetic (§1).           |
| **Fake AI/vendor/payment/email activity; invented vendor prices/ratings** | Dishonest; explicitly penalized (§5 vendors, §14).                                                               |
| **Corporate as a 4th co-equal, seeded vertical**                          | Dilutes the three graded verticals (§2.1). Keep it thin/optional or drop it.                                     |
| **Presenting local-planner output as Gemini**                             | Deception; the source badge is mandatory (§2.2).                                                                 |
| **Trusting model-supplied costs / guest data in prompts**                 | Engine computes costs; guest PII excluded from prompts unless opted in (§5 guests).                              |

---

## 18. README + SUBMISSION

README order: chosen verticals → **approach & logic** (table mapping each required feature to
its file) → how it works (**Mermaid architecture diagram** + flow) → **six-parameter mapping
table** → setup + env (`GEMINI_API_KEY` / `GEMINI_MODEL`, both optional) → testing (commands +
expected output) → **Responsible AI & data handling** → efficiency + **build output sizes** →
**honest limitations** (no auth, no server DB, no email, no real vendor directory, local-only
persistence, Gemini optional, Postgres/Auth migration path) → manual QA matrix (verticals ×
budget tiers + keyboard-only + both themes) → small screenshots.

Before submitting, verify and report:

- Public repo, **single branch**, no tags/forks; **size < 10 MB**; `.env*` ignored,
  `.env.example` present; **secret scan clean**; lockfile committed.
- Runs **keyless** with sample data for a wedding, a birthday, and a community event (incl.
  outdoor weather tasks; budget sums exact to the minor unit) — **in both light and dark**.
- All six rubric parameters have a README section or code artifact.
- Attempts used: **≤ 3** (log in `docs/Memory.md`).

---

## APPENDIX — Phases (execute in order; verify each; a phase isn't done because its UI exists)

1. **Audit & foundation:** inspect repo; keep working features; dual-theme tokens + typography
   (extend the contrast test to 8 scenarios **first**); app shell; route skeleton; UI
   primitives; docs skeleton.
2. **Domain & engine:** schemas, money utilities, rules engine (allocation, timeline,
   rebalancer, feasibility, dependencies), repository layer, local planner. **Unit tests first.**
3. **Public experience:** landing (theme-aware hero, event picker, NL prompt input), onboarding
   wizard UI, consistent states.
4. **Core workspace:** dashboard, overview (countdown + charts), budget, timeline, tasks,
   vendors, guests, inspiration, export — all wired to the repository.
5. **Gemini:** provider, `responseSchema`, `/api/generate-plan`, post-processing, editable plan
   review, copilot chips, vendor inquiry drafts, rebalancer explanations, confirmations,
   fallback + honest badges.
6. **Polish:** Motion + React Bits (reduced-motion safe), responsive pass, command menu,
   theme toggle, accessibility pass, security headers.
7. **Verification & delivery:** lint, typecheck, unit, integration, build, e2e + axe, both
   themes, `npm audit`, docs + README.

**Final report:** what was implemented, which routes are complete, which integrations work,
which env vars are optional, setup/test commands, which checks passed, what remains incomplete
and why. Prioritize functional correctness, coherent architecture, and real data flow over
decorative complexity. **Start now.**
