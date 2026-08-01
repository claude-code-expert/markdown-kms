import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Single worker: specs share one `next dev` server, and Next's on-demand route
  // compilation under concurrent first-hits was pushing default assertion timeouts.
  workers: 1,
  retries: 0,
  reporter: "list",
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: "http://localhost:3000",
  },
  // Auth E2E specs drive a real signup → session → dashboard flow — needs the app running.
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
