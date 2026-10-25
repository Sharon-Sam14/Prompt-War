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

const PersistedPlannerStateSchema = z.object({
  input: SavedPlanInputSchema.nullable().optional().default(null),
  plan: PlanSchema.nullable().optional().default(null),
  ui: z
    .object({ activeTab: z.enum(PLANNER_TABS) })
    .optional()
    .default({ activeTab: "overview" }),
  receivedDocs: z.record(z.string(), z.array(z.string())).optional().default({}),
});

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
  ui: PlannerUi;
  generatePlan: (input: PlanInput) => Promise<Plan | null>;
  regeneratePlan: () => Promise<Plan | null>;
  importPlan: (plan: Plan) => void;
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

export const usePlannerStore = create<PlannerState>()(
  persist(
    (set, get) => ({
      input: null,
      plan: null,
      status: "idle",
      error: null,
      receivedDocs: {},
      ui: INITIAL_UI,

      generatePlan: async (input) => {
        set({ status: "generating", error: null });
        try {
          const plan = await requestPlan(input);
          set({ input, plan, status: "ready", error: null, ui: { activeTab: "overview" } });
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
        set({
          input: plan.input,
          plan,
          status: "ready",
          error: null,
          receivedDocs: {},
          ui: { activeTab: "overview" },
        }),

      setTab: (tab) => set({ ui: { activeTab: tab } }),

      updateInput: (patch) => {
        const { input } = get();
        if (!input) return;
        set({ input: { ...input, ...patch } });
      },

      replaceBudget: (budget) => {
        const { plan } = get();
        if (plan) set({ plan: { ...plan, budget } });
      },

      editCategory: (categoryKey, patch) => {
        const { plan } = get();
        if (!plan) return;
        set({
          plan: {
            ...plan,
            budget: {
              ...plan.budget,
              categories: plan.budget.categories.map((c) =>
                c.key === categoryKey ? { ...c, ...patch } : c,
              ),
            },
          },
        });
      },

      toggleTask: (taskId) => {
        const { plan } = get();
        if (!plan) return;
        set({
          plan: {
            ...plan,
            timeline: plan.timeline.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)),
          },
        });
      },

      setItemStatus: (itemKey, status) => {
        const { plan } = get();
        if (!plan) return;
        const [catIdxRaw, itemIdxRaw] = itemKey.split(":");
        const catIdx = Number(catIdxRaw);
        const itemIdx = Number(itemIdxRaw);
        if (!Number.isInteger(catIdx) || !Number.isInteger(itemIdx)) return;
        set({
          plan: {
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
          },
        });
      },

      toggleDocReceived: (itemKey, docLabel) => {
        const { receivedDocs } = get();
        const current = receivedDocs[itemKey] ?? [];
        const next = current.includes(docLabel)
          ? current.filter((d) => d !== docLabel)
          : [...current, docLabel];
        set({ receivedDocs: { ...receivedDocs, [itemKey]: next } });
      },

      reset: () =>
        set({
          input: null,
          plan: null,
          status: "idle",
          error: null,
          receivedDocs: {},
          ui: INITIAL_UI,
        }),
    }),
    {
      name: "promptwar-planner",
      version: 1,
      // Only plan data — no identifiers, nothing beyond what the user typed.
      partialize: (state) => ({
        input: state.input,
        plan: state.plan,
        ui: state.ui,
        receivedDocs: state.receivedDocs,
      }),
      // Opt-in rehydration: server HTML and first client render must match
      // (no flash of stale plan, no hydration warnings). Call in an effect.
      skipHydration: true,
      merge: (persistedState, currentState) => {
        const parsed = PersistedPlannerStateSchema.safeParse(persistedState);
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
