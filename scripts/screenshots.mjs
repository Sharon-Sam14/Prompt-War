/**
 * README screenshot capture (docs/Phases.md 4.5) — headless Chromium so the
 * shots are deterministic and reproducible: `node scripts/screenshots.mjs`
 * with `npm run build && npm run start` already serving localhost:3000.
 * Dark-only since Memory D46 — every shot is the one look.
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
 */
async function settle() {
  await page.waitForFunction(() => document.querySelectorAll(".opacity-0").length === 0);
  await page.waitForTimeout(1200);
}

// 1) Landing shell — masthead, script hero, features, how-it-works, form.
await page.goto(`${BASE}/`);
await page.waitForSelector('h1:has-text("Your celebration, handled")');
await settle();
await shot("00-landing-hero", false);
await shot("01-landing-full");

// 2) Setup route — the date-aware event setup form (own route, no nav entry).
await page.goto(`${BASE}/create`);
await page.waitForSelector('h2:has-text("New event plan")');
await shot("02-setup");

// 3) Generate a plan (keyless: deterministic engine fallback) → dashboard.
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

await browser.close();
console.log("all screenshots captured");
