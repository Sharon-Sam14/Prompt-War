"use client";

import { AlertDialog } from "radix-ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BookmarkPlus, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { ImportPlanControl } from "@/components/planner/import-plan-control";
import { Button } from "@/components/ui/button";
import type { PlanInput, Vertical } from "@/lib/genai/schemas";
import { usePlannerStore } from "@/lib/store/use-planner-store";

/**
 * Command-center utility bar (Prompt 6 §2): sample plan, import, event library
 * and reset. Both destructive actions ask first through a Radix
 * AlertDialog (focus-trapped, labelled) and announce the outcome politely.
 *
 * The sample is a normal engine-generated plan — same POST /api/plan path as the
 * setup form, so it stays keyless-safe and never fabricates client-side data.
 */

const STUDIO: Record<Vertical, string> = {
  wedding: "Wedding Planning Studio",
  birthday: "Birthday Planning Studio",
  community: "Community Planning Studio",
};

export function studioName(vertical: Vertical): string {
  return STUDIO[vertical];
}

const SAMPLE_DAYS_AHEAD = 120;

function sampleInput(vertical: Vertical): PlanInput {
  const date = new Date(Date.now() + SAMPLE_DAYS_AHEAD * 86_400_000);
  return {
    vertical,
    eventDate: date.toISOString(),
    guestCount: 120,
    budgetTotalCents: 2_500_000,
    currency: "USD",
    budgetBand: "standard",
    location: "The Glasshouse Ballroom",
    theme: "Modern garden romance",
    isOutdoor: false,
  };
}

type ConfirmKind = "sample" | "reset" | "delete" | null;

export function PlanActions({ vertical }: { vertical: Vertical }) {
  const router = useRouter();
  const generatePlan = usePlannerStore((s) => s.generatePlan);
  const reset = usePlannerStore((s) => s.reset);
  const status = usePlannerStore((s) => s.status);
  const plan = usePlannerStore((s) => s.plan);
  const savedPlans = usePlannerStore((s) => s.savedPlans);
  const saveCurrentPlan = usePlannerStore((s) => s.saveCurrentPlan);
  const switchPlan = usePlannerStore((s) => s.switchPlan);
  const deleteSavedPlan = usePlannerStore((s) => s.deleteSavedPlan);
  const [selectedPlanId, setSelectedPlanId] = useState("");

  const [confirm, setConfirm] = useState<ConfirmKind>(null);
  const [message, setMessage] = useState("");

  async function loadSample() {
    setMessage("Building the sample plan…");
    const plan = await generatePlan(sampleInput(vertical));
    if (plan) {
      setMessage("Sample plan loaded.");
      router.push(`/plan/${plan.id}`);
      return;
    }
    setMessage("Could not build the sample plan. Try again in a moment.");
  }

  function resetPlan() {
    reset();
    router.push("/onboarding");
  }

  function selectPlan(planId: string) {
    setSelectedPlanId(planId);
  }

  function openSelectedPlan() {
    if (!selectedPlanId) return;
    switchPlan(selectedPlanId);
    router.push(`/plan/${selectedPlanId}`);
  }

  function removePlan() {
    if (!selectedPlanId) return;
    const deletingActive = plan?.id === selectedPlanId;
    deleteSavedPlan(selectedPlanId);
    setMessage("Saved event deleted.");
    const nextPlan = usePlannerStore.getState().plan;
    setSelectedPlanId(deletingActive ? (nextPlan?.id ?? "") : (plan?.id ?? ""));
    if (deletingActive) router.push(nextPlan ? `/plan/${nextPlan.id}` : "/onboarding");
  }

  const busy = status === "generating";

  return (
    <div className="flex flex-wrap items-center gap-1.5 print:hidden">
      <ImportPlanControl compact />

      <label className="sr-only" htmlFor="saved-event-select">
        Switch saved event
      </label>
      <select
        id="saved-event-select"
        aria-label="Switch saved event"
        value={selectedPlanId || (savedPlans[plan?.id ?? ""] ? (plan?.id ?? "") : "")}
        onChange={(event) => selectPlan(event.target.value)}
        className="h-8 max-w-44 rounded-lg border border-input bg-background px-2 text-xs text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">Choose saved event ({Object.keys(savedPlans).length})</option>
        {Object.values(savedPlans).map((entry) => (
          <option key={entry.plan.id} value={entry.plan.id}>
            {entry.plan.input.name || studioName(entry.plan.input.vertical)} ·{" "}
            {entry.plan.input.eventDate.slice(0, 10)}
          </option>
        ))}
      </select>
      <Button
        size="sm"
        variant="outline"
        disabled={!selectedPlanId || selectedPlanId === plan?.id || busy}
        onClick={openSelectedPlan}
      >
        Switch event
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={!plan || busy}
        onClick={() => {
          saveCurrentPlan();
          setSelectedPlanId(plan?.id ?? "");
          setMessage("Event saved in this browser.");
        }}
      >
        <BookmarkPlus aria-hidden="true" className="size-3.5" /> Save event
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={!selectedPlanId || busy}
        aria-label="Delete selected saved event"
        onClick={() => setConfirm("delete")}
      >
        <Trash2 aria-hidden="true" className="size-3.5" />
      </Button>
      <Button asChild size="sm" variant="ghost" disabled={busy}>
        <Link href="/onboarding">New event</Link>
      </Button>

      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => setConfirm("sample")}
        className="border-rose/25 hover:border-rose/50"
      >
        <Sparkles aria-hidden="true" className="size-3.5" />
        Load sample
      </Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirm("reset")}>
        <RotateCcw aria-hidden="true" className="size-3.5" />
        Reset
      </Button>

      <p role="status" aria-live="polite" className="sr-only">
        {message}
      </p>

      <AlertDialog.Root open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" />
          <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(92vw,26rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-5 shadow-lg">
            <AlertDialog.Title className="display text-lg font-semibold">
              {confirm === "sample"
                ? "Load a sample plan?"
                : confirm === "delete"
                  ? "Delete this saved event?"
                  : "Reset this plan?"}
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">
              {confirm === "sample"
                ? "Loading a sample starts a separate plan. Your current event is saved in the event library first."
                : confirm === "delete"
                  ? "This permanently removes the selected event and its local checklist, budget, and idea state from this browser."
                  : "This clears the active plan. Other events saved in the event library will remain available."}
            </AlertDialog.Description>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <Button size="sm" variant="ghost">
                  Cancel
                </Button>
              </AlertDialog.Cancel>
              {confirm === "sample" ? (
                <AlertDialog.Action asChild>
                  <Button size="sm" onClick={() => void loadSample()}>
                    Load sample
                  </Button>
                </AlertDialog.Action>
              ) : confirm === "delete" ? (
                <AlertDialog.Action asChild>
                  <Button size="sm" variant="destructive" onClick={removePlan}>
                    Delete event
                  </Button>
                </AlertDialog.Action>
              ) : (
                <AlertDialog.Action asChild>
                  <Button size="sm" variant="destructive" onClick={resetPlan}>
                    Reset plan
                  </Button>
                </AlertDialog.Action>
              )}
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}
