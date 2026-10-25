import type { Task, Vertical } from "@/lib/genai/schemas";

/**
 * Timeline templates and contingency rules (v2 spec §2.2): base countdown
 * offsets per vertical plus the context-aware triggers (outdoor → rain/backup
 * tasks, tight runway → compressed-planning task). Pure data — the engine in
 * `lib/rules-engine/timeline.ts` clamps, deduplicates and sorts.
 */

export interface TaskTemplate {
  title: string;
  offsetDays: number;
  phase: Task["phase"];
}

/** Base countdown templates per vertical (T-0 = event day). */
export const TIMELINE_TEMPLATES: Record<Vertical, ReadonlyArray<TaskTemplate>> = {
  wedding: [
    { title: "Set overall budget and guest list", offsetDays: 365, phase: "planning" },
    { title: "Shortlist and tour venues", offsetDays: 300, phase: "booking" },
    { title: "Book venue and sign contract", offsetDays: 270, phase: "booking" },
    { title: "Book caterer and schedule tasting", offsetDays: 240, phase: "booking" },
    { title: "Book photographer/videographer", offsetDays: 210, phase: "booking" },
    { title: "Choose wedding party attire", offsetDays: 180, phase: "booking" },
    { title: "Book entertainment (DJ/band)", offsetDays: 150, phase: "booking" },
    { title: "Send save-the-dates", offsetDays: 120, phase: "promotion" },
    { title: "Finalize décor and floral plan", offsetDays: 90, phase: "planning" },
    { title: "Send invitations", offsetDays: 60, phase: "promotion" },
    { title: "Confirm final headcount with caterer", offsetDays: 14, phase: "execution" },
    { title: "Confirm vendor arrival times", offsetDays: 7, phase: "execution" },
    { title: "Ceremony and reception", offsetDays: 0, phase: "execution" },
    { title: "Send thank-you notes", offsetDays: 0, phase: "post_event" },
  ],
  birthday: [
    { title: "Set budget and finalize guest list", offsetDays: 42, phase: "planning" },
    { title: "Book venue or confirm home setup", offsetDays: 30, phase: "booking" },
    { title: "Order cake", offsetDays: 21, phase: "booking" },
    { title: "Send invitations", offsetDays: 14, phase: "promotion" },
    { title: "Plan menu and order supplies", offsetDays: 10, phase: "planning" },
    { title: "Confirm entertainment activities", offsetDays: 7, phase: "booking" },
    { title: "Prepare decorations and party favors", offsetDays: 3, phase: "execution" },
    { title: "Birthday celebration", offsetDays: 0, phase: "execution" },
    { title: "Share photos and thank guests", offsetDays: 0, phase: "post_event" },
  ],
  community: [
    { title: "Form planning committee and set budget", offsetDays: 90, phase: "planning" },
    { title: "Secure venue and permits", offsetDays: 75, phase: "booking" },
    { title: "Confirm sponsors and vendors", offsetDays: 60, phase: "booking" },
    { title: "Open volunteer registration", offsetDays: 45, phase: "promotion" },
    { title: "Launch promotion and outreach", offsetDays: 30, phase: "promotion" },
    { title: "Confirm run-of-show and logistics", offsetDays: 14, phase: "planning" },
    { title: "Volunteer briefing and setup prep", offsetDays: 3, phase: "execution" },
    { title: "Community event day", offsetDays: 0, phase: "execution" },
    { title: "Publish recap and thank sponsors", offsetDays: 0, phase: "post_event" },
  ],
};

/**
 * Context-aware contingency triggers (docs/PRD.md personalization):
 * - outdoor event → rain/backup tasks
 * - tight runway (< 14 days) → compressed-planning task
 */
export function contingencyTasks(
  isOutdoor: boolean,
  runwayDays: number,
): ReadonlyArray<TaskTemplate> {
  const extra: TaskTemplate[] = [];
  if (isOutdoor) {
    extra.push(
      {
        title: "Check weather forecast and confirm rain backup plan",
        offsetDays: 3,
        phase: "planning",
      },
      { title: "Rent tent/cover if rain risk > 30%", offsetDays: 7, phase: "booking" },
    );
  }
  if (runwayDays < 14) {
    extra.push({
      title: "Compress planning: confirm all must-haves today",
      offsetDays: 1,
      phase: "planning",
    });
  }
  return extra;
}
