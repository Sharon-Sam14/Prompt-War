import type { ChecklistItem, Vertical } from "@/lib/genai/schemas";

/**
 * Vendor checklist templates and contingency rules (v2 spec §2.2): per-vertical
 * categories with deterministic inquiry questions and required documents, plus
 * the low-budget (DIY) and outdoor (weather) contingency categories. Pure data —
 * `lib/rules-engine/checklist.ts` instantiates items with ids and status.
 */

export type TemplateItem = Omit<ChecklistItem, "id" | "status">;
export type TemplateCategory = { category: string; items: ReadonlyArray<TemplateItem> };

export const WEDDING_CHECKLIST: ReadonlyArray<TemplateCategory> = [
  {
    category: "Venue",
    items: [
      {
        label: "Tour venue and confirm capacity for guest count",
        questions: [
          "What is the maximum seated capacity?",
          "What is the cancellation and rain policy?",
          "Are there noise or end-time restrictions?",
        ],
        docs: ["Venue contract", "Insurance certificate", "Floor plan"],
      },
      {
        label: "Confirm deposit schedule and payment milestones",
        questions: ["What is the deposit amount?", "When are remaining payments due?"],
        docs: ["Payment schedule", "Itemized quote"],
      },
    ],
  },
  {
    category: "Catering",
    items: [
      {
        label: "Schedule menu tasting and finalize menu",
        questions: [
          "Can you accommodate dietary restrictions?",
          "Is service staff included?",
          "What is the per-head price including tax and service?",
        ],
        docs: ["Menu card", "Food safety license", "Per-head quote"],
      },
    ],
  },
  {
    category: "Photography",
    items: [
      {
        label: "Review portfolio and confirm shooting hours",
        questions: [
          "How many hours of coverage are included?",
          "When do we receive the edited gallery?",
          "Do you have a second shooter?",
        ],
        docs: ["Portfolio", "Contract with delivery timeline"],
      },
    ],
  },
  {
    category: "Décor & Florals",
    items: [
      {
        label: "Confirm setup window and delivery",
        questions: ["When can vendors access the space?", "Is breakdown included?"],
        docs: ["Setup schedule", "Quote"],
      },
    ],
  },
  {
    category: "Entertainment",
    items: [
      {
        label: "Confirm equipment, playlist boundaries, and timing",
        questions: [
          "Do you bring your own sound system?",
          "What is your backup plan for breakdown?",
        ],
        docs: ["Contract", "Set list / playlist plan"],
      },
    ],
  },
];

export const BIRTHDAY_CHECKLIST: ReadonlyArray<TemplateCategory> = [
  {
    category: "Venue",
    items: [
      {
        label: "Confirm booking, hours, and access",
        questions: ["Is the space private?", "What time can we start decorating?"],
        docs: ["Booking confirmation", "Rules sheet"],
      },
    ],
  },
  {
    category: "Cake & Catering",
    items: [
      {
        label: "Order cake and confirm delivery time",
        questions: ["What is the allergy policy?", "What flavors and designs are available?"],
        docs: ["Order receipt", "Allergen information"],
      },
      {
        label: "Finalize food order and headcount",
        questions: ["Is delivery included?", "What is the minimum order?"],
        docs: ["Itemized quote"],
      },
    ],
  },
  {
    category: "Entertainment",
    items: [
      {
        label: "Confirm games/music/performer booking",
        questions: ["How long is the session?", "What ages is it suited for?"],
        docs: ["Booking confirmation"],
      },
    ],
  },
  {
    category: "Décor & Supplies",
    items: [
      {
        label: "Buy decorations, tableware, and favors",
        questions: ["What is the color theme?", "How many tables?"],
        docs: ["Shopping list", "Receipt"],
      },
    ],
  },
];

export const COMMUNITY_CHECKLIST: ReadonlyArray<TemplateCategory> = [
  {
    category: "Venue & Permits",
    items: [
      {
        label: "Secure venue booking and required permits",
        questions: [
          "Which permits does the city require?",
          "Is a certificate of insurance needed?",
        ],
        docs: ["Venue contract", "Event permit", "Insurance certificate"],
      },
    ],
  },
  {
    category: "Sponsors & Vendors",
    items: [
      {
        label: "Confirm sponsorships and in-kind donations",
        questions: ["What recognition do sponsors receive?", "What are the donation boundaries?"],
        docs: ["Sponsorship agreement", "Donation log"],
      },
      {
        label: "Book vendors (AV, stage, sanitation)",
        questions: ["Is setup and teardown included?", "Do you provide technicians?"],
        docs: ["Vendor quotes", "Contracts"],
      },
    ],
  },
  {
    category: "Volunteers",
    items: [
      {
        label: "Recruit and assign volunteer roles",
        questions: ["How many volunteers per station?", "Is training required?"],
        docs: ["Volunteer roster", "Role sheet"],
      },
    ],
  },
  {
    category: "Safety & Compliance",
    items: [
      {
        label: "Confirm first-aid and emergency contact plan",
        questions: ["Is a first-aid team on site?", "What is the emergency evacuation route?"],
        docs: ["Emergency plan", "First-aid kit checklist"],
      },
    ],
  },
];

export const TEMPLATES: Record<Vertical, ReadonlyArray<TemplateCategory>> = {
  wedding: WEDDING_CHECKLIST,
  birthday: BIRTHDAY_CHECKLIST,
  community: COMMUNITY_CHECKLIST,
};

/**
 * Context-aware contingency items (docs/PRD.md): low budget → DIY vendor template;
 * outdoor event → weather/logistics items.
 */
export function contingencyCategories(options: {
  isOutdoor?: boolean;
  lowBudget?: boolean;
}): ReadonlyArray<TemplateCategory> {
  const extra: TemplateCategory[] = [];

  if (options.lowBudget) {
    extra.push({
      category: "DIY & Budget Options",
      items: [
        {
          label: "Price-check DIY alternatives (décor, invitations, favors)",
          questions: ["Which items can be homemade safely?", "What is the bulk-buy price?"],
          docs: ["DIY cost sheet", "Supplier comparisons"],
        },
        {
          label: "Ask venue/caterer about off-peak or bundle pricing",
          questions: [
            "Do you offer weekday or off-season rates?",
            "Is a bundle discount available?",
          ],
          docs: ["Alternate quote"],
        },
      ],
    });
  }

  if (options.isOutdoor) {
    extra.push({
      category: "Weather Contingency",
      items: [
        {
          label: "Arrange tent/cover and wet-weather logistics",
          questions: ["What is the wind rating?", "Is installation included?"],
          docs: ["Rental contract", "Setup schedule"],
        },
        {
          label: "Confirm backup indoor space or reschedule terms",
          questions: ["What is the weather decision deadline?", "Are there reschedule fees?"],
          docs: ["Rain plan document"],
        },
      ],
    });
  }

  // Outdoor weather items are vertical-agnostic; low-budget DIY applies everywhere.
  return extra;
}
