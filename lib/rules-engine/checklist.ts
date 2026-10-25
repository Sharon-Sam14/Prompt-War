import { randomUUID } from "node:crypto";
import type { ChecklistCategory, Vertical } from "@/lib/genai/schemas";
import { TEMPLATES, contingencyCategories, type TemplateCategory } from "@/lib/config/checklist";

/**
 * Baseline vendor checklists per vertical (docs/PRD.md FR-4).
 * Pure TypeScript. Inquiry questions and required docs are deterministic content —
 * no LLM needed, no hallucinated vendor claims.
 */

function toItems(template: ReadonlyArray<TemplateCategory>): ChecklistCategory[] {
  return template.map((t) => ({
    category: t.category,
    items: t.items.map((i) => ({
      ...i,
      id: randomUUID(),
      status: "to_contact" as const,
    })),
  }));
}

/** Build the baseline checklist for a vertical with context-aware additions. */
export function buildChecklist(
  vertical: Vertical,
  options: { isOutdoor?: boolean; lowBudget?: boolean } = {},
): ChecklistCategory[] {
  return toItems([...TEMPLATES[vertical], ...contingencyCategories(options)]);
}
