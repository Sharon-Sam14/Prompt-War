# Frontend Prompt — GenAI Celebration & Event Planner

> Paste this prompt (or this file's body) into any AI to give it a complete,
> accurate picture of the frontend: pages, tabs, flows, tokens, and how one
> screen leads to another. Regenerate/update it whenever the UI changes.

---

## The prompt

```
You are working on "GenAI Celebration & Event Planner" — a Next.js 16 App Router
app (cacheComponents: true, TypeScript, Tailwind v4, shadcn/Radix, Zustand,
Zod 4, vitest) whose frontend follows an "editorial premium event stationery"
design system (docs/Design.md is normative; docs-first protocol: update Design.md
BEFORE any code; update docs/Memory.md after every feature).

## Design system (one glance)
- Two themes via class strategy (next-themes): LIGHT = "cream paper"
  (#FAF7F1 canvas, #FDFBF6 cards, deep-sage #3D5245 primary); DARK = "ink paper"
  (#191B17 canvas, #F2EDE3 cream text, sage-cream #A9BC96 primary). All color
  pairs are proven WCAG AA by tests/unit/theme-contrast.test.ts, which parses
  app/globals.css — NEVER move hex values out of globals.css.
- Typography: Playfair Display (display serif: headings, stat numbers, italic
  taglines) + Geist Sans (all data/UI). Utility classes: .eyebrow (11px
  uppercase, 0.18em tracking), .display (serif), .rule-gilt (hairline gold rule
  with ❦ glyph), .tnum (tabular numerals for money/dates).
- Per-vertical accent roles: app root stamps data-vertical
  (wedding|birthday|community) and CSS remaps --accent-a/--accent-b/--gilt
  (wedding sage+rose, birthday rose+gold, community blue+sage). Components only
  use role classes: bg-accent-a, text-accent-a-text, bg-accent-b, text-gilt,
  text-success-text, text-danger-text — never raw hex, never hue names.
- Imagery: hand-drawn flat SVG line art in public/images/ (art-wedding.svg,
  art-birthday.svg, art-community.svg, empty-ideas.svg) + app/icon.svg favicon.
  Mid-tone strokes so they read on both themes; always rendered via next/image
  with unoptimized, alt="", aria-hidden (decorative). No gradients, glass,
  blobs, clip-art, stock photos (Design.md §1 anti-slop table).

## Pages and how one leads to another

1) `/` — Setup page (static shell; form streams behind Suspense with
   `await connection()` because default values depend on today's date — do NOT
   call Date.now() during render; min date = tomorrow as a module const).
   - components/forms/event-setup-form.tsx. Masthead: eyebrow "GenAI Celebration
     & Event Planner" + serif h1 "New event plan" + gilt rule, with a vertical
     SVG vignette that swaps live with the selected event type (data-vertical on
     the wrapper retints radios/gilt as you pick).
   - Form (all Zod-validated client-side with the SAME PlanInputSchema the
     server uses; client validation is UX, server re-validates): event type
     (wedding/birthday/community radios), date (with live countdown hint),
     guests, budget + currency, spending style (micro/standard/premium),
     location, style/theme, cultural notes, outdoors checkbox.
   - Below the form: "How it works" 3-step strip (set constraints → engine
     prices / model personalizes → work one dashboard), then a hairline footer.
   - Submit → generatePlan(input) in the Zustand store → POST /api/plan
     (in-route rate limit; keyless fallback mode: deterministic engine always
     works, LLM ideas only if a model is available) → response Zod-validated →
     persisted to localStorage ("promptwar-planner") → router.push(/plan/{id}).

2) `/plan/[id]` — Dashboard (params awaited below a Suspense boundary — App
   Shell pattern; content is client-rendered from the persisted store).
   - components/planner/plan-dashboard.tsx, root div stamps data-vertical.
   - Sticky 48px header: ❦ Event Planner wordmark (serif, gilt, links to `/`)
     | uppercase plan title | source chip (Model-enriched / Engine-only) |
     ThemeToggle.
   - Left rail nav (220px desktop, horizontal on mobile) = Radix Tabs with
     orientation="vertical"; each trigger is an .eyebrow (uppercase tracked)
     with live counts, active = tint + gilt left border. The five tabs:
     * OVERVIEW (components/planner/overview-panel.tsx):
       plan banner (eyebrow "OUR PLAN" → serif h1 from theme/vertical, e.g.
       "The Wedding" → date · guests · location line → italic serif tagline)
       with the vertical SVG vignette at right; then a 4-stat-card row
       (Progress = CSS conic-gradient ring + %, Budget, Guests, Countdown),
       "This week's priorities" (next 3 open timeline tasks), Provenance badges
       + Regenerate, and Total Budget editor whose "Reallocate" calls the
       recalculateBudget SERVER ACTION (server owns all budget math; client
       adopts the returned Budget wholesale).
     * BUDGET (budget-table.tsx): eyebrow "WHERE THE MONEY GOES" + serif h2;
       live variance status (aria-live), editable Planned/Actual cells
       (MoneyCell: Enter commits, Escape reverts, verified by the server),
       per-row share bars (accent-a planned / accent-b actual), footer totals
       with over/under color + text.
     * TIMELINE (timeline-view.tsx): reverse-countdown list (T−N day chips:
       overdue=destructive, ≤7d=gold, done=muted strikethrough), phase badges,
       roving tabindex (↑/↓ Home/End, Space toggles done) on an <ol>.
     * CHECKLIST (vendor-checklist.tsx): numbered category cards (serif title
       in a sage numeral circle + booked count), vendor rows with status Select
       (To contact/Contacted/Quoted/Booked — chip always has text, never
       color-only), <details> inquiry questions, document checkboxes
       (receivedDocs live in the store, outside the Plan shape).
     * IDEAS (ideas-view.tsx): LLM idea cards with Sparkles + tags; in keyless
       mode an honest empty state with the empty-ideas.svg vignette explaining
       that budget/timeline/checklist are complete and ideas need a model.

## State rules
- Single store: lib/store/use-planner-store.ts (Zustand + persist,
  skipHydration: true; useRehydratePlanner() uses useSyncExternalStore — never
  setState-in-effect, server snapshot always false).
- Server truth: budget math, validation and regeneration come from the server
  (route + server actions). The store ADOPTS server outputs; optimistic edits
  (budget cells, statuses, toggles) are UI-local until verified.
- Tabs/counts/trackers: ui.activeTab, receivedDocs, itemKey `${catIdx}:${itemIdx}`.

## Accessibility contract (definition of done)
Full keyboard path; visible 2px gold focus ring; decorative icons/art
aria-hidden; one h1 per page, unbroken hierarchy; aria-live on totals,
generation status, export/status messages; prefers-reduced-motion; AA contrast
in BOTH themes × ALL verticals (machine-enforced by the contrast test).

## Workflow
1. Docs first: Design.md (spec) → code → Memory.md (decision log, D-numbers).
2. Gates in order: `npx eslint .` → `npx tsc --noEmit` → `npm test` →
   `npm run build` — all must be green (319 tests: engine/security/integration
   + theme contrast).
3. Never commit/push unless explicitly asked; submission = single branch,
   public repo https://github.com/Sharon-Sam14/Prompt-War, <10 MB.

## Not yet built (Phase 4, planned)
ExportButtons (PDF/CSV client-side, aria-live feedback), Playwright E2E,
efficiency pass, README final polish, repo hygiene audit for submission.
```
