import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";

// Vitest (unlike `next build`) doesn't auto-load .env.local — load it here so
// DATABASE_URL_TEST is set before global-setup.ts and test files read it.
try {
  process.loadEnvFile(".env.local");
} catch {
  // fine if env vars are already set some other way
}

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // tsconfig.json sets jsx:"preserve" (Next.js SWC handles JSX at build time,
  // not Vite's own oxc/esbuild transform) — Vite 8 defaults to its oxc
  // transform, which otherwise inherits "preserve" from tsconfig.json and
  // leaves raw JSX in the output. Force "automatic" so importing a .tsx file
  // (e.g. src/app/layout.tsx in tests/theme/rsc-cookie.test.ts) works.
  oxc: {
    jsx: { runtime: "automatic" },
  },
  test: {
    watch: false,
    environment: "node",
    passWithNoTests: true,
    // e2e/*.spec.ts are Playwright specs (test.describe/test from @playwright/test), not
    // Vitest tests — Vitest's default include glob matches them by extension alone and
    // fails trying to run Playwright's test() outside a Playwright runner.
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
    globalSetup: ["./tests/global-setup.ts"],
    // Route handlers under test import `@/db`, which reads DATABASE_URL — point that at the
    // test DB for the test run so signup's real transaction hits DATABASE_URL_TEST, not dev data.
    env: {
      DATABASE_URL: process.env.DATABASE_URL_TEST,
    },
    // Sequential across files: signup-atomicity.test.ts temporarily flips the seeded
    // workspace's is_default flag off/on, which would race with any other file reading it
    // concurrently (e.g. signup.test.ts's default-workspace lookup).
    fileParallelism: false,
  },
});
