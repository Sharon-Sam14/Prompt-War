import { randomUUID } from "node:crypto";
import type { Task, Vertical } from "@/lib/genai/schemas";
import { TIMELINE_TEMPLATES, contingencyTasks, type TaskTemplate } from "@/lib/config/timeline";

// Re-exported for API stability: tests and docs reference the engine module.
export { TIMELINE_TEMPLATES };
export type { TaskTemplate };

/**
 * Reverse countdown timeline (docs/PRD.md FR-3).
 * Pure TypeScript: every due date is `eventDate − offsetDays`. The engine guarantees
 * dueDate ≤ eventDate and clamps/trims tasks that don't fit the available runway.
 */

const DAY_MS = 86_400_000;

/** Days between now and the event (minimum 0). */
export function runwayDays(eventDate: string): number {
  const diff = new Date(eventDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / DAY_MS));
}

/** Absolute due date for an offset: `eventDate − offsetDays` at local noon (avoids TZ drift). */
export function dueDateFor(eventDate: string, offsetDays: number): string {
  const event = new Date(eventDate);
  const due = new Date(event.getTime() - offsetDays * DAY_MS);
  return due.toISOString();
}

/**
 * Build the full timeline: base templates + contingency tasks, clamped to the
 * available runway (a T-270 venue task is meaningless for a 14-day runway — it
 * collapses to T-runway so it becomes "as soon as possible"), deduplicated by
 * (title, offsetDays), and sorted T-365 → T-0.
 */
export function buildTimeline(
  vertical: Vertical,
  eventDate: string,
  options: { isOutdoor?: boolean } = {},
): Task[] {
  const runway = runwayDays(eventDate);
  if (runway === 0) throw new Error("eventDate must be in the future");

  const templates = [
    ...TIMELINE_TEMPLATES[vertical],
    ...contingencyTasks(options.isOutdoor === true, runway),
  ];

  const seen = new Set<string>();
  const tasks: Task[] = [];

  for (const t of templates) {
    // Clamp to runway: anything past "now" becomes due at max offset (T-runway = today-ish).
    const effectiveOffset = Math.min(t.offsetDays, runway);
    const key = `${t.title.toLowerCase()}|${effectiveOffset}`;
    if (seen.has(key)) continue;
    seen.add(key);

    tasks.push({
      id: randomUUID(),
      title: t.title,
      dueDate: dueDateFor(eventDate, effectiveOffset),
      offsetDays: effectiveOffset,
      phase: t.phase,
      done: false,
    });
  }

  return tasks.sort((a, b) => b.offsetDays - a.offsetDays || a.title.localeCompare(b.title));
}

/** Merge LLM-proposed tasks (title/offset/phase only) into an engine-built timeline. */
export function mergeTasks(
  eventDate: string,
  base: Task[],
  proposals: ReadonlyArray<{ title: string; offsetDays: number; phase: Task["phase"] }>,
  maxExtra = 40,
): Task[] {
  const runway = runwayDays(eventDate);
  const seen = new Set(base.map((t) => `${t.title.toLowerCase()}|${t.offsetDays}`));
  const merged = [...base];

  for (const p of proposals) {
    if (merged.length - base.length >= maxExtra) break;
    const offset = Math.min(p.offsetDays, runway);
    const key = `${p.title.toLowerCase()}|${offset}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({
      id: randomUUID(),
      title: p.title,
      dueDate: dueDateFor(eventDate, offset),
      offsetDays: offset,
      phase: p.phase,
      done: false,
    });
  }

  return merged.sort((a, b) => b.offsetDays - a.offsetDays || a.title.localeCompare(b.title));
}
