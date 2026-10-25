"use client";

import Image from "next/image";
import { CalendarDays, MapPin, RefreshCw, Users } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { recalculateBudget } from "@/app/actions";
import { CountUp } from "@/components/motion/count-up";
import { AssistantPanel } from "@/components/planner/assistant-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  countdown,
  formatDate,
  formatDateTime,
  formatMoney,
  parseMoneyToCents,
} from "@/lib/format";
import { usePlannerStore } from "@/lib/store/use-planner-store";
import { PlanInputSchema, type Plan } from "@/lib/genai/schemas";

/**
 * Overview panel — editorial masthead of the plan (Design.md v2 §3):
 * banner (serif event name + meta + italic voice), stat-card row with a
 * progress ring, "next up" priorities, provenance, and the server-authoritative
 * budget adjustment. Budget math always goes through the recalculateBudget
 * SERVER ACTION — the client never recomputes canonical allocation.
 */

const VERTICAL_LABEL: Record<Plan["input"]["vertical"], string> = {
  wedding: "The Wedding",
  birthday: "The Celebration",
  community: "The Gathering",
};

const BAND_LABEL: Record<Plan["input"]["budgetBand"], string> = {
  micro: "Micro",
  standard: "Standard",
  premium: "Premium",
};

function ProgressRing({ pct }: { pct: number }) {
  return (
    <div
      aria-hidden="true"
      className="relative grid size-11 place-items-center rounded-full"
      style={{
        background: `conic-gradient(var(--accent-a) ${pct * 3.6}deg, var(--muted) 0deg)`,
      }}
    >
      <span className="display tnum grid size-8 place-items-center rounded-full bg-card text-[11px] font-semibold">
        {pct}%
      </span>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  ring,
}: {
  label: string;
  value: ReactNode;
  sub: ReactNode;
  ring?: number;
}) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
      {ring !== undefined && <ProgressRing pct={ring} />}
      <div className="min-w-0">
        <p className="eyebrow text-muted-foreground">{label}</p>
        <p className="display tnum text-xl leading-6 font-semibold">{value}</p>
        <p className="truncate text-xs text-muted-foreground">{sub}</p>
      </div>
    </li>
  );
}

