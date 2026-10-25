# Design — UI/UX System Specification

**Philosophy:** _Editorial-premium event stationery meets command center._ The visual
language borrows from high-end event-planning editorials (big serif display type,
cream paper, deep sage green, dusty rose and gold accents, small-caps eyebrows) while
the interaction model stays dashboard-grade: dense tables, rails, chips, keyboard-first.
This spec is normative — components follow it, not the other way around.

> v2 note: the original Linear/Vercel monochrome system was replaced at the user's
> direction with this elegant-premium blend (user references: botanical checklist,
> wedding dashboard, "Quiet" editorial command center, PRIORI data sheets). The
> accessibility contract below is unchanged and still normative.

---

## 1. Anti-AI-Slop Rules (what we explicitly do NOT do)

| ❌ Never                                             | ✅ Instead                                                                                         |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Clip-art florals, emoji decoration, script-font spam | One glyph-scale botanical accent (`❦`, leaf) per screen max; serif does the elegance               |
| Gradient blobs, glow, glassmorphism                  | Flat paper surfaces; color only for state/meaning                                                  |
| Whitespace-as-elegance (5 items per screen)          | High data density inside elegant frames: tables, rails, stat cards                                 |
| Stock-photo heroes, clip-art, gradient 3D blobs      | Thin-line editorial SVG vignettes from `public/images/` (palette strokes, no gradients) — see §4.6 |
| Floating shadows everywhere                          | Hairline borders (1 px); shadow only for overlays (dropdown/modal)                                 |
| Decorative serif on data                             | Serif for display headings only; **tabular sans numerals** for money/dates/counts                  |
| Generic Inter-only marketing copy                    | Compact labels, small-caps eyebrows, verb-first buttons                                            |

**Test:** if a screen could be reskinned as a perfume landing page with zero changes, it's slop.

---

## 2. Design Tokens & Theme Contract

Dual theme via **CSS variables** (Tailwind v4 `@theme`) + **class strategy**
(`next-themes`, `attribute="class"`, `enableSystem`, no theme flash via
`suppressHydrationWarning`). Accent roles are **per-vertical**: the dashboard stamps
`data-vertical` on its root and CSS remaps `--accent-a/-b` (wedding = sage+rose,
birthday = rose+gold, community = blue+sage). All pairs machine-verified by
`tests/unit/theme-contrast.test.ts` in **both themes × all verticals**.

### Color palette — light ("cream paper")

| Token                | Value          | Usage                                     |
| -------------------- | -------------- | ----------------------------------------- |
| `--background`       | `#FAF7F1`      | Paper canvas                              |
| `--foreground`       | `#23201C`      | Ink text                                  |
| `--card`             | `#FDFBF6`      | Panels, tables, sidebar (`--surface`)     |
| `--primary`          | `#3D5245`      | Deep sage buttons/active nav (cream text) |
| `--border`           | `#E6DFD2`      | Structural hairlines                      |
| `--input`            | `#8A8072`      | Input/control borders (≥ 3:1 on paper ✔)  |
| `--ring`             | `#A8802A`      | Focus ring (gold, ≥ 3:1 ✔)                |
| `--muted-foreground` | `#665F52`      | Secondary text (≥ 4.5:1 ✔)                |
| `--accent-a`         | `#6B7F5E` sage | Primary accent fills (bars, chips, links) |
| `--accent-b`         | `#B5726A` rose | Secondary accent fills                    |
| `--gilt`             | `#A8802A` gold | Hairline rules, eyebrow accents, tertiary |
| `--success`          | `#15803D`      | Under budget, done, booked                |
| `--destructive`      | `#A63D40`      | Over budget, errors                       |

`-text` variants (`--accent-a-text`, `--accent-b-text`, `--gilt-text`,
`--success-text`, `--danger-text`) are darker steps used wherever the color carries
**text** (AA ≥ 4.5:1 on both paper and card). Fills keep the lighter steps (≥ 3:1).

### Color palette — dark ("ink paper")

