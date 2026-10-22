# Design — UI/UX System Specification

**Philosophy:** Anti-AI-Slop. Dense, functional, dashboard-grade UI inspired by Linear, Vercel,
and GitHub. This spec is normative — components follow it, not the other way around.

---

## 1. Anti-AI-Slop Rules (what we explicitly do NOT do)

| ❌ Never | ✅ Instead |
|---|---|
| `rounded-3xl` pastel glassmorphism cards | `rounded-md` (4–6 px) surfaces with **1 px borders** |
| Glow effects, gradient blobs, animated backgrounds | Flat surfaces; color only for state/meaning |
| Redundant hero illustrations, mascot art | Dense header: title + status chip + actions |
| Whitespace-as-elegance (5 items per screen) | High data density; tables and rails over cards |
| Floating box shadows everywhere | Border boundaries; shadow only for overlays (dropdown/modal) |
| Generic Inter-only marketing copy | Compact labels, tabular numerals, verb-first buttons |

**Test:** if a screen could be reskinned as a SaaS landing page with zero changes, it's slop.

---

## 2. Design Tokens & Theme Contract

Dual theme via **CSS variables** (registered with Tailwind v4 `@theme`) + **class strategy**
(`next-themes`, `attribute="class"`, `enableSystem`, no theme flash via `suppressHydrationWarning`).

### Color palette

| Token | Light mode | Dark mode | Usage |
|---|---|---|---|
| `--canvas` | `#FFFFFF` | `#09090B` | Page background |
| `--surface` | `#F4F4F5` | `#18181B` | Panels, table headers, sidebar |
| `--text` | `#18181B` | `#FAFAFA` | Primary text (AA on both canvases) |
| `--primary` | `#09090B` | `#FFFFFF` | Primary buttons, active nav |
| `--accent-indigo` | `#4F46E5` | `#6366F1` | Links, focus accents, wedding accents |
| `--accent-sienna` | `#EA580C` | `#FB923C` | Warnings, over-budget variance, community accents |
| `--border` | `#E4E4E7` | `#27272A` | All structural 1 px borders |
| `--muted-text` | `#71717A` | `#A1A1AA` | Secondary labels (4.5:1 on canvas ✔) |
| `--success` | `#16A34A` | `#4ADE80` | Under budget, task done |
| `--danger` | `#DC2626` | `#F87171` | Over budget, validation errors |

Semantic tokens, never raw hex in components: `bg-canvas`, `text-text`, `border-border`,
`bg-surface`, `text-accent-indigo`, etc. Both themes are first-class; **every** token pair is
verified ≥ 4.5:1 for text, ≥ 3:1 for UI borders/graphics (WCAG AA).

### Typography

- Sans: `Geist Sans` (or system stack fallback); Mono: `Geist Mono` for numbers/codes.
- Scale (compact): `12 / 14 / 16 / 20 / 24 px` — body **14 px**, dense tables **13 px**.
- `font-variant-numeric: tabular-nums` on all currency, dates, counts (columns must align).
- Hierarchy by **weight + size**, not color: section labels `12 px uppercase tracking-wide
  muted`, headings `16–20 px semibold`.
- Line length cap 72ch for prose; tables unbounded with horizontal scroll + sticky header.

### Spacing, elevation, motion

- 4 px grid: gaps of `4/8/12/16/24`; page padding `16 px` mobile, `24 px` desktop.
- Elevation = **borders**; shadow only on modal/dropdown: `0 8px 24px rgb(0 0 0 / 0.12)`.
- Motion: ≤ 150 ms transitions, `prefers-reduced-motion` disables all non-essential motion.

---

## 3. Layout System

```
┌─ Header (sticky, 48 px, border-b) ──────────────────────────────┐
│ Event name · date badge · [Light/Dark toggle] · [Export ▾]      │
├─ Sidebar (220 px, border-r, surface) ─┬─ Main content ──────────┤
│ Dashboard                              │ Tab: Budget | Timeline │
│ Budget                                 │        | Checklist     │
│ Timeline                               │        | Ideas | Chat  │
│ Vendors                                │                         │
│ Ideas                                  │  (dense working area)   │
│ Assistant                              │                         │
└────────────────────────────────────────┴─────────────────────────┘
```

