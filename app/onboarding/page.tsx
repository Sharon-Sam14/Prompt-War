"use client";

import { motion, AnimatePresence } from "motion/react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowRight, ArrowLeft, Check, Loader2, AlertCircle, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { usePlannerStore } from "@/lib/store/use-planner-store";
import { PlanInputSchema, type PlanInput } from "@/lib/genai/schemas";
import { formatMoney, parseMoneyToCents } from "@/lib/format";
import { AuroraBackground } from "@/components/ui/aurora-background";
import Link from "next/link";

/** Step 1: Event type */
interface Step1Data {
  vertical: PlanInput["vertical"];
  subtype?: string;
}

/** Step 2: Details & guests */
interface Step2Data {
  name: string;
  eventDate: string;
  city: string;
  venueStatus: "booked" | "searching" | "undecided";
  guestCount: number;
  isOutdoor: boolean;
  description: string;
}

/** Step 3: Style & vibe */
interface Step3Data {
  theme: string;
  colors: string;
  style:
    "Elegant" | "Minimal" | "Traditional" | "Modern" | "Rustic" | "Playful" | "Cultural" | "Custom";
  dietaryNeeds: string;
  accessibilityNeeds: string;
  culturalConsiderations: string;
  specialRequirements: string;
}

/** Step 4: Budget */
interface Step4Data {
  total: string;
  currency: string;
  flexibility: "strict" | "some" | "flexible";
  contingencyPercent: number;
  priorities: string[];
}

/** Step 5: Generate & review */
interface Step5Data {
  loading: boolean;
  error: string | null;
}

/** Complete form state */
interface OnboardingState {
  step1: Step1Data;
  step2: Step2Data;
  step3: Step3Data;
  step4: Step4Data;
  step5: Step5Data;
}

const initialState: OnboardingState = {
  step1: { vertical: "wedding" },
  step2: {
    name: "",
    eventDate: new Date(Date.now() + 180 * 86_400_000).toISOString().slice(0, 10),
    city: "",
    venueStatus: "undecided",
    guestCount: 100,
    isOutdoor: false,
    description: "",
  },
  step3: {
    theme: "",
    colors: "",
    style: "Elegant",
    dietaryNeeds: "",
    accessibilityNeeds: "",
    culturalConsiderations: "",
    specialRequirements: "",
  },
  step4: {
    total: "5000",
    currency: "USD",
    flexibility: "some",
    contingencyPercent: 10,
    priorities: [],
  },
  step5: { loading: false, error: null },
};

const VERTICALS = [
  { value: "wedding", label: "Wedding", hint: "Ceremony + reception, 3–12 mo runway", icon: "💍" },
  { value: "birthday", label: "Birthday", hint: "Party + vendors, 2–8 weeks runway", icon: "🎂" },
  { value: "community", label: "Community", hint: "Public event, permits + safety", icon: "🏘️" },
] as const;

/** Type guard for deep-linked `?vertical=` values. */
function isVertical(value: string): value is PlanInput["vertical"] {
  return VERTICALS.some((v) => v.value === value);
}

/**
 * Step heading that takes focus when its step mounts, except on the very
 * first paint of the wizard (so the skip link stays the first tab stop).
 * Module-scoped flag: a fresh page load resets it, a step change does not.
 */
let stepTitleSeenOnPage = false;

function StepTitle({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const handled = useRef(false);
  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    if (!stepTitleSeenOnPage) {
      stepTitleSeenOnPage = true;
      return;
    }
    ref.current?.focus();
  }, []);
  return (
    <h2 ref={ref} tabIndex={-1} className="display text-3xl font-semibold">
      {children}
    </h2>
  );
}

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "AUD", "CAD"] as const;

const STYLES = [
  "Elegant",
  "Minimal",
  "Traditional",
  "Modern",
  "Rustic",
  "Playful",
  "Cultural",
  "Custom",
] as const;

const PRIORITY_CATEGORIES = [
  "Venue",
  "Catering",
  "Décor",
  "Entertainment",
  "Attire",
  "Photography",
  "Transport",
  "Contingency",
];

const MIN_DATE = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