| Token                         | Value                 | Usage                           |
| ----------------------------- | --------------------- | ------------------------------- |
| `--background`                | `#191B17`             | Warm charcoal canvas            |
| `--foreground`                | `#F2EDE3`             | Cream ink                       |
| `--card`                      | `#212420`             | Panels                          |
| `--primary`                   | `#A9BC96`             | Sage-cream buttons (ink text)   |
| `--border`                    | `#38342E`             | Hairlines                       |
| `--input`                     | `#837A6B`             | Control borders (≥ 3:1 ✔)       |
| `--ring`                      | `#C9A24A`             | Gold focus ring                 |
| `--muted-foreground`          | `#B0A695`             | Secondary text (≥ 4.5:1 ✔)      |
| `--accent-a` / `-b`           | `#9FB48E` / `#CF9A92` | Sage / rose, lightened for dark |
| `--gilt`                      | `#D9B871`             | Gold accents                    |
| `--success` / `--destructive` | `#9FBE86` / `#E0A3A3` | State colors, lightened         |

Semantic tokens only, never raw hex in components. **Every** token pair is verified
≥ 4.5:1 for text, ≥ 3:1 for UI borders/graphics (WCAG AA) in both themes × verticals.

### Typography

- **Display:** `Playfair Display` (serif) — page titles, stat numbers, banner event
  names, section headings. Italic used sparingly as a "voice" (taglines).
- **Body/UI:** `Geist Sans` — everything data. Mono: `Geist Mono` for codes.
- **Eyebrow:** 11 px, `uppercase`, `tracking-[0.18em]`, gilt or muted — section
  kickers ("OUR PLAN", "THIS WEEK", "BUDGET SHAPE") — never all-caps serif.
- Scale (compact): `11 / 12 / 14 / 16 / 20 / 28 / 40 px` — body **14 px**.
- `font-variant-numeric: tabular-nums` on all currency, dates, counts.
- Line length cap 72ch for prose; tables unbounded with horizontal scroll.

### Spacing, elevation, motion

- 4 px grid; page padding `16 px` mobile, `24 px` desktop.
- Elevation = **hairline borders**; shadow only on modal/dropdown.
- Micro-interactions (hover, focus, disclosure) ≤ 150 ms.
- Content motion is the §1.7 layer: `Reveal` 400 ms ease-out (opacity + small translate),
  stagger 60 ms per child capped at 6 steps / 240 ms total; `CountUp` runs once on first
  mount. No gradients, parallax, 3D or glow. `prefers-reduced-motion: reduce` makes every
  one of these instant and fully visible (CSS **and** JS check).
- Radius: cards `rounded-lg`, chips `rounded-md` — soft but not pill-soft.

---

## 3. Layout System

```
┌─ Header (sticky, 48 px, hairline) ───────────────────────────────┐
│ ❦ wordmark · plan name · [theme]                                │
├─ Sidebar (220 px, card surface) ─┬─ Main ────────────────────────┤
│ ▸ OVERVIEW   (eyebrow nav)       │  Banner: serif event name     │
│ ▸ BUDGET                         │  date · location · italic tag │
│ ▸ TIMELINE                       │                               │
│ ▸ CHECKLIST                      │  Stat cards: progress ring,   │
│ ▸ IDEAS                          │  budget, guests, days-to-go   │
│ ▸ EXPORTS                        │                               │
└──────────────────────────────────┴───────────────────────────────┘
```

- Sidebar items: eyebrow-style small caps + icon; active = sage tint + left gilt bar.
- Overview opens with plan banner → stat card row → next-up list → summary block.
- Setup page (`/`) = **landing shell + split form** (user brief 2026-10-24,
  v2 spec §1.2): skip link first in DOM → sticky anchor nav (HOME · FEATURES ·
  HOW IT WORKS · CREATE EVENT + local-first chip + theme toggle) → hero →
  feature grid → how-it-works strip → `#create` split form → footer with the
  vendor-guidance note (§4.12). Every nav item is a real in-page anchor; no
  fake PRICING / SIGN IN entries.
- Session model: **guest/local-first, no auth.** Plan lives in `localStorage`
  (`promptwar-planner`) behind `/plan/<uuid>`; the "local-first — no account"
  chip sits in the landing nav.
- **Navigation settled (Memory D38):** the v2 spec §1.2 is canonical — landing
  anchor nav + dashboard header/sidebar (ASCII above) as built. The alternative
  "persistent app shell" (root-layout header + horizontal tab bar across both
  routes) was specified but **cancelled** before any code was written.

---

## 4. Component Layouts (normative)

### 4.1 Budget table & shape bars

