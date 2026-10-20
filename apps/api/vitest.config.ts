import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Several files build the whole Fastify app in beforeAll, and vitest runs
    // files in parallel. On a busy machine that setup outgrows the 10s default
    // even though each file finishes in a few seconds on its own.
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
