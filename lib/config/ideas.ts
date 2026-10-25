import type { Vertical } from "@/lib/genai/schemas";

export interface IdeaTemplate {
  key: string;
  vertical: Vertical | "all";
  title: string;
  rationale: (context: { theme?: string; culturalNotes?: string; guestCount: number }) => string;
  tags: string[];
  when: "always" | "micro" | "outdoor" | "large" | "personalized";
}

/** Copy and selection rules for deterministic, context-aware ideas. */
export const IDEA_TEMPLATES: readonly IdeaTemplate[] = [
  {
    key: "wedding-guest-book",
    vertical: "wedding",
    title: "A shared story table",
    rationale: ({ theme }) =>
      `Invite guests to leave a short memory or wish${theme ? ` in a style that fits ${theme}` : ""}.`,
    tags: ["Personal touches", "Guest experience"],
    when: "always",
  },
  {
    key: "birthday-memory",
    vertical: "birthday",
    title: "Milestone memory cards",
    rationale: ({ theme }) =>
      `Collect a favorite story or hope for the year ahead${theme ? ` around your ${theme} theme` : ""}.`,
    tags: ["Personal touches", "Entertainment"],
    when: "always",
  },
  {
    key: "community-welcome",
    vertical: "community",
    title: "A neighborhood welcome board",
    rationale: ({ guestCount }) =>
      `Give the expected ${guestCount.toLocaleString()} attendees a clear place to find hosts, activities and accessibility information.`,
    tags: ["Guest experience", "Logistics"],
    when: "always",
  },
  {
    key: "micro-diy",
    vertical: "all",
    title: "Make one detail together",
    rationale: ({ culturalNotes }) =>
      `Choose one low-cost, hands-on detail${culturalNotes ? ` inspired by ${culturalNotes}` : " such as place cards or welcome signs"}; keep the remaining production simple.`,
    tags: ["DIY", "Budget"],
    when: "micro",
  },
  {
    key: "outdoor-weather",
    vertical: "all",
    title: "Prepare a clear rain-plan cue",
    rationale: () =>
      "Choose the indoor or covered backup location now and tell guests how they will hear about a weather change.",
    tags: ["Outdoor", "Contingency"],
    when: "outdoor",
  },
  {
    key: "large-flow",
    vertical: "all",
    title: "Set a simple arrival flow",
    rationale: ({ guestCount }) =>
      `For ${guestCount.toLocaleString()} guests, separate arrival, welcome and service points to reduce queues.`,
    tags: ["Guest experience", "Logistics"],
    when: "large",
  },
  {
    key: "personal-note",
    vertical: "all",
    title: "Carry your theme into one signature moment",
    rationale: ({ theme, culturalNotes }) =>
      `Use ${theme ? `“${theme}”` : "your chosen theme"}${culturalNotes ? ` and the traditions in “${culturalNotes}”` : ""} to shape a welcome, menu note or keepsake.`,
    tags: ["Personal touches"],
    when: "personalized",
  },
];
