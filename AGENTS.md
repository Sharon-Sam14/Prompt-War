<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md

Challenge 5 entry: **GenAI Celebration & Event Planner** — Next.js 16 App Router, React 19, TS strict, Tailwind v4. Ships to public repo `Sharon-Sam14/Prompt-War`: single branch `main`, < 10 MB, ≤ 3 submission attempts (logged in `docs/Memory.md` §6).

## Binding docs (read before changing behaviour)

- `docs/CHALLENGE5_MAX_SCORE_RULES.md` — scoring rubric; its checklist gates submission.
- `docs/Rules.md` — conventions: docs-first, Zod at boundaries, engine purity, security, a11y.
- `docs/Design.md` (UI spec + color contract), `docs/Architecture.md` (import boundaries), `docs/Phases.md` (build order), `docs/Memory.md` (decision log — newest is **D51**; append a `D##` row plus an execution-log entry after every feature).
- Conflict order: executable config > Zod schema > prose (`Rules.md` §1).

## Gates (mirror `.github/workflows/quality.yml`; all green before any push)

```bash
npm run lint          # eslint: 0 errors (warnings tolerated)
npm run format:check  # prettier (npm run format to fix)
npx tsc --noEmit      # strict TS
npm test              # vitest, node env, LLM mocked: 9 files / 377 tests
npm run build         # Next 16 production build (Webpack + Tailwind PostCSS)
npm run test:e2e      # Playwright: 10 tests, keyless
npx lhci autorun      # a11y ≥ .95 and best-practices ≥ .90 are hard errors
```

Single test file: `npx vitest run tests/unit/rules-engine.test.ts` · single e2e: `npx playwright test -g "keyboard only"` · live API smoke: `node scripts/gate1.mjs` (needs a server on :3000).

## Gotchas

- **Port 3000 serializes everything.** `test:e2e` (`reuseExistingServer: true`) and `lhci` (`startServerCommand: npm run start`) both expect :3000, and a leftover `npm run start` serves stale `.next` after a rebuild. Kill it first (PowerShell):
  `Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ }`
- **E2E is serial on purpose** (`workers: 1`, `fullyParallel: false`, `reducedMotion: "reduce"`): `/api/plan` is capped at 10/min/IP (ask 30/min, server actions 60/min). Don't parallelize or unset reduced motion.
- **Keyless is the default**: no `OPENAI_API_KEY` needed — both APIs fall back to the deterministic engine and tests must never require a key. `lib/genai/*` is `server-only` (vitest aliases it to `tests/stubs/server-only.ts`); client components must never import it.
- **Two setup surfaces, one store.** `/create` (`EventSetupForm`, covered by E2E, **no nav entry** — URL-only since D47) and `/onboarding` (5-step wizard behind the landing CTAs, covered by `tests/e2e/onboarding.spec.ts`) both build a `PlanInput` and call the store's `generatePlan`. Field changes must be mirrored in both.
- **Local event library.** `promptwar-planner` stores the active event plus `savedPlans`, per-event document trackers, saved/applied idea ids; edits snapshot into the active event entry. `PlanActions` owns save/switch/delete and confirmed delete. Vendor actuals are mapped to budget keys and added to separate manual actuals once.
- **The app is dark-only since D46.** `class="dark"` is hard-coded on `<html>` and `ThemeProvider` pins `forcedTheme="dark"`. The light `:root` palette in `app/globals.css` survives only because `tests/unit/theme-contrast.test.ts` parses both themes (8 scenarios = {light,dark} × {base,wedding,birthday,community}) using **exact selector text** — keep the block structure when editing tokens.
- **Gradients exist despite `Design.md`.** §1 still forbids gradients/glass, but the shipped chrome uses `.aurora-backdrop` radial-gradient blobs (on `/`, `/create`, `/onboarding`) and `.glass-panel` (landing nav + search pill, onboarding wizard card). CSS is ground truth: don't flatten them or add new ones without owner sign-off.
- Colors live only in `app/globals.css` (never inline hex in `.tsx`); per-vertical accents remap via `data-vertical` on a wrapper, dark overrides via `.dark [data-vertical="…"]`.
- `formatMoney` (`lib/format.ts`) sets `minimumFractionDigits: 0`, so 5000¢ renders `$50` (locale may emit `US$50`). Assert with regex (`/\$[\d,.]+ \/ guest/`), never exact strings.
- Money is integer cents everywhere and allocations must sum exactly (largest-remainder rounding, test-asserted). The engine owns all math; the LLM may only suggest percentages/day-offsets, and engine math wins on merge.
- The Zustand store persists to `localStorage` (`promptwar-planner` v1, `skipHydration: true`) — anything reading persisted state must call `useRehydratePlanner()` or SSR markup will mismatch.
- `node scripts/screenshots.mjs` regenerates `docs/screenshots/*.jpg` headlessly (build + server on :3000 required); README points at those exact filenames.
- Root `*.log` / `*-output.txt` files are stale gate transcripts — re-run the gate instead of trusting them.
- Prettier ignores `package-lock.json`, `public/**`, `docs/screenshots/**`, `AGENTS.md`. The `nextjs-agent-rules` block above is rewritten by `next dev` — commit it, never fight it.
- Windows + PowerShell. Vitest runs files isolated (`isolate: true`) because route-handler tests share module state (in-memory limiter + LRU cache); add tests within a file sequentially.

