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
  test: {
    watch: false,
    environment: "node",
    passWithNoTests: true,
    globalSetup: ["./tests/global-setup.ts"],
  },
});
