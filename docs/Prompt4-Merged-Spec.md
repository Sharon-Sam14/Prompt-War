# PROMPT 4 — Merged Spec: "Soirée" GenAI Celebration & Event Planner

> **What this is.** A single, self-contained, pasteable spec that merges the best of three
> source prompts into one buildable mandate. It is the successor to `Full-System-Prompt.md`
> (v2). It is written to be handed to any AI coding assistant to build, audit, or extend the
> app from a fresh clone.
>
> - **Skeleton (non-negotiable):** the deterministic rules engine + keyless-first GenAI layer
>   - the six high-impact rubric parameters. This is where the score lives.
> - **Additive features:** the genuinely valuable product/UX ideas lifted from Prompts 2 & 3,
>   each marked with provenance in §2.
> - **Explicit rejections:** things the source prompts asked for that would _hurt_ the score,
>   each with a reason, in §12. Do not implement them.

---

## 0. ROLE AND COMPETITION CONTEXT

You are a senior full-stack engineer building **Soirée**, a GenAI Celebration & Event
Planning Assistant for **weddings, birthdays, and community events** — all three are
first-class verticals, never wedding-centric. It produces budgets priced to the cent,
reverse T−minus timelines, vendor checklists with inquiry questions, and personalized ideas
(themes, menu, décor, activities, invitation copy, day-of tips).

This is a competition entry. **Six parameters are scored and all are HIGH IMPACT — never
trade one for another:** Code Quality · Security · Efficiency · Testing · Accessibility ·
Problem-Statement Alignment. Submission rules: public GitHub repo, **single branch**,
**< 10 MB**, no secrets anywhere in git history, **max 3 attempts**, commit and push
incrementally (history is reviewed).

**Must run with `npm install && npm run dev` and NO API keys** — keyless mode is the
default and must be honest and fully functional.

> **Next.js note:** this targets the latest stable Next.js App Router. APIs and conventions
> may differ from older versions — read the guide in `node_modules/next/dist/docs/` before
> writing code, and heed deprecation notices.

Working rules for you: make small incremental commits with clear messages; do not rewrite
working code unnecessarily; run lint, typecheck, tests and build after each task; never
claim a gate passed unless you actually ran it; report files changed and anything unverified.

---

## 1. CORE ARCHITECTURAL LAW

A **deterministic rules engine owns ALL math and structure** (cents, dates, percentages,
ordering, feasibility). The **LLM is qualitative only**: it returns themes, menu ideas, décor,
activities, invitation copy, tips, and at most _percentages_ and _day-offsets_ — never a
number that reaches the UI uncomputed. The engine converts model percentages/offsets into
absolute values and **always wins** on conflicts. Every boundary (client form, API body,
persisted plan, LLM output) parses with **Zod**. This is the single most important design
decision: chatbots hallucinate costs and deadlines, and a plan whose totals don't add up is
worse than no plan.

```
client (Zustand) --POST /api/plan--> rate limit → Zod → rules-engine baseline
                                          │                 │
                                          ▼                 ▼
                                 prompt-guard ← buildPlanPrompt
                                          │
                                          ▼
                   LLM generateObject (optional, key) → Zod LlmEnrichmentSchema
                                          │ fail: ≤2 retries, backoff + jitter, in timeout
                                          └→ hydrate merge (engine math WINS)
                                                    │
                                                    ▼
                                       Zod re-validate PlanSchema → 200 → store
```

---

## 2. FEATURE SET (merged, with provenance)

Legend: **P1** = engine/spec prompt · **P2** = premium-SaaS product prompt · **P3** =
EventCraft/Gemini prompt. ✅ = include · ⛔ = reject (see §12).

### Core (from P1 — the score-bearing skeleton)

- ✅ Deterministic rules engine owning budget, timeline, checklist, feasibility. **P1**
- ✅ Keyless-first; LLM is optional enrichment, never required. **P1**
- ✅ Zod at every boundary; server re-validates everything. **P1**
- ✅ Reverse T−minus timeline with automatic short-notice compression. **P1**
- ✅ Per-IP rate limiting, prompt-injection guard, security headers. **P1**
- ✅ WCAG AA, keyboard-only, reduced-motion, axe in CI. **P1**
- ✅ Three verticals each with distinct templates/weights/ideas. **P1**

### Product & design depth (from P2 — visibly better product)

