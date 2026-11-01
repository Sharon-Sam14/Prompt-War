import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function expectNoSeriousAxeViolations(page: import("@playwright/test").Page) {
  // The app is dark-only, and step/theme transitions can overlap after the
  // heading becomes visible. Let the rendered colors settle before axe scans.
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.waitForTimeout(1400);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    ),
  ).toEqual([]);
}

/**
 * The event-type RadioGroupItem is visually hidden (`sr-only`) — the card
 * itself is the click target, exactly as a user would click it. Activation
 * forwards to the radio, so the checked assertion still proves the state
 * change reached the control.
 */
async function selectEventType(
  page: import("@playwright/test").Page,
  name: "Wedding" | "Birthday" | "Community",
) {
  await page.locator("label").filter({ hasText: name }).click();
  await expect(page.getByRole("radio", { name: new RegExp(name) })).toBeChecked();
}

/** Walk the desktop wizard from the review-free steps up to step 5. */
async function goToReview(
  page: import("@playwright/test").Page,
  opts: { name: string; city: string; date: string; priority: string },
) {
  await page.getByRole("button", { name: "Next" }).click(); // step 1 → 2
  await page.getByLabel("Event name").fill(opts.name);
  await page.getByLabel("Event date").fill(opts.date);
  await page.getByLabel("City / Location").fill(opts.city);
  await page.getByRole("button", { name: "Next" }).click(); // step 2 → 3
  await page.getByRole("button", { name: "Next" }).click(); // step 3 → 4
  await page.locator("#priorities").click();
  await page.getByRole("option", { name: opts.priority, exact: true }).click();
  await page.getByRole("button", { name: "Next" }).click(); // step 4 → 5
}

/**
 * Onboarding wizard regression suite (P0): the landing page's primary CTA
 * lands here, yet this flow had zero coverage — which is how an inert
 * event-type RadioGroup and a false "Generation failed" review state shipped.
 * Keyless: /api/plan answers with the deterministic engine fallback.
 */
