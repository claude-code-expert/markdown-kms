import { describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { folder, folderClosure } from "@/db/schema";

// Schema smoke test: table exists + Drizzle model matches the live schema.
// global-setup.ts migrates DATABASE_URL_TEST before this file runs.
const testClient = postgres(process.env.DATABASE_URL_TEST!);
const testDb = drizzle(testClient);

describe("folder / folder_closure schema", () => {
  it("folder table exists and is queryable", async () => {
    const rows = await testDb.select().from(folder);
    expect(rows).toEqual([]);
  });

  it("folder_closure table exists and is queryable", async () => {
    const rows = await testDb.select().from(folderClosure);
    expect(rows).toEqual([]);
  });
});
