import { z } from "zod";

/**
 * Single source of truth for all data contracts (see docs/Architecture.md §3).
 * Every boundary parses with these schemas: request body → LLM output → store → export.
 *
 * Conventions:
 * - Money is integer CENTS (never floats).
 * - Dates are ISO-8601 strings.
 * - Ids are UUID strings generated server-side or via crypto.randomUUID().
 */

export const VerticalSchema = z.enum(["wedding", "birthday", "community"]);
export const BudgetBandSchema = z.enum(["micro", "standard", "premium"]);
export const VendorStatusSchema = z.enum(["to_contact", "contacted", "quoted", "booked"]);

export type Vertical = z.infer<typeof VerticalSchema>;
export type BudgetBand = z.infer<typeof BudgetBandSchema>;
export type VendorStatus = z.infer<typeof VendorStatusSchema>;

/** User input that drives plan generation. */
const PlanInputFieldsSchema = z.object({
  vertical: VerticalSchema,
  /** Optional name the user gives the event (wizard step 2 / setup form). */
  name: z.string().trim().min(1).max(120).optional(),
  eventDate: z.iso.datetime({ offset: true }),
  guestCount: z.number().int().min(1).max(10_000),
  /** Total budget in integer cents. */
  budgetTotalCents: z.number().int().min(0).max(10_000_000_00),
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/, "currency must be a 3-letter ISO-4217 code")
    .default("USD"),
  budgetBand: BudgetBandSchema,
  location: z.string().trim().max(200).optional(),
  theme: z.string().trim().max(200).optional(),
  culturalNotes: z.string().trim().max(1_000).optional(),
  /** Free-text vision/must-haves — reaches the model as delimited context. */
  description: z.string().trim().max(600).optional(),
  isOutdoor: z.boolean().default(false),
});

/** Input accepted for new plan generation; event date validated on client. */
export const PlanInputSchema = PlanInputFieldsSchema;

/** Saved plans remain importable after their event date has passed. */
export const SavedPlanInputSchema = PlanInputFieldsSchema;

export type PlanInput = z.infer<typeof PlanInputSchema>;

/** One budget row. planned/actual are integer cents. */
export const BudgetCategorySchema = z.object({
  key: z.string().min(1).max(64),
  label: z.string().min(1).max(80),
  plannedCents: z.number().int().min(0),
  actualCents: z.number().int().min(0).nullable().default(null),
  /** Manual portion is kept separate when vendor actuals roll into actualCents. */
  manualActualCents: z.number().int().min(0).nullable().optional(),
});

export const BudgetSchema = z.object({
  categories: z.array(BudgetCategorySchema).min(1).max(24),
  /** Contingency/reserve percentage of total (0–30). */
  contingencyPct: z.number().min(0).max(30),
});

export type Budget = z.infer<typeof BudgetSchema>;
export type BudgetCategory = z.infer<typeof BudgetCategorySchema>;

/** One reverse-countdown task. dueDate is always ≤ eventDate (engine-enforced). */
export const TaskSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1).max(160),
  dueDate: z.iso.datetime({ offset: true }),
  /** Days before the event (0 = event day). */
  offsetDays: z.number().int().min(0).max(730),
  phase: z.enum(["planning", "booking", "promotion", "execution", "post_event"]),
  done: z.boolean().default(false),
});

export type Task = z.infer<typeof TaskSchema>;

export const ChecklistItemSchema = z.object({
  id: z.uuid(),
  label: z.string().min(1).max(200),
  status: VendorStatusSchema.default("to_contact"),
  /** Questions to ask this vendor. */
  questions: z.array(z.string().min(1).max(300)).max(20).default([]),
  /** Documents to collect from this vendor. */
  docs: z.array(z.string().min(1).max(160)).max(20).default([]),
  budgetCategoryKey: z.string().min(1).max(64).nullable().optional().default(null),
  estimatedCents: z.number().int().min(0).nullable().optional().default(null),
  actualCents: z.number().int().min(0).nullable().optional().default(null),
});

export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;

export const ChecklistCategorySchema = z.object({
  category: z.string().min(1).max(80),
  items: z.array(ChecklistItemSchema).max(40),
});

export type ChecklistCategory = z.infer<typeof ChecklistCategorySchema>;

export const ChecklistSchema = z.array(ChecklistCategorySchema).max(24);

/** LLM-enriched personalized idea. */
export const IdeaSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1).max(160),
  rationale: z.string().min(1).max(500),
  tags: z.array(z.string().min(1).max(40)).max(8).default([]),
  /** Legacy persisted ideas were model-generated and did not carry provenance. */
  source: z.enum(["rules", "llm"]).default("llm"),
});

export type Idea = z.infer<typeof IdeaSchema>;

