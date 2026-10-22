# Architecture — Celebration & Event Planner

**Strategy:** BACKEND-FIRST. Contracts, rules, security, and data flow are defined here before
any UI is built. Stack: Next.js 16 (App Router), TypeScript strict, Vercel AI SDK, Zod, Zustand.

> Read [`CHALLENGE5_MAX_SCORE_RULES.md`](./CHALLENGE5_MAX_SCORE_RULES.md) before any task.
> Update [`Memory.md`](./Memory.md) after every feature.

---

## 1. Directory Topology

```
promptwar/
├── docs/                                 # Centralized documentation (source of truth)
│   ├── CHALLENGE5_MAX_SCORE_RULES.md     # Evaluation criteria & pre-submission checklist
│   ├── PRD.md                            # Product Requirements Document
│   ├── Architecture.md                   # This file — system architecture & flow specs
│   ├── Design.md                         # Anti-AI-slop UI & theme contract (light/dark)
│   ├── Phases.md                         # Implementation execution sequence
│   ├── Memory.md                         # Living project context & state tracking
│   └── Rules.md                          # Coding rules & AI agent directives
│
├── app/                                  # Next.js 16 App Router directory
│   ├── api/
│   │   └── plan/
│   │       └── route.ts                  # Server-side LLM call handler (POST)
│   ├── plan/
│   │   └── [id]/
│   │       └── page.tsx                  # Generated event dashboard view
│   ├── globals.css                       # Tailwind v4 & CSS variables for themes
│   ├── layout.tsx                        # Root layout: ThemeProvider & providers
│   └── page.tsx                          # Event setup form landing
│
├── components/                           # UI presentation layer
│   ├── ui/                               # Primitive shadcn components (Button, Input, Table)
│   ├── forms/                            # Event planner wizard form
│   ├── planner/                          # Core dashboard modules
│   │   ├── BudgetTable.tsx               # Live budget allocations & variance bar
│   │   ├── TimelineView.tsx              # Reverse countdown task schedule
│   │   ├── VendorChecklist.tsx           # Category vendor checklists & questions
│   │   └── IdeasView.tsx                 # AI-enriched recommendations
│   └── ExportButtons.tsx                 # PDF / CSV / Markdown export handlers
│
├── lib/                                  # Pure logic & server modules
│   ├── genai/
│   │   ├── client.ts                     # AI provider setup (Vercel AI SDK), server-only
│   │   ├── prompts.ts                    # Versioned prompt templates
│   │   └── schemas.ts                    # Zod schemas for LLM output & app contracts
│   ├── rules-engine/                     # Deterministic math engine (pure TS, no I/O)
│   │   ├── budget.ts                     # Allocation % rules per event type
│   │   ├── timeline.ts                   # Date interval rules (reverse countdown)
│   │   └── checklist.ts                  # Baseline tasks per category
│   ├── security/
│   │   └── prompt-guard.ts               # Input sanitization & token capping
│   └── store/
│       └── use-planner-store.ts          # Zustand store for local plan state
│
├── tests/                                # Automated testing suite
│   ├── unit/
│   │   ├── rules-engine.test.ts          # Math & date unit tests (Vitest)
│   │   └── prompt-guard.test.ts          # Security & sanitization unit tests
│   └── integration/
│       └── api-plan.test.ts              # Mocked LLM route handler tests
│
├── .env.example                          # Redacted environment variables example
├── package.json                          # Dependencies & scripts
└── tsconfig.json                         # Strict TypeScript configuration
```

**Extensions without breaking the canonical shape:** small helpers (`cache` for the server LRU,
rate limiter, HTML escape, LLM fallback) are colocated *inside* the canonical modules —
`lib/genai/client.ts` / `app/api/plan/route.ts` and `lib/security/prompt-guard.ts` — not as
new top-level directories.

**Import boundaries (enforced by convention + lint):**

| Module | May import | Must never import |
|---|---|---|
| `lib/rules-engine/*` | `lib/genai/schemas.ts` (types only) | AI SDK, `fetch`, store, React |
| `lib/genai/*` | AI SDK, `lib/genai/schemas.ts`, `lib/security` | React components, store |
| `lib/security/*` | stdlib only | AI SDK, store |
| `components/*` (client) | `lib/store`, `components/ui` | `lib/genai`, AI SDK, env keys |
| `app/api/plan/route.ts` | everything server-side | — |

