import Link from "next/link";
import { Suspense } from "react";
import { PlanDashboard } from "@/components/planner/plan-dashboard";
import { Button } from "@/components/ui/button";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Dashboard route (Phases.md 3.4). Next.js 16 with cacheComponents: `params`
 * is runtime URL data, so it is read inside a Server Component behind a
 * `<Suspense>` boundary (App Shell pattern) — the URL-independent shell
 * prerenders and the param-specific dashboard streams in per request.
 *
 * There is no database in v1: the plan itself lives in the client store, so
 * the server only validates the URL shape; after hydration the dashboard
 * degrades to a "create a plan" state when the id is unknown.
 */
function InvalidPlanLink() {
  return (
    <main id="main-content" className="grid flex-1 place-items-center p-8">
      <div className="grid max-w-[46ch] justify-items-center gap-3 text-center">
        <h1 className="text-lg font-semibold">Invalid plan link</h1>
        <p className="text-sm text-muted-foreground">
          Plan ids are UUIDs produced at generation time.
        </p>
        <Button asChild>
          <Link href="/">Create a plan</Link>
        </Button>
      </div>
    </main>
  );
}

async function PlanContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return <InvalidPlanLink />;
  return <PlanDashboard planId={id} />;
}

export default function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <div role="status" aria-live="polite" className="p-8 text-sm text-muted-foreground">
          Loading plan…
        </div>
      }
    >
      <PlanContent params={params} />
    </Suspense>
  );
}

export async function generateMetadata(): Promise<{ title: string }> {
  return { title: "Your event plan — Event Planner" };
}
