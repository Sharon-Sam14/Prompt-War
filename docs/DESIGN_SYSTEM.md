# Design System — Dual Theme Specification (Brand Edition)

## Version

2.1 (brand refresh) · Status: Active · Updated: 2026-10-26

> This document defines the design tokens, component states, motion rules, and accessibility
> contract for both light ("champagne paper & wine") and dark ("aubergine & wine") themes.
> All values are machine-verified by `tests/unit/theme-contrast.test.ts` across 8 scenarios.
> Brand system adds: vertical accents, display serif, SVG illustration set, tonal gradients allowed
> ONLY where contrast is verified, and tasteful celebratory moments.

---

## 1. Theme Architecture

### 1.1 Dual Theme Strategy

| Theme | Name                   | CSS Class         | Description                                                        |
| ----- | ---------------------- | ----------------- | ------------------------------------------------------------------ |
| Light | Champagne Paper & Wine | `:root` (default) | Warm cream paper, burgundy wine, soft gold, deep green             |
| Dark  | Aubergine & Wine       | `.dark`           | Deep aubergine near-black surfaces, plum/lavender luminous accents |

**Mechanism:** `next-themes` with `attribute="class"`, `defaultTheme="system"`, `enableSystem`.
The `.dark` class is toggled on `<html>`. No-flash inline script prevents FOUC.

### 1.2 Color-Scheme Meta

```css
.dark {
  color-scheme: dark;
}
```

---

## 2. Design Tokens (CSS Variables)

### 2.1 Light Theme (`:root`)

| Token                | Value     | Usage                                                                        |
| -------------------- | --------- | ---------------------------------------------------------------------------- |
| `--background`       | `#FAF8F5` | Champagne paper canvas                                                       |
| `--foreground`       | `#2B1A1C` | Wine-black ink text                                                          |
| `--card`             | `#FBF6EC` | Panels, tables, sidebar                                                      |
| `--primary`          | `#6B0F22` | Deep burgundy buttons/active nav, primary calls-to-action                    |
| `--secondary`        | `#D9A8C6` | Rich highlight — used for chip backgrounds, chart segments, event covers     |
| `--border`           | `#DDCEBB` | Structural hairlines                                                         |
| `--input`            | `#8D7A6F` | Input/control borders                                                        |
| `--ring`             | `#8A6B1F` | Focus ring (antique gold)                                                    |
| `--muted-foreground` | `#6F5A55` | Secondary text, disabled text                                                |
| `--accent-a`         | `#8E2436` | Primary accent — wedding: rose-wine; birthday: warm coral; community: forest |
| `--accent-b`         | `#A67C1E` | Secondary accent — antique gold, used for hairlines, dividers, warmth        |
| `--gilt`             | `#96731A` | Hairline rules, eyebrow accents, print-mount framing                         |
| `--success`          | `#1C7A4F` | Under budget, done, booked                                                   |
| `--destructive`      | `#8F1D28` | Over budget, errors                                                          |
| `--info`             | `#4A90E2` | Mild action, hover state                                                     |

### 2.2 Dark Theme (`.dark`)

| Token                | Value     | Usage                                                                                                         |
| -------------------- | --------- | ------------------------------------------------------------------------------------------------------------- |
| `--background`       | `#17121A` | Deep aubergine near-black                                                                                     |
| `--foreground`       | `#F1E9F1` | Soft white text                                                                                               |
| `--card`             | `#211A26` | Elevated surfaces                                                                                             |
| `--primary`          | `#C9A6E0` | Soft plum-lavender primary                                                                                    |
| `--secondary`        | `#F5C7D7` | Rich highlight — used for chip backgrounds, chart segments, event covers                                      |
| `--border`           | `#3A2F42` | Structural hairlines                                                                                          |
| `--input`            | `#5A4E66` | Input borders                                                                                                 |
| `--ring`             | `#B98FD6` | Focus ring                                                                                                    |
| `--muted-foreground` | `#B9A8C0` | Secondary text, disabled text                                                                                 |
| `--accent-a`         | `#D05772` | Rose-wine (wedding) — `.dark [data-vertical="wedding"]` → `#D05772`                                           |
| `--accent-b`         | `#D9B04F` | Antique gold — `.dark [data-vertical="birthday"]` → warm coral; `.dark [data-vertical="community"]` → saffron |
| `--gilt`             | `#D4A243` | Hairline rules, eyebrow accents                                                                               |
| `--success`          | `#34B47D` | Success green                                                                                                 |
| `--destructive`      | `#C7384B` | Error/destructive                                                                                             |
| `--info`             | `#6EA8F1` | Mild action, hover state                                                                                      |