`lib/genai/client.ts` starts with `import "server-only"` — the build fails if an API key can
reach the browser bundle.

---

## 2. Backend-First Data & Logic Flow

```
                      +-------------------------------------+
                      |   User Input (Client Component)     |
                      | Event Type, Budget, Guests, Date    |
                      +------------------+------------------+
                                         |
                                         v
                      +-------------------------------------+
                      |  Server Action / API Route Handler  |
                      |     POST /api/plan (Next.js 16)     |
                      +------------------+------------------+
                                         |
                +------------------------+------------------------+
                |                                                 |
                v                                                 v
+-----------------------------------+           +-----------------------------------+
| 1. Rules Engine (Pure TS)         |           | 2. Prompt Guard (Security)        |
| - Baseline budget % allocations   |           | - Input length capping           |
| - Countdown date calculations     |           | - Delimiter isolation            |
| - Default category checklists     |           |   (<user_input> tags)            |
| - Contingency triggers            |           | - Sanitization & escape          |
|   (outdoor → rain, < $2k → DIY)   |           | - Prompt-injection hardening     |
+----------------+------------------+           +----------------+------------------+
                 |                                                 |
                 +------------------------+------------------------+
                                          |
                                          v
                      +-------------------------------------+
                      | 3. Vercel AI SDK Layer (server)      |
                      |   generateObject() + Zod Schema      |
                      |   (qualitative enrichment only)      |
                      +------------------+------------------+
                                         |
                                         v
                      +-------------------------------------+
                      | 4. State Hydration (Zustand Store)   |
                      | Merge deterministic baseline ⊕       |
                      | LLM enrichment, Zod re-validate      |
                      +------------------+------------------+
                                         |
                                         v
                      +-------------------------------------+
                      | 5. Interactive Dashboard View        |
                      | - BudgetTable + live variance bar    |
                      | - Reverse countdown schedule         |
                      | - Vendor checklists / ideas          |
                      | - Export (PDF / CSV / Markdown)      |
                      +-------------------------------------+
```

The two steps 1 and 2 run **in parallel** per request: the Rules Engine produces the
deterministic baseline while the Prompt Guard prepares safe prompt material. Their outputs
meet at step 3, where the baseline is injected as grounded context for `generateObject()`.

**Rules:**
1. **Rules Engine owns all arithmetic** (percentages, totals, variance, dates). LLM never does
   math — it may only *propose* line items, which are re-priced by the engine.
2. **Zod is the contract** at every boundary: request body → guard → AI output → hydration →
   store → export.
3. **Baseline ⊕ enrichment, never replacement:** LLM output cannot delete engine-computed
   totals or dates; hydration filters conflicts in favor of the engine.
4. **Fallback is a feature:** any LLM failure yields a complete (if plainer) plan from templates,
   so the core flow never dead-ends.

---

## 3. API Surface (backend contract first)

### Route Handler — `app/api/plan/route.ts` (server-only LLM call)

| Route | Body (Zod) | Returns | LLM? |
|---|---|---|---|
| `POST /api/plan` | `PlanInputSchema` | `PlanSchema` (hydrated baseline ⊕ enrichment) | yes (on cache miss) |

This is the **only** LLM route handler. It orchestrates: rate limit → prompt guard → rules
engine → cache lookup → `generateObject()` → hydration merge → Zod re-validate → response.

### Server Actions (Next.js 16) — mutations

| Action | Purpose |
|---|---|
| `savePlanSlice(slice, data)` | Partial plan persistence (budget / timeline / checklist) |
| `toggleTask(id)` / `updateVendorItem(id, status)` | Checklist mutations |
| `recalculateBudget(input)` | Server-side re-allocation returning canonical math |

Mutations go through Server Actions; generation goes through the Route Handler. No legacy
`pages/api`, no `getServerSideProps` equivalents. Generation/export never run in a Server
Component render — export is client-side by design (see §6).

### Core Zod contracts (summary, `lib/genai/schemas.ts`)

