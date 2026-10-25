<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md

Challenge 5 competition entry: **GenAI Celebration & Event Planner** (Next.js 16 App Router, React 19, TS strict, Tailwind v4). Ships to public repo `Sharon-Sam14/Prompt-War` — **single branch `main`**, < 10 MB, ≤ 3 submission attempts.

## Binding docs (read before changing things)

- `docs/CHALLENGE5_MAX_SCORE_RULES.md` — scoring rubric; its pre-submission checklist gates the entry.
- `docs/Rules.md` — binding conventions: docs-first, Zod at every boundary, engine purity, security, a11y. Conflict order: executable config > Zod schema > prose.
- `docs/Design.md` (normative UI spec + color contract), `docs/Phases.md` (build order), `docs/Architecture.md` (module/import boundaries), `docs/Memory.md` (decision log — add the next `D##` row + execution-log entry after **every** feature).

## Gate order (mirrors `.github/workflows/quality.yml`; all green before any push)

```bash
npm run lint              # eslint, 0 errors
npm run format:check      # prettier (npm run format to fix)
npx tsc --noEmit          # strict TS
npm test                  # vitest: 8 files / ~367 tests, node env, LLM fully mocked
npm run build             # Next 16 Turbopack production build
npm run test:e2e          # Playwright: 3 tests, keyless, axe + keyboard + 320px/200% zoom
npx lhci autorun          # Lighthouse: a11y ≥ .95 and best-practices ≥ .90 are hard errors
```

Single test: `npx vitest run tests/unit/rules-engine.test.ts` · single e2e: `npx playwright test -g "name"`. Live smoke check: `node scripts/gate1.mjs` (needs a running server).

## Gotchas (each one cost time)

- **Only one server may own port 3000.** `npm run test:e2e` (`reuseExistingServer: true`) and `npx lhci autorun` both start/expect a server on :3000, and a leftover `npm run start` serves stale `.next` after rebuilds. Kill it first (PowerShell):
  `Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ }`
- **E2E is serial by design** (`workers: 1`, `fullyParallel: false`, `reducedMotion: "reduce"`): routes rate-limit 10 plans/min/IP. Don't parallelize or "fix" it.
- **Keyless is the default** — no `OPENAI_API_KEY`; both APIs fall back to the deterministic engine and tests must never need a key. `lib/genai/*` is `server-only` (vitest aliases it to `tests/stubs/server-only.ts`); client components must never import it.
- `formatMoney` (`lib/format.ts`) uses `Intl` with `minimumFractionDigits: 0` → 5000¢ renders `$50` (locale may render `US$50`). Assertions use regex (`/\$[\d,.]+ \/ guest/`), never exact strings.
- **Color hex lives ONLY in `app/globals.css`** (never inline in `.tsx`). `tests/unit/theme-contrast.test.ts` matches globals.css by **exact selector text**: use `.dark [data-vertical="…"]` (descendant — `.dark` is on `<html>`, the attribute on a div), and never a bare `.dark` selector inside the `@media print` block.
- Money is **integer cents** everywhere; allocations must sum exactly (largest-remainder rounding, asserted in tests). The engine owns all math; the LLM may only suggest percentages/offsets, merged where **engine math always wins**.
- The Zustand store persists to `localStorage` (`promptwar-planner` v1) with `skipHydration: true` — any component reading persisted state must call `useRehydratePlanner()`.
- `node scripts/screenshots.mjs` regenerates `docs/screenshots/*.jpg` headlessly (the desktop browser screenshot path is blocked by Windows foreground-lock). README references those files — keep names in sync.
- Prettier deliberately ignores `package-lock.json`, `public/**`, `docs/screenshots/**`, `AGENTS.md`. The nextjs-agent-rules block above is rewritten by `next dev` — commit it, never fight it.

## Architecture (wiring you'd otherwise guess wrong)

- Routes: `/` = landing + setup form (`components/landing-page.tsx` + `components/forms/event-setup-form.tsx`); `/plan/[id]` = dashboard (`components/planner/plan-dashboard.tsx`, Radix sidebar tabs, 6 panels). APIs: `app/api/plan`, `app/api/ask`; mutations in `app/actions.ts` (Server Actions are **public endpoints** — each Zod self-validates and is rate-limited).
- `lib/rules-engine/*` is pure TS (no I/O/React/LLM); templates/weights live in `lib/config/*.ts`. `hydrate.ts` merges optional LLM enrichment; `meta.source: "llm" | "fallback"` must stay honest in UI and exports.
- Per-vertical theming: `data-vertical="wedding|birthday|community"` on a wrapper re-tints accent roles. All three verticals are first-class — never wedding-centric copy.
- Anti-slop design contract (Design.md §1, enforced by review): no gradients, glassmorphism, neon, stock photos, AI sparkles, dead links, clickable divs; flat SVG vignettes only (`public/images/vignettes/`).
- **Navigation is settled (Memory D38):** the v2 spec §1.2 is canonical — landing anchor-nav + dashboard sidebar tablist. An earlier "persistent app-shell" alternative was spec'd in `Design.md`/`Phases.md` then cancelled (Phases 4.9 marked cancelled); don't revive it without an explicit owner request.

## Session rules (this repo, per owner)

- **Never `git commit` / `git push` unless explicitly asked.** Before any agreed push: single branch, remote `origin = Sharon-Sam14/Prompt-War`, secret scan clean (`git log -p | Select-String -Pattern "sk-|API_KEY|TOKEN"`), `git count-objects -vH` < 10 MB, attempt count logged in `docs/Memory.md` §6.
- Environment is Windows + PowerShell.
- Any UI change requires: both themes checked, keyboard path intact, `npm run format` on touched files, gate chain re-run, `Memory.md` entry.