- ✅ **Warm light-first palette** — ivory canvas, deep plum primary, soft lavender highlight,
  muted sage support; generous whitespace, subtle 1px borders, rounded cards. **P2**
- ✅ **Landing dashboard preview** + an **AI-generated plan preview** section. **P2**
- ✅ **Testimonials (clearly labeled as sample content), FAQ, and a pricing section** on the
  landing page. **P2**
- ✅ **Natural-language plan input** — a "Plan it for me" box: _"Plan a 150-person wedding in
  Mumbai for ₹12 lakh."_ Parsed client-side into wizard fields (never trusted; Zod-validated
  like any input). Directly scores **Assistant behavior / logical decision making**. **P2**
- ✅ **Event switcher** for managing multiple events. **P2**
- ✅ **Kanban task view** as an alternative to list view (list stays default). **P2**
- ✅ **Guest list tab** (search, RSVP, dietary, plus-ones, CSV import/export) — optional,
  lowest rubric return; build last. **P2**
- ✅ **Currency + locale selection**, INR default, `Intl`-based money formatting. **P1+P2**

### AI UX specifics (from P3 — visible GenAI value)

- ✅ **Strict structured-JSON output** via a response schema; parse with Zod, fall back to
  mock on any failure. **P3** (merged with P1's "LLM never emits final numbers")
- ✅ **AI Copilot tab with prompt chips** — "Make it more budget-friendly", "Add a kids'
  corner", "Draft an RSVP reminder", "5 theme ideas". **P3**
- ✅ **"AI Budget Rebalancer" button** + a **what-if total-budget slider** with live
  reallocation (debounced; engine does the math). **P3** + **P2**
- ✅ **Vendor inquiry draft generator** — a modal with tailored outreach text per vendor type.
  **P3**
- ✅ **Seeded sample events** (one per vertical) so a reviewer sees the full app in seconds.
  **P1** (rubric: "demo works end to end")

---

## 3. DESIGN LANGUAGE (warm, editorial, anti-AI-slop)

- **Light-first.** One primary theme: warm ivory canvas `#faf7f0`, card `#ffffff`, ink
  `#241a20`, deep-plum primary `#5b2340`, lavender highlight `#e7dff0`, muted-sage support
  `#6f7d63`, gold hairline `#9a7b33`. Optional dark mode is an **enhancement, not a
  requirement** — if implemented, it must pass the same contrast test; otherwise ship
  light-only and say so. Do not let dark mode compromise the light experience.
- **Color contract:** literal hex lives ONLY in `app/globals.css` as role tokens
  (`--background`, `--foreground`, `--card`, `--border`, `--accent`, `--highlight`,
  `--muted`, `--success`, `--danger`, `--ring`). Components use role utilities only; zero
  inline hex in `.tsx`.
- **Per-vertical accent remap:** `data-vertical="wedding|birthday|community"` on a wrapper
  re-tints accent roles (plum+lavender / blush+gold / forest+sage).
- **Typography:** a display serif for headings + a readable serif or humanist sans for body +
  a mono for eyebrows/tabular money. Load via `next/font`, self-hosted. One script flourish
  per screen at most.
- **Strictly banned (reads as AI slop):** gradients, glassmorphism/backdrop-blur, neon/glow,
  3D glossy objects, AI sparkles, cursor-follow effects, clip-art, hotlinked stock, floating
  ribbons, lorem/dead links, clickable `<div>`s.
- **Imagery:** prefer SVG and CSS. If photos are used, bundle a **few compressed** JPEGs
  (≤ 250 KB each) locally in `public/images/`, in a small number of framed slots, decorative
  (`alt=""`, `aria-hidden`). The repo must stay **< 10 MB** — no videos, no big fonts, no
  committed `node_modules`.
- **Motion:** minimal and functional. Use a **filtered React Bits subset** only (see §9),
  adapted to the theme — never the reverse. Every animation is disabled under
  `prefers-reduced-motion: reduce`.

---

## 4. ROUTES AND PAGES

### `/` Landing (server component)

- Skip-to-content link first. Sticky nav (solid bg, hairline border): brand, in-page
  anchors (FEATURES · HOW IT WORKS · PRICING · FAQ), and a "Local-first, no account" chip.
  Responsive mobile menu. No fake SIGN IN.
- Hero: animated heading (SplitText/FadeContent, reduced-motion-safe), one-line value prop,
  primary CTA **"Plan my event"**, secondary **"Try a sample event"**.
- **Three event-type cards** (Wedding, Birthday, Community) linking into the wizard
  prefilled.
- **"How it works"** in 3 steps; **features grid** (Budget · Timeline · Vendors · Ideas).
- **Dashboard preview** + **AI-generated plan preview** sections.
- **Testimonials** (labeled sample content), **pricing** (free / keyless), **FAQ**.
- Footer: privacy note — _data stays in your browser in keyless mode_ — plus the
  vendor/pricing disclaimer (§7).

### `/plan/new` — Create wizard

Multi-step with progress indicator, per-step validation, keyboard navigation, and a draft
saved to Zustand on every step (refresh loses nothing):

1. **Type** — wedding / birthday / community + subtype (e.g. milestone birthday, fundraiser).
2. **Basics** — name, date (date picker; warn if < 30 days), city, guest count (slider +
   number input), indoor/outdoor.
3. **Budget** — total + currency (default INR ₹), flexibility (strict/moderate/flexible),
   top-3 priorities.
4. **Preferences** — vibe chips (traditional, minimal, rustic, modern…), dietary needs,
   cultural/religious notes (free text, sanitized), age range, accessibility needs.
5. **Natural-language accelerator** _(optional)_ — "Plan it for me" box parsed into the above.
6. **Review & Generate** — summary, Generate button with loading skeleton, then redirect.

Every input has a visible label + helper text; errors set `aria-invalid` and link via
`aria-describedby`; focus moves to the first invalid field. Client mirrors the server Zod
schema for instant feedback (UX only — server re-validates).

### `/events` — My events

List/cards of saved events with progress, date, type; event switcher; empty state with CTA;
delete with confirmation dialog.

### `/events/[id]` — Dashboard

- Header: event name, live countdown, type badge, edit button.
- Four summary cards (Budget used · Tasks done · Vendors booked · Days left) with CountUp
  (final value in DOM for AT).
- Tabs: **Overview · Budget · Timeline · Vendors · Ideas · Guests (optional) · AI Copilot**.
- Overview: next 5 upcoming tasks, overdue alerts (text + icon, never color-only), quick
  actions (regenerate ideas, export, duplicate).
- **AI Copilot tab:** conversational panel with context snapshot + last 3 turns, prompt
  chips, `aria-live` answers, source badge (Engine / Model), one-click "apply" with
  confirmation before mutating the plan.

### `/events/[id]/budget`

- Donut chart (Recharts) **plus an accessible data table** (planned vs actual vs remaining).
- Inline-editable planned/actual (Enter commits, Escape reverts); engine **rebalances**
  unlocked categories. Add custom category; lock a category from rebalancing.
- **What-if total-budget slider** with debounced live reallocation; **"AI Budget Rebalancer"**
  button; over-budget warnings with the engine's suggested trade-offs.

### `/events/[id]/timeline`

- Vertical timeline grouped by phase (T−12m → day-of), auto-compressed if the date is close.
- Task: title, due date, owner, status (todo/doing/done), category tag, notes.
- **Drag-and-drop reorder (@dnd-kit) with a keyboard alternative** (move up/down buttons,
  roving tabindex). Filter by status/category. Toggle **list ↔ calendar ↔ kanban** view.
- Per-phase progress bar; overdue highlighted with text, not only color.

### `/events/[id]/vendors`

- Categories per vertical (venue, caterer, photographer, decorator, DJ, mehendi, cake,
  transport…).
- Per-vendor card: name, contact, quote, deposit paid, status (shortlisted/contacted/booked/
  paid), notes. Add/edit/delete with confirm dialog.
- Checklist of **questions to ask** each vendor type + a contract checklist.
- **Vendor inquiry draft generator** (modal, tailored outreach text).
- Sum of quotes vs budget category with warning.

### `/events/[id]/ideas`

- Tabs: **Themes · Menu · Décor · Activities · Invitation text · Day-of tips**.
- Each card: **Save · Regenerate this · Copy**; a **"Board"** section of saved ideas.
- Free-text prompt box → `POST /api/ideas`. **Visible badge: "Local templates" vs "AI".**

### `/events/[id]/export`

- Printable summary (print stylesheet), **Download JSON**, **Download CSV** (budget, tasks,
  vendors), **Copy-as-text** for WhatsApp. All renderers lazy-`import()`ed on click.

### `/settings`

- Currency, theme (light/dark/system if dark ships), reduced-motion override, clear all
  data, **AI mode status (keyless vs key set)**.

### Utility

- `not-found.tsx`, `error.tsx`, `loading.tsx` per route group; `/about` explaining the
  rules engine vs AI split.

---

## 5. DETERMINISTIC RULES ENGINE (`lib/engine/`, pure, no I/O)

All templates live in **config files** (`lib/config/*.ts`), not scattered in code.

- **`budget.ts`** — weights per vertical × guest band × city tier × user priorities;
  **integer-cent allocation summing exactly to the total** (largest-remainder rounding,
  asserted in tests); contingency reserve; feasibility warnings ("budget too low for N
  guests") with suggestions; rebalancing that respects locked categories.
- **`timeline.ts`** — tasks generated **backwards** from the event date (12m, 9m, 6m, 3m, 1m,
  1w, day-of), **compressed automatically** when the date is close; model offsets clamped to
  `[0, runway]`; past dates rejected at schema level; outdoor flag injects weather tasks.
- **`checklist.ts`** — per-vertical vendor categories, inquiry questions, document trackers.
- **`ideas.ts`** — deterministic contextual ideas (vertical, band, per-guest, guest count,
  outdoor, theme, cultural notes), tagged `source: "rules"` so the UI is never empty.
- **`hydrate.ts`** — merges LLM enrichment over the baseline; model cannot override
  structure, dates, or totals; `meta.source = "llm" | "fallback"` recorded honestly.
- **`ask.ts`** — deterministic responder answering only from the plan snapshot (a unit test
  proves it never quotes a number absent from the snapshot); supports one clarifying
  follow-up.

---

## 6. GENAI LAYER (`lib/ai/`, server-only)

- `provider.ts` defines an interface with **two implementations**: **`mock`** (default,
  deterministic, template-based, no network, zero tokens) and **`llm`** (used **only** if an
  API key is set; Gemini or OpenAI-compatible via `fetch`). Keys are server-side only.
- `client.ts` starts with `import "server-only"` — any client-bundle import fails the build.
- **All LLM output parses with Zod; on any failure, fall back to the mock provider.** Bounded
  retries (≤2) with exponential backoff + jitter, inside an overall timeout. Never throws to
  the route.
- **Prompt guard** (`lib/security/prompt-guard.ts`): strip control chars, cap length,
  **delimit user free-text as DATA not instructions**, and instruct the model to ignore any
  instructions embedded inside it; a heuristic flags likely injection (recorded, not
  blocking).
- `prompts.ts` is the only place prompt text lives (versioned; version feeds the cache key).
- **Efficiency:** LRU cache (identical request = 0 tokens, `X-Cache-Hit`); `maxOutputTokens`
  caps; send only needed context; trim history to the last 3 turns; no per-keystroke calls.

---

## 7. API

Base: same-origin JSON. Errors: `{ "error": "<code>", "issues"?: "field: message; ..." }`.

- **`POST /api/plan`** — body validated by `PlanInputSchema` (vertical, eventDate future,
  guestCount 1..10000, budgetTotalCents positive int, currency ISO-4217, band, optional
  location/theme/culturalNotes/isOutdoor). Pipeline: rate limit (10/min/IP) → Zod → engine →
  rules ideas → cached LLM enrichment (skipped if keyless) → hydrate → Zod re-validate → 200.
  Headers `X-Plan-Source`, `X-Cache-Hit`, `X-Prompt-Flag`. Statuses 400 / 429 (+`Retry-After`)
  / 500 (generic).
- **`POST /api/ideas`** — Zod-validated, sanitized, length-capped, rate-limited; returns typed
  JSON ideas with a `source` badge value.
- **`POST /api/ask`** — `{ question ≤500, history ≤3 turns, context: AskContext }` →
  `{ answer, source, followUp?, suggestions? }`. Rate limit 30/min/IP.
- **Server Actions** (`app/actions.ts`): `recalculateBudget`, `computeVariance`,
  `resetChecklist`. Each is a **publicly reachable endpoint** — self-validate with Zod and
  apply the same rate-limit discipline.

Responsible-AI disclaimer shown under Budget, Vendors, Export and in the footer:
_"Estimates and vendor suggestions are planning guidance, not quotes. Confirm prices and
availability with vendors."_

---

## 8. STATE (Zustand, local-first, no auth)

- `eventStore` (events list, active event) + `uiStore`, persist middleware to `localStorage`
  (key `soiree-planner` v1) with `skipHydration: true` + a `useSyncExternalStore`
  rehydration hook. `partialize` keeps only plan data — no status, no error, no identifiers.
- **Deliberate choice:** guest/local-first — no login, no server-side plan storage, no PII
  beyond the plan. Opening a plan URL on another device shows an honest "No saved plan here"
  with an **Import plan (JSON)** button. Do not describe the URL as "shareable".
- Server owns math and validation; the store **adopts** server outputs; optimistic edits are
  UI-local until verified.

---

## 9. MOTION (filtered React Bits subset)

Use React Bits **selectively** for premium effects: a text reveal on the hero heading, a
CountUp on budget numbers, an AnimatedList on checklists, a subtle scroll reveal on feature
cards. Use `motion`/framer-motion only where React Bits doesn't cover it. Copy components
into `components/reactbits/` as owned code.

- Prefer the **TS + Tailwind** variants. Review every copied file: strip unused props and any
  hardcoded hex/gradient/glow/blur. Reject any component needing three.js, ogl, or WebGL.
- **Banned:** particles/aurora/WebGL backgrounds, glows, spotlights, tilt, shiny/gradient
  text, cursor-follow. Never animate form inputs, ledger cells, or assistant answer text.
- **Accessibility (non-negotiable):** all motion disabled/instant under
  `prefers-reduced-motion: reduce` (CSS **and** JS). SplitText must keep the heading a single
  accessible string (`aria-label` on the heading, split spans `aria-hidden`). CountUp puts
  the final engine value in the DOM for AT. No layout shift; `aria-live` announces final
  values, not intermediate frames.
- **Efficiency:** motion lives in `"use client"` leaf files; pages stay server components;
  lazy-load below-the-fold motion; **total added JS < 30 KB gzip** — record before/after
  bundle sizes; if exceeded, drop components, never accessibility.

---

## 10. SECURITY

- **No secrets in the client bundle.** `.env.example` only; `.env*` gitignored. Keys
  server-side. No secrets anywhere in git history (scan and record).
- **Zod-validate every input** on client and server; strip HTML; cap lengths.
- **Prompt-injection resistance:** delimit and neutralize user free-text in all prompts.
- **No `dangerouslySetInnerHTML` / `innerHTML`** anywhere; a test fails the build if either
  appears. Model output renders as escaped text/markdown only.
- **Security headers** in `next.config`: CSP, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy`, `frame-ancestors 'none'`.
- **Rate limiting** per IP on every route and server action; generic error messages; no
  stack traces or internals leaked.
- Run **`npm audit`** and document the result in the README.
- No unnecessary PII; document how data and prompt content are handled.

---

## 11. EFFICIENCY

- Server Components by default; `"use client"` only where needed. Dynamic-import charts and
  heavy motion. `next/font`; no big assets.
- **One LLM call per plan generation** (0 in keyless mode or on cache hit); one per
  assistant question; none per keystroke. Debounce the what-if slider.
- Token caps, trimmed history, LRU cache, bounded retries with backoff, timeouts, no runaway
  loops. Loading skeletons for perceived performance.
- Paginate long lists. Repo < 10 MB; lean bundle; report build output sizes in the README.

---

## 12. WHAT TO REJECT (and why) — do NOT implement

| Rejected ask                                                             | Source | Why                                                                                                                                                   |
| ------------------------------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth (`/login`, `/signup`, sessions), server-side plan storage           | P2, P3 | Adds PII, scope, and risk for zero rubric points; the challenge rewards **keyless, local-first**. Ownership checks are N/A by design — document that. |
| **"Corporate" event type** (4th vertical)                                | P2     | The vertical is weddings/birthdays/community. A 4th dilutes "all three first-class."                                                                  |
| **Image uploads / Pinterest moodboards / hotlinked stock**               | P2     | Collides with **repo < 10 MB**. Use SVG/CSS or a few bundled compressed images.                                                                       |
| **Glowing/neon/dark-heavy hero, particles, aurora, blurred backgrounds** | P3     | Reads as AI-generated slop; graders penalize it.                                                                                                      |
| **LLM emits `estimatedCost` / final numbers**                            | P3     | Hallucinates and breaks totals. Model returns percentages/offsets only; engine owns arithmetic.                                                       |
| Hardcoding one vendor SDK as the only path                               | P3     | Keep the `provider.ts` interface with a **mock default** so the app is fully functional keyless.                                                      |

---

## 13. ACCESSIBILITY CONTRACT (WCAG 2.2 AA, test-enforced)

- Semantic landmarks (single `nav`/`main`/`footer`), one `h1` per page, ordered headings, real
  `<button>`/`<label>`, visible focus rings, no keyboard traps.
- Labels + errors tied via `aria-describedby`; errors announced with `aria-live`; required
  fields announced.
- `aria-live` for totals/answers/generation status; `aria-expanded` accordions; `aria-pressed`
  chips; `aria-selected` tabs (correct orientation); roving tabindex in timeline/kanban;
  every icon-only button has an accessible name.
- **Never convey state by color alone** (overruns get icon + text).
- Charts have a **text/table alternative**; drag-and-drop has a **keyboard alternative**.
- Works at **320 px width and 200 % zoom** with no horizontal scroll.
- A contrast test parses `globals.css` and asserts AA for every token pair across all
  verticals (and both themes if dark ships). A failing pair fails the build.
- `@axe-core/playwright` runs on every main page; **serious/critical violations fail e2e**.
  Record a manual keyboard-only run in the README QA matrix.

---

## 14. TESTING (LLM fully mocked, zero tokens)

- **Engine:** allocation sums exactly to the total; rebalancing respects locks; timeline
  date math incl. **short-notice compression**; feasibility warnings; edge cases (0 guests,
  past date, huge budgets, 10 000 guests).
- **Schemas:** Zod schemas for all boundaries.
- **AI provider:** mock/llm interface, **fallback on malformed output**, prompt builder
  (system vs delimited user data), retry → fallback, timeout, cache hits.
- **API route:** validation, rate limit (429 + `Retry-After`), keyless Gate 1.
- **RTL:** wizard validation, budget editor.
- **Security:** prompt-guard, injection strings, XSS payload in free text, no `innerHTML`,
  limiter.
- **Accessibility:** contrast proof, axe, 320 px/200 % zoom, keyboard-only flow.
- **E2E (Playwright):** create via wizard → dashboard → edit budget → complete task → add
  vendor → export; JSON round-trip; reload persistence; zero page errors; one motion-enabled
  test asserting content settles visible.
- **Coverage target ≥ 80 % on `/lib`.** CI (GitHub Actions) runs lint, format, typecheck,
  test, build, e2e, and Lighthouse; README shows the badge and expected output.

---

## 15. QUALITY GATES (run in order; all green before each push)

```
npm run lint              # eslint, 0 errors
npm run format:check      # prettier
npx tsc --noEmit          # strict TS, clean
npm test                  # vitest; report real counts
npm run build             # production build
npm run test:e2e          # Playwright, keyless, includes axe
npx lhci autorun          # Lighthouse: a11y ≥ .95, best-practices ≥ .90
```

---

## 16. README AND SUBMISSION GATE

README order: chosen vertical → **approach and logic** (table mapping each required feature
to the file that implements it) → how it works (Mermaid architecture diagram + flow) →
**six-parameter mapping table** → assumptions & limitations → quick start (install, env,
run, test with expected output) → Responsible AI & data handling → efficiency + **build
output sizes** → manual QA matrix (3 verticals × budget tiers + keyboard-only) → small
screenshots.

Before submitting, verify and report:

- Public repo, **single branch**, no tags/forks; **size < 10 MB**; `.env*` ignored,
  `.env.example` present; **secret scan clean**; lockfile committed.
- Runs **keyless** with **seeded sample data** for a wedding, a birthday, and a community
  event (incl. an outdoor plan with weather tasks; budget sums exact to the cent).
- All six rubric parameters have a README section or code artifact.
- Attempts used: **≤ 3** (log in `docs/Memory.md`).

---

## APPENDIX — Build order (maximizes score per attempt)

Engine + tests → types/schemas → store → UI primitives → wizard → dashboard + tabs →
AI route + provider (mock first, key optional) → ideas/copilot → budget what-if/rebalancer →
timeline kanban/dnd → vendor inquiry drafts → sample seeds → polish/a11y/security headers →
e2e + CI → README. Treat alignment, code quality, security, efficiency, testing, and
accessibility as **equally mandatory** — do not finish one before starting the others.
