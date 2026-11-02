"use client";

import Image from "next/image";
import { ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { countdown, formatMoney, parseMoneyToCents } from "@/lib/format";
import { VERTICAL_PHOTOS } from "@/lib/config/photos";
import { usePlannerStore } from "@/lib/store/use-planner-store";
import { PlanInputSchema, type PlanInput } from "@/lib/genai/schemas";

/**
 * Event setup form (Phases.md 3.2). The client mirrors PlanInputSchema so the
 * user gets instant field-level errors; the server re-validates the same schema
 * on POST /api/plan — client checks are UX, never trust.
 */

const VERTICALS: ReadonlyArray<{ value: PlanInput["vertical"]; label: string; hint: string }> = [
  { value: "wedding", label: "Wedding", hint: "Ceremony + reception, 3–12 mo runway" },
  { value: "birthday", label: "Birthday", hint: "Party + vendors, 2–8 weeks runway" },
  { value: "community", label: "Community", hint: "Public event, permits + safety" },
];

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "AUD", "CAD"] as const;

/** Vertical-aware quick fills (Design.md §4.4) — fill fields, never bypass validation. */
const PRESETS: Record<
  PlanInput["vertical"],
  ReadonlyArray<{ label: string; theme: string; notes: string; isOutdoor?: boolean }>
> = {
  wedding: [
    {
      label: "Sangeet & reception",
      theme: "Sangeet & reception",
      notes: "Sangeet night, ceremony rituals and reception flow; family-led traditions.",
    },
    {
      label: "Garden ceremony",
      theme: "Garden / botanical",
      notes: "Outdoor ceremony with botanical décor and a weather-contingency plan.",
      isOutdoor: true,
    },
    {
      label: "Classic formal wedding",
      theme: "Classic formal",
      notes: "Traditional ceremony order, formal dress code, plated dinner service.",
    },
  ],
  birthday: [
    {
      label: "Milestone 30th (outdoor)",
      theme: "Milestone birthday",
      notes: "Speeches, cake cutting and garden games for a milestone birthday.",
      isOutdoor: true,
    },
    {
      label: "Kids' party",
      theme: "Playful kids party",
      notes: "Games, entertainer, allergy-safe snacks and a calm wind-down corner.",
    },
    {
      label: "Surprise party",
      theme: "Surprise celebration",
      notes: "Strict surprise logistics: coordinated arrivals, hidden cake, low-key décor.",
    },
  ],
  community: [
    {
      label: "Neighborhood block party",
      theme: "Block party",
      notes: "Street permit, shared potluck tables, children's area and first-aid desk.",
    },
    {
      label: "Cultural fair",
      theme: "Cultural heritage fair",
      notes: "Multi-booth cultural showcases, volunteer stewards, donation-based entry.",
    },
    {
      label: "Charity fundraiser",
      theme: "Charity fundraiser",
      notes: "Sponsor tiers, auction run-of-show, transparent donation reporting.",
    },
  ],
};

function defaultDateInput(): string {
  return new Date(Date.now() + 180 * 86_400_000).toISOString().slice(0, 10);
}

/** Earliest selectable date = tomorrow (module-level: never computed during render). */
const MIN_DATE_INPUT = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

/** Raw string fields — validated and converted on submit, never trusted. */
interface FormState {
  vertical: PlanInput["vertical"];
  name: string;
  eventDate: string;
  guestCount: string;
  budget: string;
  currency: string;
  budgetBand: PlanInput["budgetBand"];
  location: string;
  theme: string;
  culturalNotes: string;
  isOutdoor: boolean;
}

function initialForm(): FormState {
  return {
    vertical: "wedding",
    name: "",
    eventDate: defaultDateInput(),
    guestCount: "100",
    budget: "5000",
    currency: "USD",
    budgetBand: "standard",
    location: "",
    theme: "",
    culturalNotes: "",
    isOutdoor: false,
  };
}

