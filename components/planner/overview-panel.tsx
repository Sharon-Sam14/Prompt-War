"use client";

import Image from "next/image";
import { CalendarDays, MapPin, RefreshCw, Users } from "lucide-react";
import { useState } from "react";
import { recalculateBudget } from "@/app/actions";
import { AssistantPanel } from "@/components/planner/assistant-panel";
import { PlanMetrics } from "@/components/planner/plan-metrics";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VERTICAL_PHOTOS } from "@/lib/config/photos";
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
 * Overview panel — the command-center main stage (Prompt 6 §2): masthead, the
 * eight-card KPI band with its deadline/snapshot widgets, the assistant, the
 * provenance strip and the server-authoritative budget adjustment.
 *
 * Budget math always goes through the recalculateBudget SERVER ACTION — the
 * client never recomputes canonical allocation.
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

export function OverviewPanel({ plan }: { plan: Plan }) {
  const updateInput = usePlannerStore((s) => s.updateInput);
  const replaceBudget = usePlannerStore((s) => s.replaceBudget);
  const regeneratePlan = usePlannerStore((s) => s.regeneratePlan);
  const status = usePlannerStore((s) => s.status);

  const [draft, setDraft] = useState((plan.input.budgetTotalCents / 100).toFixed(2));
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const cd = countdown(plan.input.eventDate);

  // The user's own event name wins; otherwise the theme/vertical fallback label.
  const heading =
    plan.input.name ??
    (plan.input.theme
      ? `${plan.input.theme} ${VERTICAL_LABEL[plan.input.vertical].toLowerCase().replace("the ", "")}`
      : VERTICAL_LABEL[plan.input.vertical]);

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
      {/* Masthead — command-center title, not a landing hero. */}
      <section
        aria-labelledby="plan-banner-title"
        className="flex flex-wrap items-start justify-between gap-6"
      >
        <div className="grid min-w-0 gap-2">
          <p className="eyebrow text-accent-a-text">Planning command center</p>
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
            <span className="rounded-full border border-rose/25 bg-wine-deep/30 px-2.5 py-0.5 text-[11px] text-accent-a-text">
              {BAND_LABEL[plan.input.budgetBand]} band
            </span>
          </p>
          <p className="display max-w-[72ch] text-sm italic">
            {plan.input.culturalNotes ||
              `${cd.label} — the shape of your plan is set: budget to the cent, dates counted backwards.`}
          </p>
        </div>
        {/* Vertical photo plate — sanctioned slot 3 of 3 (Design.md §4.6, D44):
            same photo as the setup masthead, fixed 3:2 mount, md+ only.
            Atmosphere only → alt="" + aria-hidden. */}
        <figure className="hidden shrink-0 border border-gilt/60 bg-card p-1 md:block">
          <Image
            src={VERTICAL_PHOTOS[plan.input.vertical].src}
            alt=""
            aria-hidden="true"
            width={VERTICAL_PHOTOS[plan.input.vertical].width}
            height={VERTICAL_PHOTOS[plan.input.vertical].height}
            sizes="192px"
            className="h-32 w-48 object-cover"
            style={{ objectPosition: VERTICAL_PHOTOS[plan.input.vertical].objectPosition }}
          />
        </figure>
      </section>

      {/* Eight KPI cards + deadlines/snapshot widgets. */}
      <PlanMetrics plan={plan} />

      {/* Conversational assistant (Design.md §4.9) */}
      <AssistantPanel plan={plan} />

      {/* Provenance */}
      <section
        aria-labelledby="overview-provenance"
        className="grid gap-2 rounded-xl border border-border bg-card p-4"
      >
        <h3 id="overview-provenance" className="eyebrow text-muted-foreground">
          Provenance
        </h3>
        <ul className="flex flex-wrap items-center gap-2 text-xs">
          <li>
            <Badge
              className={
                plan.meta.source === "llm"
                  ? "border-rose/30 bg-wine-deep/40 text-accent-a-text"
                  : "bg-muted text-muted-foreground"
              }
              variant="outline"
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
        {plan.meta.source === "fallback" && (
          <p className="text-xs text-muted-foreground">
            AI enrichment was unavailable or not configured for this request; the deterministic
            engine generated this plan. Add a server-side API key or retry when the provider is
            available.
          </p>
        )}
        {plan.input.theme && (
          <p className="text-sm text-muted-foreground">Theme: {plan.input.theme}</p>
        )}
      </section>

      {/* Budget adjustment — server-authoritative */}
      <section
        aria-labelledby="overview-budget"
        className="grid gap-3 rounded-xl border border-border bg-card p-4"
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