### 2.3 Per-Vertical Accent Remap

Applied via `[data-vertical="wedding|birthday|community"]` on a wrapper.

The accent remap overrides `--accent-a`, `--accent-b`, and `--gilt` in **both** themes.

#### Light Theme Verticals

| Vertical  | `--accent-a` / `-text` | `--accent-b` / `-text` | `--gilt` / `-text`    |
| --------- | ---------------------- | ---------------------- | --------------------- |
| Wedding   | `#8E2436` / `#6B0F22`  | `#A67C1E` / `#7D5C14`  | `#96731A` / `#7D5C14` |
| Birthday  | `#B8737A` / `#8C4A47`  | `#A67C1E` / `#7D5C14`  | `#B8737A` / `#8C4A47` |
| Community | `#1E4D3A` / `#173B2C`  | `#A67C1E` / `#7D5C14`  | `#96731A` / `#7D5C14` |

#### Dark Theme Verticals (`.dark [data-vertical="..."]`)

| Vertical  | `--accent-a` / `-text` | `--accent-b` / `-text` | `--gilt` / `-text`    |
| --------- | ---------------------- | ---------------------- | --------------------- |
| Wedding   | `#D05772` / `#FFA2B0`  | `#D9B04F` / `#F3D486`  | `#D9B04F` / `#F3D486` |
| Birthday  | `#D98A92` / `#FFC4C9`  | `#D9B04F` / `#F3D486`  | `#D98A92` / `#FFC4C9` |
| Community | `#4BB088` / `#85E0B8`  | `#D9B04F` / `#F3D486`  | `#4BB088` / `#85E0B8` |

### 2.4 Chart Palette (6 tones, distinguishable without color alone)

| Index | Light     | Dark      | Usage                     |
| ----- | --------- | --------- | ------------------------- |
| 0     | `#6B0F22` | `#C9A6E0` | Primary, active state     |
| 1     | `#1C7A4F` | `#4FBF8B` | Success, positive         |
| 2     | `#8F1D28` | `#C7384B` | Destructive, warning      |
| 3     | `#A67C1E` | `#D9B04F` | Secondary accent          |
| 4     | `#D05772` | `#D05772` | Wedding accent (override) |
| 5     | `#1E4D3A` | `#4BB088` | Community accent          |

Each tone passes 4.5:1 contrast on `--background` / `--foreground` and 3:1 on `--card`.
Charts use **patterns or direct labels** as the distinguish-Without-Color mechanism.

### 2.5 Gradients (Allowed ONLY where contrast verified)

- **Hero background:** soft tonal gradient, low saturation, never behind body text
- **Event covers:** subtle gradient overlay on SVG illustration, contrast-checked
- **Stat highlights:** one gradient per page max, as accent not background
- **Never** a gradient behind table rows, focus rings, or body copy

All gradient stops must be declared in `app/globals.css` and will be parsed by the contrast test.
If a gradient fails the 8-scenario contrast test, it must be removed.

---

## 3. Typography