const STEPS = [
  { key: "step1", label: "Event type", desc: "Choose your event type" },
  { key: "step2", label: "Details", desc: "Date, location, guests" },
  { key: "step3", label: "Style", desc: "Theme, vibe, needs" },
  { key: "step4", label: "Budget", desc: "Total, currency, priorities" },
  { key: "step5", label: "Review", desc: "Generate & confirm" },
] as const;

function ProgressStep({
  index,
  current,
  completed,
  label,
  desc,
}: {
  index: number;
  current: number;
  completed: boolean;
  label: string;
  desc: string;
}) {
  const isActive = index === current;
  const isDone = completed;

  return (
    <div className="flex flex-col items-center flex-1 relative">
      {index < STEPS.length - 1 && (
        <div
          className={cn(
            "absolute top-5 left-1/2 w-full h-0.5 -translate-x-1/2",
            isDone ? "bg-gilt" : "bg-border",
          )}
          aria-hidden="true"
        />
      )}

      <div
        className={cn(
          "relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all",
          isDone
            ? "bg-gilt border-gilt text-background"
            : isActive
              ? "border-gilt bg-background text-gilt"
              : "border-border bg-background text-muted-foreground",
        )}
      >
        {isDone ? (
          <Check className="size-5" aria-hidden="true" />
        ) : (
          <span className={cn("font-medium", isActive ? "text-base" : "text-sm")}>{index + 1}</span>
        )}
      </div>

      <div className="mt-2 text-center w-24">
        <p
          className={cn(
            "text-xs font-medium",
            isActive ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {label}
        </p>
        <p className="text-[10px] text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}

function MobileStepper({
  current,
  onBack,
  onNext,
  isLastStep,
}: {
  current: number;
  onBack: () => void;
  onNext: () => void;
  isLastStep: boolean;
}) {
  return (
    <div className="md:hidden flex items-center justify-between px-2 py-4">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onBack}
        disabled={current === 0}
        className="gap-1"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Back
      </Button>
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">
          Step {current + 1} of {STEPS.length}
        </p>
        <p className="text-xs text-muted-foreground">{STEPS[current].label}</p>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onNext} className="gap-1">
        {isLastStep ? "Create plan" : "Next"}
      </Button>
    </div>
  );
}

function OnboardingWizard() {
  const router = useRouter();
  const generatePlan = usePlannerStore((s) => s.generatePlan);

  const [state, setState] = useState<OnboardingState>(initialState);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  /**
   * Deep links from the landing page (D48): the natural-language prompt bar
   * pushes `?prompt=` and the vertical cards push `?vertical=`. Read them
   * once on mount — client-only, so SSR markup is untouched and hydration
   * never mismatches.
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verticalParam = params.get("vertical");
    const promptParam = params.get("prompt")?.trim();
    const vertical = verticalParam && isVertical(verticalParam) ? verticalParam : null;
    if (!vertical && !promptParam) return;
    // One-time hydration-safe deep-link read (empty dep array): a single
    // mount-time state write, so there is no cascading-render concern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((prev) => ({
      ...prev,
      step1: vertical ? { ...prev.step1, vertical } : prev.step1,
      step2: promptParam ? { ...prev.step2, description: promptParam } : prev.step2,
    }));
  }, []);

  /** Build the full PlanInput from all steps */
  const buildPlanInput = useMemo((): PlanInput | null => {
    const draft = {
      vertical: state.step1.vertical,
      name: state.step2.name.trim() || undefined,
      eventDate: state.step2.eventDate
        ? new Date(`${state.step2.eventDate}T12:00:00`).toISOString()
        : "",
      guestCount: state.step2.guestCount,
      budgetTotalCents: parseMoneyToCents(state.step4.total),
      currency: state.step4.currency,
      budgetBand: "standard" as const,
      location: state.step2.city.trim() || undefined,
      theme: state.step3.theme.trim() || undefined,
      culturalNotes:
        [
          state.step3.culturalConsiderations,
          state.step3.dietaryNeeds,
          state.step3.accessibilityNeeds,
          state.step3.specialRequirements,
        ]
          .filter(Boolean)
          .join("; ") || undefined,
      description: state.step2.description.trim() || undefined,
      isOutdoor: state.step2.isOutdoor,
    };

    const parsed = PlanInputSchema.safeParse(draft);
    if (parsed.success) return parsed.data;
    return null;
  }, [state]);

  /** Validate current step */
  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 0:
        if (!state.step1.vertical) newErrors.vertical = "Select an event type";
        break;
      case 1:
        if (!state.step2.name.trim()) newErrors.name = "Event name is required";
        if (!state.step2.eventDate) newErrors.eventDate = "Event date is required";
        else if (new Date(state.step2.eventDate) < new Date(MIN_DATE)) {
          newErrors.eventDate = "Date must be at least tomorrow";
        }
        if (!state.step2.city.trim()) newErrors.city = "City is required";
        if (!Number.isFinite(state.step2.guestCount) || state.step2.guestCount < 1) {
          newErrors.guestCount = "Guest count must be at least 1";
        }
        break;
      case 2:
        break;
      case 3:
        const cents = parseMoneyToCents(state.step4.total);
        if (cents === null || cents < 1) newErrors.total = "Enter a valid budget amount";
        if (!state.step4.currency) newErrors.currency = "Select a currency";
        if (state.step4.priorities.length === 0)
          newErrors.priorities = "Select at least one priority";
        if (
          !Number.isInteger(state.step4.contingencyPercent) ||
          state.step4.contingencyPercent < 0 ||
          state.step4.contingencyPercent > 50
        ) {
          newErrors.contingency = "Contingency must be 0-50%";
        }
        break;
    }

    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const goNext = async () => {
    if (!validateStep(currentStep)) return;

    if (currentStep < STEPS.length - 1) {
      setCompletedSteps((prev) => new Set([...prev, currentStep]));
      setCurrentStep((prev) => prev + 1);
    } else if (currentStep === STEPS.length - 1) {
      const input = buildPlanInput;
      if (!input) {
        setState((prev) => ({ ...prev, step5: { ...prev.step5, error: "Invalid form data" } }));
        return;
      }

      setState((prev) => ({ ...prev, step5: { ...prev.step5, loading: true, error: null } }));

      try {
        const plan = await generatePlan(input);
        if (plan) {
          router.push(`/plan/${plan.id}`);
        } else {
          setState((prev) => ({
            ...prev,
            step5: { ...prev.step5, loading: false, error: "Failed to generate plan" },
          }));
        }
      } catch {
        setState((prev) => ({
          ...prev,
          step5: { ...prev.step5, loading: false, error: "Generation failed" },
        }));
      }
    }
  };

  const goBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const isLastStep = currentStep === STEPS.length - 1;

  /** Helper to update a specific step in the main state */
  const updateStep = <K extends keyof OnboardingState>(
    stepKey: K,
    value: OnboardingState[K] | ((prev: OnboardingState[K]) => OnboardingState[K]),
  ) => {
    setState((prev) => ({
      ...prev,
      [stepKey]: typeof value === "function" ? value(prev[stepKey]) : value,
    }));
  };

  return (
    <AuroraBackground className="min-h-screen flex flex-col">
      {/* Top navigation - Back to Home */}
      <header className="w-full max-w-4xl mx-auto px-4 py-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Back to Home
        </Link>
      </header>

      {/* Main content - fluid responsive card */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-6 md:py-10 flex flex-col justify-center">
        <div className="w-full glass-panel p-4 md:p-6 lg:p-8 rounded-2xl md:rounded-3xl shadow-xl relative">
          <MobileStepper
            current={currentStep}
            onBack={goBack}
            onNext={goNext}
            isLastStep={isLastStep}
          />
          {/* Polite announcement of wizard progress for screen readers. */}
          <p id="step-announcer" className="sr-only" aria-live="polite">
            Step {currentStep + 1} of {STEPS.length}: {STEPS[currentStep].label}
          </p>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="space-y-6"
            >
              <div className="w-full">
                {/* Progress indicator - desktop only */}
                <nav aria-label="Onboarding progress" className="mb-6 hidden md:block">
                  <ol className="relative flex" role="list">
                    {STEPS.map((step, i) => (
                      <li key={step.key}>
                        <ProgressStep
                          index={i}
                          current={currentStep}
                          completed={completedSteps.has(i)}
                          label={step.label}
                          desc={step.desc}
                        />
                      </li>
                    ))}
                  </ol>
                </nav>

                {/* Step content */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    goNext();
                  }}
                  noValidate
                  className="w-full"
                >
                  {currentStep === 0 && (
                    <Step1Form state={state.step1} updateStep={updateStep} errors={formErrors} />
                  )}
                  {currentStep === 1 && (
                    <Step2Form state={state.step2} updateStep={updateStep} errors={formErrors} />
                  )}
                  {currentStep === 2 && <Step3Form state={state.step3} updateStep={updateStep} />}
                  {currentStep === 3 && (
                    <Step4Form
                      state={state.step4}
                      updateStep={updateStep}
                      errors={formErrors}
                      guestCount={state.step2.guestCount}
                    />
                  )}
                  {currentStep === 4 && (
                    <Step5Form
                      state={state.step5}
                      planInput={buildPlanInput}
                      priorities={state.step4.priorities}
                    />
                  )}

                  {/* Navigation - desktop only */}
                  <div className="mt-6 flex justify-between pt-4 border-t border-border hidden md:flex">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={goBack}
                      disabled={currentStep === 0}
                      className="gap-2"
                    >
                      <ArrowLeft className="size-4" aria-hidden="true" />
                      Back
                    </Button>

                    {isLastStep ? (
                      <Button type="submit" disabled={state.step5.loading} className="gap-2">
                        {state.step5.loading ? (
                          <>
                            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                            Generating…
                          </>
                        ) : (
                          <>
                            Create event plan
                            <ArrowRight className="size-4" aria-hidden="true" />
                          </>
                        )}
                      </Button>
                    ) : (
                      <Button type="submit" className="gap-2">
                        Next
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </Button>
                    )}
                  </div>

                  {state.step5.error && (
                    <div
                      className="mt-4 p-3 text-sm text-destructive bg-destructive/5 rounded border border-destructive/20"
                      role="alert"
                    >
                      {state.step5.error}
                    </div>
                  )}
                </form>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </AuroraBackground>
  );
}

/** Step 1: Event Type */
function Step1Form({
  state,
  updateStep,
  errors,
}: {
  state: Step1Data;
  updateStep: <K extends keyof OnboardingState>(
    stepKey: K,
    value: OnboardingState[K] | ((prev: OnboardingState[K]) => OnboardingState[K]),
  ) => void;
  errors: Record<string, string>;
}) {
  return (
    <div className="space-y-6">
      <header className="text-center">
        <StepTitle>What type of event?</StepTitle>
        <p className="mt-2 text-muted-foreground">
          This sets the default budget weights, timeline template, and vendor checklist.
        </p>
      </header>

      <RadioGroup
        value={state.vertical}
        onValueChange={(v) => updateStep("step1", { vertical: v as PlanInput["vertical"] })}
      >
        {VERTICALS.map((v) => (
          <Label
            key={v.value}
            className={cn(
              "relative flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all",
              "has-data-[state=checked]:border-gilt has-data-[state=checked]:ring-2 has-data-[state=checked]:ring-gilt/30",
              state.vertical === v.value ? "bg-accent-a/5" : "bg-background",
            )}
          >
            <RadioGroupItem value={v.value} className="sr-only peer" />
            <span className="text-5xl" aria-hidden="true">
              {v.icon}
            </span>
            <span className="font-semibold text-lg">{v.label}</span>
            <span className="text-sm text-muted-foreground text-center">{v.hint}</span>
          </Label>
        ))}
      </RadioGroup>

      {errors.vertical && (
        <p className="text-sm text-destructive" role="alert">
          {errors.vertical}
        </p>
      )}
    </div>
  );
}

/** Step 2: Details & Guests */
function Step2Form({
  state,
  updateStep,
  errors,
}: {
  state: Step2Data;
  updateStep: <K extends keyof OnboardingState>(
    stepKey: K,
    value: OnboardingState[K] | ((prev: OnboardingState[K]) => OnboardingState[K]),
  ) => void;
  errors: Record<string, string>;
}) {
  return (
    <div className="space-y-6">
      <header className="text-center">
        <StepTitle>Event details</StepTitle>
        <p className="mt-2 text-muted-foreground">When, where, and how many people.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="name">Event name</Label>
          <Input
            id="name"
            value={state.name}
            onChange={(e) => updateStep("step2", (prev) => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Sarah & James Wedding"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "name-error" : undefined}
          />
          {errors.name && (
            <p id="name-error" className="text-sm text-destructive" role="alert">
              {errors.name}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="eventDate">Event date</Label>
          <Input
            id="eventDate"
            type="date"
            min={MIN_DATE}
            value={state.eventDate}
            onChange={(e) =>
              updateStep("step2", (prev) => ({ ...prev, eventDate: e.target.value }))
            }
            aria-invalid={Boolean(errors.eventDate)}
            aria-describedby={errors.eventDate ? "eventDate-error" : "eventDate-hint"}
          />
          {errors.eventDate ? (
            <p id="eventDate-error" className="text-sm text-destructive" role="alert">
              {errors.eventDate}
            </p>
          ) : (
            <p id="eventDate-hint" className="text-xs text-muted-foreground">
              Must be at least tomorrow
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="city">City / Location</Label>
          <Input
            id="city"
            value={state.city}
            onChange={(e) => updateStep("step2", (prev) => ({ ...prev, city: e.target.value }))}
            placeholder="e.g., Mumbai, India"
            aria-invalid={Boolean(errors.city)}
            aria-describedby={errors.city ? "city-error" : undefined}
          />
          {errors.city && (
            <p id="city-error" className="text-sm text-destructive" role="alert">
              {errors.city}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="venueStatus">Venue status</Label>
          <Select
            value={state.venueStatus}
            onValueChange={(v) =>
              updateStep("step2", (prev) => ({
                ...prev,
                venueStatus: v as Step2Data["venueStatus"],
              }))
            }
          >
            <SelectTrigger id="venueStatus">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="booked">Booked</SelectItem>
              <SelectItem value="searching">Searching</SelectItem>
              <SelectItem value="undecided">Undecided</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="guestCount">Guest count</Label>
          <Input
            id="guestCount"
            type="number"
            min="1"
            max="10000"
            value={state.guestCount}
            onChange={(e) =>
              updateStep("step2", (prev) => ({
                ...prev,
                guestCount: Math.max(1, Number(e.target.value) || 1),
              }))
            }
            aria-invalid={Boolean(errors.guestCount)}
            aria-describedby={errors.guestCount ? "guestCount-error" : undefined}
          />
          {errors.guestCount && (
            <p id="guestCount-error" className="text-sm text-destructive" role="alert">
              {errors.guestCount}
            </p>
          )}
        </div>

        <div className="grid gap-2 sm:col-span-2">
          <Label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={state.isOutdoor}
              onCheckedChange={(c) =>
                updateStep("step2", (prev) => ({ ...prev, isOutdoor: c as boolean }))
              }
              className="mr-2"
            />
            Outdoor event
          </Label>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          value={state.description}
          onChange={(e) =>
            updateStep("step2", (prev) => ({ ...prev, description: e.target.value }))
          }
          placeholder="Brief description of your vision, must-haves, or constraints…"
          rows={3}
        />
      </div>
    </div>
  );
}

/** Step 3: Style & Vibe */
function Step3Form({
  state,
  updateStep,
}: {
  state: Step3Data;
  updateStep: <K extends keyof OnboardingState>(
    stepKey: K,
    value: OnboardingState[K] | ((prev: OnboardingState[K]) => OnboardingState[K]),
  ) => void;
}) {
  return (
    <div className="space-y-6">
      <header className="text-center">
        <StepTitle>Style & vibe</StepTitle>
        <p className="mt-2 text-muted-foreground">
          Help the AI tailor ideas, themes, and vendor questions.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="theme">Theme / theme (optional)</Label>
          <Input
            id="theme"
            value={state.theme}
            onChange={(e) => updateStep("step3", (prev) => ({ ...prev, theme: e.target.value }))}
            placeholder="e.g., Rustic garden, Bollywood glam, Minimalist white"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="colors">Color palette (optional)</Label>
          <Input
            id="colors"
            value={state.colors}
            onChange={(e) => updateStep("step3", (prev) => ({ ...prev, colors: e.target.value }))}
            placeholder="e.g., Sage green, ivory, gold"
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="style">Overall style</Label>
        <Select
          value={state.style}
          onValueChange={(v) =>
            updateStep("step3", (prev) => ({ ...prev, style: v as Step3Data["style"] }))
          }
        >
          <SelectTrigger id="style">
            <SelectValue placeholder="Select style" />
          </SelectTrigger>
          <SelectContent>
            {STYLES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator className="my-4" />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="dietaryNeeds">Dietary needs (optional)</Label>
          <Textarea
            id="dietaryNeeds"
            value={state.dietaryNeeds}
            onChange={(e) =>
              updateStep("step3", (prev) => ({ ...prev, dietaryNeeds: e.target.value }))
            }
            placeholder="Vegetarian, vegan, halal, kosher, nut-free, gluten-free…"
            rows={2}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="accessibilityNeeds">Accessibility needs (optional)</Label>
          <Textarea
            id="accessibilityNeeds"
            value={state.accessibilityNeeds}
            onChange={(e) =>
              updateStep("step3", (prev) => ({ ...prev, accessibilityNeeds: e.target.value }))
            }
            placeholder="Wheelchair access, sign language, sensory-friendly space…"
            rows={2}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="culturalConsiderations">Cultural considerations (optional)</Label>
          <Textarea
            id="culturalConsiderations"
            value={state.culturalConsiderations}
            onChange={(e) =>
              updateStep("step3", (prev) => ({ ...prev, culturalConsiderations: e.target.value }))
            }
            placeholder="Religious rituals, family traditions, language requirements…"
            rows={2}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="specialRequirements">Special requirements (optional)</Label>
          <Textarea
            id="specialRequirements"
            value={state.specialRequirements}
            onChange={(e) =>
              updateStep("step3", (prev) => ({ ...prev, specialRequirements: e.target.value }))
            }
            placeholder="Anything else the planner should know…"
            rows={2}
          />
        </div>
      </div>
    </div>
  );
}

/** Step 4: Budget */
function Step4Form({
  state,
  updateStep,
  errors,
  guestCount = 100,
}: {
  state: Step4Data;
  updateStep: <K extends keyof OnboardingState>(
    stepKey: K,
    value: OnboardingState[K] | ((prev: OnboardingState[K]) => OnboardingState[K]),
  ) => void;
  errors: Record<string, string>;
  guestCount?: number;
}) {
  const perGuest = useMemo(() => {
    const cents = parseMoneyToCents(state.total);
    if (cents === null || guestCount < 1) return null;
    const per = Math.round(cents / guestCount);
    return per > 0 ? formatMoney(per, state.currency) : null;
  }, [state.total, state.currency, guestCount]);

  return (
    <div className="space-y-6">
      <header className="text-center">
        <StepTitle>Budget</StepTitle>
        <p className="mt-2 text-muted-foreground">
          Set your total and priorities. The engine allocates to the cent.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="total">Total budget</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {state.currency === "USD"
                ? "$"
                : state.currency === "EUR"
                  ? "€"
                  : state.currency === "GBP"
                    ? "£"
                    : "₹"}
            </span>
            <Input
              id="total"
              type="number"
              min="1"
              step="100"
              value={state.total}
              onChange={(e) => updateStep("step4", (prev) => ({ ...prev, total: e.target.value }))}
              className="pl-8"
              aria-invalid={Boolean(errors.total)}
              aria-describedby={errors.total ? "total-error" : "total-hint"}
            />
          </div>
          {errors.total && (
            <p id="total-error" className="text-sm text-destructive" role="alert">
              {errors.total}
            </p>
          )}
          <p id="total-hint" className="text-xs text-muted-foreground">
            {perGuest
              ? `≈ ${perGuest} / guest (${guestCount} guests)`
              : "Enter amount to see per-guest estimate"}
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="currency">Currency</Label>
          <Select
            value={state.currency}
            onValueChange={(v) => updateStep("step4", (prev) => ({ ...prev, currency: v }))}
          >
            <SelectTrigger id="currency">
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
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="flexibility">Budget flexibility</Label>
          <Select
            value={state.flexibility}
            onValueChange={(v) =>
              updateStep("step4", (prev) => ({
                ...prev,
                flexibility: v as Step4Data["flexibility"],
              }))
            }
          >
            <SelectTrigger id="flexibility">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="strict">Strict — do not exceed</SelectItem>
              <SelectItem value="some">Some flexibility (±10%)</SelectItem>
              <SelectItem value="flexible">Flexible — prioritize experience</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="contingencyPercent">Contingency %</Label>
          <Input
            id="contingencyPercent"
            type="number"
            min="0"
            max="50"
            value={state.contingencyPercent}
            onChange={(e) => {
              const v = Math.max(0, Math.min(50, Number(e.target.value) || 0));
              updateStep("step4", (prev) => ({ ...prev, contingencyPercent: v }));
            }}
            aria-invalid={Boolean(errors.contingency)}
            aria-describedby={errors.contingency ? "contingency-error" : undefined}
          />
          {errors.contingency && (
            <p id="contingency-error" className="text-sm text-destructive" role="alert">
              {errors.contingency}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="priorities">Top priorities</Label>
          <Select
            value={state.priorities.join(",")}
            onValueChange={(v) =>
              updateStep("step4", (prev) => ({
                ...prev,
                priorities: v ? v.split(",").filter(Boolean) : [],
              }))
            }
            aria-describedby={errors.priorities ? "priorities-error" : undefined}
          >
            <SelectTrigger id="priorities">
              <SelectValue placeholder="Select priorities" />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_CATEGORIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.priorities && (
            <p id="priorities-error" className="text-sm text-destructive" role="alert">
              {errors.priorities}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Step 5: Generate & Review */
function Step5Form({
  state,
  planInput,
  priorities,
}: {
  state: Step5Data;
  planInput: PlanInput | null;
  priorities: string[];
}) {
  if (state.loading) {
    return (
      <div className="text-center py-12" role="status">
        <Loader2 className="mx-auto size-12 animate-spin text-gilt mb-4" aria-hidden="true" />
        <h3 className="text-lg font-medium">Generating your plan…</h3>
        <p className="mt-2 text-muted-foreground">
          The deterministic engine is computing budgets, timelines, and checklists.
        </p>
      </div>
    );
  }

  if (!planInput) {
    // Defensive fallback: steps 1–4 validate before the wizard reaches here.
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto size-12 text-muted-foreground mb-4" aria-hidden="true" />
        <h3 className="text-lg font-medium">Some details are incomplete</h3>
        <p className="mt-2 text-muted-foreground">
          Go back and check your earlier answers, then try again.
        </p>
      </div>
    );
  }

  // Honest review summary: exactly what will be sent to the engine.
  const rows: Array<{ id: string; term: string; value: string }> = [
    {
      id: "review-event-type",
      term: "Event type",
      value: VERTICALS.find((v) => v.value === planInput.vertical)?.label ?? planInput.vertical,
    },
    {
      id: "review-event-date",
      term: "Date",
      value: new Date(planInput.eventDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    },
    { id: "review-guest-count", term: "Guest count", value: `${planInput.guestCount} guests` },
    {
      id: "review-budget",
      term: "Budget",
      value: formatMoney(planInput.budgetTotalCents, planInput.currency),
    },
    {
      id: "review-priorities",
      term: "Priorities",
      value: priorities.join(", ") || "None selected",
    },
  ];

  return (
    <div className="space-y-6">
      <header className="text-center">
        <StepTitle>Review your event</StepTitle>
        <p className="mt-2 text-muted-foreground">
          Check your answers, then create your plan. Nothing is saved until you create it.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Event summary</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            {rows.map((row) => (
              <div key={row.id} className="rounded-xl border border-border bg-background p-4">
                <dt className="text-sm text-muted-foreground">{row.term}</dt>
                <dd id={row.id} className="mt-1 font-medium text-foreground">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

export default OnboardingWizard;
