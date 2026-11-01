# Frontend Review — Prompt

> Copy everything below the line into a fresh agent session. It is written as an
> instruction **to the reviewer**, and it carries the full inventory of routes,
> page contents and design contracts so the review can be done without re-reading
> the repo cold.

---

## Role

You are a senior frontend reviewer (design-engineering background) auditing the
**GenAI Celebration & Event Planner** — a Next.js 16 App Router / React 19 /
TypeScript-strict / Tailwind v4 application. Your job is to produce a **prioritised,
evidence-based frontend review**: what each page contains, whether it is coherent
and accessible, where it breaks, and what to change — in that order.

Review the **frontend only**. Do not redesign the rules engine, the GenAI layer, or
the persistence model. You may read them to explain UI behaviour.

## Product constraints (non-negotiable — treat violations as findings)

1. **Dark mode only.** The app ships one theme: "aubergine & wine". There is no
   light mode, no theme toggle, no `prefers-color-scheme` switch. Dark must be the
   first painted state (no flash), and must survive JavaScript being disabled.
2. **Keyless-first.** No `GEMINI_API_KEY` / `OPENAI_API_KEY` is required. Both API
   routes fall back to a deterministic local engine. Every screen must be fully
   usable and visually complete in keyless mode.
3. **Local-first, no account.** No auth, no database, no email. Plans persist to
   `localStorage` (`promptwar-planner`, v1, `skipHydration: true`). Any component
   reading persisted state must call `useRehydratePlanner()`.
4. **Color lives only in `app/globals.css`.** No inline hex in `.tsx`. Components
   use semantic tokens (`bg-background`, `text-muted-foreground`, `text-accent-a`,
   `text-gilt-text`, …).
5. **All three verticals are first-class** — wedding, birthday, community. Never
   wedding-centric copy. Each vertical re-tints accent roles via
   `data-vertical="wedding|birthday|community"` on a wrapper element.
6. **WCAG AA contrast is machine-verified.** `tests/unit/theme-contrast.test.ts`
   asserts 281 contrast pairs across `{light, dark} × {base, wedding, birthday,
community}`. Do not propose changes that would require renaming the `:root` or
   `.dark` blocks in `globals.css` — the test parses them by exact selector text.
7. **Anti-slop design contract.** No glassmorphism-for-its-own-sake, no neon, no
   AI-sparkle iconography as a personality, no dead links, no clickable divs, no
   hotlinked stock photography. Photography, where used, is bundled under
   `public/images/photos/` and confined to sanctioned "print mount" slots.
8. **Money is integer cents.** `formatMoney` uses `minimumFractionDigits: 0`, so
   5000¢ renders `$50` (locale may render `US$50`). Never assert exact money
   strings in tests — use a regex such as `/\$[\d,.]+ \/ guest/`.
9. **Ship size:** repo under 10 MB, single branch `main`, ≤ 3 submission attempts.

## Route map

| Route            | Rendering               | File                                                               | Purpose                                                           |
| ---------------- | ----------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `/`              | Static (`○`)            | `app/page.tsx` → `components/landing-page.tsx`                     | Marketing landing page. No form.                                  |
| `/create`        | Dynamic (`ƒ`)           | `app/create/page.tsx`                                              | Dedicated event-setup page (the only place the setup form lives). |
| `/onboarding`    | Static (`○`)            | `app/onboarding/page.tsx`                                          | 5-step guided wizard. Accepts `?prompt=` and `?vertical=`.        |
| `/plan/[id]`     | Partial prerender (`◐`) | `app/plan/[id]/page.tsx` → `components/planner/plan-dashboard.tsx` | The plan dashboard, six tabs.                                     |
| `POST /api/plan` | Dynamic (`ƒ`)           | `app/api/plan/route.ts`                                            | Validates `PlanInput`, rate-limits, returns a generated plan.     |
| `POST /api/ask`  | Dynamic (`ƒ`)           | `app/api/ask/route.ts`                                             | Plan-scoped assistant question, deterministic fallback.           |
| `/icon.svg`      | Static                  | `app/icon.svg`                                                     | Favicon.                                                          |

Global chrome from `app/layout.tsx`: skip-to-content link (`#main-content`,
first in DOM), font variables on `<html>`, `ThemeProvider` pinned to dark, and the
`dark` class hard-coded on `<html>`.

---

## Page-by-page inventory

### `/` — Landing page

`components/landing-page.tsx` is a **client component** (the natural-language
prompt bar owns state and routing). Section order, top to bottom:

1. **Skip link** (from `app/layout.tsx`) — visually hidden until focused, jumps to
   `#main-content`.