## Architecture

- Routes: `/` = static landing only; `/create` = setup form (`await connection()` + `export const instant = false`, because its date-dependent defaults break `cacheComponents` prerender); `/onboarding` = 5-step wizard linked from the landing hero/vertical cards; `/plan/[id]` = dashboard (`components/planner/plan-dashboard.tsx`, Radix sidebar tablist over `PLANNER_TABS`, 6 panels). Everything is local-first — plans live in `localStorage`, there is no server-side plan storage.
- APIs: `app/api/plan` (generation), `app/api/ask` (assistant); mutations in `app/actions.ts`. Server Actions are **public endpoints** — each one Zod-validates and rate-limits itself.
- `lib/rules-engine/*` is pure TS (no I/O/React/LLM); templates/weights live in `lib/config/*.ts`; `hydrate.ts` merges optional LLM enrichment and must keep `meta.source: "llm" | "fallback"` honest in UI and exports.
- All three verticals (wedding, birthday, community) are first-class — never wedding-centric copy.
- Photography: bundled Pexels-license JPEGs in `public/images/photos/`, used only in the sanctioned slots (Design.md §4.6, print-mount framing): the setup masthead, the dashboard overview header, and the three landing vertical cards — one photo per event type, fluid on mobile. `hero-suite.jpg` is bundled and reserved (the landing hero plate was specified but never shipped). Hand-drawn SVG only for `empty-ideas.svg` and `app/icon.svg`. No hotlinked stock.
- Navigation is settled: landing anchor-nav (**no "Create event" entry** — owner removed it, D47) + `/create` route (URL-only) + dashboard sidebar tablist (Memory D38/D46/D47; the `#create` anchor is retired). The earlier "persistent app-shell" alternative stays cancelled — don't revive it without an explicit owner request.

## Session rules (owner)

- **Never `git commit` / `git push` unless explicitly asked.** Before an agreed push: single branch `main`, remote `origin = Sharon-Sam14/Prompt-War`, secret scan clean (`git log -p | Select-String -Pattern "sk-|API_KEY|TOKEN"`), `git count-objects -vH` < 10 MB, attempt count updated in `docs/Memory.md` §6.
- Any UI change requires: all three vertical accents checked (`theme-contrast.test.ts`), keyboard path intact, `npm run format` on touched files, full gate chain re-run, and a `Memory.md` entry.
