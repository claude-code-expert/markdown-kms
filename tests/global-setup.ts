import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { seedDefaultWorkspace } from "@/db/seed";

// Vitest globalSetup: migrates + seeds DATABASE_URL_TEST before the suite runs.
// Idempotent (migrate tracks applied migrations, seed is check-then-insert),
// so it is safe to run before every test run.
export default async function globalSetup() {
  const client = postgres(process.env.DATABASE_URL_TEST!, { max: 1 });
  const testDb = drizzle(client);

  await migrate(testDb, { migrationsFolder: "./drizzle" });
  await seedDefaultWorkspace(testDb);

  await client.end();
}