2. **Sticky nav** — `aria-label="Site"`, `glass-panel`, 1px `border-border` hairline.
   - Wordmark `❦ Event Planner` → `#top`.
   - Links: `Home` (`#top`, `aria-current="page"`), `Features` (`#features`),
     `How it works` (`#how-it-works`) — anchors only; the former `Create event`
     nav entry was removed (owner direction 2026-10-27, D47). All nav items are
     plain `<a>` hash links now.
   - Utility cluster (right): pill chip "Local-first — no account", hidden below
     `md`.
3. **Hero** (`aria-labelledby="hero-title"`).
   - `<h1>` "Your celebration, handled" + a decorative bouncing `❦`
     (`aria-hidden`).
   - Subtitle: weddings / birthdays / community events, deterministic plan,
     "No API key required. Keeps your data in your browser."
   - **Natural-language prompt bar**: a single glass pill
     (`rounded-full`, `items-center`, `focus-within:ring-2`), containing a
     `Sparkles` icon, a `type="search"` input labelled
     _"Describe your event in plain language"_, and a pill **Curate** submit
     button. It is a real `<form onSubmit>`; Curate pushes
     `/onboarding?prompt=<encoded>` (no-op on empty input).
   - **"Try:" chips** — three example prompts. Clicking one sets the input value
     in React state and focuses the input (it does **not** navigate).
   - **Three vertical cards** — Wedding / Birthday / Community. Each is a `Link`
     to `/onboarding?vertical=<value>` wrapping `data-vertical="<value>"` and
     `.event-card`. Contents: SVG illustration, label, hint line, and a mini
     "Sample plan" block (`justify-between` + `items-baseline`, mono
     `tnum` "Est. $4,800", 2-line detail). Hover: spring lift `y: -6`, accent
     stripe fades in, accent top border.
4. **`#features`** — eyebrow heading + hairline rule; three bordered cards
   (`Deterministic Budget Ledger`, `Reverse Timeline Matrix`,
   `Vendor Operations Checklist`), each with an inline SVG, body copy, and a mono
   "data sheet" preview line.
5. **`#how-it-works`** — eyebrow heading; ordered list of three numbered steps
   (`Curate details`, `Deterministic & AI engine`, `Live execution dashboard`),
   each with an index numeral, icon, body, and mono input-preview box.
6. **`#trust`** — "Why you can trust the numbers": three `Card`s — _Rules engine
   owns the math_, _No hidden costs_, _Confidence through transparency_.
7. **`#preview`** — "Dashboard preview": a `figure` with an `sr-only` caption and
   an **illustrated placeholder tile** (4-rect SVG, "Interactive dashboard",
   "Budget donut · Reverse timeline · Vendor checklist · AI copilot", and a
   "Try it yourself →" link to `/onboarding`). It is **not** a real screenshot —
   evaluate whether that is acceptable honesty or a credibility gap.
8. **`#faq`** — Radix `Accordion.Root type="multiple"`, six questions: API key,
   data locality, export formats, supported event types, budget math, and the
   appearance/theme question.
9. **Footer** — script signature `❦ GenAI Celebration & Event Planner`,
   "Local-first — no account…", "Budget math is engine-verified…", and a
   full-width disclaimer that estimates are guidance, not quotes.

**Landing page does _not_ contain:** the setup form, pricing, sign-in, testimonials,
logos, newsletter capture, or a light/dark switch. If you find any of these, that is
a finding.

### `/create` — Event setup

`app/create/page.tsx` (async server component):

- `export const instant = false` + `await connection()` — the form's defaults
  depend on today's date (`min` = tomorrow, default = today + 180 days), which
  `cacheComponents` forbids during prerender. The route therefore renders per
  request and is **not** wrapped in `<Suspense>`: an earlier version used a
  Suspense boundary and the streamed fallback ("Loading event setup…") could be
  left stranded with a duplicated hidden copy of the form in the DOM. Keep the
  blocking render; do not reintroduce a Suspense shell here.
- Header row: "← Back to Home" `Link` to `/`.
- `<main id="main-content">` containing `EventSetupForm` directly.
- Background: `AuroraBackground`.

`components/forms/event-setup-form.tsx` (client) renders a `data-vertical` wrapper
with a split "stationery" layout:

- **Left column:** eyebrow "Create your event", display `<h2>` "New event plan",
  gilt rule, promise lines, vertical vignette.
- **Right column (card):**
  - Event-type radio cards (wedding / birthday / community) — re-tints the whole
    wrapper live.
  - `Event date` (with live T−days chip).
  - `Guests` (with live ≈ per-guest badge).
  - `Total budget`, `Currency` select.
  - `Spending style` band (micro / standard / premium).
  - `Location (optional)`, `Style or theme (optional)`,
    `Cultural notes (optional)`.
  - Vertical-aware **preset chips** (fill fields; never bypass validation).
  - `Outdoors` checkbox ("adds weather-contingency tasks").
  - **Generate plan** button with `aria-live` status and a loading state; on
    success `router.push('/plan/<id>')`.

