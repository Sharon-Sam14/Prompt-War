import { Suspense } from "react";
import { connection } from "next/server";
import { EventSetupForm } from "@/components/forms/event-setup-form";
import { LandingPage } from "@/components/landing-page";

/**
 * The form's defaults depend on the current date (min = tomorrow, default
 * event = today + 180 days). With cacheComponents, `connection()` inside a
 * Suspense boundary is the sanctioned way to defer date-dependent rendering
 * to the request (Next 16: blocking-prerender-current-time) while the page
 * shell still prerenders statically.
 *
 * `/` renders the landing shell (Design.md §4.10) around the form: nav, hero,
 * features and how-it-works are static shell; only the form streams.
 */
async function DateAwareSetupForm() {
  await connection();
  return <EventSetupForm />;
}

export default function Home() {
  return (
    <LandingPage>
      <Suspense
        fallback={
          <div
            role="status"
            aria-live="polite"
            className="p-8 text-center text-sm text-muted-foreground"
          >
            Loading event setup…
          </div>
        }
      >
        <DateAwareSetupForm />
      </Suspense>
    </LandingPage>
  );
}
