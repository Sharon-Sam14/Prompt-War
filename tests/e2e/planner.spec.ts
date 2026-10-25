import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function expectNoSeriousAxeViolations(page: import("@playwright/test").Page) {
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
 * Full happy path (Phases.md 4.3): setup → generate → dashboard tabs →
 * budget edit → task toggle → vendor status → CSV/Markdown/PDF/JSON exports
 * and JSON import round-trip.
 * Runs keyless: /api/plan answers with the deterministic engine fallback.
 */
test("setup → generate → edit → export", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));

  // ---- Landing shell: hero h1 + form section (Design.md §4.10) -------------
  const landingResponse = await page.goto("/");
  expect(landingResponse?.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(landingResponse?.headers()["x-content-type-options"]).toBe("nosniff");
  expect(landingResponse?.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  expect(new URL(page.url()).hash).toBe("#main-content");
  await expect(
    page.getByRole("heading", { level: 1, name: "Bespoke Event Planning Engine" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "New event plan" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Site" })).toBeVisible();
  await expectNoSeriousAxeViolations(page);
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expectNoSeriousAxeViolations(page);
  await page.getByRole("button", { name: "Switch to light theme" }).click();

  await page.setViewportSize({ width: 320, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => {
    document.documentElement.style.zoom = "200%";
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => {
    document.documentElement.style.zoom = "";
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(
    page.getByRole("heading", { level: 1, name: "Bespoke Event Planning Engine" }),
  ).toBeVisible();

  // Live previews: ≈ per-guest badge (5000 / 100) and the T− chip after a date.
  // formatMoney uses minimumFractionDigits: 0 → "$50 / guest", not "$50.00".
  await expect(page.getByText(/\$[\d,.]+ \/ guest/)).toBeVisible();
  await page.getByLabel("Event date").fill("2027-06-12");
  await expect(page.getByText(/^T−\d+ days?$/)).toBeVisible();

  // Preset chip fills theme + cultural notes.
  await page.getByRole("button", { name: "Sangeet & reception" }).click();
  await expect(page.getByLabel("Cultural notes (optional)")).toHaveValue(/Sangeet/);

  // ---- Generate -----------------------------------------------------------
  await page.getByRole("button", { name: "Generate plan" }).click();
  await page.waitForURL(/\/plan\/[0-9a-f-]{36}$/);
  const planUrl = page.url();
  await expect(
    page.getByRole("heading", { level: 2, name: /Sangeet & reception wedding/ }),
  ).toBeVisible();
  await expectNoSeriousAxeViolations(page);
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expectNoSeriousAxeViolations(page);
  await page.getByRole("button", { name: "Switch to light theme" }).click();

  // ---- Assistant: keyless engine answer from plan context -----------------
  await page.getByRole("button", { name: "How many tasks are left?" }).click();
  await expect(page.getByText(/\d+ of \d+ tasks done and \d+ of \d+ vendors booked/)).toBeVisible();

  // ---- Budget: commit a planned cell -------------------------------------
  await page.getByRole("tab", { name: "Budget" }).click();
  const plannedCell = page.locator("tbody input").first();
  await plannedCell.fill("999");
  await plannedCell.press("Enter");
  await expect(plannedCell).toHaveValue("999.00");

  // ---- Timeline: toggle the first task ------------------------------------
  await page.getByRole("tab", { name: "Timeline" }).click();
  const firstTaskLabel = page.getByText("Ceremony and reception", { exact: true });
  await firstTaskLabel.click();
  await expect(page.getByRole("checkbox", { name: "Ceremony and reception" })).toHaveAttribute(
    "aria-checked",
    "true",
  );

  // ---- Checklist: move a vendor to Booked --------------------------------
  await page.getByRole("tab", { name: "Checklist" }).click();
  const statusSelect = page.getByLabel(/^Status for/).first();
  await statusSelect.click();
  await page.getByRole("option", { name: "Booked", exact: true }).click();
  await expect(statusSelect).toContainText("Booked");

  // ---- Exports: CSV, Markdown and PDF all download -----------------------
  await page.getByRole("tab", { name: "Exports" }).click();
  await expect(
    page.getByText("Exports read directly from your open plan", { exact: false }),
  ).toBeVisible();

  const [csv] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download CSV" }).click(),
  ]);
  expect(csv.suggestedFilename()).toMatch(/\.csv$/);

  const [md] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download Markdown" }).click(),
  ]);
  expect(md.suggestedFilename()).toMatch(/\.md$/);

  const [pdf] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download PDF" }).click(),
  ]);
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);

  const [json] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download JSON" }).click(),
  ]);
  expect(json.suggestedFilename()).toMatch(/\.json$/);
  const jsonPath = await json.path();
  expect(jsonPath).not.toBeNull();
  await expect(page.getByRole("status").filter({ hasText: "Exported" })).toBeVisible();

  // A bookmarked URL has no server-side plan. Restore it with the JSON file.
  await page.evaluate(() => localStorage.clear());
  await page.goto(planUrl);
  await expect(page.getByRole("heading", { name: "No saved plan here" })).toBeVisible();
  await page.locator("#plan-json-import").setInputFiles(jsonPath!);
  await expect(
    page.getByRole("heading", { level: 2, name: /Sangeet & reception wedding/ }),
  ).toBeVisible();

  await page.getByRole("tab", { name: "Exports" }).click();

  // ---- Plan persisted: reload restores the dashboard ----------------------
  await page.reload();
  // active tab survives (persisted ui state) …
  await expect(page.getByRole("tab", { name: "Exports" })).toHaveAttribute("aria-selected", "true");
  // … and so does the plan itself
  await page.getByRole("tab", { name: "Overview" }).click();
  await expect(
    page.getByRole("heading", { level: 2, name: /Sangeet & reception wedding/ }),
  ).toBeVisible();

  expect(pageErrors).toEqual([]);
});

