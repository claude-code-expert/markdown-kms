import { defineConfig } from "drizzle-kit";

// drizzle-kit is a standalone CLI (unlike `next build`, it doesn't auto-load
// .env.local) — Node's built-in env file loader covers it, no dotenv dep needed.
try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local missing is fine if DATABASE_URL is already set in the shell env
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
