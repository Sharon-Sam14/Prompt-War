"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Reveal } from "@/components/motion/reveal";
import Link from "next/link";
import {
  Sparkles,
  Users,
  CalendarRange,
  Wallet,
  Store,
  ListChecks,
  Lightbulb,
  Download,
  ShieldCheck,
  WifiOff,
  HeartHandshake,
  FileDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { motion } from "motion/react";
import * as Accordion from "@radix-ui/react-accordion";

/**
 * Landing shell for `/` (Design.md §3 + §4.10, brand direction 2026-10-24).
 *
 * Client component (the NL prompt bar owns state + routing): nav + hero +
 * features + how-it-works + trust + dashboard preview + FAQ + footer. Every nav
 * item is a real in-page anchor — no dead PRICING/SIGN IN entries (anti-slop:
 * fake UI is slop), and the nav carries **no "Create event" entry** (owner
 * direction 2026-10-27): creation CTAs live in the prompt bar, the "Try"
 * chips and the vertical cards, all pointing at `/onboarding`. `/create` stays
 * as the direct, E2E-covered form route (URL-only). The honest "local-first —
 * no account" chip sits in the utility cluster instead. All color via tokens;
 * no inline hex anywhere.
 *
 * Brand: editorial warmth + product clarity, dark-only (owner direction
 * 2026-10-27). Vertical accents (wedding/wine, birthday/terracotta,
 * community/forest) on cards, chips, covers. Tonal gradients only where
 * contrast-proven. Display serif for headlines. SVG icons with `currentColor`.
 *
 * Motion: staggered fade-up on mount via Reveal, hover spring lifts on vertical
 * cards. All motion honors prefers-reduced-motion.
 */

const NAV_LINKS = [
  { href: "#top", label: "Home", current: true },
  { href: "#features", label: "Features", current: false },
  { href: "#how-it-works", label: "How it works", current: false },
] as const;

const FEATURES = [
  {
    title: "Deterministic Budget Ledger",
    body: "Integer-cents allocation across categories with planned-vs-actual variance and a running reserve — the engine prices it, the model never touches a number.",
    preview: "CATERING · $1,850 · 37% · reserve 8%",
    icon: (
      <svg
        className="w-6 h-6 text-accent-a"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M6 8h12" />
        <path d="M10 12h8" />
        <path d="M6 16h8" />
      </svg>
    ),
  },
  {
    title: "Reverse Timeline Matrix",
    body: "Every task dated backwards from the event (T−12 months to day-of), clamped to your runway, with urgent milestones surfaced first.",
    preview: "T−120 BOOK VENUE · T−45 SEND INVITES",
    icon: (
      <svg
        className="w-6 h-6 text-accent-a"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    title: "Vendor Operations Checklist",
    body: "Per-vertical vendor categories, inquiry questions and document trackers — status from first contact to booked, with the next move named.",
    preview: "☑ CATERER BOOKED · ☐ VENUE — QUOTED",
    icon: (
      <svg
        className="w-6 h-6 text-accent-a"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
] as const;

const STEPS = [
  {
    title: "Curate details",
    body: "Set budget, date, and cultural preferences — mirrored against the same Zod schema on the client and the server.",
    preview: "wedding · 100 guests · $5,000 · T−180d",
    icon: (
      <svg
        className="w-6 h-6 text-gilt"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    title: "Deterministic & AI engine",
    body: "Automated ledger math paired with GenAI creative concepts — the numbers never come from the model.",
    preview: "8 categories · 14 tasks · reserve 8%",
    icon: (
      <svg
        className="w-6 h-6 text-gilt"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
  },
  {
    title: "Live execution dashboard",
    body: "Track vendors, the reverse T−minus timeline, and budget reallocation in one plan.",
    preview: "ledger ✓ timeline ✓ vendors ✓ exports ✓",
    icon: (
      <svg
        className="w-6 h-6 text-gilt"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
] as const;

/** Capability callouts (Prompt 6 §3) — every one maps to a shipped feature. */
const CAPABILITIES = [
  { label: "Countdown & timeline", icon: CalendarRange },
  { label: "Budget planner", icon: Wallet },
  { label: "Guest-aware costs", icon: Users },
  { label: "Vendor management", icon: Store },
  { label: "Tasks & milestones", icon: ListChecks },
  { label: "Ideas & inspiration", icon: Lightbulb },
  { label: "Reports & exports", icon: Download },
] as const;

/** Guarantee strip — claims kept literally true (no purchase exists). */
const GUARANTEES = [
  {
    title: "Local-first",
    body: "Keyless mode needs no internet; plans stay in this browser.",
    icon: WifiOff,
  },
  {
    title: "100% private",
    body: "No account, no cloud sync, no tracking.",
    icon: ShieldCheck,
  },
  {
    title: "Import & export",
    body: "PDF, CSV, Markdown and JSON — move a plan anytime.",
    icon: FileDown,
  },
  {
    title: "Free & open source",
    body: "No subscription, no hidden fees.",
    icon: HeartHandshake,
  },
] as const;

const VERTICALS = [
  {
    value: "wedding",
    label: "Wedding",
    hint: "Ceremony + reception, 3–12 mo runway",
    accent: "rose-wine",
    illustration: (
      <svg
        className="w-12 h-12 text-accent-a"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ),
  },
  {
    value: "birthday",
    label: "Birthday",
    hint: "Party + vendors, 2–8 weeks runway",
    accent: "terracotta",
    illustration: (
      <svg
        className="w-12 h-12 text-accent-a"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M17 21v-6a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v6" />
        <path d="M12 3v4" />
        <path d="M8 21h8" />
        <ellipse cx="12" cy="3" rx="4" ry="1" />
        <path d="M12 7a4 4 0 0 0-4 4c0 1.5.8 2.8 2 3.5" />
        <path d="M12 7a4 4 0 0 1 4 4c0 1.5-.8 2.8-2 3.5" />
      </svg>
    ),
  },
  {
    value: "community",
    label: "Community",
    hint: "Public event, permits + safety",
    accent: "forest",
    illustration: (
      <svg
        className="w-12 h-12 text-accent-a"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
] as const;

const EXAMPLE_PROMPTS = [
  "150-person wedding in Mumbai, ₹12 lakh, February",
  "Kid's 7th birthday, ₹40k, October",
  "Ganesh festival for 300, ₹25k, December",
];

export function LandingPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const promptRef = useRef<HTMLInputElement>(null);

  const handleCurate = (textToSubmit?: string) => {
    const query = (textToSubmit ?? prompt).trim();
    if (!query) return;
    router.push(`/onboarding?prompt=${encodeURIComponent(query)}`);
  };

  return (
    <AuroraBackground className="min-h-screen">
      <div className="relative z-10">
        {/* Top nav — glassmorphic background with backdrop blur */}
        <nav aria-label="Site" className="sticky top-0 z-40 border-b border-border glass-panel">
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2 sm:px-8">
            <a
              href="#top"
              className="display shrink-0 text-sm font-semibold text-gilt-text hover:underline"
            >
              <span aria-hidden="true">❦</span> Event Planner
            </a>
            <span aria-hidden="true" className="hidden h-4 w-px bg-border sm:block" />
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    aria-current={link.current ? "page" : undefined}
                    className={
                      link.current
                        ? "eyebrow border-b-2 pb-0.5 text-xs transition-colors border-gilt text-foreground"
                        : "eyebrow border-b-2 pb-0.5 text-xs transition-colors border-transparent text-muted-foreground hover:border-gilt/50 hover:text-foreground"
                    }
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="ml-auto flex items-center gap-2">
              <span className="hidden rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground md:inline">
                Local-first — no account
              </span>
            </div>
          </div>
        </nav>

        <main id="main-content" className="flex flex-1 flex-col">
          {/* Hero — with Reveal staggered entries */}
          <section aria-labelledby="hero-title" className="border-b border-border">
            <div className="mx-auto grid max-w-6xl justify-items-center gap-5 px-4 py-12 text-center sm:px-8 sm:py-16">
              <Reveal as="p" className="eyebrow text-accent-a-text">
                Plan your entire event in one dashboard
              </Reveal>
              <Reveal
                as="h1"
                id="hero-title"
                trigger="mount"
                className="display max-w-[22ch] text-5xl lg:text-6xl xl:text-7xl font-semibold leading-tight tracking-tight sm:text-6xl"
              >
                Your celebration, handled
                <span className="animate-bounce inline-block text-gilt-text" aria-hidden="true">
                  ❦
                </span>
              </Reveal>

              <p className="mt-4 max-w-[62ch] text-base text-muted-foreground leading-relaxed">
                Plan your wedding, birthday, or community event — set a budget, get a deterministic
                plan, and manage it all in one workspace. No API key required. Keeps your data in
                your browser.
              </p>

              <ul
                aria-label="What the workspace covers"
                className="flex flex-wrap items-center justify-center gap-2"
              >
                {["Budget", "Guests", "Vendors", "Timeline", "Ideas & exports"].map((item) => (
                  <li
                    key={item}
                    className="rounded-full border border-rose/25 bg-wine-deep/30 px-3 py-1 text-[11px] tracking-[0.12em] text-accent-a-text uppercase"
                  >
                    {item}
                  </li>
                ))}
              </ul>

              {/* Interactive Natural Language Prompt Bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleCurate();
                }}
                className="glass-panel rounded-full flex items-center gap-2 p-2 border border-border/80 shadow-md focus-within:ring-2 focus-within:ring-primary/30 transition-all max-w-2xl mx-auto mt-8"
              >
                <Sparkles className="w-5 h-5 text-accent-a shrink-0 ml-2" aria-hidden="true" />
                <Input
                  ref={promptRef}
                  id="nl-prompt"
                  name="prompt"
                  type="search"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Plan a 150-person wedding in Mumbai, ₹12 lakh, February"
                  className="w-full flex-1 bg-transparent border-none outline-none text-sm md:text-base text-foreground placeholder:text-muted-foreground/60 py-2"
                  aria-label="Describe your event in plain language"
                />
                <Button
                  size="default"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-full shrink-0 gap-2 shadow-sm transition-all px-5"
                  type="submit"
                >
                  Curate
                </Button>
              </form>

              {/* Quick Chips */}
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
                <span className="font-semibold uppercase tracking-wider text-[10px]">Try:</span>
                {EXAMPLE_PROMPTS.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setPrompt(chip);
                      promptRef.current?.focus();
                    }}
                    className="px-3 py-1 rounded-full text-xs font-medium bg-secondary/20 hover:bg-secondary/40 text-foreground transition-all cursor-pointer border border-border/40 hover:border-accent-a/40"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Three verticals band — tall cards with accent, illustration, mini plan preview */}
              <div className="mt-10 max-w-6xl mx-auto grid gap-6 sm:grid-cols-3 pb-6">
                {VERTICALS.map((v) => (
                  <Link
                    key={v.value}
                    href={`/onboarding?vertical=${v.value}`}
                    className="group block"
                  >
                    <div
                      data-vertical={v.value}
                      className="event-card h-full focus-visible:ring-2 focus-visible:ring-ring/70"
                    >
                      <motion.div
                        whileHover={{
                          y: -6,
                          transition: { type: "spring", stiffness: 300, damping: 20 },
                        }}
                        className="relative h-full transition-all rounded-2xl p-5"
                      >
                        {/* Accent stripe on the left — a hover affordance, so it is
                            deliberately `opacity-0` at rest (marked so the motion
                            e2e can tell it apart from a stranded reveal). */}
                        <div
                          aria-hidden="true"
                          data-hover-affordance="true"
                          className="absolute left-0 top-0 bottom-0 w-0.5 bg-accent-a/20 opacity-0 group-hover:opacity-100 transition-all rounded-tl-2xl rounded-bl-2xl"
                        ></div>

                        <div className="relative flex flex-col h-full p-5">
                          <div className="mb-4">{v.illustration}</div>

                          <h4 className="text-lg font-semibold text-foreground mb-2">{v.label}</h4>
                          <p className="text-sm text-muted-foreground mb-4">{v.hint}</p>

                          {/* Mini plan preview — compact budget + 1 task */}
                          <div className="mt-auto p-4 rounded-xl bg-background/60 border border-border/60 text-sm">
                            <div className="flex justify-between items-baseline gap-2">
                              <span className="font-medium text-foreground text-sm whitespace-nowrap">
                                Sample plan
                              </span>
                              <span className="font-mono tnum text-xs font-semibold text-muted-foreground whitespace-nowrap">
                                Est. $4,800
                              </span>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                              {v.value === "wedding"
                                ? "100 guests · 12 categories · venue booked · caterer quoted"
                                : v.value === "birthday"
                                  ? "40 guests · 8 categories · venue searching · entertainment planned"
                                  : "80 guests · 10 categories · venue booked · RSVP 70%"}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          {/* Capability strip — seven callouts, each backed by a real panel */}
          <section
            id="capabilities"
            aria-labelledby="capabilities-title"
            className="scroll-mt-16 border-b border-border bg-card/30"
          >
            <div className="mx-auto grid max-w-6xl gap-5 px-4 py-10 sm:px-8">
              <div className="flex items-center gap-3">
                <Reveal as="h2" id="capabilities-title" className="eyebrow text-gilt-text">
                  Everything in one place
                </Reveal>
                <span aria-hidden="true" className="h-px flex-1 bg-border" />
              </div>
              <Reveal as="ul" stagger={50} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {CAPABILITIES.map((capability) => {
                  const Icon = capability.icon;
                  return (
                    <li
                      key={capability.label}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                    >
                      <span
                        aria-hidden="true"
                        className="grid size-9 shrink-0 place-items-center rounded-full border border-rose/25 bg-wine-deep/50 text-rose"
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="text-xs font-medium leading-snug">{capability.label}</span>
                    </li>
                  );
                })}
              </Reveal>
            </div>
          </section>

          {/* Feature grid with staggered Reveal */}
          <section
            id="features"
            aria-labelledby="features-title"
            className="scroll-mt-16 border-b border-border"
          >
            <div className="mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:px-8">
              <div className="flex items-center gap-3">
                <Reveal as="h2" id="features-title" className="eyebrow text-gilt-text">
                  Features
                </Reveal>
                <span aria-hidden="true" className="h-px flex-1 bg-border" />
              </div>
              <Reveal as="ul" stagger={60} className="grid gap-4 sm:grid-cols-3">
                {FEATURES.map((feature) => (
                  <li
                    key={feature.title}
                    className="grid gap-2 rounded-lg border border-border bg-card p-5"
                  >
                    <div className="mb-2 grid size-11 place-items-center rounded-full border border-rose/25 bg-wine-deep/50">
                      {feature.icon}
                    </div>
                    <h3 className="display text-lg font-semibold">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.body}</p>
                    <p className="tnum mt-1 rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground">
                      {feature.preview}
                    </p>
                  </li>
                ))}
              </Reveal>
            </div>
          </section>

          {/* How it works — 3 numbered steps with animated visuals */}
          <section
            id="how-it-works"
            aria-labelledby="how-title"
            className="scroll-mt-16 border-b border-border"
          >
            <div className="mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:px-8">
              <div className="flex items-center gap-3">
                <Reveal as="h2" id="how-title" className="eyebrow text-gilt-text">
                  How it works
                </Reveal>
                <span aria-hidden="true" className="h-px flex-1 bg-border" />
              </div>
              <Reveal as="ol" stagger={80} className="grid gap-4 sm:grid-cols-3">
                {STEPS.map((step, i) => (
                  <li
                    key={step.title}
                    className="grid gap-2 rounded-lg border border-border bg-card p-5"
                  >
                    <span
                      aria-hidden="true"
                      className="display text-lg font-semibold text-gilt-text"
                    >
                      {i + 1}
                    </span>
                    <div className="mb-2">{step.icon}</div>
                    <h3 className="display text-base font-semibold">{step.title}</h3>
                    <p className="text-xs text-muted-foreground">{step.body}</p>
                    <p className="tnum rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground">
                      {step.preview}
                    </p>
                  </li>
                ))}
              </Reveal>
            </div>
          </section>

          {/* Why you can trust the numbers — honest differentiator */}
          <section
            id="trust"
            aria-labelledby="trust-title"
            className="scroll-mt-16 border-b border-border bg-card/50"
          >
            <div className="mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:px-8">
              <div className="flex items-center gap-3">
                <Reveal as="h2" id="trust-title" className="eyebrow text-gilt-text">
                  Why you can trust the numbers
                </Reveal>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Card className="p-4">
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">
                      Rules engine owns the math
                    </CardTitle>
                  </CardHeader>
                  <CardDescription>
                    Every cent is computed by the deterministic rules engine. The LLM only suggests
                    percentages and offsets — the engine clamps, normalizes, and computes actual
                    amounts.
                  </CardDescription>
                </Card>

                <Card className="p-4">
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">No hidden costs</CardTitle>
                  </CardHeader>
                  <CardDescription>
                    Categories sum exactly to your total (largest-remainder rounding). No
                    double-counting. No hidden fees. What you see is what the engine computes.
                  </CardDescription>
                </Card>

                <Card className="p-4">
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">
                      Confidence through transparency
                    </CardTitle>
                  </CardHeader>
                  <CardDescription>
                    Source badge on every plan: Engine-only or Model-enriched. You always know where
                    the numbers came from.
                  </CardDescription>
                </Card>
              </div>
            </div>
          </section>

          {/* Real-UI dashboard preview (Prompt 5 §5) */}
          <section
            id="preview"
            aria-labelledby="preview-title"
            className="scroll-mt-16 border-b border-border"
          >
            <div className="mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:px-8">
              <div className="flex items-center gap-3">
                <Reveal as="h2" id="preview-title" className="eyebrow text-gilt-text">
                  Dashboard preview
                </Reveal>
                <span aria-hidden="true" className="h-px flex-1 bg-border" />
              </div>
              <Reveal
                as="figure"
                className="rounded-lg border border-border bg-card overflow-hidden"
              >
                <figcaption className="sr-only">
                  Screenshot of the event dashboard showing budget donut, timeline, vendor
                  checklist, and AI suggestions
                </figcaption>
                <div className="aspect-video bg-muted/50 flex items-center justify-center">
                  <div className="text-center p-8">
                    <div
                      className="mx-auto w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-4"
                      aria-hidden="true"
                    >
                      <svg
                        className="size-12 text-muted-foreground"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <rect
                          x="3"
                          y="3"
                          width="7"
                          height="7"
                          rx="1"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                        <rect
                          x="14"
                          y="3"
                          width="7"
                          height="7"
                          rx="1"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                        <rect
                          x="3"
                          y="14"
                          width="7"
                          height="7"
                          rx="1"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                        <rect
                          x="14"
                          y="14"
                          width="7"
                          height="7"
                          rx="1"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                      </svg>
                    </div>
                    <p className="font-medium text-foreground">Interactive dashboard</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Budget donut · Reverse timeline · Vendor checklist · AI copilot
                    </p>
                    <a
                      href="/onboarding"
                      className="mt-4 inline-flex items-center gap-1 text-sm text-gilt-text hover:underline"
                    >
                      Try it yourself →
                    </a>
                  </div>
                </div>
              </Reveal>
            </div>
          </section>

          {/* FAQ (Prompt 5 §5) — no pricing section per anti-slop contract */}
          <section
            id="faq"
            aria-labelledby="faq-title"
            className="scroll-mt-16 border-b border-border"
          >
            <div className="mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:px-8">
              <div className="flex items-center gap-3">
                <Reveal as="h2" id="faq-title" className="eyebrow text-gilt-text">
                  FAQ
                </Reveal>
                <span aria-hidden="true" className="h-px flex-1 bg-border" />
              </div>
              <Reveal as="div" stagger={60} className="grid gap-6 md:grid-cols-2 max-w-3xl">
                <Accordion.Root type="multiple" className="w-full space-y-3">
                  {[
                    {
                      q: "Do I need an API key to use this?",
                      a: "No. The app runs fully in keyless mode using a deterministic local planner. Add an OPENAI_API_KEY only if you want AI-enriched ideas and phrasing — the math stays engine-owned either way.",
                    },
                    {
                      q: "Is my data sent to a server?",
                      a: "Plans stay in this browser's localStorage; our app server does not store them. If you configure an OpenAI key, plan generation sends event type, date, guest count, budget, and optional preferences; the event name stays local. Assistant questions send a compact plan snapshot without the event name plus your recent messages. Avoid entering personal or sensitive details in free-text fields.",
                    },
                    {
                      q: "Can I export my plan?",
                      a: "Yes. One-click export to PDF, CSV, Markdown, or JSON. Exports are generated client-side from your plan — screen equals file by construction.",
                    },
                    {
                      q: "What event types are supported?",
                      a: "Weddings, birthdays, and community/festival events are first-class with distinct budgets, timelines, and vendor checklists. Corporate events work as a thin template.",
                    },
                    {
                      q: "How does the budget math work?",
                      a: "The rules engine allocates integer cents to categories using vertical- and guest-aware weights that sum exactly to your total (largest-remainder rounding). The LLM only suggests percentages — the engine computes every cent.",
                    },
                    {
                      q: "What does it look like?",
                      a: "One fixed dark theme — deep aubergine surfaces, wine and gilt accents — with a distinct accent per event type (wedding, birthday, community). There is no light mode; contrast is verified against WCAG AA by automated tests across every theme × vertical combination.",
                    },
                  ].map((faq, i) => (
                    <Accordion.Item key={i} value={`faq-${i}`}>
                      <Accordion.Header>
                        <Accordion.Trigger className="font-medium text-foreground text-sm hover:text-accent-a transition-colors">
                          {faq.q}
                        </Accordion.Trigger>
                      </Accordion.Header>
                      <Accordion.Content className="text-sm text-muted-foreground pb-3">
                        {faq.a}
                      </Accordion.Content>
                    </Accordion.Item>
                  ))}
                </Accordion.Root>
              </Reveal>
            </div>
          </section>

          {/* Guarantee strip — every claim literally true for this build */}
          <section
            id="guarantees"
            aria-labelledby="guarantees-title"
            className="border-b border-border bg-card/50"
          >
            <div className="mx-auto grid max-w-6xl gap-4 px-4 py-10 sm:px-8">
              <Reveal as="h2" id="guarantees-title" className="sr-only">
                Guarantees
              </Reveal>
              <Reveal as="ul" stagger={40} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {GUARANTEES.map((guarantee) => {
                  const Icon = guarantee.icon;
                  return (
                    <li key={guarantee.title} className="flex items-start gap-3">
                      <span
                        aria-hidden="true"
                        className="grid size-10 shrink-0 place-items-center rounded-full border border-rose/25 bg-wine-deep/50 text-rose"
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="grid gap-0.5">
                        <span className="text-sm font-medium">{guarantee.title}</span>
                        <span className="text-xs leading-snug text-muted-foreground">
                          {guarantee.body}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </Reveal>
            </div>
          </section>

          {/* Sticky footer with signature */}
          <footer className="border-t border-border">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:px-8">
              {/* Stationery signature — the only other script line on this page. */}
              <p className="script text-base">
                <span aria-hidden="true">❦</span> GenAI Celebration & Event Planner
              </p>
              <p>Local-first — no account; your plan stays in this browser.</p>
              <p>Budget math is engine-verified — the model never touches the numbers.</p>
              <p className="w-full border-t border-border pt-3 text-xs text-muted-foreground">
                Estimates and vendor suggestions are planning guidance, not quotes. Confirm prices
                and availability with vendors.
              </p>
            </div>
          </footer>
        </main>
      </div>
    </AuroraBackground>
  );
}