/**
 * Motion enabled (PROMPT §1.7 Testing): the runner defaults to
 * `reducedMotion: "reduce"`, so this block opts back into motion and asserts
 * that every animated surface settles on fully visible content and that the
 * count-up digits finish on the engine's value — with zero page errors.
 */
test.describe("motion enabled", () => {
  test.use({ reducedMotion: "no-preference" });

  test("reveals and count-ups settle to full content", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto("/");

    // Hero reveal (trigger="mount") settles at full opacity.
    await expect(
      page.getByRole("heading", { level: 1, name: "Bespoke Event Planning Engine" }),
    ).toHaveCSS("opacity", "1");

    // Staggered lists reveal fully — and no arming class is left behind
    // anywhere (the 1200 ms safety timer guarantees this even off-screen).
    await expect(page.locator("#features li")).toHaveCount(3);
    await expect(page.locator("#how-it-works li")).toHaveCount(3);
    await expect(page.locator(".opacity-0")).toHaveCount(0);

    // ---- Generate a plan with known values so the count-up is checkable ----
    await page.getByLabel("Event date").fill("2027-06-12");
    await page.getByLabel("Guests", { exact: true }).fill("25");
    await page.getByLabel("Total budget").fill("5000");
    await page.getByRole("button", { name: "Generate plan" }).click();
    await page.waitForURL(/\/plan\/[0-9a-f-]{36}$/);

    const atAGlance = page.getByRole("list", { name: "Plan at a glance" });
    await expect(atAGlance).toBeVisible();

    // CountUp's animated span must finish on the engine's value (25 guests),
    // not merely start near it.
    const guestsCard = atAGlance.locator("li").filter({ hasText: "Guests" });
    await expect(guestsCard.locator('span[aria-hidden="true"]')).toHaveText("25");

    // Progress card: the engine's integer percentage from the server-rendered
    // sub-line must be the value the animation lands on.
    const sub = await page.getByText(/^\d+\/\d+ vendors · \d+\/\d+ tasks$/).innerText();
    const [, booked, vendors, done, tasks] = sub.match(
      /(\d+)\/(\d+) vendors · (\d+)\/(\d+) tasks/,
    )!;
    const expectedPct = Math.round(
      ((Number(booked) + Number(done)) / (Number(vendors) + Number(tasks))) * 100,
    );
    await expect(page.getByText(`${expectedPct}%`, { exact: true }).first()).toBeVisible();

    expect(pageErrors).toEqual([]);
  });
});