```ts
PlanInputSchema = {
  vertical: z.enum(["wedding", "birthday", "community"]),
  eventDate: z.string().datetime(),           // must be future (refine)
  guestCount: z.number().int().min(1).max(10_000),
  budgetTotal: z.number().positive(),
  currency: z.string().length(3).default("USD"),
  location?, theme?, culturalNotes?,
  budgetBand: z.enum(["micro", "standard", "premium"])
}

PlanSchema = {
  input: PlanInputSchema,
  budget: { categories: [{ key, label, plannedCents, actualCents? }], contingencyPct },
  timeline: [{ id, title, dueDate, phase, done }],
  checklist: [{ category, items: [{ id, label, status, questions[], docs[] }] }],
  ideas: [{ id, title, rationale, tags[] }],
  meta: { generatedAt, source: "llm" | "fallback", cacheHit }
}
```

Money is stored as **integer cents**; dates as ISO strings; all ids are string UUIDs generated
server-side or via `crypto.randomUUID()`.

---

## 4. Security Specifications

| Threat | Control |
|---|---|
| Key leakage | `.env.local` only, `server-only` import guard, keys read in `lib/genai/client.ts` alone; `.env.example` shipped redacted; nothing key-shaped in client bundle |
| Prompt injection | `prompt-guard.ts`: input length cap (2 000 chars), control-char strip, XML-style `<user_input>` delimiters, system prompt orders model to treat delimited content as data only |
| XSS via LLM output | Escaping helper colocated in `lib/security/prompt-guard.ts` — output rendered as text; no `dangerouslySetInnerHTML` on model content |
| Resource abuse | Rate limit: e.g. 10 gen/min/IP, `429` with `Retry-After`; timeout on AI calls (e.g. 20 s) |
| Schema smuggling | `generateObject` + Zod; unknown keys stripped (`strict` schemas where safe) |
| Dependency risk | No key-vulnerable packages; lockfile committed |

## 5. Efficiency Specifications

- **Server LRU cache** for generations, key = hash(sanitized input + schema version); cap ≈ 200
  entries, TTL ≈ 15 min → identical requests cost 0 tokens.
- **Token discipline:** context includes only baseline + user input; system prompt has no
  per-request bloat; response schema constrains output length; `maxOutputTokens` set per route.
- **Client:** debounced regeneration (400 ms), no LLM call per keystroke, `useMemo` for derived
  budget math, streamed responses where supported, loading skeletons otherwise.
- **Retries:** exactly 1 retry on invalid object output, then deterministic fallback (no loops).

---

## 6. State Hydration & Store Shape

```ts
// lib/store/use-planner-store.ts — Zustand + persist("planner-plan", version: 1)
{
  input: PlanInput | null,
  plan: Plan | null,             // hydrated, Zod-validated
  status: "idle" | "loading" | "ready" | "error",
  error?: string,
  ui: { theme, activeTab, focusTaskId },
  actions: { generate, patchBudget, toggleTask, setVendorStatus, reset }
}
```

Store receives **only** validated `Plan` objects; it never constructs LLM-shaped data itself.
Hydration (step 4 above) is the single merge point: deterministic baseline ⊕ LLM enrichment,
re-validated with Zod before it ever reaches the store.

**Exports** (`components/ExportButtons.tsx`) read directly from the store and render
**client-side**: `jspdf` for PDF, `json2csv` for CSV, and a string template for Markdown.
Because the store is the one source of truth, on-screen values and exported values are
identical by construction — no export round-trip, no second data path, zero token cost.

**Dashboard routing:** `/` collects the event setup form; `POST /api/plan` returns a plan id;
the router navigates to `/plan/[id]`, which renders the dashboard reading the persisted store
state for that id.

---

## 7. Error Handling Contract

| Failure | Behavior |
|---|---|
| Guard rejects input | `400` + field-level Zod issues; UI shows inline errors |
| Rate limited | `429` + `Retry-After`; UI disables button with countdown |
| LLM timeout / invalid output | 1 retry → deterministic fallback plan (colocated in `lib/genai/client.ts`) with `meta.source = "fallback"`; banner: "Using offline template plan" |
| Export failure (client render, e.g. jspdf) | Toast with retry; plan state untouched |
