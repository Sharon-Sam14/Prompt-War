import { IDEA_TEMPLATES } from "@/lib/config/ideas";
import type { Idea, PlanInput } from "@/lib/genai/schemas";

/** Build a guaranteed personalized idea set without I/O or model access. */
export function buildIdeas(input: PlanInput): Idea[] {
  const context = {
    theme: input.theme,
    culturalNotes: input.culturalNotes,
    guestCount: input.guestCount,
  };
  const personalized = Boolean(input.theme || input.culturalNotes);
  const perGuestCents = input.guestCount > 0 ? input.budgetTotalCents / input.guestCount : 0;

  return IDEA_TEMPLATES.flatMap((template, index) => {
    if (template.vertical !== "all" && template.vertical !== input.vertical) return [];
    const include =
      template.when === "always" ||
      (template.when === "micro" && (input.budgetBand === "micro" || perGuestCents < 5_000)) ||
      (template.when === "outdoor" && input.isOutdoor) ||
      (template.when === "large" && input.guestCount >= 150) ||
      (template.when === "personalized" && personalized);
    if (!include) return [];

    return [
      {
        id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        title: template.title,
        rationale: template.rationale(context),
        tags: [...template.tags],
        source: "rules" as const,
      },
    ];
  }).slice(0, 6);
}
