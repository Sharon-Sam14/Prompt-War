import { Reveal } from "@/components/motion/reveal";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Landing shell for `/` (Design.md §3 + §4.10, user brief 2026-10-24).
 *
 * Server component: nav + hero + features + how-it-works + footer, with the
 * date-aware setup form passed in as `children` (its Suspense boundary lives
 * in `app/page.tsx`). Every nav item is a real in-page anchor — no dead
 * PRICING/SIGN IN entries (anti-slop: fake UI is slop); the honest
 * "local-first — no account" chip sits in the utility cluster instead.
 * All color via tokens; no inline hex anywhere.
 */

const NAV_LINKS = [
  { href: "#top", label: "Home", current: true },
  { href: "#features", label: "Features", current: false },
  { href: "#how-it-works", label: "How it works", current: false },
  { href: "#create", label: "Create event", current: false },
] as const;

const FEATURES = [
  {
    title: "Deterministic Budget Ledger",
    body: "Integer-cents allocation across categories with planned-vs-actual variance and a running reserve — the engine prices it, the model never touches a number.",
    preview: "CATERING · $1,850 · 37% · reserve 8%",
  },
  {
    title: "Reverse Timeline Matrix",
    body: "Every task dated backwards from the event (T−12 months to day-of), clamped to your runway, with urgent milestones surfaced first.",
    preview: "T−120 BOOK VENUE · T−45 SEND INVITES",
  },
  {
    title: "Vendor Operations Checklist",
    body: "Per-vertical vendor categories, inquiry questions and document trackers — status from first contact to booked, with the next move named.",
    preview: "☑ CATERER BOOKED · ☐ VENUE — QUOTED",
  },
] as const;

const STEPS = [
  {
    title: "Curate details",
    body: "Set budget, date, and cultural preferences — mirrored against the same Zod schema on the client and the server.",
    preview: "wedding · 100 guests · $5,000 · T−180d",
  },
  {
    title: "Deterministic & AI engine",
    body: "Automated ledger math paired with GenAI creative concepts — the numbers never come from the model.",
    preview: "8 categories · 14 tasks · reserve 8%",
  },
  {
    title: "Live execution dashboard",
    body: "Track vendors, the reverse T−minus timeline, and budget reallocation in one plan.",
    preview: "ledger ✓ timeline ✓ vendors ✓ exports ✓",
  },
] as const;

export function LandingPage({ children }: { children: React.ReactNode }) {
  return (
    <div id="top" className="flex flex-1 flex-col">
      {/* Top nav — solid background (no blur/glass), hairline bottom (§4.10) */}
      <nav aria-label="Site" className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-8">
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
                  className={`eyebrow border-b-2 pb-0.5 text-xs transition-colors ${
                    link.current
                      ? "border-gilt text-foreground"
                      : "border-transparent text-muted-foreground hover:border-gilt/50 hover:text-foreground"
                  }`}
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
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <main id="main-content" className="flex flex-1 flex-col">
        {/* Hero */}
        <section aria-labelledby="hero-title" className="border-b border-border">
          <div className="mx-auto grid max-w-6xl justify-items-center gap-5 px-4 py-16 text-center sm:px-8 sm:py-24">
            <p className="eyebrow text-gilt-text">GenAI Celebration &amp; Event Planner</p>
            <Reveal
              as="h1"
              id="hero-title"
              trigger="mount"
              className="display max-w-[22ch] text-4xl leading-tight font-semibold sm:text-6xl"
            >
              Bespoke Event Planning Engine
            </Reveal>
            <div className="rule-gilt w-full max-w-md" aria-hidden="true">
              <span>❦</span>
            </div>
            <p className="max-w-[58ch] text-base text-muted-foreground">
              A GenAI celebration and logistics planner for weddings, birthdays, and community
              gatherings.
            </p>
            <a
              href="#create"
              className="eyebrow mt-2 inline-flex items-center gap-2 rounded-md border border-gilt px-6 py-3 text-xs font-medium text-gilt-text transition-colors hover:bg-gilt/10 focus-visible:ring-2 focus-visible:ring-ring/70"
            >
              Curate your event
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </section>

        {/* Feature grid */}
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

        {/* How it works — 3 numbered steps with mono input-preview boxes */}
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
            <Reveal as="ol" stagger={60} className="grid gap-4 sm:grid-cols-3">
              {STEPS.map((step, i) => (
                <li
                  key={step.title}
                  className="grid gap-2 rounded-lg border border-border bg-card p-5"
                >
                  <span aria-hidden="true" className="display text-lg font-semibold text-gilt-text">
                    {i + 1}
                  </span>
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

        {/* The product: date-aware setup form (Suspense lives in page.tsx) */}
        {children}
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:px-8">
          <p>
            <span aria-hidden="true">❦</span> GenAI Celebration &amp; Event Planner
          </p>
          <p>Local-first — no account; your plan stays in this browser.</p>
          <p>Budget math is engine-verified — the model never touches the numbers.</p>
          <p className="w-full border-t border-border pt-3 text-xs text-muted-foreground">
            Estimates and vendor suggestions are planning guidance, not quotes. Confirm prices and
            availability with vendors.
          </p>
        </div>
      </footer>
    </div>
  );
}