- Breakpoints: sidebar collapses to icon rail < 1024 px; tables switch to stacked rows < 640 px.
- No hero section — the app opens directly into the working dashboard.

---

## 4. Component Layouts (normative)

### 4.1 Budget Table & Variance Bar
- Rows: category | planned | actual | variance | % bar. Header row `bg-surface`, `12 px uppercase`.
- Inputs: bare inline editors (1 px border on focus), right-aligned tabular numerals.
- **Variance bar** per row: 6 px track (`bg-surface`, inner `rounded-full` fill) —
  green ≤ 0 % over, sienna > 0 % over; percentage printed beside the bar (never color-only).
- Total row: top border 2 px, bold; over-total amount in `--danger` + "Over" text + icon.
- Keyboard: `Tab` through cells, `Enter` commits, `Escape` reverts, `↑/↓` row navigation;
  screen-reader announces totals via `aria-live="polite"` on commit.

### 4.2 Task Timeline (reverse countdown)
- Vertical rail (1 px) with nodes (8 px squares — not circles; functional geometry), grouped by
  phase; each row: due date (mono, tabular) · `T-21d` offset chip · title · checkbox.
- Past due: sienna left-border + "Overdue" chip; ≤ 7 days: indigo chip; done: muted + strikethrough.
- **Keyboard navigation:** roving `tabindex`; `↑/↓` move between tasks, `Home/End` jump,
  `Space` toggles, `Enter` opens detail; `aria-current="true"` on focused row; list semantics
  (`<ol>`), each row a `<li>` with explicit label.

### 4.3 Accessible Form Primitives
- **Explicit visible `<label>` above every input** (never placeholder-as-label), `for`/`id` paired.
- Errors: `aria-invalid="true"` + `aria-describedby` to helper text; `role="alert"` for the first
  error on submit.
- Required fields: textual "required" (not red asterisk alone).
- Generation/chat updates announced via `aria-live="polite"` region ("Plan ready — 14 tasks").
- Focus ring: `2 px solid var(--accent-indigo)` with 2 px offset — visible in both themes.

### 4.4 Assistant Panel
- Message list (`role="log"`, `aria-live="polite"`), user vs. assistant distinction by border
  + label, **not** color alone.
- Markdown output rendered as escaped structured blocks (chips/tables/lists) — no raw HTML.
- Input: textarea with visible label "Message the planner", `Enter` sends / `Shift+Enter` newline;
  send disabled while pending; loading announced politely.
- Streaming shows partial text + animated caret (disabled under reduced-motion).

### 4.5 Buttons, chips, tables (shared)
- Primary: `bg-primary text-canvas`, h-32 px, `rounded-md`, hover opacity 90 %.
- Secondary: `border-border bg-canvas`, hover `bg-surface`.
- Chips/badges: 12 px, 1 px border, square-ish (`rounded-sm`), text + optional icon.
- Data tables: sticky header, zebra **not** used (borders only), sortable headers are
  `<button>`s with `aria-sort`.

---

## 5. Accessibility Contract (definition of done)

- [ ] Full critical path operable with keyboard alone; no traps; visible focus everywhere
- [ ] All images/icons decorative → `aria-hidden`; meaningful → alt text
- [ ] AA contrast (≥ 4.5:1 text, ≥ 3:1 large text/UI) in **light and dark**
- [ ] Landmarks: `<header>/<nav>/<main>`; one `h1`; heading hierarchy unbroken
- [ ] `aria-live` on: chat output, totals changes, export success/failure
- [ ] `prefers-reduced-motion` respected; 200 % zoom without loss of function
- [ ] Lighthouse a11y ≥ 95, **zero critical/serious axe violations**