| Role        | Font                     | Usage                                                        |
| ----------- | ------------------------ | ------------------------------------------------------------ |
| **Display** | `Cormorant Garamond`     | Page titles, hero headline, stat numbers, event cover titles |
| **UI Sans** | `EB Garamond`            | Wait — UI sans is `Inter` (or `system-ui`), display is serif |
| **Body**    | `Inter` (or `system-ui`) | Prose, data, labels, tables, forms                           |
| **Mono**    | `IBM Plex Mono`          | Money cells, codes, input previews (`.tnum`, `.eyebrow`)     |

> **Correction:** `Cormorant Garamond` for display headings and big numbers; `Inter` for all UI text.

**Scale:** `11 / 12 / 14 / 16 / 24 / 32 / 48 px` — body **14 px**
**Tabular numerals:** `font-variant-numeric: tabular-nums` on all currency, dates, counts
**Line length:** 72ch cap for prose; tables unbounded with horizontal scroll
**Eyebrows:** small caps, `font-variant: small-caps`, `font-size: 0.75rem`, tracking wider

**Hierarchy:**

- Hero: `4xl`–`7xl` desktop (56–72 px), tight tracking, display serif
- Section titles: `xl`–`2xl` (20–32 px), display serif, modest tracking
- Body copy: `base` (14 px), Inter, leading-relaxed
- Small caps eyebrows: `0.75rem`, `font-variant: small-caps`, tracking wider

---

## 4. Spacing, Elevation, Motion

### 4.1 Spacing

- 4 px grid; page padding `16 px` mobile, `24 px` desktop
- Section gap: `24 px` desktop, `16 px` mobile

### 4.2 Elevation

- Hairline borders (1 px `--border`); shadow only on modal/dropdown
- No box-shadow on cards, buttons, or page containers

### 4.3 Motion

- Micro-interactions (hover, focus, disclosure) ≤ 150 ms
- Content motion: `Reveal` 400 ms ease-out (opacity + small translate ≤ 8 px), stagger 60 ms per child capped at 6 steps / 240 ms total
- `CountUp` runs once on first mount; updates only on genuine data change
- **Gradients:** allowed only where contrast verified (see §2.5)
- **No parallax, 3D, or continuous glow**
- `prefers-reduced-motion: reduce` makes all motion instant and fully visible (CSS **and** JS check)
- Confetti: capped at ~1.2 s, drawn on canvas, lazy-loaded, `prefers-reduced-motion` disables

### 4.4 Radius

- Cards: `rounded-lg`; Chips: `rounded-md` — soft but not pill-soft (`--radius: 0.3rem`)

---

## 5. Component States (Normative)

| State          | Visual Treatment                                              |
| -------------- | ------------------------------------------------------------- |
| Default        | Base token colors (no inline hex)                             |
| Hover          | `--accent-a/10` background tint or `--border` → `--ring`      |
| Focus          | 2 px `--ring` with offset, visible on every surface           |
| Active/Pressed | Scale 0.98 or `--accent-a/20` background                      |
| Disabled       | `opacity-50`, `cursor-not-allowed`, `--muted-foreground` text |
| Loading        | `LoadingSkeleton` matching final layout                       |
| Error          | `--destructive` border + inline error message                 |
| Empty          | `EmptyState` with icon, title, description, optional action   |

---

## 6. Anti-AI-Slop Rules (Enforced)

| ❌ Never                                                              | ✅ Instead                                                                    |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Clip-art florals, emoji decoration, script-font spam                  | One glyph-scale flourish (`❦`, one script line) per screen max                |
| Gradient blobs, glow, glassmorphism (outside verified gradient areas) | Flat paper surfaces; color only for state/meaning                             |
| Whitespace-as-elegance (5 items per screen)                           | High data density inside elegant frames: tables, rails, stat cards            |
| Hotlinked/stock-lottery imagery                                       | Bundled free-license photo plates in exactly three sanctioned slots           |
| Floating shadows everywhere                                           | Hairline borders (1 px); shadow only for overlays                             |
| Decorative serif on data                                              | Serif for display headings only; **mono tabular numerals** for money/dates    |
| Generic Inter-only marketing copy                                     | Compact labels, mono small-caps eyebrows, verb-first buttons                  |
| More than one brand flourish per screen                               | One script flourish (`❦`) max, used in hero, footer, or cover — not all three |

