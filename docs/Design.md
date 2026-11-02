# Design — UI/UX System Specification

**Philosophy:** _Editorial-premium event stationery meets command center._ The visual
language borrows from high-end event-planning brand boards (big serif display type,
champagne paper, burgundy wine, antique gold and deep green accents, tracked small-caps
eyebrows, a single script flourish per screen) while the interaction model stays
dashboard-grade: dense tables, rails, chips, keyboard-first. This spec is normative —
components follow it, not the other way around.

> v2 note: the original Linear/Vercel monochrome system was replaced at the user's
> direction with this elegant-premium blend (user references: botanical checklist,
> wedding dashboard, "Quiet" editorial command center, PRIORI data sheets). The
> accessibility contract below is unchanged and still normative.

> v3 note (2026-10-26): **single-theme rebrand** from the owner's attached brand boards
> (Heart's Desire, Jewellect, green/gold monogram, Glam Haus) — champagne paper +
> burgundy wine + antique gold + deep green, all-serif type stack. **Dark mode is
> removed** at the owner's direction (Memory D43): one theme, no toggle, no provider.

---

## 1. Anti-AI-Slop Rules (what we explicitly do NOT do)

| ❌ Never                                             | ✅ Instead                                                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Clip-art florals, emoji decoration, script-font spam | One glyph-scale flourish (`❦`, one script line) per screen max; serif does the elegance                      |
| Gradient blobs, glow, glassmorphism                  | Flat paper surfaces; color only for state/meaning                                                            |
| Whitespace-as-elegance (5 items per screen)          | High data density inside elegant frames: tables, rails, stat cards                                           |
| Hotlinked/stock-lottery imagery, clip-art, blobs     | Bundled free-license photo **plates** in exactly three sanctioned slots, framed like print mounts — see §4.6 |
| Floating shadows everywhere                          | Hairline borders (1 px); shadow only for overlays (dropdown/modal)                                           |
| Decorative serif on data                             | Serif for display headings only; **mono tabular numerals** for money/dates/counts                            |
| Generic Inter-only marketing copy                    | Compact labels, mono small-caps eyebrows, verb-first buttons                                                 |

**Test:** if a screen could be reskinned as a perfume landing page with zero changes, it's slop.

---

## 2. Design Tokens & Theme Contract

**Single theme — "champagne paper & wine"** — via CSS variables (Tailwind v4 `@theme`).
There is no theme provider, no `.dark` class and no toggle: the app has exactly one look
(owner direction, Memory D43). Accent roles are **per-vertical**: the dashboard stamps
`data-vertical` on its root and CSS remaps `--accent-a/-b` and `--gilt` (wedding =
wine + gold, birthday = blush rose + champagne, community = forest green + gold). All
pairs are machine-verified by `tests/unit/theme-contrast.test.ts` in **base + every
vertical** (4 scenarios).

### Color palette — champagne paper & wine

| Token                | Value                  | Usage                                       |
| -------------------- | ---------------------- | ------------------------------------------- |
| `--background`       | `#F6EFE3`              | Champagne paper canvas                      |
| `--foreground`       | `#2B1A1C`              | Wine-black ink text                         |
| `--card`             | `#FBF6EC`              | Panels, tables, sidebar (`--surface`)       |
| `--primary`          | `#6B0F22`              | Deep burgundy buttons/active nav (cream tx) |
| `--border`           | `#DDCEBB`              | Structural hairlines                        |
| `--input`            | `#8D7A6F`              | Input/control borders (≥ 3:1 on paper ✔)    |
| `--ring`             | `#8A6B1F`              | Focus ring (antique gold, ≥ 3:1 ✔)          |
| `--muted-foreground` | `#6F5A55`              | Secondary text (≥ 4.5:1 ✔)                  |
| `--accent-a`         | `#8E2436` rose-wine    | Primary accent fills (bars, chips, links)   |
| `--accent-b`         | `#A67C1E` antique gold | Secondary accent fills (≥ 3:1 ✔)            |
| `--gilt`             | `#96731A` gilt gold    | Hairline rules, eyebrow accents (≥ 3:1 ✔)   |
| `--success`          | `#1C7A4F`              | Under budget, done, booked (deep green)     |
| `--destructive`      | `#8F1D28`              | Over budget, errors (claret)                |

`-text` variants (`--accent-a-text`, `--accent-b-text`, `--gilt-text`,
`--success-text`, `--danger-text`) are darker steps used wherever the color carries
**text** (AA ≥ 4.5:1 on both paper and card). Fills keep the lighter steps (≥ 3:1).

### Per-vertical accent remap (`[data-vertical=…]`)

| Vertical      | accent-a / -text      | accent-b / -text      | gilt / -text          | Identity               |
| ------------- | --------------------- | --------------------- | --------------------- | ---------------------- |
| **wedding**   | `#8E2436` / `#6B0F22` | `#A67C1E` / `#7D5C14` | `#96731A` / `#7D5C14` | wine + gold            |
| **birthday**  | `#B8737A` / `#8C4A47` | `#A67C1E` / `#7D5C14` | `#B8737A` / `#8C4A47` | blush rose + champagne |
| **community** | `#1E4D3A` / `#173B2C` | `#A67C1E` / `#7D5C14` | `#96731A` / `#7D5C14` | forest green + gold    |

Semantic tokens only, never raw hex in components. **Every** token pair is verified
≥ 4.5:1 for text, ≥ 3:1 for UI borders/graphics (WCAG AA) for base + all verticals.

### Typography

- **Display:** a locally available traditional serif stack (Baskerville, Palatino,
  Georgia) — page titles, stat numbers, banner event names, and section headings. Italic
  used sparingly as a "voice" (taglines).
- **Script accent:** a locally available script stack (Segoe Script, cursive) — one short
  flourish per screen maximum (hero kicker, footer signature). Never on data, controls or
  paragraphs (§1 script-spam rule).
- **Body/UI:** a locally available book serif stack (Palatino, Book Antiqua, Georgia) —
  prose and data. **Mono:** Cascadia Mono, IBM Plex Mono, or Consolas for money cells,
  codes and input-preview lines (`.tnum` columns, `.eyebrow` kickers).
- **Build constraint:** use system font stacks through CSS variables. Do not fetch fonts
  from Google during compilation; this keeps clean production builds offline-capable while
  preserving the editorial serif/script/mono hierarchy.
- **Eyebrow:** 11 px mono, `uppercase`, `tracking-[0.18em]`, gilt or muted — section
  kickers ("OUR PLAN", "THIS WEEK", "BUDGET SHAPE") and data-sheet labels.
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
- Radius: cards `rounded-lg`, chips `rounded-md` — soft but not pill-soft (`--radius:
0.3rem`, letterpress-sharp).

---

## 3. Layout System

```
┌─ Header (sticky, 48 px, hairline) ───────────────────────────────┐
│ ❦ wordmark · plan name · script tagline                          │
├─ Sidebar (220 px, card surface) ─┬─ Main ────────────────────────┤
│ ▸ OVERVIEW   (eyebrow nav)       │  Banner: serif event name     │
│ ▸ BUDGET                         │  date · location · italic tag │
│ ▸ TIMELINE                       │                               │
│ ▸ CHECKLIST                      │  Stat cards: progress ring,   │
│ ▸ IDEAS                          │  budget, guests, days-to-go   │
│ ▸ EXPORTS                        │                               │
└──────────────────────────────────┴───────────────────────────────┘
```

- Sidebar items: eyebrow-style small caps + icon; active = wine tint + left gilt bar.
- Overview opens with plan banner → stat card row → next-up list → summary block.
- Setup page (`/create`) = split form behind its own route (owner direction
  2026-10-27, D46) with **no nav entry** (owner: "remove create event", D47) —
  it stays reachable by URL and is the E2E-covered surface. The landing shell
  on `/` (user brief 2026-10-24, v2 spec §1.2) is: skip link first in DOM →
  sticky anchor nav (HOME · FEATURES · HOW IT WORKS + local-first chip) →
  hero → vertical cards → feature grid → how-it-works strip → trust cards →
  dashboard preview → FAQ → footer with the vendor-guidance note (§4.12).
  Creation CTAs (prompt bar, "Try" chips, vertical cards) all route to
  `/onboarding`. Every nav item is real; no fake PRICING / SIGN IN entries.
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
- Bars: `--accent-a` fill on paper track; over-plan overlay `--accent-b`; percentage in
  tabular mono.
- Total row: 2 px top border, serif number; over-budget = danger + icon + text.
- Keyboard: Tab through cells, Enter commits, Escape reverts; totals `aria-live`.

### 4.2 Task timeline (reverse countdown)

- Rail + nodes, grouped by phase; serif section heading; `T-21d` chips.
- Overdue: danger chip; ≤ 7 days: gilt chip; done: muted + strikethrough.
- Lists over 30 items are paginated behind a "Show all N tasks" control (v2 §1.2).
- Roving tabindex: `↑/↓`, `Home/End`, `Space` toggles; `<ol>/<li>` semantics.

### 4.3 Checklist (vendor cards)

- **Accordion**: each numbered category header is a toggle button
  (`aria-expanded`, `aria-controls`); categories open by default, state is
  local UI state (not persisted).
- Numbered category headers (wine circle numeral + serif title + booked count).
- Item rows: vendor label, status chip (`To contact / Contacted / Quoted / Booked`),
  `details` disclosure for inquiry questions, document checkboxes.
- Status is never color-only — chip always carries text.

### 4.4 Forms

- Visible labels above every input; `for`/`id` paired; no placeholder-as-label.
- Errors: `aria-invalid` + `aria-describedby`; `role="alert"` on submit.
- Focus ring: 2 px `--ring` (antique gold) with offset — visible on every surface.
- **Live previews (display-only, never canonical math):** date field shows a
  `T−Nd` countdown chip; budget + guests show an approximate per-guest badge
  (`≈ $N / guest`).
- **Preset chips** under Style/Theme & Cultural notes (vertical-aware quick
  fills, e.g. _Sangeet & Reception_, _Milestone 30th outdoor_, _Neighborhood
  block party_) — they fill fields; they never bypass validation.

### 4.5 Buttons, chips, cards

- Primary: burgundy bg + cream text, h-32 px; secondary: hairline border on paper.
- Chips: 12 px, 1 px border, text always present (never color-only).
- Stat cards: eyebrow label, serif tabular number, muted sub-line.

### 4.6 Imagery (photo plates + SVG accents)

Owner direction, 2026-10-26 (D44): replace the flat SVG vignettes with real
photography where atmosphere is sold, keep hand-drawn SVG only where the image is
_functional_.

- **Files:** `public/images/photos/hero-suite.jpg` (1600×1067, **reserved —
  not rendered**, see below), `wedding-table.jpg` (1100×733),
  `birthday-cake.jpg` (900×1350), `community-gathering.jpg` (1100×733) — all
  **Pexels License** (free for commercial use; no attribution required — we
  credit photo IDs in the README anyway), downloaded once and **bundled
  locally** (never hotlinked). Plus `public/images/empty-ideas.svg` (empty
  state) and `app/icon.svg` (favicon), which stay hand-drawn SVG.
- **Sanctioned slots — exactly three, never wallpaper (inventory as of D52):**
  1. **Setup page brand column** — the vertical photo, swaps live with the
     event-type radios. This is where the SVG vignette used to render: the
     vignette files were deleted in D44 but the `<Image>` reference survived
     and served a 404 on every event type until D52 replaced it with
     `VERTICAL_PHOTOS`.
  2. **Dashboard overview header** — the same vertical photo: a fluid banner
     on phones, the fixed mount from `sm:` up. It was `hidden md:block`, so
     phones never saw their own event photograph (fixed in D52).
  3. **Landing vertical cards (D52, new)** — each of the three event-type
     cards carries its own `VERTICAL_PHOTOS` photograph above the mini
     "Sample plan" block, print-mount framed, fluid at every width
     (`sizes="(min-width: 640px) 30vw, 100vw"`).
- **Reserved, not shipped:** the D44 "landing hero plate" band
  (`hero-suite.jpg` under the hero CTA, with `HERO_PHOTO` in
  `lib/config/photos.ts`) was specified but never built — the hero stays
  text-only so the landing keeps its existing visual identity. The file and
  export remain bundled and reserved; do not place them without owner
  sign-off.
- **Framing = print mount:** card-paper background, 1 px gilt hairline border,
  `object-cover` crop to the slot's aspect box. **No** shadow, gradient, overlay,
  caption bar or filter on the photo itself.
- **Palette fit:** each photo was chosen to carry the palette — wedding table =
  wine dahlias + blush roses; birthday = blush frosting + gold script topper;
  community = amber bulb light over a shared table; hero = cream/bronze suite.
- **Rules:** ≤ 250 KB per file; intrinsic `width`/`height` declared (CLS must
  stay 0); one photo per slot instance; aspect-cropped, never letterboxed; portrait
  sources inside landscape mounts carry a per-photo `object-position` (birthday
  plate `50% 75%`) so the subject stays fully framed — verified against the
  rendered plates; still no gradients/filters/overlays anywhere in the chrome
  around them.
- **Semantics:** atmosphere only → `aria-hidden="true"` + `alt=""` (no information
  is conveyed by the pixels); JPEGs render through `next/image`'s optimizer,
  the two SVGs keep `unoptimized` (vector passthrough).

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
- **Top nav** — sticky, `glass-panel` with a 1px `border-border` hairline. Left: ❦
  wordmark (Cormorant small caps). Center/right: eyebrow uppercase anchors HOME
  (`aria-current`, gilt underline hairline) · FEATURES · HOW IT WORKS — **anchors
  only**; there is no CREATE EVENT entry (owner direction 2026-10-27, D47).
  Creation happens via the prompt bar / "Try" chips / vertical cards →
  `/onboarding`, or by visiting `/create` directly. Utility cluster:
  "local-first — no account" chip (no theme toggle — dark-only, D46).
- **Hero** — `display` h1 "Your celebration, handled" with one ❦ flourish, muted
  subtitle (weddings, birthdays, community gatherings), and a **glass pill
  natural-language prompt bar** (input + pill "Curate" → `/onboarding?prompt=…`)
  followed by three "Try:" chips that fill the input.
- **Feature grid** — 3 flat bordered cards: _Deterministic Budget Ledger_,
  _Reverse Timeline Matrix_, _Vendor Operations Checklist_, each with one
  `font-mono` preview line (data-sheet motif).
- **How it works** — 3 numbered steps, each with a mono **input preview box**.
- **Vertical cards** — 3 `data-vertical` cards (wedding / birthday / community)
  linking to `/onboarding?vertical=…`, each with its own event-type photograph
  (§4.6 slot 3, D52) above a mini "Sample plan" block.
- **#trust / #preview / #faq** — honest-numbers cards, dashboard preview figure,
  and a 6-item accordion.
- **`/create`** — the split-stationery form (h2 "New event plan",
  `data-vertical` retint for live radio previews) lives on its own route, not on
  `/` (D46).
- **Footer** — local-first note, "Budget math is engine-verified", script signature,
  and the vendor-guidance note (§4.12).
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

### 4.14 Event library, idea actions, and vendor costs (emergency pass)

- The dashboard utility bar can save the active plan into a local event library,
  switch to another saved plan, start another event via onboarding, and delete a
  library entry only after confirmation. Every plan retains its own budget, tasks,
  vendors, document tracker, saved ideas, and applied ideas.
- Idea cards expose Save/Unsave and Apply/Applied actions. Applying adds the idea
  once to the event brief so later regeneration receives it as context.
- Vendor checklist rows may record an estimate, actual amount, and budget category.
  Budget actuals equal manually entered amounts plus mapped vendor actuals; those
  sources remain separate so edits cannot double count vendor expenses.
- Privacy copy describes the event fields sent for generation and the compact plan
  snapshot sent for assistant requests. Saved plans remain in browser storage.
- Axe checks cover each dashboard panel after it is opened, alongside landing,
  creation, and onboarding flows.

## 5. Accessibility Contract (definition of done)

- [ ] Full critical path operable with keyboard alone; no traps; visible focus everywhere
- [ ] All icons decorative → `aria-hidden`; meaningful → alt text
- [ ] AA contrast (≥ 4.5:1 text, ≥ 3:1 large text/UI) on champagne paper, all verticals
- [ ] Landmarks: `<header>/<nav>/<main>`; one `h1`; heading hierarchy unbroken
- [ ] `aria-live` on: totals changes, generation status, export success/failure
- [ ] `prefers-reduced-motion` respected; 200 % zoom without loss of function
- [ ] Lighthouse a11y ≥ 95, **zero critical/serious axe violations**