### `/onboarding` — 5-step wizard

Client page wrapped in `AuroraBackground`:

- Header: "← Back to Home".
- Main: a fluid `max-w-4xl` `glass-panel` card.
- **Mobile (`<768px`)**: `MobileStepper` with Back/Next and a "Step N of 5" label.
- **Desktop**: horizontal progress `nav aria-label="Onboarding progress"` listing
  the five steps with active/completed states.
- Steps:
  1. **Event type** — "What type of event?" three selectable cards.
  2. **Details** — event name, date, location, status select, free-text vision.
  3. **Style & vibe** — theme, colour palette, style select, dietary needs,
     accessibility needs, cultural/religious notes, extra notes.
  4. **Budget** — amount, currency, priority select, budget sliders.
  5. **Review** — "Your plan is ready": summary of the inputs + generate action.
- Query params: `?prompt=` prefills the free-text description; `?vertical=`
  preselects the event type. Both are how the landing page hands off.
- Back is disabled on step 1. Transitions are `AnimatePresence` and must honour
  `prefers-reduced-motion`.

### `/plan/[id]` — Plan dashboard

`components/planner/plan-dashboard.tsx`:

- Header: `<h1>` = `<vertical> · <formatted event date>`, plus a source badge —
  **"Model-enriched"** when `plan.meta.source === "llm"`, **"Engine-only"**
  otherwise. This badge must stay honest.
- Radix `Tabs` in `orientation="vertical"`; on `lg` the tab list is a 220px left
  sidebar, below `lg` it becomes a horizontal strip.
- Six tabs, each backed by a component in `components/planner/`:
  | Tab       | Component                                       | Contents                                                                                            |
  | --------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------- |
  | Overview  | `overview-panel.tsx`                            | Plan banner, stat-card row, "next up" list, summary block.                                          |
  | Budget    | `budget-table.tsx`                              | Editable planned cells (enter cents/amounts, commit on Enter), planned-vs-actual variance, reserve. |
  | Timeline  | `timeline-view.tsx`                             | Reverse T−minus task list with checkbox completion.                                                 |
  | Checklist | `vendor-checklist.tsx`                          | Vendor categories, status transitions (first contact → booked), next-move hints.                    |
  | Ideas     | `ideas-view.tsx`                                | GenAI/engine creative suggestions, source-badged.                                                   |
  | Exports   | `exports-panel.tsx` + `import-plan-control.tsx` | CSV / Markdown / PDF / JSON export, plus JSON import round-trip.                                    |
- Print styles hide the sidebar (`print:hidden`) so exports/printouts are clean.

### API routes

- `POST /api/plan` — Zod-validated `PlanInput`; per-IP rate limit (10 plans/min);
  returns the full plan JSON; `429` with `Retry-After` when limited; `500`
  `{ error: "plan_failed" }` on engine failure. Falls back to the deterministic
  engine when no key is configured.
- `POST /api/ask` — plan context + question; rate-limited; keyless deterministic
  answer (e.g. "N of M tasks done and X of Y vendors booked").

Both are `server-only`; client components must never import `lib/genai/*`.

---

## Design-system contract to review against

- **Palette:** dark "aubergine & wine" only — deep aubergine surfaces, wine
  primary, gilt accents, per-vertical accent roles. `.dark` block in
  `app/globals.css` is the single source of truth. The light `:root` block still
  exists **solely** because the contrast test parses it.
- **Type stack:** Cormorant Garamond (display), EB Garamond (body/UI),
  IBM Plex Mono (`.eyebrow`, `.tnum` data), Pinyon Script (`.script` — exactly one
  flourish per screen: hero kicker + footer signature).
- **Surfaces:** flat cards, 1px `border-border` hairlines, `glass-panel` reserved
  for the sticky nav, the prompt pill, and the wizard card. `AuroraBackground`
  supplies the ambient backdrop on `/`, `/create`, `/onboarding`.
- **Motion:** `Reveal` (staggered fade-up), spring hover lifts on vertical cards,
  count-ups on stats. Everything must collapse under
  `prefers-reduced-motion: reduce`; no content may be hidden if animation never
  fires (a 1200 ms safety timer clears arming classes).
- **A11y:** skip link first in DOM; one `<h1>` per page; every nav item a real
  link; icon-only controls labelled; `aria-live` on async status; focus-visible
  rings on all interactive elements; no `div` acting as a button.

## Responsive / zoom requirements

- 320 px wide: no horizontal overflow on any route.
- 200 % browser zoom at 320 px: still no horizontal overflow.
- Wizard is usable at 390 px (mobile stepper, not the desktop progress rail).
- Tab strip wraps rather than clips below `lg`.
- Lighthouse: accessibility ≥ 0.95 and best-practices ≥ 0.90 are **hard errors**.

