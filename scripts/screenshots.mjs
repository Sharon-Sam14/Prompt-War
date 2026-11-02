/**
 * README screenshot capture (docs/Phases.md 4.5) — headless Chromium so the
 * shots are deterministic and reproducible: `node scripts/screenshots.mjs`
 * with `npm run build && npm run start` already serving localhost:3000.
 * Dark-only since Memory D46 — every shot is the one look.
 *
 * Desktop shots are 1440×960; the mobile pair (D52) resizes the SAME page to
 * 390×844 so it keeps the plan's localStorage state. Captures: landing hero +
 * full page, setup form, then one dashboard per event type (wedding, birthday,
 * community — each with its own photograph), assistant, exports, mobile.
 */
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3000";
const OUT = "docs/screenshots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

async function shot(name, fullPage = true) {
  await page.waitForTimeout(500); // let fonts/hydration settle
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 82, fullPage });
  console.log(`captured ${name}.jpg`);
}

/**
 * Reveal animations arm at `.opacity-0` and clear themselves (the 1200 ms
 * safety timer guarantees this even off-screen); CountUp digits run ~1 s.
 * Wait both out so screenshots capture settled content, never mid-flight.
 * Hover affordances are excluded by contract — they are `opacity-0` at rest
 * (same selector the motion e2e asserts, planner.spec.ts:288).
 */
async function settle() {
  await page.waitForFunction(
    () => document.querySelectorAll(".opacity-0:not([data-hover-affordance])").length === 0,
  );
  await page.waitForTimeout(1200);
}

/**
 * Open /create, pick the event type, generate a keyless plan (deterministic
 * engine fallback) and land settled on its dashboard.
 */
async function generatePlan(vertical) {
  await page.goto(`${BASE}/create`);
  await page.waitForSelector('h2:has-text("New event plan")');
  await page.getByRole("radio", { name: new RegExp(vertical, "i") }).click();
  await page.getByLabel("Event date").fill("2027-06-12");
  await page.getByRole("button", { name: "Generate plan" }).click();
  await page.waitForURL(/\/plan\/[0-9a-f-]{36}$/);
  await settle();
}

// 1) Landing shell — masthead, script hero, features, how-it-works, form.
await page.goto(`${BASE}/`);
await page.waitForSelector('h1:has-text("Your celebration, handled")');
await settle();
await shot("00-landing-submission", false); // README header image (laptop viewport)
await shot("01-landing-full"); // full page incl. the three per-event photo cards

// 2) Setup route — date-aware form with the wedding photo in the brand column.
await page.goto(`${BASE}/create`);
await page.waitForSelector('h2:has-text("New event plan")');
await shot("02-setup");

// 3) Generate the wedding plan (keyless: deterministic engine fallback).
await page.getByLabel("Event date").fill("2027-06-12");
await page.getByRole("button", { name: "Generate plan" }).click();
await page.waitForURL(/\/plan\/[0-9a-f-]{36}$/);
await settle();
await shot("03-overview");

// 4) Assistant panel — keyless engine answer.
await page.getByRole("button", { name: "How many tasks are left?" }).click();
await page.waitForSelector("text=/\\d+ of \\d+ tasks done/");
await shot("04-assistant");

// 5) Exports tab — PDF / CSV / Markdown / JSON + print.
await page.getByRole("tab", { name: "Exports" }).click();
await shot("05-exports");

// 6) Birthday plan — birthday-cake photograph on its dashboard.
await generatePlan("Birthday");
await shot("06-birthday-overview");

// 7) Community plan — community-gathering photograph on its dashboard.
await generatePlan("Community");
await shot("07-community-overview");
const communityUrl = page.url();

// 8) Mobile (390×844) — the landing page at phone width: the three event-type
//    cards stack with their photographs full-width.
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/`);
await page.waitForSelector('h1:has-text("Your celebration, handled")');
await settle();
await shot("08-mobile-landing");

// 9) Mobile dashboard — event photo banner above the KPIs at phone width.
await page.goto(communityUrl);
await settle();
await page.locator("figure").first().scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await shot("09-mobile-overview", false);

await browser.close();
console.log("all screenshots captured");