- Ledger typography: money cells and totals use `font-mono` + `.tnum`.
- Eyebrow header "BUDGET SHAPE"; rows: category | planned | actual | variance | bar.
- Bars: sage fill on cream track; over-plan overlay rose; percentage in tabular sans.
- Total row: 2 px top border, serif number; over-budget = danger + icon + text.
- Keyboard: Tab through cells, Enter commits, Escape reverts; totals `aria-live`.

### 4.2 Task timeline (reverse countdown)

- Rail + nodes, grouped by phase; serif section heading; `T-21d` chips.
- Overdue: rose/danger chip; ≤ 7 days: gilt chip; done: muted + strikethrough.
- Roving tabindex: `↑/↓`, `Home/End`, `Space` toggles; `<ol>/<li>` semantics.

### 4.3 Checklist (vendor cards)

- **Accordion**: each numbered category header is a toggle button
  (`aria-expanded`, `aria-controls`); categories open by default, state is
  local UI state (not persisted).
- Numbered category headers (sage circle numeral + serif title + booked count).
- Item rows: vendor label, status chip (`To contact / Contacted / Quoted / Booked`),
  `details` disclosure for inquiry questions, document checkboxes.
- Status is never color-only — chip always carries text.

### 4.4 Forms

- Visible labels above every input; `for`/`id` paired; no placeholder-as-label.
- Errors: `aria-invalid` + `aria-describedby`; `role="alert"` on submit.
- Focus ring: 2 px `--ring` (gold) with offset — visible in both themes.
- **Live previews (display-only, never canonical math):** date field shows a
  `T−Nd` countdown chip; budget + guests show an approximate per-guest badge
  (`≈ $N / guest`).
- **Preset chips** under Style/Theme & Cultural notes (vertical-aware quick
  fills, e.g. _Sangeet & Reception_, _Milestone 30th outdoor_, _Neighborhood
  block party_) — they fill fields; they never bypass validation.

### 4.5 Buttons, chips, cards

- Primary: sage bg + cream text, h-32 px; secondary: hairline border on paper.
- Chips: 12 px, 1 px border, text always present (never color-only).
- Stat cards: eyebrow label, serif tabular number, muted sub-line.

### 4.6 Imagery (static SVG vignettes)

- **Files:** `public/images/vignettes/art-wedding.svg`, `art-birthday.svg`,
  `art-community.svg` (masthead/banner vignettes), `public/images/empty-ideas.svg`
  (empty state), plus `app/icon.svg` (favicon). Hand-drawn line art only.
- **Palette:** mid-tone strokes (`#6b7f5e` sage, `#a8802a` gold, `#b5726a` rose,
  `#8a8072` neutral) so every image is legible on cream **and** ink paper —
  no ink-black strokes (vanish in dark), no pure white (vanish in light).
- **Rules:** 1.5–2 px strokes, flat color, **no gradients, no filters, no
  embedded raster, no faces/clip-art**; ≤ 4 KB per file; one vignette per zone
  (masthead, banner, empty state) — never wallpaper.
- **Semantics:** decorative art → `aria-hidden="true"` + `alt=""`; rendered via
  `next/image` with `unoptimized` (vector passthrough, no optimizer/CSP risk).

### 4.7 Exports tab (Phase 4)

- Sixth rail item `EXPORTS`; panel offers **PDF** (jsPDF), **CSV**
  (`@json2csv/plainjs` — maintained json2csv successor: budget rows + task
  rows), **Markdown** (string template), **JSON** (complete validated plan),
  and **Print** (`window.print()`). A JSON import control validates the whole
  file with `PlanSchema` before replacing local state; an unavailable local plan
  view offers this same import action.
- All renderers are **lazily `import()`-ed inside the click handler** so the
  libraries never enter the initial bundle (efficiency rule).
- All data is read from the client store — screen ≡ export by construction (D5);
  success/failure announced via `aria-live`.
- `@media print` CSS (globals.css): hide header/rail/controls, drop paper
  backgrounds, keep plan content — physical stationery output.

### 4.8 Ideas filters

- Deterministic rule-based ideas are always present and conditioned on vertical,
  budget band, per-guest budget, guest count, outdoor status, theme and cultural
  notes. Each card carries a visible `Rule-based` or `Model-enriched` source
  badge. The rules engine remains the source of ideas in keyless mode; an LLM
  may add qualitative ideas but cannot replace the baseline.
- A chip row filters cards by tag/category (Decor, Entertainment, Catering,
  Personal Touches, …) — pure client state; empty filter results show an inline
  "no ideas in this category" note.

