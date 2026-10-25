/**
 * README screenshot capture (docs/Phases.md 4.5) — headless Chromium so the
 * shots are deterministic and reproducible: `node scripts/screenshots.mjs`
 * with `npm run build && npm run start` already serving localhost:3000.
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

// 1) Landing shell — nav, hero, features, form — light theme.
await page.goto(`${BASE}/`);
await page.waitForSelector('h1:has-text("Bespoke Event Planning Engine")');
await shot("00-landing-hero", false);
await shot("01-landing-light");

// 2) Setup page — dark ink-paper theme.
await page.getByRole("button", { name: /switch to dark theme/i }).click();
await shot("02-setup-dark");

// 3) Generate a plan (defaults are valid) → Overview, light.
await page.getByRole("button", { name: /switch to light theme/i }).click();
await page.getByRole("button", { name: "Generate plan" }).click();
await page.waitForURL(/\/plan\/[0-9a-f-]{36}$/);
await page.waitForSelector("#plan-banner-title");
await shot("03-overview-light");

// 4) Assistant answering a keyless engine question.
await page.getByRole("button", { name: "How many tasks are left?" }).click();
await page.waitForSelector("section:has(#ask-title) li");
await shot("04-assistant");

// 5) Exports tab.
await page.getByRole("tab", { name: "Exports" }).click();
await shot("05-exports", false);

// 6) Dashboard — dark ink-paper theme.
await page.getByRole("tab", { name: "Overview" }).click();
await page.getByRole("button", { name: /switch to dark theme/i }).click();
await shot("06-overview-dark");

await browser.close();
console.log("done →", OUT);
