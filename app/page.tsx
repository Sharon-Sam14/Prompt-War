import { LandingPage } from "@/components/landing-page";

/**
 * `/` is the landing shell only — no form, no wizard. Two creation surfaces
 * exist beside it (Memory D47): `/create` (date-aware `EventSetupForm`, the
 * E2E-covered route, no nav entry — owner direction 2026-10-27) and
 * `/onboarding` (5-step wizard, the landing CTAs' target).
 */

export default function Home() {
  return <LandingPage />;
}