export function OverviewPanel({ plan }: { plan: Plan }) {
  const updateInput = usePlannerStore((s) => s.updateInput);
  const replaceBudget = usePlannerStore((s) => s.replaceBudget);
  const regeneratePlan = usePlannerStore((s) => s.regeneratePlan);
  const status = usePlannerStore((s) => s.status);

  const [draft, setDraft] = useState((plan.input.budgetTotalCents / 100).toFixed(2));
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const cd = countdown(plan.input.eventDate);

  const stats = useMemo(() => {
    const vendorTotal = plan.checklist.reduce((n, c) => n + c.items.length, 0);
    const booked = plan.checklist.reduce(
      (n, c) => n + c.items.filter((i) => i.status === "booked").length,
      0,
    );
    const taskTotal = plan.timeline.length;
    const tasksDone = plan.timeline.filter((t) => t.done).length;
    const nextUp = plan.timeline
      .filter((t) => !t.done)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 3);
    // Combined progress: booked vendors + done tasks over everything tracked.
    const done = booked + tasksDone;
    const tracked = vendorTotal + taskTotal;
    // Display-only health signal; the budget tab still verifies server-side.
    const actualSum = plan.budget.categories.reduce((n, c) => n + (c.actualCents ?? 0), 0);
    const hasActuals = plan.budget.categories.some((c) => c.actualCents !== null);
    return {
      vendorTotal,
      booked,
      taskTotal,
      tasksDone,
      pct: tracked ? Math.round((done / tracked) * 100) : 0,
      nextUp,
      actualSum,
      hasActuals,
    };
  }, [plan.checklist, plan.timeline, plan.budget.categories]);

  const heading = plan.input.theme
    ? `${plan.input.theme} ${VERTICAL_LABEL[plan.input.vertical].toLowerCase().replace("the ", "")}`
    : VERTICAL_LABEL[plan.input.vertical];

  async function saveBudget(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cents = parseMoneyToCents(draft);
    if (cents === null) {
      setMessage({ kind: "error", text: "Enter an amount like 5000 or 4999.99" });
      return;
    }
    const nextInput = { ...plan.input, budgetTotalCents: cents };
    const parsed = PlanInputSchema.safeParse(nextInput);
    if (!parsed.success) {
      setMessage({ kind: "error", text: parsed.error.issues[0]?.message ?? "Invalid budget" });
      return;
    }
    const result = await recalculateBudget(parsed.data);
    if (!result.ok) {
      setMessage({ kind: "error", text: result.issues });
      return;
    }
    // Engine authority: adopt the server's reallocation wholesale.
    updateInput({ budgetTotalCents: cents });
    replaceBudget(result.data);
    setMessage({
      kind: "ok",
      text: `Reallocated on the server: ${formatMoney(cents, plan.input.currency)} across ${result.data.categories.length} categories.`,
    });
  }

  return (
    <div className="grid gap-6">
      {/* Plan banner — compact editorial masthead, not a landing hero. */}
      <section
        aria-labelledby="plan-banner-title"
        className="flex items-start justify-between gap-6"
      >
        <div className="grid min-w-0 gap-2">
          <p className="eyebrow text-gilt-text">Our plan</p>
          <h2
            id="plan-banner-title"
            className="display text-3xl leading-tight font-semibold sm:text-4xl"
          >
            {heading}
          </h2>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays aria-hidden="true" className="size-3.5" />
              {formatDate(plan.input.eventDate)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users aria-hidden="true" className="size-3.5" />
              {plan.input.guestCount.toLocaleString()} guests
            </span>
            {plan.input.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin aria-hidden="true" className="size-3.5" />
                {plan.input.location}
              </span>
            )}
          </p>
          <p className="display max-w-[72ch] text-sm italic">
            {plan.input.culturalNotes ||
              `${cd.label} — the shape of your plan is set: budget to the cent, dates counted backwards.`}
          </p>
        </div>
        <Image
          src={`/images/vignettes/art-${plan.input.vertical}.svg`}
          alt=""
          aria-hidden="true"
          width={320}
          height={200}
          unoptimized
          className="hidden h-32 w-auto shrink-0 md:block"
        />
      </section>

      {/* Stat cards — CountUp animates the display only; the engine value is the DOM value (§1.7) */}
      <ul aria-label="Plan at a glance" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Progress"
          value={<CountUp to={stats.pct} format={(value) => `${Math.round(value)}%`} />}
          sub={`${stats.booked}/${stats.vendorTotal} vendors · ${stats.tasksDone}/${stats.taskTotal} tasks`}
          ring={stats.pct}
        />
        <StatCard
          label="Budget health"
          value={
            <CountUp
              to={plan.input.budgetTotalCents}
              format={(value) => formatMoney(Math.round(value), plan.input.currency)}
            />
          }
          sub={
            stats.hasActuals ? (
              stats.actualSum > plan.input.budgetTotalCents ? (
                <span className="text-danger-text">
                  Over by{" "}
                  {formatMoney(stats.actualSum - plan.input.budgetTotalCents, plan.input.currency)}
                </span>
              ) : (
                <span className="text-success-text">
                  Under by{" "}
                  {formatMoney(plan.input.budgetTotalCents - stats.actualSum, plan.input.currency)}
                </span>
              )
            ) : (
              `${BAND_LABEL[plan.input.budgetBand]} band · reserve ${plan.budget.contingencyPct}%`
            )
          }
        />
        <StatCard
          label="Guests"
          value={<CountUp to={plan.input.guestCount} />}
          sub={
            <>
              <span className="tnum">
                {formatMoney(
                  Math.round(plan.input.budgetTotalCents / plan.input.guestCount),
                  plan.input.currency,
                )}{" "}
                / guest
              </span>
              {plan.input.isOutdoor ? " · Outdoor" : " · Indoor"}
            </>
          }
        />
        <StatCard label="Countdown" value={<CountUp to={cd.days} />} sub={cd.label.toLowerCase()} />
      </ul>

      {/* Next up */}
      <section
        aria-labelledby="next-up-title"
        className="rounded-lg border border-border bg-card p-4"
      >
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h3 id="next-up-title" className="eyebrow text-muted-foreground">
            This week&rsquo;s priorities
          </h3>
          <span className="text-xs text-muted-foreground">
            next {stats.nextUp.length} open tasks
          </span>
        </div>
        {stats.nextUp.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Everything on the timeline is done — remarkable.
          </p>
        ) : (
          <ul className="grid gap-2">
            {stats.nextUp.map((task) => (
              <li
                key={task.id}
                className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-b-0 last:pb-0"
              >
                <span className="text-sm font-medium">{task.title}</span>
                <span className="tnum shrink-0 text-xs text-muted-foreground">
                  {formatDate(task.dueDate)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Conversational assistant (Design.md §4.9) */}
      <AssistantPanel plan={plan} />

      {/* Provenance */}
      <section aria-labelledby="overview-provenance" className="grid gap-2">
        <h3 id="overview-provenance" className="eyebrow text-muted-foreground">
          Provenance
        </h3>
        <ul className="flex flex-wrap items-center gap-2 text-xs">
          <li>
            <Badge
              className={
                plan.meta.source === "llm"
                  ? "bg-accent-a/15 text-accent-a-text"
                  : "bg-muted text-muted-foreground"
              }
            >
              {plan.meta.source === "llm" ? "Model-enriched" : "Engine-only mode"}
            </Badge>
          </li>
          <li>
            <Badge variant="outline" className="text-muted-foreground">
              {plan.meta.cacheHit ? "Served from cache" : "Fresh generation"}
            </Badge>
          </li>
          <li className="text-muted-foreground">Schema v{plan.meta.schemaVersion}</li>
          <li className="text-muted-foreground">
            Generated {formatDateTime(plan.meta.generatedAt)}
          </li>
          <li>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void regeneratePlan()}
              disabled={status === "generating"}
            >
              <RefreshCw aria-hidden="true" className="size-3.5" />
              Regenerate
            </Button>
          </li>
        </ul>
        {plan.input.theme && (
          <p className="text-sm text-muted-foreground">Theme: {plan.input.theme}</p>
        )}
      </section>

      {/* Budget adjustment — server-authoritative */}
      <section
        aria-labelledby="overview-budget"
        className="grid gap-3 rounded-lg border border-border bg-card p-4"
      >
        <h3 id="overview-budget" className="eyebrow text-muted-foreground">
          Total budget
        </h3>
        <p className="text-xs text-muted-foreground">
          {formatMoney(plan.input.budgetTotalCents, plan.input.currency)} · changing it reallocates
          every category on the server (deterministic engine, never the model).
        </p>
        <form onSubmit={saveBudget} className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="budget-adjust" className="text-xs">
              New total ({plan.input.currency})
            </Label>
            <Input
              id="budget-adjust"
              inputMode="decimal"
              className="tnum w-36"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Reallocate
          </Button>
        </form>
        <p
          role={message?.kind === "error" ? "alert" : "status"}
          aria-live="polite"
          className="text-xs"
        >
          <span className={message?.kind === "error" ? "text-danger-text" : "text-success-text"}>
            {message?.text ?? ""}
          </span>
        </p>
      </section>
    </div>
  );
}
