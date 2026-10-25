"use client";

import { CircleCheck, Clock } from "lucide-react";
import { useMemo, useState } from "react";
import { Reveal } from "@/components/motion/reveal";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDate } from "@/lib/format";
import { usePlannerStore } from "@/lib/store/use-planner-store";
import type { Task } from "@/lib/genai/schemas";

/**
 * Reverse-countdown timeline (Phases.md 3.6). Engine computes every date;
 * this view only presents and mutates `done`. Keyboard model: roving tabindex —
 * ↑/↓ move, Home/End jump, Space/Enter toggles completion (WCAG 2.1.1).
 * Spec §1.2: grouped by phase under serif headings; lists over 30 items are
 * paged ("Show all" reveals the rest) so long runways stay scannable.
 */

const PHASE_LABEL: Record<Task["phase"], string> = {
  planning: "Planning",
  booking: "Booking",
  promotion: "Promotion",
  execution: "Execution",
  post_event: "Post-event",
};

/** Page size for long timelines (v2 §1.2: >30 items paginated). */
const TIMELINE_PAGE = 30;

interface TimelineState {
  chip: "overdue" | "soon" | "open" | "done";
  chipLabel: string;
}

function taskState(task: Task): TimelineState {
  if (task.done) return { chip: "done", chipLabel: "Done" };
  const daysLeft = Math.ceil((new Date(task.dueDate).getTime() - Date.now()) / 86_400_000);
  if (daysLeft < 0) return { chip: "overdue", chipLabel: "Overdue" };
  if (daysLeft <= 7) return { chip: "soon", chipLabel: "Due soon" };
  return { chip: "open", chipLabel: "Open" };
}

const CHIP_CLASS: Record<TimelineState["chip"], string> = {
  overdue: "border-transparent bg-destructive/10 text-danger-text",
  soon: "border-transparent bg-accent-b/15 text-accent-b-text",
  open: "border-transparent bg-muted text-muted-foreground",
  done: "border-transparent bg-success/15 text-success-text",
};

/** Group visible tasks by phase, buckets ordered by first appearance in the date sort. */
function groupByPhase(tasks: Task[]): Array<{ phase: Task["phase"]; tasks: Task[] }> {
  const order: Task["phase"][] = [];
  const byPhase = new Map<Task["phase"], Task[]>();
  for (const task of tasks) {
    const bucket = byPhase.get(task.phase);
    if (bucket) {
      bucket.push(task);
    } else {
      byPhase.set(task.phase, [task]);
      order.push(task.phase);
    }
  }
  return order.flatMap((phase) => {
    const bucket = byPhase.get(phase);
    return bucket ? [{ phase, tasks: bucket }] : [];
  });
}

export function TimelineView({ tasks }: { tasks: Task[] }) {
  const toggleTask = usePlannerStore((s) => s.toggleTask);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showAll, setShowAll] = useState(false);

  // Newest-due first: far-out items on top, event day at the bottom.
  const sorted = useMemo(
    () => [...tasks].sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()),
    [tasks],
  );

  const doneCount = tasks.filter((t) => t.done).length;

  const renderGroups = useMemo(() => {
    const sliced = showAll ? sorted : sorted.slice(0, TIMELINE_PAGE);
    let index = 0;
    return groupByPhase(sliced).map((group) => ({
      phase: group.phase,
      items: group.tasks.map((task) => ({ task, index: index++ })),
    }));
  }, [sorted, showAll]);

  const totalItems = renderGroups.reduce((n, g) => n + g.items.length, 0);
  const hiddenCount = sorted.length - totalItems;

  function toggleExpand() {
    const next = !showAll;
    setShowAll(next);
    if (!next) setActiveIndex((i) => Math.min(i, TIMELINE_PAGE - 1));
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    const last = totalItems - 1;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((i) => Math.min(last, i + 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(last);
        break;
      default:
        break;
    }
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        <CircleCheck aria-hidden="true" className="mr-1 inline size-3.5" />
        {doneCount} of {tasks.length} tasks complete · dates are engine-computed backwards from your
        event day
      </p>

      <Reveal as="div" className="grid gap-5" stagger={30} onKeyDown={onKeyDown}>
        {renderGroups.map((group) => (
          <section key={group.phase} className="grid gap-1">
            <h3 className="display flex items-center gap-3 text-sm font-semibold text-muted-foreground">
              {PHASE_LABEL[group.phase]}
              <span aria-hidden="true" className="h-px flex-1 bg-border" />
            </h3>
            <ol className="grid gap-0">
              {group.items.map(({ task, index }) => {
                const state = taskState(task);
                const active = index === activeIndex;
                return (
                  <li
                    key={task.id}
                    tabIndex={active ? 0 : -1}
                    data-active={active || undefined}
                    onFocus={() => setActiveIndex(index)}
                    className="group relative flex items-start gap-3 border-b border-border py-2.5 pl-6 outline-none last:border-b-0 data-[active]:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring/60"
                  >
                    {/* Countdown rail dot */}
                    <span
                      aria-hidden="true"
                      className={`absolute top-4 left-1.5 size-2 rounded-full ${
                        task.done
                          ? "bg-success"
                          : state.chip === "overdue"
                            ? "bg-destructive"
                            : "bg-accent-a"
                      }`}
                    />
                    <Checkbox
                      id={`task-${task.id}`}
                      checked={task.done}
                      onCheckedChange={() => toggleTask(task.id)}
                      className="mt-0.5"
                    />
                    <div className="grid min-w-0 flex-1 gap-1">
                      <label
                        htmlFor={`task-${task.id}`}
                        className={`cursor-pointer text-sm font-medium ${
                          task.done ? "text-muted-foreground line-through" : ""
                        }`}
                      >
                        {task.title}
                      </label>
                      <p className="text-xs text-muted-foreground">
                        <Clock aria-hidden="true" className="mr-1 inline size-3" />
                        {formatDate(task.dueDate)} · T−{task.offsetDays} day
                        {task.offsetDays === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        {PHASE_LABEL[task.phase]}
                      </Badge>
                      <Badge className={CHIP_CLASS[state.chip]}>
                        {state.chip === "overdue" && (
                          <span
                            aria-hidden="true"
                            className="mr-1 size-1.5 rounded-full bg-destructive"
                          />
                        )}
                        {state.chipLabel}
                        <span className="sr-only">
                          {" "}
                          — due {formatDate(task.dueDate)},{" "}
                          {task.done ? "completed" : "not completed"}
                        </span>
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </Reveal>

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={toggleExpand}
          className="eyebrow justify-self-start rounded-md border border-border px-3 py-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70"
        >
          Show all {sorted.length} tasks ({hiddenCount} more)
        </button>
      )}
      {showAll && sorted.length > TIMELINE_PAGE && (
        <button
          type="button"
          onClick={toggleExpand}
          className="eyebrow justify-self-start rounded-md border border-border px-3 py-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70"
        >
          Show first {TIMELINE_PAGE} tasks
        </button>
      )}
    </div>
  );
}
