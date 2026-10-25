import { defineConfig } from "@playwright/test";

/**
 * E2E runner (Phases.md 4.3). Keyless by design: the API falls back to the
 * deterministic engine, so the suite never needs OPENAI_API_KEY. Serial workers
 * keep us clear of the in-route rate limit (10 plans/min/IP).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    reducedMotion: "reduce",
  },
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
