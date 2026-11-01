import { formatDate, formatMoney } from "@/lib/format";
import type { AskContext, Plan } from "@/lib/genai/schemas";

/**
 * Deterministic assistant responder (Design.md §4.9, Phases 4.7).
 *
 * Answers come ONLY from the plan snapshot — every figure it quotes exists in
 * the context, so a keyless install can never hallucinate a number. Keyword
 * routing is intentionally conservative: when nothing matches, it says what it
 * can answer instead of guessing. This module is pure (no I/O, no clock reads
 * beyond formatDate of provided dates) and unit-tested directly.
 */

/** Build the client-side snapshot from a hydrated plan. */
export function buildAskContext(plan: Plan, savedIdeaIds: readonly string[] = []): AskContext {
  const saved = new Set(savedIdeaIds);
  return {
    vertical: plan.input.vertical,
    eventDate: plan.input.eventDate,
    guestCount: plan.input.guestCount,
    budgetTotalCents: plan.input.budgetTotalCents,
    currency: plan.input.currency,
    budgetBand: plan.input.budgetBand,
    theme: plan.input.theme,
    location: plan.input.location,
    isOutdoor: plan.input.isOutdoor,
    contingencyPct: plan.budget.contingencyPct,
    categories: plan.budget.categories.map((c) => ({
      label: c.label,
      plannedCents: c.plannedCents,
      actualCents: c.actualCents,
    })),
    tasks: plan.timeline.map((t) => ({
      title: t.title,
      dueDate: t.dueDate,
      offsetDays: t.offsetDays,
      done: t.done,
    })),
    vendors: plan.checklist.flatMap((c) =>
      c.items.map((i) => ({ category: c.category, label: i.label, status: i.status })),
    ),
    ideaTitles: plan.ideas.map((i) => i.title),
    savedIdeaTitles: plan.ideas.filter((i) => saved.has(i.id)).map((i) => i.title),
  };
}

const word = (w: string): RegExp => new RegExp(`\\b${w}\\b`, "i");
const has = (q: string, ...re: RegExp[]): boolean => re.some((r) => r.test(q));

function moneyWords(q: string): boolean {
  return has(
    q,
    word("budget"),
    word("cost"),
    word("costs"),
    word("spend"),
    word("spending"),
    word("money"),
    word("much"),
    word("afford"),
    word("allocat"),
    word("share"),
    word("percent"),
    word("reserve"),
    word("contingency"),
    word("price"),
    word("pricing"),
  );
}

function timelineWords(q: string): boolean {
  return has(
    q,
    word("next"),
    word("upcoming"),
    word("when"),
    word("due"),
    word("deadline"),
    word("timeline"),
    word("schedule"),
    word("soon"),
    word("urgent"),
    word("overdue"),
    word("week"),
    word("countdown"),
    word("t-minus"),
  );
}

function progressWords(q: string): boolean {
  return (
    (has(
      q,
      word("progress"),
      word("left"),
      word("remaining"),
      word("done"),
      word("complete"),
      word("finished"),
    ) &&
      has(q, word("task"), word("vendor"), word("checklist"), word("todo"))) ||
    has(q, word("progress")) ||
    /^how many\b/i.test(q.trim())
  );
}

/** Engine-computed derived figures — handed to the LLM so it never computes. */
export function deriveFacts(ctx: AskContext): string[] {
  const money = (cents: number) => formatMoney(cents, ctx.currency);
  const open = ctx.tasks.filter((t) => !t.done);
  const done = ctx.tasks.length - open.length;
  const booked = ctx.vendors.filter((v) => v.status === "booked").length;
  const next = [...open].sort((a, b) => a.offsetDays - b.offsetDays)[0];
  const top = [...ctx.categories].sort((a, b) => b.plannedCents - a.plannedCents)[0];
  const perGuest = ctx.guestCount > 0 ? Math.round(ctx.budgetTotalCents / ctx.guestCount) : 0;

  return [
    `total_budget: ${money(ctx.budgetTotalCents)} (${ctx.budgetBand} band)`,
    `per_guest: ${money(perGuest)} across ${ctx.guestCount} guests`,
    `reserve: ${ctx.contingencyPct}% contingency`,
    `largest_category: ${top ? `${top.label} ${money(top.plannedCents)}` : "n/a"}`,
    `tasks: ${done} done, ${open.length} open of ${ctx.tasks.length}`,
    next
      ? `next_task: ${next.title} due ${formatDate(next.dueDate)} (T-${next.offsetDays}d)`
      : "next_task: none",
    `vendors: ${booked} booked of ${ctx.vendors.length}`,
    `ideas: ${ctx.ideaTitles.length}`,
    `is_outdoor: ${String(ctx.isOutdoor)}`,
  ];
}

/**
 * Route a question to a deterministic answer. Order matters: specific
 * (money + category) before general (budget), timeline before progress.
 */