/**
 * Keyboard-only core flow (PROMPT §1.6, README QA matrix): the whole critical
 * path is driven with Tab / arrows / Enter / Space / Escape and *no pointer*.
 * It fails if any control becomes unreachable, if focus is ever dropped to
 * <body>, or if an operation needs a mouse. Bounded `Tab` walks keep the test
 * insensitive to cosmetic DOM order changes while still proving reachability.
 */
test.describe("keyboard only", () => {
  test("critical flow is operable without a mouse", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    const focused = (locator: import("@playwright/test").Locator) =>
      locator.evaluate((el) => el === document.activeElement).catch(() => false);

    /** Walk `Tab` (or `Shift+Tab`) until `locator` owns focus. */
    async function walkTo(
      locator: import("@playwright/test").Locator,
      key: "Tab" | "Shift+Tab" = "Tab",
      max = 80,
    ) {
      for (let i = 0; i < max; i += 1) {
        if (await focused(locator)) return;
        await page.keyboard.press(key);
      }
      expect(await focused(locator), `never reached by keyboard (${key})`).toBe(true);
    }

    /**
     * Radix radios implement "selection follows focus" only while the arrow key
     * is still held (the item clicks itself on focus if a keydown is pending),
     * so a real key hold is emulated instead of an instantaneous press.
     */
    async function pressAndHold(key: string) {
      await page.keyboard.down(key);
      await page.waitForTimeout(60);
      await page.keyboard.up(key);
    }

    // ---- Landing: skip link → main content, by Enter only -------------------
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
    await page.keyboard.press("Enter");
    expect(new URL(page.url()).hash).toBe("#main-content");

    // ---- Hydration gate -----------------------------------------------------
    // Radix handlers only exist after React hydrates; a keyboard activation of
    // the theme toggle proves it before the rest of the run depends on it.
    const toDark = page.getByRole("button", { name: "Switch to dark theme" });
    const toLight = page.getByRole("button", { name: "Switch to light theme" });
    await walkTo(toDark);
    await page.keyboard.press("Enter");
    await expect(toLight).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(toDark).toBeFocused();

    // ---- Event type: reachable and changeable with arrow keys ---------------
    const weddingRadio = page.getByRole("radio", { name: /Wedding/ });
    const birthdayRadio = page.getByRole("radio", { name: /Birthday/ });
    await walkTo(weddingRadio);
    await expect(weddingRadio).toBeChecked();
    await pressAndHold("ArrowRight");
    await expect(birthdayRadio).toBeFocused();
    await expect(birthdayRadio).toBeChecked();
    await pressAndHold("ArrowLeft");
    await expect(weddingRadio).toBeChecked();

    /**
     * Exact tab order of the setup form, walked one press at a time. A single
     * dropped stop (focus escaping to <body>) fails the assertion at that step.
     */
    const setupOrder: Array<[string, import("@playwright/test").Locator]> = [
      ["Event date", page.getByLabel("Event date")],
      ["Guests", page.getByLabel("Guests", { exact: true })],
      ["Total budget", page.getByLabel("Total budget")],
      ["Currency", page.getByLabel("Currency")],
      ["Spending style", page.getByLabel("Spending style")],
      ["Location", page.getByLabel("Location (optional)")],
      ["Style/theme", page.getByLabel("Style or theme (optional)")],
      ["Cultural notes", page.getByLabel("Cultural notes (optional)")],
      ["Preset: Sangeet & reception", page.getByRole("button", { name: "Sangeet & reception" })],
      ["Outdoors checkbox", page.getByRole("checkbox", { name: /Outdoors/ })],
      ["Generate plan", page.getByRole("button", { name: "Generate plan" })],
    ];
    for (const [name, control] of setupOrder) {
      let reached = false;
      // A native date input exposes internal segments, so allow a few presses
      // per stop — but every one of them must land on a real control.
      for (let attempt = 0; attempt < 4 && !reached; attempt += 1) {
        await page.keyboard.press("Tab");
        const tag = await page.evaluate(() => document.activeElement?.tagName ?? "NONE");
        expect(tag, `focus escaped to ${tag} before "${name}"`).not.toBe("BODY");
        reached = await focused(control);
      }
      expect(reached, `tab order: ${name}`).toBe(true);
    }

    // Preset applied with Enter (no pointer).
    await page.getByRole("button", { name: "Sangeet & reception" }).press("Enter");
    await expect(page.getByLabel("Cultural notes (optional)")).toHaveValue(/Sangeet/);

    // Outdoors checkbox toggled with Space.
    const outdoors = page.getByRole("checkbox", { name: /Outdoors/ });
    await outdoors.focus();
    await page.keyboard.press("Space");
    await expect(outdoors).toBeChecked();

    // ---- Generate, from the submit button, with Enter -----------------------
    const generate = page.getByRole("button", { name: "Generate plan" });
    await generate.focus();
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/plan\/[0-9a-f-]{36}$/);
    await expect(
      page.getByRole("heading", { level: 2, name: /Sangeet & reception wedding/ }),
    ).toBeVisible();

    // ---- Dashboard tabs: reachable, switchable with arrow keys -------------
    const overviewTab = page.getByRole("tab", { name: "Overview" });
    const budgetTab = page.getByRole("tab", { name: "Budget" });
    const timelineTab = page.getByRole("tab", { name: "Timeline" });
    const checklistTab = page.getByRole("tab", { name: "Checklist" });
    const exportsTab = page.getByRole("tab", { name: "Exports" });

    await walkTo(overviewTab);
    await expect(overviewTab).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowDown");
    await expect(budgetTab).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowUp");
    await expect(overviewTab).toHaveAttribute("aria-selected", "true");

    // ---- Assistant: ask by Enter, answer announced -------------------------
    const question = page.getByRole("button", { name: "How many tasks are left?" });
    await walkTo(question);
    await page.keyboard.press("Enter");
    await expect(
      page.getByText(/\d+ of \d+ tasks done and \d+ of \d+ vendors booked/),
    ).toBeVisible();

    // ---- Budget: reach the grid, commit a cell by Enter --------------------
    await walkTo(overviewTab, "Shift+Tab");
    await page.keyboard.press("ArrowDown");
    await expect(budgetTab).toHaveAttribute("aria-selected", "true");
    const plannedCell = page.locator("tbody input").first();
    await walkTo(plannedCell);
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("777");
    await page.keyboard.press("Enter");
    await expect(plannedCell).toHaveValue("777.00");

    // ---- Timeline: toggle a task with Space --------------------------------
    await walkTo(budgetTab, "Shift+Tab");
    await page.keyboard.press("ArrowDown");
    await expect(timelineTab).toHaveAttribute("aria-selected", "true");
    const taskCheckbox = page.getByRole("checkbox", { name: "Ceremony and reception" });
    await walkTo(taskCheckbox);
    await page.keyboard.press("Space");
    await expect(taskCheckbox).toHaveAttribute("aria-checked", "true");

    // ---- Checklist: open the status select and pick with arrows ------------
    await walkTo(timelineTab, "Shift+Tab");
    await page.keyboard.press("ArrowDown");
    await expect(checklistTab).toHaveAttribute("aria-selected", "true");
    const statusSelect = page.getByLabel(/^Status for/).first();
    await walkTo(statusSelect);
    await page.keyboard.press("Enter");
    // Radix Select mounts its listbox asynchronously; an arrow key sent before
    // it exists is dropped, so wait for the popup before navigating it.
    const listbox = page.getByRole("listbox");
    await expect(listbox).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await expect(listbox.getByRole("option", { name: "Contacted" })).toHaveAttribute(
      "data-highlighted",
      "",
    );
    await page.keyboard.press("Enter");
    await expect(listbox).toBeHidden();
    // Engine defaults every item to "To contact", so the arrow walk must have
    // committed a genuinely different status.
    await expect(statusSelect).toContainText("Contacted");

    // ---- Exports: trigger a download by Enter ------------------------------
    const ideasTab = page.getByRole("tab", { name: "Ideas" });
    await walkTo(checklistTab, "Shift+Tab");
    await page.keyboard.press("ArrowDown"); // ideas
    await expect(ideasTab).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowDown"); // exports
    await expect(exportsTab).toHaveAttribute("aria-selected", "true");
    const csvButton = page.getByRole("button", { name: "Download CSV" });
    await walkTo(csvButton);
    const [csv] = await Promise.all([page.waitForEvent("download"), page.keyboard.press("Enter")]);
    expect(csv.suggestedFilename()).toMatch(/\.csv$/);

    // Nothing in the run may have been reachable only by pointer.
    expect(pageErrors).toEqual([]);
  });
});