function buildPayload(form: FormState): {
  input: PlanInput | null;
  issues: Record<string, string>;
} {
  const draft = {
    vertical: form.vertical,
    name: form.name.trim() || undefined,
    eventDate: form.eventDate ? new Date(`${form.eventDate}T12:00:00`).toISOString() : "",
    guestCount: Number(form.guestCount),
    budgetTotalCents: parseMoneyToCents(form.budget),
    currency: form.currency,
    budgetBand: form.budgetBand,
    location: form.location.trim() || undefined,
    theme: form.theme.trim() || undefined,
    culturalNotes: form.culturalNotes.trim() || undefined,
    isOutdoor: form.isOutdoor,
  };
  const parsed = PlanInputSchema.safeParse(draft);
  if (parsed.success) return { input: parsed.data, issues: {} };

  const issues: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const field = String(issue.path[0] ?? "form");
    if (!issues[field]) issues[field] = issue.message;
  }
  if (draft.budgetTotalCents === null) issues.budget = "Enter an amount like 5000 or 4999.99";
  return { input: null, issues };
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-xs text-danger-text">
      {message}
    </p>
  );
}

export function EventSetupForm() {
  const router = useRouter();
  const generatePlan = usePlannerStore((s) => s.generatePlan);
  const status = usePlannerStore((s) => s.status);

  const [form, setForm] = useState<FormState>(initialForm);
  const [issues, setIssues] = useState<Record<string, string>>({});

  /** Live T−minus preview for the date field (display-only; server validates). */
  const cd = useMemo(() => {
    const date = form.eventDate ? new Date(`${form.eventDate}T12:00:00`) : null;
    if (!date || Number.isNaN(date.getTime())) return null;
    return countdown(date.toISOString());
  }, [form.eventDate]);

  /** Live ≈ per-guest preview (display-only; the engine owns canonical math). */
  const perGuest = useMemo(() => {
    const cents = parseMoneyToCents(form.budget);
    const guests = Number(form.guestCount);
    if (cents === null || !Number.isFinite(guests) || guests < 1 || cents < 1) return null;
    const per = Math.round(cents / guests);
    if (!Number.isFinite(per) || per < 1) return null;
    return formatMoney(per, form.currency);
  }, [form.budget, form.guestCount, form.currency]);

  const generating = status === "generating";

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setIssues((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { input, issues: fieldIssues } = buildPayload(form);
    if (!input) {
      setIssues(fieldIssues);
      return;
    }
    const plan = await generatePlan(input);
    if (plan) router.push(`/plan/${plan.id}`);
  }

  /** Quick preset: fills theme + notes (+ outdoors flag) — still validated on submit. */
  function applyPreset(preset: (typeof PRESETS)[PlanInput["vertical"]][number]) {
    update("theme", preset.theme);
    update("culturalNotes", preset.notes);
    if (preset.isOutdoor !== undefined) update("isOutdoor", preset.isOutdoor);
  }

  return (
    // data-vertical retints accent roles live as the event-type radios change.
    <div
      id="create"
      data-vertical={form.vertical}
      className="mx-auto w-full max-w-6xl scroll-mt-16 px-4 py-10 sm:px-8"
    >
      {/* Split bespoke-stationery layout (Design.md §3): brand column | paper form card */}
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <header className="grid gap-4">
          <p className="eyebrow text-gilt-text">Create your event</p>
          <h2 className="display text-4xl leading-tight font-semibold sm:text-5xl">
            New event plan
          </h2>
          <div className="rule-gilt" aria-hidden="true">
            <span>❦</span>
          </div>
          <p className="max-w-[52ch] text-sm text-muted-foreground">
            Set the constraints once. The engine prices the budget and timeline to the cent; the
            model adds personalized ideas on top.
          </p>
          <ul className="grid gap-1.5 text-sm text-muted-foreground">
            {[
              "Budgets allocated to the cent — deterministically.",
              "Reverse T−minus timelines and vendor checklists.",
              "GenAI ideas layered on top, never in the math.",
            ].map((line) => (
              <li key={line} className="flex gap-2">
                <span aria-hidden="true" className="text-gilt-text">
                  —
                </span>
                {line}
              </li>
            ))}
          </ul>
          {/* Vertical photo plate — sanctioned slot 2 of 3 (Design.md §4.6):
              the selected event type's own photograph, swapping live with the
              radios. Print-mount framing, decorative, fluid at every width. */}
          <figure className="w-full max-w-sm border border-gilt/60 bg-card p-1">
            <Image
              key={form.vertical}
              src={VERTICAL_PHOTOS[form.vertical].src}
              alt=""
              aria-hidden="true"
              width={VERTICAL_PHOTOS[form.vertical].width}
              height={VERTICAL_PHOTOS[form.vertical].height}
              sizes="(min-width: 1024px) 384px, 100vw"
              className="aspect-[3/2] w-full object-cover"
              style={{ objectPosition: VERTICAL_PHOTOS[form.vertical].objectPosition }}
            />
          </figure>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="display">Event setup</CardTitle>
            <CardDescription>All fields required unless marked optional.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} noValidate className="grid gap-5">
              {/* Event type */}
              <fieldset className="grid gap-2">
                <legend className="text-sm font-medium">Event type</legend>
                <RadioGroup
                  value={form.vertical}
                  onValueChange={(value) => update("vertical", value as FormState["vertical"])}
                  aria-label="Event type"
                  className="grid gap-2 sm:grid-cols-3"
                >
                  {VERTICALS.map((v) => (
                    <Label
                      key={v.value}
                      className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-background p-3 has-data-[state=checked]:border-ring has-data-[state=checked]:ring-2 has-data-[state=checked]:ring-ring/40"
                    >
                      <RadioGroupItem value={v.value} className="mt-0.5" />
                      <span className="grid gap-0.5">
                        <span className="text-sm font-medium">{v.label}</span>
                        <span className="text-xs text-muted-foreground">{v.hint}</span>
                      </span>
                    </Label>
                  ))}
                </RadioGroup>
              </fieldset>

              {/* Event name — optional; surfaces in the dashboard masthead, exports and prompts */}
              <div className="grid gap-2">
                <Label htmlFor="name">Event name (optional)</Label>
                <Input
                  id="name"
                  placeholder="e.g. Priya & Sam's wedding"
                  maxLength={120}
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  aria-invalid={Boolean(issues.name)}
                  aria-describedby={issues.name ? "name-error" : undefined}
                />
                <FieldError id="name-error" message={issues.name} />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                {/* Date */}
                <div className="grid gap-2">
                  <Label htmlFor="eventDate">Event date</Label>
                  <Input
                    id="eventDate"
                    type="date"
                    min={MIN_DATE_INPUT}
                    value={form.eventDate}
                    onChange={(e) => update("eventDate", e.target.value)}
                    aria-invalid={Boolean(issues.eventDate)}
                    aria-describedby={issues.eventDate ? "eventDate-error" : "eventDate-hint"}
                  />
                  {issues.eventDate ? (
                    <FieldError id="eventDate-error" message={issues.eventDate} />
                  ) : (
                    <p
                      id="eventDate-hint"
                      className="tnum inline-flex w-fit items-center rounded-md border border-border bg-accent-a/10 px-2 py-0.5 text-xs font-medium text-accent-a-text"
                    >
                      {cd ? `T−${cd.days} day${cd.days === 1 ? "" : "s"}` : ""}
                    </p>
                  )}
                </div>

                {/* Guests */}
                <div className="grid gap-2">
                  <Label htmlFor="guestCount">Guests</Label>
                  <Input
                    id="guestCount"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={10_000}
                    value={form.guestCount}
                    onChange={(e) => update("guestCount", e.target.value)}
                    aria-invalid={Boolean(issues.guestCount)}
                    aria-describedby={issues.guestCount ? "guestCount-error" : undefined}
                  />
                  <FieldError id="guestCount-error" message={issues.guestCount} />
                </div>

                {/* Budget */}
                <div className="grid gap-2">
                  <Label htmlFor="budget">Total budget</Label>
                  <Input
                    id="budget"
                    inputMode="decimal"
                    placeholder="5000"
                    value={form.budget}
                    onChange={(e) => update("budget", e.target.value)}
                    aria-invalid={Boolean(issues.budget)}
                    aria-describedby={issues.budget ? "budget-error" : undefined}
                  />
                  <FieldError id="budget-error" message={issues.budget} />
                  {!issues.budget && perGuest && (
                    <p
                      aria-label="Approximate spend per guest"
                      className="tnum inline-flex w-fit items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      ≈ {perGuest} / guest
                    </p>
                  )}
                </div>

                {/* Currency */}
                <div className="grid gap-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={form.currency}
                    onValueChange={(value) => update("currency", value)}
                  >
                    <SelectTrigger id="currency" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Budget band */}
                <div className="grid gap-2">
                  <Label htmlFor="budgetBand">Spending style</Label>
                  <Select
                    value={form.budgetBand}
                    onValueChange={(value) =>
                      update("budgetBand", value as FormState["budgetBand"])
                    }
                  >
                    <SelectTrigger id="budgetBand" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="micro">Micro — lean, DIY-leaning</SelectItem>
                      <SelectItem value="standard">Standard — balanced</SelectItem>
                      <SelectItem value="premium">Premium — full service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Location */}
                <div className="grid gap-2">
                  <Label htmlFor="location">Location (optional)</Label>
                  <Input
                    id="location"
                    placeholder="City or venue area"
                    maxLength={200}
                    value={form.location}
                    onChange={(e) => update("location", e.target.value)}
                    aria-invalid={Boolean(issues.location)}
                    aria-describedby={issues.location ? "location-error" : undefined}
                  />
                  <FieldError id="location-error" message={issues.location} />
                </div>

                {/* Theme / style */}
                <div className="grid gap-2">
                  <Label htmlFor="theme">Style or theme (optional)</Label>
                  <Input
                    id="theme"
                    placeholder="e.g. garden, 1920s, rustic"
                    maxLength={200}
                    value={form.theme}
                    onChange={(e) => update("theme", e.target.value)}
                    aria-invalid={Boolean(issues.theme)}
                    aria-describedby={issues.theme ? "theme-error" : undefined}
                  />
                  <FieldError id="theme-error" message={issues.theme} />
                </div>

                {/* Cultural notes */}
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="culturalNotes">Cultural notes (optional)</Label>
                  <Textarea
                    id="culturalNotes"
                    rows={2}
                    maxLength={1000}
                    placeholder="Traditions, rituals, dietary rules the plan should respect"
                    value={form.culturalNotes}
                    onChange={(e) => update("culturalNotes", e.target.value)}
                    aria-invalid={Boolean(issues.culturalNotes)}
                    aria-describedby={issues.culturalNotes ? "culturalNotes-error" : undefined}
                  />
                  <FieldError id="culturalNotes-error" message={issues.culturalNotes} />
                  {/* Vertical-aware quick fills (Design.md §4.4) */}
                  <div className="grid gap-1.5">
                    <span id="preset-label" className="text-xs text-muted-foreground">
                      Quick presets — fills style &amp; cultural notes
                    </span>
                    <div
                      role="group"
                      aria-labelledby="preset-label"
                      className="flex flex-wrap gap-1.5"
                    >
                      {PRESETS[form.vertical].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => applyPreset(preset)}
                          className="rounded-full border border-border bg-background px-2.5 py-1 text-xs hover:border-gilt hover:text-gilt-text focus-visible:ring-2 focus-visible:ring-ring/70"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Outdoor */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="isOutdoor"
                  checked={form.isOutdoor}
                  onCheckedChange={(checked) => update("isOutdoor", checked === true)}
                />
                <Label htmlFor="isOutdoor" className="cursor-pointer">
                  Outdoors — adds weather-contingency tasks and checklist items
                </Label>
              </div>

              <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
                <p aria-live="polite" className="text-sm text-muted-foreground" role="status">
                  {generating ? "Generating your plan…" : ""}
                </p>
                <Button type="submit" disabled={generating}>
                  {generating ? (
                    <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                  ) : (
                    <ArrowRight aria-hidden="true" className="size-4" />
                  )}
                  {generating ? "Generating…" : "Generate plan"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
