"use client";

import Link from "next/link";
import {
  CalendarRange,
  ClipboardList,
  Download,
  LayoutDashboard,
  Lightbulb,
  Wallet,
} from "lucide-react";
import { BudgetTable } from "@/components/planner/budget-table";
import { ExportsPanel } from "@/components/planner/exports-panel";
import { IdeasView } from "@/components/planner/ideas-view";
import { ImportPlanControl } from "@/components/planner/import-plan-control";
import { OverviewPanel } from "@/components/planner/overview-panel";
import { PlanActions, studioName } from "@/components/planner/plan-actions";
import { TimelineView } from "@/components/planner/timeline-view";
import { VendorChecklist } from "@/components/planner/vendor-checklist";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime } from "@/lib/format";
import {
  PLANNER_TABS,
  usePlannerStore,
  useRehydratePlanner,
  type PlannerTab,
} from "@/lib/store/use-planner-store";

/**
 * Dashboard shell (Prompt 6 §2): studio header with the utility bar, a
 * burgundy-tinted sidebar and the six real sections. Tabs keep their original
 * labels and counts — the e2e suite drives them by role and name.
 *
 * All data comes from the Zod-validated store; nothing here re-derives server
 * truth. Section copy uses the plan's own vertical, never a wedding default.
 */

const TAB_META: Record<PlannerTab, { label: string; icon: React.ElementType }> = {
  overview: { label: "Overview", icon: LayoutDashboard },
  budget: { label: "Budget", icon: Wallet },
  timeline: { label: "Timeline", icon: CalendarRange },
  checklist: { label: "Checklist", icon: ClipboardList },
  ideas: { label: "Ideas", icon: Lightbulb },
  exports: { label: "Exports", icon: Download },
};

function PanelIntro({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-4 border-b border-border pb-3">
      <p className="eyebrow text-accent-a-text">{kicker}</p>
      <h2 className="display mt-1 text-xl font-semibold">{title}</h2>
    </div>
  );
}

