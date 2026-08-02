import { defineConfig } from "@playwright/test";

// Ephemeral, perf-run-only config for e2e/preview-perf.spec.ts (EDIT-06, 02-05).
// Mirrors playwright.config.ts but binds to a dedicated port instead of 3000 --
// this worktree's measurement must run against ITS OWN code, and port 3000 was
// occupied by an unrelated, user-owned `pnpm dev` session in the main checkout
// (a stray port collision, not a sibling worktree agent -- confirmed via `lsof`
// cwd + tty). Not committed as a permanent addition to the shared root config
// (out of this plan's file scope); kept here only to make this one spec runnable
// in isolation. See SUMMARY Deviations.
const PERF_PORT = 3411;

export default defineConfig({
  testDir: ".",
  testMatch: "preview-perf.spec.ts",
  fullyParallel: true,
  workers: 1,
  retries: 0,
  reporter: "list",
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: `http://localhost:${PERF_PORT}`,
  },
  webServer: {
    command: "pnpm dev",
    url: `http://localhost:${PERF_PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { PORT: String(PERF_PORT) },
  },
});