export function answerFromPlan(question: string, ctx: AskContext): string {
  const q = question.trim().toLowerCase();
  const money = (cents: number) => formatMoney(cents, ctx.currency);
  const moneyRe = moneyWords(q);

  // 1) Greeting / capability question. (No "who": "who should I book" is vendor intent.)
  if (has(q, word("hello"), word("hi"), word("hey"), word("help"))) {
    return "I answer questions about this plan's budget, timeline and vendor checklist — for example: What's next? How much is catering? How many tasks are left?";
  }

  // 2) Guests / per-head spend.
  if (has(q, word("guest"), word("guests"), /per[- ]head/, /per[- ]guest/, word("headcount"))) {
    const perGuest = ctx.guestCount > 0 ? Math.round(ctx.budgetTotalCents / ctx.guestCount) : 0;
    return `You're planning for ${ctx.guestCount} guests — about ${money(perGuest)} of budget per guest (total ${money(ctx.budgetTotalCents)}).`;
  }

  // 3) A named category with money words → that row. (Specific beats general.)
  const category = ctx.categories.find((c) => q.includes(c.label.toLowerCase()));
  if (category && (moneyRe || has(q, word("about"), word("tell")))) {
    const share =
      ctx.budgetTotalCents > 0
        ? Math.round((category.plannedCents / ctx.budgetTotalCents) * 100)
        : 0;
    const actual =
      category.actualCents === null
        ? "no actuals recorded yet"
        : `actual ${money(category.actualCents)}`;
    return `${category.label} is planned at ${money(category.plannedCents)} (${share}% of budget), ${actual}.`;
  }

  // 4) Time questions → the reverse timeline's next open tasks.
  if (timelineWords(q)) {
    const open = ctx.tasks
      .filter((t) => !t.done)
      .sort((a, b) => a.offsetDays - b.offsetDays)
      .slice(0, 3);
    if (open.length === 0) return "Every task on the timeline is already done.";
    const list = open
      .map((t) => `${t.title} (${formatDate(t.dueDate)}, T−${t.offsetDays}d)`)
      .join("; ");
    return `Next up: ${list}.`;
  }

  // 5) Whole-budget questions.
  if (moneyRe) {
    const top = [...ctx.categories].sort((a, b) => b.plannedCents - a.plannedCents)[0];
    const actuals = ctx.categories.filter((c) => c.actualCents !== null);
    const actualSum = actuals.reduce((n, c) => n + (c.actualCents ?? 0), 0);
    const health =
      actuals.length === 0
        ? `reserve ${ctx.contingencyPct}% for contingencies`
        : actualSum > ctx.budgetTotalCents
          ? `actuals are over budget by ${money(actualSum - ctx.budgetTotalCents)}`
          : `actuals are under budget by ${money(ctx.budgetTotalCents - actualSum)}`;
    const topLine = top ? ` Largest line: ${top.label} at ${money(top.plannedCents)}.` : "";
    return `Your ${money(ctx.budgetTotalCents)} budget (${ctx.budgetBand} band) is fully allocated across ${ctx.categories.length} categories; ${health}.${topLine}`;
  }

  // 6) Progress.
  if (progressWords(q)) {
    const done = ctx.tasks.filter((t) => t.done).length;
    const booked = ctx.vendors.filter((v) => v.status === "booked").length;
    return `${done} of ${ctx.tasks.length} tasks done and ${booked} of ${ctx.vendors.length} vendors booked.`;
  }

  // 7) Vendors / booking.
  if (
    has(
      q,
      word("vendor"),
      word("vendors"),
      word("book"),
      word("booking"),
      word("supplier"),
      word("checklist"),
      word("contract"),
      word("deposit"),
    )
  ) {
    const counts: Record<string, number> = {};
    for (const v of ctx.vendors) counts[v.status] = (counts[v.status] ?? 0) + 1;
    const firstOpen = ctx.vendors.find((v) => v.status !== "booked");
    const summary = ["booked", "quoted", "contacted", "to_contact"]
      .filter((s) => counts[s])
      .map((s) => `${counts[s]} ${s.replace("_", " ")}`)
      .join(", ");
    const nudge = firstOpen
      ? ` Next: ${firstOpen.label} (${firstOpen.category}) is ${firstOpen.status.replace("_", " ")}.`
      : "";
    return `${ctx.vendors.length} vendors tracked — ${summary}.${nudge}`;
  }

  // 8) Weather / outdoor.
  if (has(q, word("rain"), word("weather"), word("outdoor"))) {
    if (!ctx.isOutdoor)
      return "This plan is marked indoor, so there are no weather-contingency tasks — you can still ask about the timeline or budget.";
    const weatherTasks = ctx.tasks.filter((t) => /weather|rain|outdoor|tent/i.test(t.title)).length;
    return `Your event is outdoor — the plan carries ${weatherTasks} weather-contingency task${weatherTasks === 1 ? "" : "s"} and keeps ${ctx.contingencyPct}% reserve for surprises.`;
  }

  // 9) Ideas / creative.
  if (
    has(
      q,
      word("idea"),
      word("ideas"),
      word("theme"),
      word("themes"),
      word("decor"),
      word("inspiration"),
      word("creative"),
    )
  ) {
    if (ctx.ideaTitles.length === 0) {
      return "This plan ran in engine-only mode, so there are no personalized ideas yet — budget, timeline and vendor answers still work. Add an API key to generate ideas.";
    }
    const saved = ctx.savedIdeaTitles ?? [];
    const example = saved[0] ?? ctx.ideaTitles[0];
    return saved.length > 0
      ? `${ctx.ideaTitles.length} personalized ideas, ${saved.length} of them saved by you — for example: “${example}”.`
      : `${ctx.ideaTitles.length} personalized ideas live in the Ideas tab — for example: “${example}”.`;
  }

  // 10) Honest fallback with concrete follow-ups.
  return "I can answer from this plan: budget and category shares, the next timeline tasks, vendor status, and per-guest spend. Try: What's next? How much is catering? How many tasks are left?";
}