## How to verify

```powershell
npm run lint              # eslint — must be 0 errors
npm run format:check      # prettier
npx tsc --noEmit          # strict TS
npm test                  # vitest, node env, LLM fully mocked
npm run build             # Next 16 Turbopack production build
npm run test:e2e          # Playwright, serial (workers: 1), keyless
npx lhci autorun          # a11y + best-practices gates
```

Single checks: `npx vitest run tests/unit/theme-contrast.test.ts` ·
`npx playwright test -g "keyboard only"`.

**Port 3000 rule:** only one server may own it. Both Playwright
(`reuseExistingServer: true`) and Lighthouse start/expect a server there, and a
leftover `npm run start` serves a stale `.next`. Kill it first:

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen |
  Select-Object -ExpandProperty OwningProcess |
  ForEach-Object { Stop-Process -Id $_ }
```

E2E is serial **by design** — routes rate-limit 10 plans/min/IP. Do not
parallelise it.

---

## Known deviations and open questions (verify, then judge)

These are the things most likely to be real findings. Confirm each against the
current tree before writing it up; several may already be fixed.

1. **Landing docs vs code drift.** `docs/Design.md` §4.10 still describes a
   `#create` anchor on `/` and a "Bespoke Event Planning Engine" h1. Code now uses
   `/create` and "Your celebration, handled". `docs/IMPLEMENTATION_PLAN.md` and
   `docs/Frontend-Prompt.md` still reference `ThemeToggle`.
2. **`#trust`, `#preview`, `#faq` are not in the nav.** They are reachable only by
   scrolling. Decide whether that is fine or whether the nav should expose them.
3. **Dashboard preview is a placeholder**, not a real product screenshot. It may
   read as filler on an otherwise concrete page.
4. **Aurora gradient backdrop vs the anti-slop "no gradients" rule.** Decide
   whether the ambient aurora is sanctioned atmosphere or a contract violation.
5. **Landing page weight.** Hero + 3 vertical cards + 3 features + 3 steps + 3
   trust cards + preview + 6 FAQ items is a lot above the first CTA; check mobile
   scroll depth and LCP.
6. **Lint warnings (0 errors, ~19 warnings)** — unused icon imports in
   `landing-page.tsx` (`Calendar`, `Users`, `MapPin`, `Building2`, `Music`,
   `Utensils`, `Camera`, `Car`, `Palette`, `Balloon`, `Gift`, `Landmark`,
   `TreePine`, `Shield`, `FileText`), unused `VERTICAL_PHOTOS` and `updateStep` in
   `app/onboarding/page.tsx`, and a `useCallback` dependency warning in
   `components/features/CommandMenu.tsx`. Dead imports are shipping bytes and
   review noise.
7. **Wizard input surface area.** Step 3 collects seven free-text/select fields;
   check it does not feel like a form dump and that all of it is actually
   consumed downstream (unused inputs are anti-slop).
8. **Keyboard order on `/create`.** The e2e suite walks an exact tab order
   (date → guests → budget → currency → spending style → location → theme →
   cultural notes → preset → outdoors → generate). Any new control inserted
   mid-form must update that assertion, and must not drop focus to `<body>`.
9. **Dark-only residue.** Confirm no `dark:` utility duplication, no unused
   `next-themes` state, no orphaned `ThemeToggle` import, and that the very first
   server-rendered byte already carries `class="dark"` on `<html>`.

## What to report

Produce a single review with these sections, in this order:

1. **Verdict** — 3–5 sentences. Is the frontend shippable, and what is the single
   biggest problem?
2. **Route table** — for each of `/`, `/create`, `/onboarding`, `/plan/[id]`,
   `/api/plan`, `/api/ask`: what it renders, whether it is complete, and any
   broken/absent element.
3. **Landing page audit** — walk the ten sections in order. For each: does it earn
   its place, is the copy honest, is the hierarchy right, is anything redundant?
4. **Findings**, each with: severity (`blocker` / `high` / `medium` / `low`),
   route or file, what is wrong, why it matters, and the concrete fix. Cite file
   paths and line numbers where possible.
5. **Accessibility & responsive report** — contrast, focus order, headings,
   landmarks, reduced motion, 320 px, 200 % zoom, Lighthouse numbers if run.
6. **What is already good** — short, specific; do not pad.
7. **Top five changes**, ordered by impact-per-hour of work.

Rules for the report:

- Evidence over opinion: quote the file/line or the measured value.
- Do not propose new features, new routes, auth, a database, or a light mode.
- Do not propose moving color out of `globals.css` or renaming the `:root` /
  `.dark` blocks.
- Every proposed UI change must state its effect on all three verticals.
- If you cannot verify something (e.g. a live Lighthouse run), say so explicitly
  rather than guessing.