export const PlanMetaSchema = z.object({
  generatedAt: z.iso.datetime({ offset: true }),
  source: z.enum(["llm", "fallback"]),
  cacheHit: z.boolean(),
  schemaVersion: z.literal(1),
});

export type PlanMeta = z.infer<typeof PlanMetaSchema>;

/** The complete hydrated plan — the only shape the store accepts. */
export const PlanSchema = z.object({
  id: z.uuid(),
  input: SavedPlanInputSchema,
  budget: BudgetSchema,
  timeline: z.array(TaskSchema).min(1).max(200),
  checklist: ChecklistSchema,
  ideas: z.array(IdeaSchema).max(30),
  meta: PlanMetaSchema,
});

export type Plan = z.infer<typeof PlanSchema>;

/**
 * Shape the LLM is asked to produce (see lib/genai/prompts.ts).
 * Deliberately narrower than PlanSchema: dates come back as offsets and amounts as
 * percentages — the Rules Engine converts them to absolute cents/dates so the model
 * can never do arithmetic (docs/Architecture.md §2 rule 1).
 */
export const LlmEnrichmentSchema = z.object({
  budgetPct: z
    .array(
      z.object({
        key: z.string().min(1).max(64),
        pct: z.number().min(0).max(100),
      }),
    )
    .max(24),
  tasks: z
    .array(
      z.object({
        title: z.string().min(1).max(160),
        offsetDays: z.number().int().min(0).max(730),
        phase: z.enum(["planning", "booking", "promotion", "execution", "post_event"]),
      }),
    )
    .max(200),
  ideas: z
    .array(
      z.object({
        title: z.string().min(1).max(160),
        rationale: z.string().min(1).max(500),
        tags: z.array(z.string().min(1).max(40)).max(8),
      }),
    )
    .max(30),
});

export type LlmEnrichment = z.infer<typeof LlmEnrichmentSchema>;

/**
 * Compact plan snapshot the client sends with an assistant question
 * (Design.md §4.9). The plan lives in localStorage, so the server learns the
 * user's actual context from this request — never from stored server state.
 */
export const AskContextSchema = z.object({
  vertical: VerticalSchema,
  eventDate: z.iso.datetime({ offset: true }),
  guestCount: z.number().int().min(1).max(10_000),
  budgetTotalCents: z.number().int().min(0),
  currency: z.string().length(3),
  budgetBand: BudgetBandSchema,
  theme: z.string().trim().max(200).optional(),
  location: z.string().trim().max(200).optional(),
  isOutdoor: z.boolean(),
  contingencyPct: z.number().min(0).max(30),
  categories: z
    .array(
      z.object({
        label: z.string().min(1).max(80),
        plannedCents: z.number().int().min(0),
        actualCents: z.number().int().min(0).nullable(),
      }),
    )
    .min(1)
    .max(24),
  tasks: z
    .array(
      z.object({
        title: z.string().min(1).max(160),
        dueDate: z.iso.datetime({ offset: true }),
        offsetDays: z.number().int().min(0).max(730),
        done: z.boolean(),
      }),
    )
    .min(1)
    .max(200),
  vendors: z
    .array(
      z.object({
        category: z.string().min(1).max(80),
        label: z.string().min(1).max(200),
        status: VendorStatusSchema,
      }),
    )
    .max(400),
  ideaTitles: z.array(z.string().min(1).max(160)).max(30),
  /** Titles the user explicitly bookmarked in the Ideas tab (empty if none). */
  savedIdeaTitles: z.array(z.string().min(1).max(160)).max(30).optional(),
});

export type AskContext = z.infer<typeof AskContextSchema>;

export const AskHistoryMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().trim().min(1).max(500),
});
export type AskHistoryMessage = z.infer<typeof AskHistoryMessageSchema>;

/** POST /api/ask request body. */
export const AskRequestSchema = z.object({
  question: z.string().trim().min(1).max(500),
  history: z.array(AskHistoryMessageSchema).max(3).default([]),
  context: AskContextSchema,
});

export type AskRequest = z.infer<typeof AskRequestSchema>;

/** What the LLM is asked to produce for an assistant turn. */
export const LlmAskSchema = z.object({
  answer: z.string().min(1).max(1_200),
});

export type LlmAsk = z.infer<typeof LlmAskSchema>;

/** POST /api/ask response — source is always labeled in the UI (§4.9). */
export const AskResponseSchema = z.object({
  answer: z.string().min(1).max(1_200),
  source: z.enum(["engine", "llm"]),
  followUp: z.string().max(200).optional(),
  suggestions: z.array(z.string().max(80)).length(3).optional(),
});

export type AskResponse = z.infer<typeof AskResponseSchema>;
