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
import { ThemeToggle } from "@/components/theme-toggle";
import { BudgetTable } from "@/components/planner/budget-table";
import { ExportsPanel } from "@/components/planner/exports-panel";
import { IdeasView } from "@/components/planner/ideas-view";
import { ImportPlanControl } from "@/components/planner/import-plan-control";
import { OverviewPanel } from "@/components/planner/overview-panel";
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
 * Dashboard shell (Phases.md 3.4): sticky header, 220px sidebar, tab panels
 * (Radix Tabs — arrow-key navigation follows the vertical orientation of the
 * sidebar list). All data comes from the Zod-validated store; nothing here
 * re-derives server truth.
 */

const TAB_META: Record<PlannerTab, { label: string; icon: React.ElementType }> = {
  overview: { label: "Overview", icon: LayoutDashboard },
  budget: { label: "Budget", icon: Wallet },
  timeline: { label: "Timeline", icon: CalendarRange },
  checklist: { label: "Checklist", icon: ClipboardList },
  ideas: { label: "Ideas", icon: Lightbulb },
  exports: { label: "Exports", icon: Download },
};

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
            <Link href="/">Create a plan</Link>
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
      <header className="sticky top-0 z-10 flex h-12 items-center justify-between gap-4 border-b border-border bg-background px-4 print:hidden">
        <div className="flex min-w-0 items-baseline gap-3">
          <Link
            href="/"
            className="display shrink-0 text-sm font-semibold text-gilt-text hover:underline"
            aria-label="Event Planner — home"
          >
            <span aria-hidden="true">❦</span> Event Planner
          </Link>
          <span aria-hidden="true" className="hidden h-4 w-px bg-border sm:block" />
          <h1 className="truncate text-xs tracking-[0.14em] uppercase">
            {plan.input.vertical} · {formatDateTime(plan.input.eventDate)}
          </h1>
          <span
            className={`hidden shrink-0 rounded-full px-2 py-0.5 text-xs sm:inline ${
              plan.meta.source === "llm"
                ? "bg-accent-a/15 text-accent-a-text"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {plan.meta.source === "llm" ? "Model-enriched" : "Engine-only"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
        </div>
      </header>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setTab(value as PlannerTab)}
        orientation="vertical"
        className="grid flex-1 lg:grid-cols-[220px_1fr]"
      >
        <nav
          aria-label="Plan sections"
          className="border-b border-border bg-sidebar lg:border-r lg:border-b-0 print:hidden"
        >
          <TabsList className="h-auto w-full justify-start gap-1 bg-transparent p-2 lg:flex-col lg:items-stretch">
            {PLANNER_TABS.map((tab) => {
              const Icon = TAB_META[tab].icon;
              return (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  className="eyebrow justify-start gap-2 data-[state=active]:border-l-2 data-[state=active]:border-gilt data-[state=active]:bg-accent data-[state=active]:text-foreground"
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

        <main id="main-content" className="min-w-0 flex-1 p-4 sm:p-6">
          <TabsContent value="overview" className="mt-0">
            <OverviewPanel plan={plan} />
          </TabsContent>
          <TabsContent value="budget" className="mt-0">
            <p className="eyebrow text-gilt-text">Where the money goes</p>
            <h2 className="display mb-4 text-xl font-semibold">Budget</h2>
            <BudgetTable
              currency={plan.input.currency}
              totalCents={plan.input.budgetTotalCents}
              categories={plan.budget.categories}
              contingencyPct={plan.budget.contingencyPct}
            />
          </TabsContent>
          <TabsContent value="timeline" className="mt-0">
            <p className="eyebrow text-gilt-text">Reverse countdown</p>
            <h2 className="display mb-4 text-xl font-semibold">Timeline</h2>
            <TimelineView tasks={plan.timeline} />
          </TabsContent>
          <TabsContent value="checklist" className="mt-0">
            <p className="eyebrow text-gilt-text">Vendors &amp; documents</p>
            <h2 className="display mb-4 text-xl font-semibold">Vendor Checklist</h2>
            <VendorChecklist checklist={plan.checklist} />
          </TabsContent>
          <TabsContent value="ideas" className="mt-0">
            <p className="eyebrow text-gilt-text">Personalised suggestions</p>
            <h2 className="display mb-4 text-xl font-semibold">Ideas</h2>
            <IdeasView ideas={plan.ideas} />
          </TabsContent>
          <TabsContent value="exports" className="mt-0">
            <p className="eyebrow text-gilt-text">PDF · CSV · Markdown · Print</p>
            <h2 className="display mb-4 text-xl font-semibold">Exports</h2>
            <ExportsPanel plan={plan} />
          </TabsContent>
        </main>
      </Tabs>
    </div>
  );
}