export function PlanDashboard({ planId }: { planId: string }) {
  const hydrated = useRehydratePlanner();
  const plan = usePlannerStore((s) => s.plan);
  const activeTab = usePlannerStore((s) => s.ui.activeTab);
  const setTab = usePlannerStore((s) => s.setTab);

  if (!hydrated) {
    return (
      <div className="p-8 text-sm text-muted-foreground" role="status" aria-live="polite">
        Loading plan…
      </div>
    );
  }

  if (!plan || plan.id !== planId) {
    return (
      <main id="main-content" className="grid flex-1 place-items-center p-8">
        <div className="grid max-w-[46ch] justify-items-center gap-3 text-center">
          <h1 className="display text-lg font-semibold">No saved plan here</h1>
          <p className="text-sm text-muted-foreground">
            This dashboard reads the plan from your browser session. Create a new plan to get the
            budget, timeline and vendor checklist, or import a plan JSON saved from another device.
          </p>
          <ImportPlanControl />
          <Button asChild>
            <Link href="/onboarding">Create a plan</Link>
          </Button>
        </div>
      </main>
    );
  }

  const openTasks = plan.timeline.filter((t) => !t.done).length;
  const booked = plan.checklist.reduce(
    (n, c) => n + c.items.filter((i) => i.status === "booked").length,
    0,
  );
  const vendorTotal = plan.checklist.reduce((n, c) => n + c.items.length, 0);

  const counts: Record<PlannerTab, string> = {
    overview: "",
    budget: String(plan.budget.categories.length),
    timeline: String(openTasks),
    checklist: `${booked}/${vendorTotal}`,
    ideas: String(plan.ideas.length),
    exports: "",
  };

  return (
    // data-vertical stamps the accent role remap for the whole subtree (Design.md v2).
    <div data-vertical={plan.input.vertical} className="flex min-h-screen flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur print:hidden">
        <div className="mx-auto flex w-full max-w-[1500px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6">
          <Link href="/" className="group flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="display grid size-9 place-items-center rounded-xl border border-rose/30 bg-wine-deep/50 text-base leading-none text-rose transition-colors group-hover:border-rose/60"
            >
              ❦
            </span>
            <span className="grid leading-tight">
              <h1 className="display text-sm font-semibold">{studioName(plan.input.vertical)}</h1>
              <span className="eyebrow text-[10px] text-muted-foreground">
                Planning command center
              </span>
            </span>
            <span className="sr-only">— Event Planner home</span>
          </Link>

          <span aria-hidden="true" className="hidden h-8 w-px bg-border sm:block" />
          <p className="hidden text-xs text-muted-foreground sm:block">
            {formatDateTime(plan.input.eventDate)}
          </p>

          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <span
              className={`hidden shrink-0 rounded-full border px-2.5 py-1 text-[11px] sm:inline ${
                plan.meta.source === "llm"
                  ? "border-rose/30 bg-wine-deep/40 text-accent-a-text"
                  : "border-border bg-muted text-muted-foreground"
              }`}
            >
              {plan.meta.source === "llm" ? "Model-enriched" : "Engine-only"}
            </span>
            <PlanActions vertical={plan.input.vertical} />
          </div>
        </div>
      </header>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setTab(value as PlannerTab)}
        orientation="vertical"
        className="grid flex-1 lg:grid-cols-[248px_1fr]"
      >
        <nav
          aria-label="Plan sections"
          className="border-b border-border bg-sidebar lg:border-r lg:border-b-0 print:hidden"
        >
          <div className="hidden items-center gap-2 px-4 pt-4 pb-1 lg:flex">
            <span aria-hidden="true" className="script text-lg leading-none text-rose">
              ❦
            </span>
            <span className="eyebrow text-[10px] text-muted-foreground">Sections</span>
          </div>
          {/* Mobile: the six section tabs wrap onto a second row instead of
              scrolling sideways (D52) — at 390 px a clipped strip hid
              Timeline/Checklist/Ideas/Exports behind an invisible scroll.
              lg restores the single-column rail. */}
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-none bg-transparent p-2 lg:flex-col lg:items-stretch lg:flex-nowrap">
            {PLANNER_TABS.map((tab) => {
              const Icon = TAB_META[tab].icon;
              return (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  className="eyebrow justify-start gap-2 rounded-lg border-l-2 border-transparent px-3 py-2 data-[state=active]:border-gilt data-[state=active]:bg-accent data-[state=active]:text-foreground"
                >
                  <Icon aria-hidden="true" className="size-4" />
                  {TAB_META[tab].label}
                  {counts[tab] && (
                    <span className="tnum ml-auto text-xs text-muted-foreground">
                      {counts[tab]}
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </nav>

        <main id="main-content" className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:py-6">
          <div className="mx-auto w-full max-w-[1120px]">
            <TabsContent value="overview" className="mt-0">
              <OverviewPanel plan={plan} />
            </TabsContent>
            <TabsContent value="budget" className="mt-0">
              <PanelIntro kicker="Where the money goes" title="Budget planner" />
              <BudgetTable
                currency={plan.input.currency}
                totalCents={plan.input.budgetTotalCents}
                categories={plan.budget.categories}
                checklist={plan.checklist}
                contingencyPct={plan.budget.contingencyPct}
              />
            </TabsContent>
            <TabsContent value="timeline" className="mt-0">
              <PanelIntro kicker="Reverse countdown" title="Tasks & milestones" />
              <TimelineView tasks={plan.timeline} />
            </TabsContent>
            <TabsContent value="checklist" className="mt-0">
              <PanelIntro kicker="Vendors & documents" title="Vendor management" />
              <VendorChecklist
                checklist={plan.checklist}
                budgetCategories={plan.budget.categories}
                currency={plan.input.currency}
              />
            </TabsContent>
            <TabsContent value="ideas" className="mt-0">
              <PanelIntro kicker="Personalised suggestions" title="Inspiration" />
              <IdeasView ideas={plan.ideas} />
            </TabsContent>
            <TabsContent value="exports" className="mt-0">
              <PanelIntro kicker="PDF · CSV · Markdown · Print" title="Reports & exports" />
              <ExportsPanel plan={plan} />
            </TabsContent>
          </div>
        </main>
      </Tabs>
    </div>
  );
}