test.describe("onboarding wizard", () => {
  test("birthday: select → review → generate → birthday plan", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto("/onboarding");
    await expect(
      page.getByRole("heading", { level: 2, name: "What type of event?" }),
    ).toBeVisible();
    await expectNoSeriousAxeViolations(page);

    // ---- Event type selection reaches the wizard state --------------------
    await selectEventType(page, "Birthday");

    await goToReview(page, {
      name: "Maya's 30th",
      city: "Lisbon",
      date: "2027-06-12",
      priority: "Venue",
    });

    // ---- Review summary is accurate and never falsely fails ---------------
    await expect(page.getByRole("heading", { level: 2, name: "Review your event" })).toBeVisible();
    await expect(page.locator("#review-event-type")).toHaveText("Birthday");
    await expect(page.locator("#review-event-date")).toHaveText("June 12, 2027");
    await expect(page.locator("#review-guest-count")).toHaveText("100 guests");
    // formatMoney: minimumFractionDigits 0 → "$5,000" (locale-tolerant regex).
    await expect(page.locator("#review-budget")).toHaveText(/\$[\d,.]+/);
    await expect(page.locator("#review-priorities")).toHaveText("Venue");
    await expect(page.getByText("Generation failed")).toHaveCount(0);

    // ---- Submission works and the plan carries the event type -------------
    await page.getByRole("button", { name: "Create event plan" }).click();
    await page.waitForURL(/\/plan\/[0-9a-f-]{36}$/);
    // The wizard's own event name becomes the dashboard masthead …
    await expect(page.getByRole("heading", { level: 2, name: "Maya's 30th" })).toBeVisible();
    // … while the studio h1 still proves the vertical reached the plan.
    await expect(
      page.getByRole("heading", { level: 1, name: "Birthday Planning Studio" }),
    ).toBeVisible();
    await expectNoSeriousAxeViolations(page);

    expect(pageErrors).toEqual([]);
  });

  test("community: select → review → generate → community plan", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto("/onboarding");
    await selectEventType(page, "Community");

    await goToReview(page, {
      name: "Summer block party",
      city: "Porto",
      date: "2027-09-20",
      priority: "Catering",
    });

    await expect(page.locator("#review-event-type")).toHaveText("Community");
    await expect(page.locator("#review-event-date")).toHaveText("September 20, 2027");
    await expect(page.locator("#review-priorities")).toHaveText("Catering");
    await expect(page.getByText("Generation failed")).toHaveCount(0);

    await page.getByRole("button", { name: "Create event plan" }).click();
    await page.waitForURL(/\/plan\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 2, name: "Summer block party" })).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: "Community Planning Studio" }),
    ).toBeVisible();

    expect(pageErrors).toEqual([]);
  });

  test("all three event types selectable; review accurate; no false failure", async ({ page }) => {
    await page.goto("/onboarding");
    const wedding = page.getByRole("radio", { name: /Wedding/ });
    const birthday = page.getByRole("radio", { name: /Birthday/ });

    await expect(wedding).toBeChecked(); // documented default
    await expectNoSeriousAxeViolations(page);

    await selectEventType(page, "Birthday");
    await expect(wedding).not.toBeChecked();

    await selectEventType(page, "Community");
    await expect(birthday).not.toBeChecked();

    await selectEventType(page, "Wedding");

    await goToReview(page, {
      name: "Anniversary dinner",
      city: "Porto",
      date: "2027-12-24",
      priority: "Photography",
    });

    // The review step must greet the user with a summary, not a failure.
    await expect(page.getByRole("heading", { level: 2, name: "Review your event" })).toBeVisible();
    await expect(page.getByText("Generation failed")).toHaveCount(0);
    await expect(page.locator("#review-event-type")).toHaveText("Wedding");
    await expect(page.locator("#review-event-date")).toHaveText("December 24, 2027");
    await expect(page.locator("#review-guest-count")).toHaveText("100 guests");
    await expect(page.locator("#review-budget")).toHaveText(/\$[\d,.]+/);
    await expect(page.locator("#review-priorities")).toHaveText("Photography");
    await expect(page.getByRole("button", { name: "Create event plan" })).toBeEnabled();
    // No error message before the user submits (Next's route announcer is an
    // always-present, empty role="alert" — only alerts with text count).
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveCount(0);
    await expectNoSeriousAxeViolations(page);
  });

  test("?vertical= and ?prompt= deep links preselect the wizard", async ({ page }) => {
    // Landing vertical card → matching event type preselected.
    await page.goto("/");
    await page.locator('a[href="/onboarding?vertical=birthday"]').click();
    await page.waitForURL(/\/onboarding\?vertical=birthday/);
    await expect(page.getByRole("radio", { name: /Birthday/ })).toBeChecked();

    // Prompt bar query lands in the wizard's description field.
    await page.goto("/onboarding?vertical=community&prompt=Summer%20block%20party%20for%20200");
    await expect(page.getByRole("radio", { name: /Community/ })).toBeChecked();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByLabel("Description (optional)")).toHaveValue(
      "Summer block party for 200",
    );

    // Prompt-only link keeps the default event type but still carries the text.
    await page.goto("/onboarding?prompt=Surprise%20party%20for%2030");
    await expect(page.getByRole("radio", { name: /Wedding/ })).toBeChecked();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByLabel("Description (optional)")).toHaveValue("Surprise party for 30");
  });

  test("mobile final-step button is labelled Create plan, not Continue", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/onboarding");

    await page.getByRole("button", { name: "Next" }).click();
    await page.getByLabel("Event name").fill("Mobile test event");
    await page.getByLabel("City / Location").fill("Berlin");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.locator("#priorities").click();
    await page.getByRole("option", { name: "Venue", exact: true }).click();
    await page.getByRole("button", { name: "Next" }).click();

    await expect(page.getByText("Generation failed")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Create plan" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toHaveCount(0);

    // The mobile control performs the real submission too.
    await page.getByRole("button", { name: "Create plan" }).click();
    await page.waitForURL(/\/plan\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 2, name: "Mobile test event" })).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: "Wedding Planning Studio" }),
    ).toBeVisible();
  });
});

