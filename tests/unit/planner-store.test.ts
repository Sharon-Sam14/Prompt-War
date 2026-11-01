import { beforeEach, describe, expect, it } from "vitest";
import { PlanInputSchema, type PlanInput } from "@/lib/genai/schemas";
import { hydratePlan } from "@/lib/rules-engine/hydrate";
import {
  parsePersistedPlannerState,
  selectPersistedPlannerState,
  usePlannerStore,
} from "@/lib/store/use-planner-store";

const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

function makePlan(vertical: PlanInput["vertical"], name: string, guests: number) {
  const input = PlanInputSchema.parse({
    vertical,
    name,
    eventDate: future(120),
    guestCount: guests,
    budgetTotalCents: 1_000_000,
    currency: "USD",
    budgetBand: "standard",
  });
  return hydratePlan({ input, enrichment: null, cacheHit: false });
}

beforeEach(() => {
  usePlannerStore.setState({
    input: null,
    plan: null,
    status: "idle",
    error: null,
    receivedDocs: {},
    savedPlans: {},
    savedIdeaIds: [],
    appliedIdeaIds: [],
    ui: { activeTab: "overview" },
  });
});

describe("planner event library", () => {
  it("saves, switches, and keeps each event's plan and vendor state separate", () => {
    const wedding = makePlan("wedding", "Wedding", 80);
    const birthday = makePlan("birthday", "Birthday", 20);
    const store = usePlannerStore.getState();

    store.importPlan(wedding);
    usePlannerStore.getState().toggleTask(wedding.timeline[0].id);
    usePlannerStore.getState().setItemStatus("0:0", "booked");
    usePlannerStore.getState().toggleDocReceived("0:0", "Venue contract");
    usePlannerStore.getState().saveCurrentPlan();
    usePlannerStore.getState().importPlan(birthday);

    usePlannerStore.getState().switchPlan(wedding.id);
    const restoredWedding = usePlannerStore.getState();
    expect(restoredWedding.plan?.input.vertical).toBe("wedding");
    expect(restoredWedding.plan?.timeline[0].done).toBe(true);
    expect(restoredWedding.plan?.checklist[0].items[0].status).toBe("booked");
    expect(restoredWedding.receivedDocs["0:0"]).toContain("Venue contract");

    usePlannerStore.getState().switchPlan(birthday.id);
    const restoredBirthday = usePlannerStore.getState();
    expect(restoredBirthday.plan?.input.vertical).toBe("birthday");
    expect(restoredBirthday.plan?.input.guestCount).toBe(20);
    expect(restoredBirthday.plan?.timeline[0].done).toBe(false);
    expect(restoredBirthday.plan?.checklist[0].items[0].status).not.toBe("booked");
    expect(restoredBirthday.receivedDocs["0:0"]).toBeUndefined();
  });

  it("persists the library and saved/applied idea state through the Zod boundary", () => {
    const plan = makePlan("community", "Festival", 300);
    usePlannerStore.getState().importPlan(plan);
    usePlannerStore.getState().saveCurrentPlan();
    usePlannerStore.getState().toggleSavedIdea(plan.ideas[0].id);
    usePlannerStore.getState().applyIdea(plan.ideas[0].id);

    const persisted = selectPersistedPlannerState(usePlannerStore.getState());
    const parsed = parsePersistedPlannerState(persisted);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.savedPlans[plan.id].plan.input.vertical).toBe("community");
    expect(parsed.data.savedPlans[plan.id].savedIdeaIds).toContain(plan.ideas[0].id);
    expect(parsed.data.savedPlans[plan.id].appliedIdeaIds).toContain(plan.ideas[0].id);
    expect(parsed.data.plan?.input.description).toContain(`Selected idea: ${plan.ideas[0].title}`);
  });

  it("applies an idea once and allows saving and unsaving without duplicate ids", () => {
    const plan = makePlan("birthday", "Birthday", 12);
    usePlannerStore.getState().importPlan(plan);
    const ideaId = plan.ideas[0].id;

    usePlannerStore.getState().toggleSavedIdea(ideaId);
    usePlannerStore.getState().toggleSavedIdea(ideaId);
    expect(usePlannerStore.getState().savedIdeaIds).not.toContain(ideaId);
    usePlannerStore.getState().toggleSavedIdea(ideaId);
    usePlannerStore.getState().applyIdea(ideaId);
    const description = usePlannerStore.getState().plan?.input.description;
    usePlannerStore.getState().applyIdea(ideaId);
    expect(usePlannerStore.getState().appliedIdeaIds.filter((id) => id === ideaId)).toHaveLength(1);
    expect(usePlannerStore.getState().plan?.input.description).toBe(description);
  });

  it("adds linked vendor actuals to budget actuals once and preserves manual amounts", () => {
    const plan = makePlan("wedding", "Wedding costs", 70);
    usePlannerStore.getState().importPlan(plan);
    const item = plan.checklist[0].items[0];
    const key = plan.budget.categories[0].key;
    const store = usePlannerStore.getState();

    store.setVendorCosts("0:0", {
      estimatedCents: 12_000,
      actualCents: 10_000,
      budgetCategoryKey: key,
    });
    expect(usePlannerStore.getState().plan?.budget.categories[0].actualCents).toBe(10_000);
    usePlannerStore.getState().editCategory(key, { actualCents: 5_000 });
    expect(usePlannerStore.getState().plan?.budget.categories[0].actualCents).toBe(15_000);

    usePlannerStore.getState().setVendorCosts("0:0", {
      estimatedCents: item.estimatedCents ?? 12_000,
      actualCents: 20_000,
      budgetCategoryKey: key,
    });
    expect(usePlannerStore.getState().plan?.budget.categories[0].actualCents).toBe(25_000);

    usePlannerStore.getState().setVendorCosts("0:0", {
      estimatedCents: 20_000,
      actualCents: 20_000,
      budgetCategoryKey: null,
    });
    expect(usePlannerStore.getState().plan?.budget.categories[0].actualCents).toBe(5_000);
  });

  it("deletes a saved event without disturbing a different active event", () => {
    const first = makePlan("wedding", "First", 80);
    const second = makePlan("community", "Second", 200);
    usePlannerStore.getState().importPlan(first);
    usePlannerStore.getState().saveCurrentPlan();
    usePlannerStore.getState().importPlan(second);
    usePlannerStore.getState().saveCurrentPlan();
    usePlannerStore.getState().deleteSavedPlan(first.id);

    expect(usePlannerStore.getState().plan?.id).toBe(second.id);
    expect(usePlannerStore.getState().savedPlans[first.id]).toBeUndefined();
  });
});
