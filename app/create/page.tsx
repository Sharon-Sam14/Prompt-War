import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { connection } from "next/server";
import { EventSetupForm } from "@/components/forms/event-setup-form";
import { AuroraBackground } from "@/components/ui/aurora-background";

/**
 * `/create` — the event setup form on its own route (owner direction 2026-10-27:
 * "create event on completely different page rather than on landing page").
 *
 * The form's defaults depend on the current date (min = tomorrow, default =
 * today + 180 days), which Next 16's cacheComponents forbids during prerender.
 * `await connection()` opts the whole route into per-request rendering and
 * `instant = false` sanctions the blocking render (no `<Suspense>` shell), so
 * there is no streamed fallback to get stranded and no duplicated hidden copy
 * of the form in the DOM.
 */
export const instant = false;

export default async function CreatePage() {
  await connection();

  return (
    <AuroraBackground className="min-h-screen flex flex-col">
      <header className="w-full max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Back to Home
        </Link>
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="display grid size-8 place-items-center rounded-lg border border-rose/30 bg-wine-deep/50 text-sm leading-none text-rose"
          >
            ❦
          </span>
          <span className="grid text-right leading-tight">
            <span className="display text-sm font-semibold">Create event</span>
            <span className="eyebrow text-[10px] text-muted-foreground">Planning studio</span>
          </span>
        </div>
      </header>

      <main id="main-content" className="flex-1">
        <EventSetupForm />
      </main>
    </AuroraBackground>
  );
}
