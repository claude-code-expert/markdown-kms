import { fileURLToPath } from "url";
import { eq } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/postgres-js";
import { workspace } from "./schema";

type Db = ReturnType<typeof drizzle>;

export async function seedDefaultWorkspace(db: Db) {
  const [existing] = await db.select().from(workspace).where(eq(workspace.isDefault, true));
  if (existing) return existing;

  const [created] = await db
    .insert(workspace)
    .values({ name: "기본 워크스페이스", isDefault: true })
    .returning();
  return created;
}

// CLI entry: `pnpm tsx src/db/seed.ts` seeds the dev DB (DATABASE_URL via src/db/index.ts).
// tsx, unlike `next build`, doesn't auto-load .env.local — load it here so
// DATABASE_URL is set before src/db/index.ts reads process.env.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  (async () => {
    if (!process.env.DATABASE_URL) {
      try {
        process.loadEnvFile(".env.local");
      } catch {
        // fine if DATABASE_URL is already set some other way
      }
    }
    const { db } = await import("./index");
    const ws = await seedDefaultWorkspace(db);
    console.log("Seeded default workspace:", ws);
    process.exit(0);
  })();
}
