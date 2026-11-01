"use client";

import {
  AlarmClock,
  CalendarDays,
  Gauge,
  ListChecks,
  PiggyBank,
  Store,
  Users,
  Wallet,
} from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { CountUp } from "@/components/motion/count-up";
import { Badge } from "@/components/ui/badge";
import { countdown, formatDate, formatMoney, isDueWithin } from "@/lib/format";
import type { Plan } from "@/lib/genai/schemas";
import { usePlannerStore } from "@/lib/store/use-planner-store";

/**
 * Dashboard metric band (Prompt 6 §2): eight KPI cards over exactly the data the
 * engine already produces — no invented RSVP/seating numbers. Lower widgets:
 * upcoming deadlines and a four-bar planning snapshot.
 *
 * Every number is display-only; the engine and the server actions remain the
 * source of truth (Design.md §1.4). CountUp keeps the final value in the DOM for
 * assistive tech, and bars are fixed-height so nothing shifts while animating.
 */

/** Snapshot bar: width-only change, announced as a real progressbar. */
function ProgressBar({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
    >
      <div
        className="h-full rounded-full bg-rose transition-[width]"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  note,
  children,
}: {
  icon: React.ElementType;
  label: string;
  value: ReactNode;
  sub: ReactNode;
  note?: ReactNode;
  children?: ReactNode;
}) {
  const Icon = icon;
  return (
    <li className="flex flex-col rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow pt-1 text-muted-foreground">{label}</p>
        <span className="grid size-8 shrink-0 place-items-center rounded-full border border-rose/25 bg-wine-deep/40 text-rose">
          <Icon aria-hidden="true" className="size-4" />
        </span>
      </div>
      <p className="display tnum mt-2 text-2xl leading-none font-semibold">{value}</p>
      <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{sub}</p>
      {note ? <p className="mt-1 text-[11px] text-muted-foreground">{note}</p> : null}
      {children ? <div className="mt-3">{children}</div> : null}
    </li>
  );
}

