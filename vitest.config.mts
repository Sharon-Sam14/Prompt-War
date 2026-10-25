import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      // lib/genai/client.ts must be importable in tests: the real `server-only`
      // package throws outside a React Server context by design.
      {
        find: /^server-only$/,
        replacement: fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
      },
      // Scoped packages (@ai-sdk/...) must NOT be matched — anchored regex only.
      { find: /^@\//, replacement: root },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Route-handler tests share module state (rate limiter, LRU cache):
    // keep each test FILE isolated, but tests within a file run sequentially.
    isolate: true,
    testTimeout: 15_000,
  },
});
