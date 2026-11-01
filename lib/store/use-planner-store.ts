"use client";

import { useEffect, useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { z } from "zod";
import {
  PlanInputSchema,
  PlanSchema,
  SavedPlanInputSchema,
  type Budget,
  type Plan,
  type PlanInput,
  type VendorStatus,
} from "@/lib/genai/schemas";

/**
 * Planner store (docs/Architecture.md §4): the single client-side source of
 * truth for the generated plan. The server owns math and validation — this
 * store holds Zod-validated results and *adopts* server outputs (POST /api/plan
 * response, server-action budgets) instead of recomputing its own truth.
 */

export const PLANNER_TABS = [
  "overview",
  "budget",
  "timeline",
  "checklist",
  "ideas",
  "exports",
] as const;
export type PlannerTab = (typeof PLANNER_TABS)[number];

/**
 * One saved event in the library. The full plan travels with its own UI state
 * (document trackers, bookmarked ideas) so switching events never leaks state
 * between plans. New optional field — v1 payloads parse into `{}` untouched.
 */
const SavedPlanEntrySchema = z.object({
  plan: PlanSchema,
  receivedDocs: z.record(z.string(), z.array(z.string())).optional().default({}),
  savedIdeaIds: z.array(z.string()).optional().default([]),
  appliedIdeaIds: z.array(z.string()).optional().default([]),
});

export type SavedPlanEntry = z.infer<typeof SavedPlanEntrySchema>;

const PersistedPlannerStateSchema = z.object({
  input: SavedPlanInputSchema.nullable().optional().default(null),
  plan: PlanSchema.nullable().optional().default(null),
  ui: z
    .object({ activeTab: z.enum(PLANNER_TABS) })
    .optional()
    .default({ activeTab: "overview" }),
  receivedDocs: z.record(z.string(), z.array(z.string())).optional().default({}),
  /** Event library, keyed by plan id — the multi-event surface. */
  savedPlans: z.record(z.string(), SavedPlanEntrySchema).optional().default({}),
  savedIdeaIds: z.array(z.string()).optional().default([]),
  appliedIdeaIds: z.array(z.string()).optional().default([]),
});

export function parsePersistedPlannerState(value: unknown) {
  return PersistedPlannerStateSchema.safeParse(value);
}

export function selectPersistedPlannerState(state: PlannerState) {
  return {
    input: state.input,
    plan: state.plan,
    ui: state.ui,
    receivedDocs: state.receivedDocs,
    savedPlans: state.savedPlans,
    savedIdeaIds: state.savedIdeaIds,
    appliedIdeaIds: state.appliedIdeaIds,
  };
}

export type PlanStatus = "idle" | "generating" | "ready" | "error";

interface PlannerUi {
  activeTab: PlannerTab;
}

export interface PlannerState {
  input: PlanInput | null;
  plan: Plan | null;
  status: PlanStatus;
  error: string | null;
  /** itemKey (`${categoryIndex}:${itemIndex}`) → received doc labels (UI-only). */
  receivedDocs: Record<string, string[]>;
  savedPlans: Record<string, SavedPlanEntry>;
  savedIdeaIds: string[];
  appliedIdeaIds: string[];
  ui: PlannerUi;
  generatePlan: (input: PlanInput) => Promise<Plan | null>;
  regeneratePlan: () => Promise<Plan | null>;
  importPlan: (plan: Plan) => void;
  saveCurrentPlan: () => void;
  switchPlan: (planId: string) => void;
  deleteSavedPlan: (planId: string) => void;
  toggleSavedIdea: (ideaId: string) => void;
  applyIdea: (ideaId: string) => void;
  setTab: (tab: PlannerTab) => void;
  updateInput: (patch: Partial<PlanInput>) => void;
  /** Adopt an authoritative Budget produced by the server (server action). */
  replaceBudget: (budget: Budget) => void;
  /** Optimistic local edit of planned/actual cents in one row (keyed by row key). */
  editCategory: (
    categoryKey: string,
    patch: { plannedCents?: number; actualCents?: number | null },
  ) => void;
  toggleTask: (taskId: string) => void;
  setItemStatus: (itemKey: string, status: VendorStatus) => void;
  setVendorCosts: (
    itemKey: string,
    values: {
      estimatedCents: number | null;
      actualCents: number | null;
      budgetCategoryKey: string | null;
    },
  ) => void;
  /** Document trackers live outside the Plan shape (docs are plain strings server-side). */
  toggleDocReceived: (itemKey: string, docLabel: string) => void;
  reset: () => void;
}

async function requestPlan(input: PlanInput): Promise<Plan> {
  const validatedInput = PlanInputSchema.parse(input);
  const res = await fetch("/api/plan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(validatedInput),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
        ? body.error
        : `Plan request failed (HTTP ${res.status})`;
    throw new Error(message);
  }
  const parsed = PlanSchema.safeParse(body);
  if (!parsed.success) throw new Error("Plan service returned an invalid response.");
  return parsed.data;
}

const INITIAL_UI: PlannerUi = { activeTab: "overview" };

const VendorCostUpdateSchema = z.object({
  estimatedCents: z.number().int().min(0).nullable(),
  actualCents: z.number().int().min(0).nullable(),
  budgetCategoryKey: z.string().min(1).max(64).nullable(),
});

export function vendorTotalForCategory(checklist: Plan["checklist"], categoryKey: string): number {
  return checklist.reduce(
    (total, category) =>
      total +
      category.items.reduce(
        (sum, item) => sum + (item.budgetCategoryKey === categoryKey ? (item.actualCents ?? 0) : 0),
        0,
      ),
    0,
  );
}

function actualWithVendorCosts(manual: number | null, vendorActual: number): number | null {
  return manual === null && vendorActual === 0 ? null : (manual ?? 0) + vendorActual;
}

type SnapshotState = Pick<
  PlannerState,
  "plan" | "receivedDocs" | "savedIdeaIds" | "appliedIdeaIds" | "savedPlans"
>;

function activeEntry(state: SnapshotState): SavedPlanEntry | null {
  if (!state.plan) return null;
  return {
    plan: state.plan,
    receivedDocs: state.receivedDocs,
    savedIdeaIds: state.savedIdeaIds,
    appliedIdeaIds: state.appliedIdeaIds,
  };
}

function withActiveSaved(state: SnapshotState): Record<string, SavedPlanEntry> {
  const entry = activeEntry(state);
  return entry ? { ...state.savedPlans, [entry.plan.id]: entry } : state.savedPlans;
}

export const usePlannerStore = create<PlannerState>()(
  persist(
    (set, get) => ({
      input: null,
      plan: null,
      status: "idle",
      error: null,
      receivedDocs: {},
      ui: INITIAL_UI,
      savedPlans: {},
      savedIdeaIds: [],
      appliedIdeaIds: [],

      generatePlan: async (input) => {
        set({ status: "generating", error: null });
        try {
          const plan = await requestPlan(input);
          set((state) => {
            const savedPlans = withActiveSaved(state);
            return {
              input,
              plan,
              status: "ready",
              error: null,
              receivedDocs: {},
              savedIdeaIds: [],
              appliedIdeaIds: [],
              savedPlans,
              ui: { activeTab: "overview" },
            };
          });
          return plan;
        } catch (err) {
          set({ status: "error", error: err instanceof Error ? err.message : "Generation failed" });
          return null;
        }
      },

      regeneratePlan: async () => {
        const { input } = get();
        if (!input) return null;
        return get().generatePlan(input);
      },

      importPlan: (plan) =>
        set((state) => ({
          input: plan.input,
          plan,
          status: "ready",
          error: null,
          receivedDocs: {},
          savedIdeaIds: [],
          appliedIdeaIds: [],
          savedPlans: withActiveSaved(state),
          ui: { activeTab: "overview" },
        })),

      saveCurrentPlan: () => set((state) => ({ savedPlans: withActiveSaved(state) })),

      switchPlan: (planId) =>
        set((state) => {
          const target = state.savedPlans[planId];
          if (!target) return {};
          if (state.plan?.id === planId) return { savedPlans: withActiveSaved(state) };
          const savedPlans = withActiveSaved(state);
          return {
            savedPlans,
            input: target.plan.input,
            plan: target.plan,
            receivedDocs: target.receivedDocs,
            savedIdeaIds: target.savedIdeaIds,
            appliedIdeaIds: target.appliedIdeaIds,
            status: "ready",
            error: null,
            ui: { activeTab: "overview" },
          };
        }),

      deleteSavedPlan: (planId) =>
        set((state) => {
          const savedPlans = { ...state.savedPlans };
          delete savedPlans[planId];
          if (state.plan?.id === planId) {
            const nextEntry = Object.values(savedPlans)[0];
            return {
              savedPlans,
              input: nextEntry?.plan.input ?? null,
              plan: nextEntry?.plan ?? null,
              receivedDocs: nextEntry?.receivedDocs ?? {},
              savedIdeaIds: nextEntry?.savedIdeaIds ?? [],
              appliedIdeaIds: nextEntry?.appliedIdeaIds ?? [],
              status: nextEntry ? "ready" : "idle",
              error: null,
              ui: INITIAL_UI,
            };
          }
          return { savedPlans };
        }),

      toggleSavedIdea: (ideaId) =>
        set((state) => {
          if (!state.plan?.ideas.some((idea) => idea.id === ideaId)) return {};
          const savedIdeaIds = state.savedIdeaIds.includes(ideaId)
            ? state.savedIdeaIds.filter((id) => id !== ideaId)
            : [...state.savedIdeaIds, ideaId];
          const next = { ...state, savedIdeaIds };
          return { savedIdeaIds, savedPlans: withActiveSaved(next) };
        }),

      applyIdea: (ideaId) =>
        set((state) => {
          const idea = state.plan?.ideas.find((item) => item.id === ideaId);
          if (!idea || state.appliedIdeaIds.includes(ideaId) || !state.plan) return {};
          const marker = `Selected idea: ${idea.title} — ${idea.rationale}`;
          const existing = state.plan.input.description?.slice(0, 400);
          const description = [existing, marker].filter(Boolean).join("\n").slice(-600);
          const input = { ...state.plan.input, description };
          const plan = { ...state.plan, input };
          const appliedIdeaIds = [...state.appliedIdeaIds, ideaId];
          const next = { ...state, input, plan, appliedIdeaIds };
          return { input, plan, appliedIdeaIds, savedPlans: withActiveSaved(next) };
        }),

      setTab: (tab) => set({ ui: { activeTab: tab } }),

      updateInput: (patch) => {
        const { input, plan } = get();
        if (!input) return;
        set((state) => {
          const nextInput = { ...input, ...patch };
          const nextPlan = plan ? { ...plan, input: { ...plan.input, ...patch } } : plan;
          const next = { ...state, input: nextInput, plan: nextPlan };
          return {
            input: nextInput,
            plan: nextPlan,
            ...(nextPlan ? { savedPlans: withActiveSaved(next) } : {}),
          };
        });
      },

      replaceBudget: (budget) => {
        const { plan } = get();
        if (plan)
          set((state) => {
            const old = new Map(plan.budget.categories.map((category) => [category.key, category]));
            const categories = budget.categories.map((category) => {
              const previous = old.get(category.key);
              const manual = previous?.manualActualCents ?? previous?.actualCents ?? null;
              return {
                ...category,
                manualActualCents: manual,
                actualCents: actualWithVendorCosts(
                  manual,
                  vendorTotalForCategory(plan.checklist, category.key),
                ),
              };
            });
            const nextPlan = { ...plan, budget: { ...budget, categories } };
            return { plan: nextPlan, savedPlans: withActiveSaved({ ...state, plan: nextPlan }) };
          });
      },

      editCategory: (categoryKey, patch) => {
        const { plan } = get();
        if (!plan) return;
        set((state) => {
          const categories = plan.budget.categories.map((c) => {
            if (c.key !== categoryKey) return c;
            const manualActualCents =
              patch.actualCents === undefined
                ? (c.manualActualCents ?? c.actualCents)
                : patch.actualCents;
            return {
              ...c,
              ...patch,
              manualActualCents,
              actualCents: actualWithVendorCosts(
                manualActualCents,
                vendorTotalForCategory(plan.checklist, categoryKey),
              ),
            };
          });
          const nextPlan = { ...plan, budget: { ...plan.budget, categories } };
          const next = { ...state, plan: nextPlan };
          return { plan: nextPlan, savedPlans: withActiveSaved(next) };
        });
      },

      toggleTask: (taskId) => {
        const { plan } = get();
        if (!plan) return;
        set((state) => {
          const nextPlan = {
            ...plan,
            timeline: plan.timeline.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)),
          };
          return { plan: nextPlan, savedPlans: withActiveSaved({ ...state, plan: nextPlan }) };
        });
      },

      setItemStatus: (itemKey, status) => {
        const { plan } = get();
        if (!plan) return;
        const [catIdxRaw, itemIdxRaw] = itemKey.split(":");
        const catIdx = Number(catIdxRaw);
        const itemIdx = Number(itemIdxRaw);
        if (!Number.isInteger(catIdx) || !Number.isInteger(itemIdx)) return;
        set((state) => {
          const nextPlan = {
            ...plan,
            checklist: plan.checklist.map((cat, ci) =>
              ci === catIdx
                ? {
                    ...cat,
                    items: cat.items.map((item, ii) =>
                      ii === itemIdx ? { ...item, status } : item,
                    ),
                  }
                : cat,
            ),
          };
          return { plan: nextPlan, savedPlans: withActiveSaved({ ...state, plan: nextPlan }) };
        });
      },

      setVendorCosts: (itemKey, values) => {
        const { plan } = get();
        if (!plan) return;
        const [catIdxRaw, itemIdxRaw] = itemKey.split(":");
        const catIdx = Number(catIdxRaw);
        const itemIdx = Number(itemIdxRaw);
        if (!Number.isInteger(catIdx) || !Number.isInteger(itemIdx)) return;
        const parsedValues = VendorCostUpdateSchema.safeParse(values);
        if (!parsedValues.success) return;
        const targetBudget = plan.budget.categories.find(
          (category) => category.key === parsedValues.data.budgetCategoryKey,
        );
        if (parsedValues.data.budgetCategoryKey && !targetBudget) return;
        const checklist = plan.checklist.map((category, ci) =>
          ci === catIdx
            ? {
                ...category,
                items: category.items.map((item, ii) =>
                  ii === itemIdx
                    ? {
                        ...item,
                        estimatedCents: parsedValues.data.estimatedCents,
                        actualCents: parsedValues.data.actualCents,
                        budgetCategoryKey: parsedValues.data.budgetCategoryKey,
                      }
                    : item,
                ),
              }
            : category,
        );
        const budget = {
          ...plan.budget,
          categories: plan.budget.categories.map((category) => {
            const vendorTotal = vendorTotalForCategory(checklist, category.key);
            const manual = category.manualActualCents ?? category.actualCents;
            return {
              ...category,
              manualActualCents: manual,
              actualCents: actualWithVendorCosts(manual, vendorTotal),
            };
          }),
        };
        set((state) => {
          const nextPlan = { ...plan, checklist, budget };
          return { plan: nextPlan, savedPlans: withActiveSaved({ ...state, plan: nextPlan }) };
        });
      },

      toggleDocReceived: (itemKey, docLabel) => {
        const { receivedDocs } = get();
        const current = receivedDocs[itemKey] ?? [];
        const next = current.includes(docLabel)
          ? current.filter((d) => d !== docLabel)
          : [...current, docLabel];
        set((state) => {
          const nextDocs = { ...receivedDocs, [itemKey]: next };
          const nextState = { ...state, receivedDocs: nextDocs };
          return { receivedDocs: nextDocs, savedPlans: withActiveSaved(nextState) };
        });
      },

      reset: () =>
        set({
          input: null,
          plan: null,
          status: "idle",
          error: null,
          receivedDocs: {},
          savedIdeaIds: [],
          appliedIdeaIds: [],
          ui: INITIAL_UI,
        }),
    }),
    {
      name: "promptwar-planner",
      version: 1,
      // Only plan data — no identifiers, nothing beyond what the user typed.
      partialize: selectPersistedPlannerState,
      // Opt-in rehydration: server HTML and first client render must match
      // (no flash of stale plan, no hydration warnings). Call in an effect.
      skipHydration: true,
      merge: (persistedState, currentState) => {
        const parsed = parsePersistedPlannerState(persistedState);
        if (!parsed.success) return currentState;
        return {
          ...currentState,
          ...parsed.data,
          input: parsed.data.input ?? parsed.data.plan?.input ?? null,
          status: parsed.data.plan ? "ready" : "idle",
          error: null,
        };
      },
    },
  ),
);

/**
 * Rehydrate the persisted store exactly once on the client. Returns `true`
 * once hydration has run, so components can avoid flashing empty/stale state
 * and SSR markup still matches the first client render.
 */
/**
 * Hydration status as external-store state (no setState-in-effect): the
 * persisted store flips `hasHydrated` and this subscribes to that transition.
 * `skipHydration` (above) means the effect kick-starts the read from
 * localStorage; server snapshot is always `false` so SSR markup never claims
 * to have data it cannot have.
 */
const subscribeHydration = (onStoreChange: () => void) =>
  usePlannerStore.persist.onFinishHydration(onStoreChange);
const getHydratedSnapshot = () => usePlannerStore.persist.hasHydrated();
const getServerSnapshot = () => false;

export function useRehydratePlanner(): boolean {
  useEffect(() => {
    void usePlannerStore.persist.rehydrate();
  }, []);
  return useSyncExternalStore(subscribeHydration, getHydratedSnapshot, getServerSnapshot);
}