export function PlanMetrics({ plan }: { plan: Plan }) {
  const receivedDocs = usePlannerStore((s) => s.receivedDocs);

  const stats = useMemo(() => {
    const { currency, budgetTotalCents, guestCount, eventDate } = plan.input;
    const contingencyPct = plan.budget.contingencyPct;
    const days = countdown(eventDate).days;
    const weeks = Math.floor(days / 7);

    const spentCents = plan.budget.categories.reduce((n, c) => n + (c.actualCents ?? 0), 0);
    const hasActuals = plan.budget.categories.some((c) => c.actualCents !== null);
    const remainingCents = budgetTotalCents - spentCents;
    const reserveCents = Math.round((budgetTotalCents * contingencyPct) / 100);

    const vendorItems = plan.checklist.flatMap((c) => c.items);
    const vendorTotal = vendorItems.length;
    const booked = vendorItems.filter((i) => i.status === "booked").length;
    const contacted = vendorItems.filter((i) => i.status === "contacted").length;
    const quoted = vendorItems.filter((i) => i.status === "quoted").length;
    const docsTotal = vendorItems.reduce((n, i) => n + i.docs.length, 0);
    // Store keys are `${categoryIndex}:${itemIndex}` (lib/store/use-planner-store.ts).
    const docsCollected = plan.checklist.reduce(
      (total, category, categoryIndex) =>
        total +
        category.items.reduce(
          (n, _item, itemIndex) => n + (receivedDocs[`${categoryIndex}:${itemIndex}`]?.length ?? 0),
          0,
        ),
      0,
    );

    const taskTotal = plan.timeline.length;
    const tasksDone = plan.timeline.filter((t) => t.done).length;
    const openTasks = plan.timeline
      .filter((t) => !t.done)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    const urgent = openTasks.filter((t) => isDueWithin(t.dueDate, 30)).length;

    const tracked = vendorTotal + taskTotal;
    const readiness = tracked ? Math.round(((booked + tasksDone) / tracked) * 100) : 0;
    const taskPct = taskTotal ? Math.round((tasksDone / taskTotal) * 100) : 0;
    const vendorPct = vendorTotal ? Math.round((booked / vendorTotal) * 100) : 0;
    const budgetPct = budgetTotalCents ? Math.round((spentCents / budgetTotalCents) * 100) : 0;
    const docsPct = docsTotal ? Math.round((docsCollected / docsTotal) * 100) : 0;

    return {
      currency,
      days,
      weeks,
      spentCents,
      hasActuals,
      remainingCents,
      reserveCents,
      guestCount,
      perGuestCents: Math.round(budgetTotalCents / Math.max(1, guestCount)),
      vendorTotal,
      booked,
      contacted,
      quoted,
      taskTotal,
      tasksDone,
      taskPct,
      urgent,
      openTasks,
      readiness,
      budgetPct,
      vendorPct,
      docsTotal,
      docsCollected,
      docsPct,
    };
  }, [plan, receivedDocs]);

  const readinessLabel =
    stats.readiness >= 80 ? "Ready to host" : stats.readiness >= 50 ? "On track" : "Needs focus";
  const readinessTone =
    stats.readiness >= 80
      ? "border-success/40 bg-success/10 text-success-text"
      : stats.readiness >= 50
        ? "border-gilt/40 bg-gilt/10 text-gilt-text"
        : "border-rose/30 bg-wine-deep/40 text-accent-a-text";

  return (
    <div className="grid gap-6">
      <section aria-labelledby="plan-metrics-title" className="grid gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 id="plan-metrics-title" className="eyebrow text-muted-foreground">
            At a glance
          </h3>
          <span className="text-xs text-muted-foreground">
            {stats.openTasks.length} open task{stats.openTasks.length === 1 ? "" : "s"}
          </span>
        </div>

        <ul aria-label="Plan at a glance" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon={CalendarDays}
            label="Days until"
            value={<CountUp to={stats.days} />}
            sub={
              stats.days === 0
                ? "Event day is here"
                : `${stats.weeks} week${stats.weeks === 1 ? "" : "s"} remaining`
            }
          />
          <KpiCard
            icon={Wallet}
            label="Budget remaining"
            value={
              <CountUp
                to={stats.remainingCents}
                format={(value) => formatMoney(Math.round(value), stats.currency)}
              />
            }
            sub={
              stats.hasActuals
                ? `Spent: ${formatMoney(stats.spentCents, stats.currency)}`
                : "No actuals logged yet"
            }
          >
            <ProgressBar value={stats.budgetPct} label="Share of the budget spent" />
          </KpiCard>
          <KpiCard
            icon={Users}
            label="Guests"
            value={<CountUp to={stats.guestCount} />}
            sub={`${formatMoney(stats.perGuestCents, stats.currency)} / guest`}
          />
          <KpiCard
            icon={Store}
            label="Vendors booked"
            value={
              <span className="tnum">
                {stats.booked}
                <span className="text-muted-foreground"> / {stats.vendorTotal}</span>
              </span>
            }
            sub={`${stats.contacted} contacted · ${stats.quoted} quoted`}
          >
            <ProgressBar value={stats.vendorPct} label="Vendors booked" />
          </KpiCard>
          <KpiCard
            icon={ListChecks}
            label="Tasks completed"
            value={
              <span className="tnum">
                {stats.tasksDone}
                <span className="text-muted-foreground"> / {stats.taskTotal}</span>
              </span>
            }
            sub={`${stats.taskPct}% complete`}
          >
            <ProgressBar value={stats.taskPct} label="Tasks completed" />
          </KpiCard>
          <KpiCard
            icon={Gauge}
            label="Readiness"
            value={<CountUp to={stats.readiness} format={(value) => `${Math.round(value)}%`} />}
            sub={
              <Badge className={readinessTone} variant="outline">
                {readinessLabel}
              </Badge>
            }
            note={`${stats.booked}/${stats.vendorTotal} vendors · ${stats.tasksDone}/${stats.taskTotal} tasks`}
          >
            <ProgressBar value={stats.readiness} label="Overall readiness" />
          </KpiCard>
          <KpiCard
            icon={AlarmClock}
            label="Upcoming deadlines"
            value={<CountUp to={stats.urgent} />}
            sub="Due in the next 30 days"
          />
          <KpiCard
            icon={PiggyBank}
            label="Reserve held"
            value={
              <CountUp
                to={stats.reserveCents}
                format={(value) => formatMoney(Math.round(value), stats.currency)}
              />
            }
            sub="Contingency for overruns"
          />
        </ul>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <section
          aria-labelledby="deadlines-title"
          className="rounded-xl border border-border bg-card p-4"
        >
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h3 id="deadlines-title" className="eyebrow text-muted-foreground">
              Upcoming deadlines
            </h3>
            <span className="text-xs text-muted-foreground">next {stats.openTasks.length}</span>
          </div>
          {stats.openTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing open — every dated task on the timeline is done.
            </p>
          ) : (
            <ul className="grid gap-2">
              {stats.openTasks.slice(0, 4).map((task) => (
                <li
                  key={task.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 last:border-b-0 last:pb-0"
                >
                  <span className="text-sm font-medium">{task.title}</span>
                  <span className="tnum shrink-0 rounded-full border border-rose/25 bg-wine-deep/30 px-2.5 py-0.5 text-[11px] text-accent-a-text">
                    {formatDate(task.dueDate)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="snapshot-title"
          className="rounded-xl border border-border bg-card p-4"
        >
          <h3 id="snapshot-title" className="eyebrow mb-3 text-muted-foreground">
            Planning snapshot
          </h3>
          <ul className="grid gap-3">
            <li className="grid gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="text-foreground">Budget used</span>
                <span className="tnum text-muted-foreground">{stats.budgetPct}%</span>
              </div>
              <ProgressBar value={stats.budgetPct} label="Budget used" />
            </li>
            <li className="grid gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="text-foreground">Vendors booked</span>
                <span className="tnum text-muted-foreground">{stats.vendorPct}%</span>
              </div>
              <ProgressBar value={stats.vendorPct} label="Vendors booked" />
            </li>
            <li className="grid gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="text-foreground">Tasks done</span>
                <span className="tnum text-muted-foreground">{stats.taskPct}%</span>
              </div>
              <ProgressBar value={stats.taskPct} label="Tasks done" />
            </li>
            <li className="grid gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="text-foreground">Documents collected</span>
                <span className="tnum text-muted-foreground">
                  {stats.docsCollected}/{stats.docsTotal} · {stats.docsPct}%
                </span>
              </div>
              <ProgressBar value={stats.docsPct} label="Vendor documents collected" />
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