/**
 * Keyboard-only wizard (README QA matrix): selection follows focus on the
 * event-type radios, focus lands on each new step's heading, and the final
 * submission is reachable and operable with Enter alone.
 */
test.describe("keyboard only", () => {
  test("wizard is operable without a mouse", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    const focused = (locator: import("@playwright/test").Locator) =>
      locator.evaluate((el) => el === document.activeElement).catch(() => false);

    /** Walk `Tab` until `locator` owns focus. */
    async function walkTo(
      locator: import("@playwright/test").Locator,
      key: "Tab" | "Shift+Tab" = "Tab",
      max = 60,
    ) {
      for (let i = 0; i < max; i += 1) {
        if (await focused(locator)) return;
        await page.keyboard.press(key);
      }
      expect(await focused(locator), `never reached by keyboard (${key})`).toBe(true);
    }

    /**
     * Radix radios implement "selection follows focus" only while the arrow key
     * is still held, so a real key hold is emulated instead of an
     * instantaneous press (same pattern as planner.spec.ts).
     */
    async function pressAndHold(key: string) {
      await page.keyboard.down(key);
      await page.waitForTimeout(60);
      await page.keyboard.up(key);
    }

    await page.goto("/onboarding");
    await expect(
      page.getByRole("heading", { level: 2, name: "What type of event?" }),
    ).toBeVisible();

    // ---- Event type: reachable and changeable with arrow keys -------------
    const wedding = page.getByRole("radio", { name: /Wedding/ });
    const birthday = page.getByRole("radio", { name: /Birthday/ });
    await walkTo(wedding);
    await expect(wedding).toBeChecked();
    await pressAndHold("ArrowRight");
    await expect(birthday).toBeFocused();
    await expect(birthday).toBeChecked();

    // ---- Step change moves focus to the new step's heading ----------------
    const next = page.getByRole("button", { name: "Next" });
    await walkTo(next);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 2, name: "Event details" })).toBeFocused();
    // … and the polite live region announces the step.
    await expect(page.locator("#step-announcer")).toHaveText("Step 2 of 5: Details");

    // ---- Required fields typed with the keyboard only ---------------------
    await walkTo(page.getByLabel("Event name"));
    await page.keyboard.type("Keyboard event");
    await walkTo(page.getByLabel("City / Location"));
    await page.keyboard.type("Berlin");

    await walkTo(next);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 2, name: "Style & vibe" })).toBeFocused();

    await walkTo(next);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 2, name: "Budget" })).toBeFocused();

    // ---- Priorities: required select driven by keyboard -------------------
    await walkTo(page.locator("#priorities"));
    await page.keyboard.press("Enter");
    const listbox = page.getByRole("listbox");
    await expect(listbox).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(listbox).toBeHidden();
    const chosen = (await page.locator("#priorities").innerText()).trim();
    expect(chosen).toMatch(/Venue|Catering|Décor|Entertainment|Attire|Photography|Transport/);

    // ---- Review: focused heading, accurate summary ------------------------
    await walkTo(next);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 2, name: "Review your event" })).toBeFocused();
    await expect(page.locator("#review-event-type")).toHaveText("Birthday");
    await expect(page.locator("#review-priorities")).toHaveText(chosen);
    await expect(page.getByText("Generation failed")).toHaveCount(0);

    // ---- Submit with Enter alone ------------------------------------------
    const create = page.getByRole("button", { name: "Create event plan" });
    await walkTo(create);
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/plan\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 2, name: "Keyboard event" })).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: "Birthday Planning Studio" }),
    ).toBeVisible();

    expect(pageErrors).toEqual([]);
  });
});