### 4.9 "Ask your planner" (conversational assistant)

- Section at the bottom of the Overview panel: suggested-question chips, one
  text input + Ask button, Q/A thread — **session-only** (never persisted to
  localStorage; only the plan itself is persisted).
- `POST /api/ask` carries the question plus a compact **plan context snapshot**
  (`AskRequestSchema`: input summary, category rows, next tasks, vendor
  statuses) — the assistant follows up on the user's actual context, not a
  generic prompt. Rate-limited (30/min/IP), prompt-guard sanitized,
  Zod-validated — the same control set as `/api/plan`.
- Two answer sources, **always labeled in the UI**:
  - **engine** (keyless default): deterministic keyword responder over the
    snapshot (totals, per-category, timeline, vendors, progress, per-guest);
    it never invents a figure and offers concrete follow-up questions.
  - **llm** (with `OPENAI_API_KEY`): prompt-guarded `generateObject` answer,
    up to 2 retries with bounded backoff → engine responder fallback; the model is instructed to use only
    provided figures and to do **no arithmetic** (engine computes derived
    values such as per-guest and hands them over).
- Answers announced `aria-live="polite"`; failures `role="alert"`.
- Each request may include only the last three user/assistant messages, sanitized
  as untrusted input. When a question depends on missing plan context, the
  assistant asks one concise clarifying follow-up. Three suggestion buttons are
  returned for the current plan (including rain-plan prompts for outdoor events).

### 4.10 Landing shell (`/`, user brief 2026-10-24, v2 spec §1.2)

- **Skip-to-content link** first in the DOM (global, rendered by `app/layout.tsx`).
- **Top nav** — sticky, solid `bg-background` (no blur/glass), 1px `border-border`
  hairline. Left: ❦ wordmark. Center/right: eyebrow uppercase anchors HOME
  (`aria-current`, gilt underline hairline) · FEATURES · HOW IT WORKS ·
  CREATE EVENT (`#create`). Utility cluster: "local-first — no account" chip +
  theme toggle.
- **Hero** — eyebrow, `display` h1 "Bespoke Event Planning Engine", gilt rule
  with ❦, muted subtitle (weddings, birthdays, community gatherings), flat
  gilt-border CTA "CURATE YOUR EVENT" → `#create`.
- **Feature grid** — 3 flat bordered cards: _Deterministic Budget Ledger_,
  _Reverse Timeline Matrix_, _Vendor Operations Checklist_, each with one
  `font-mono` preview line (data-sheet motif).
- **How it works** — 3 numbered steps, each with a mono **input preview box**.
- **#create** — the split-stationery form section (h2 "New event plan",
  `data-vertical` retint for live radio previews); anchors get `scroll-mt`
  for the sticky nav.
- **Footer** — local-first note, "Budget math is engine-verified", and the
  vendor-guidance note (§4.12).
- **Dashboard `/plan/[id]`** — sticky header row + 220 px sidebar tablist +
  six panels (ASCII in §3); the persistent app-shell variant is **cancelled**
  (Memory D38). No fake PRICING / SIGN IN entries anywhere (anti-slop: dead UI
  is slop); all copy is real product copy.

---

### 4.12 Responsible-AI vendor guidance

- Show the exact note under Budget, Checklist and Exports, and in the landing footer:
  “Estimates and vendor suggestions are planning guidance, not quotes. Confirm prices and availability with vendors.”

### 4.13 Persisted state boundary

- Parse plan-generation responses and localStorage rehydration with the shared Zod schemas.
- Invalid stored state is ignored safely. Older ideas without provenance migrate as model-enriched;
  newly generated rule-based ideas always include their explicit source.

## 5. Accessibility Contract (definition of done)

- [ ] Full critical path operable with keyboard alone; no traps; visible focus everywhere
- [ ] All icons decorative → `aria-hidden`; meaningful → alt text
- [ ] AA contrast (≥ 4.5:1 text, ≥ 3:1 large text/UI) in **light and dark**, all verticals
- [ ] Landmarks: `<header>/<nav>/<main>`; one `h1`; heading hierarchy unbroken
- [ ] `aria-live` on: totals changes, generation status, export success/failure
- [ ] `prefers-reduced-motion` respected; 200 % zoom without loss of function
- [ ] Lighthouse a11y ≥ 95, **zero critical/serious axe violations**
