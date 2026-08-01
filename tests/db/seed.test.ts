import { describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { workspace } from "@/db/schema";
import { seedDefaultWorkspace } from "@/db/seed";

const testClient = postgres(process.env.DATABASE_URL_TEST!);
const testDb = drizzle(testClient);

describe("seedDefaultWorkspace", () => {
  it("is idempotent: exactly one is_default row named 기본 워크스페이스 after repeated runs", async () => {
    await seedDefaultWorkspace(testDb);
    await seedDefaultWorkspace(testDb);

    const rows = await testDb.select().from(workspace).where(eq(workspace.isDefault, true));

    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("기본 워크스페이스");
  });
});