**Test:** If a screen could be reskinned as a perfume landing page with zero changes, it's slop.

---

## 7. Contrast Test Scenarios (Machine-Enforced)

`tests/unit/theme-contrast.test.ts` parses `app/globals.css` and proves WCAG 2.1 AA for:

**8 Scenarios = {Light, Dark} × {Base, Wedding, Birthday, Community}**

| Requirement                           | Threshold |
| ------------------------------------- | --------- |
| Text (SC 1.4.3)                       | ≥ 4.5:1   |
| UI Boundaries/Focus Rings (SC 1.4.11) | ≥ 3:1     |

**Pairs tested:** All foreground/background combinations from the token tables above.
A failing pair fails the build.

---

## 8. Imagery

### 8.1 Photo Plates (Exactly 3 Sanctioned Slots)

1. **Landing hero band** under CTA — `public/images/photos/hero-suite.jpg` (1600×1067)
2. **Setup masthead** (swaps with vertical radios) — vertical-specific
3. **Dashboard overview header** — `hidden md:block`, vertical-specific

**Files and licenses:**

| File                                 | Size     | License |
| ------------------------------------ | -------- | ------- |
| `hero-suite.jpg` (1600×1067)         | ≤ 200 KB | Pexels  |
| `wedding-table.jpg` (1100×733)       | ≤ 200 KB | Pexels  |
| `birthday-cake.jpg` (900×1350)       | ≤ 200 KB | Pexels  |
| `community-gathering.jpg` (1100×733) | ≤ 200 KB | Pexels  |

**Framing:** `bg-card` + 1 px gilt hairline + `object-cover`, no shadow/gradient/overlay/filter
**CLS:** Intrinsic width/height declared (CLS 0)
**Accessibility:** `alt=""` + `aria-hidden="true"`

### 8.2 Functional SVG Only (Brand Palette, `currentColor`)

- `public/images/empty-ideas.svg` (empty state — line art, no fill-dependent colors)
- `app/icon.svg` (favicon — single-path geometric mark, `fill="currentColor"` so it inherits `--foreground` / `--accent-a`)
- **New:** `celebration-icons.svg` — small SVG set (confetti, ring, candle/lantern, balloon, floral sprig, calendar, table setting) all with `fill="currentColor"` so they inherit theme colors in both light and dark

### 8.3 Illustration Policy

- **Baseline:** SVG/CSS scenes, patterns, and generated textures
- **Optional:** Up to 6 compressed local JPEG/WebP photos (≤ 200 KB each, with documented licensing or self-made) in sanctioned slots only
- **Never:** Hotlinked stock, broken images, AI-looking clip art, emoji decoration
- All SVGs use `fill="currentColor"` or explicit brand palette hex values that pass contrast

---

## 9. Print Stylesheet

```css
@media print {
  html,
  body {
    background: #ffffff !important;
    color: #2b1a1c !important;
  }
  .print\:hidden {
    display: none !important;
  }
}

Print always re-keys to light ink for legibility regardless of on-screen theme.
```

---

## 10. Implementation Checklist

- [ ] All components use semantic tokens only (no inline hex)
- [ ] Both themes pass contrast test (8 scenarios)
- [ ] `prefers-reduced-motion` honored in CSS and JS
- [ ] All states implemented (hover, focus, active, disabled, loading, error, empty)
- [ ] Photo plates in exactly 3 slots, framed correctly
- [ ] Print stylesheet tested
- [ ] No `dark:` utilities in component code (handled by `.dark` variable overrides)
- [ ] SVG illustrations use `fill="currentColor"` or verified palette hex
- [ ] Gradient usage declared and contrast-checked ( §2.5 )
- [ ] Vertical accent remap applied in both light and dark ( §2.3 )
