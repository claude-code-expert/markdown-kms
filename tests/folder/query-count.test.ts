// TDD RED (03-02 Task 1): imports @/lib/closure, which doesn't exist yet. TREE-02 — assert
// getWorkspaceFolders issues the same SQL statement count regardless of tree depth (flat
// single-query load, RESEARCH Pattern 1). Uses a separate debug-hooked postgres client on
// DATABASE_URL_TEST (RESEARCH Code Examples §"쿼리 개수 단언") — production src/db/index.ts is
// untouched, so the debug hook never runs against dev data.
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql } from "drizzle-orm";
import postgres from "postgres";
import { db } from "@/db";
import { workspace } from "@/db/schema";
import { createFolder, getWorkspaceFolders } from "@/lib/closure";
import { createTestWorkspace } from "../rbac/helpers";

let queryCount = 0;
const debugClient = postgres(process.env.DATABASE_URL_TEST!, {
  debug: () => {
    queryCount += 1;
  },
});
const debugDb = drizzle(debugClient);

afterAll(() => debugClient.end());

describe("getWorkspaceFolders — fixed SQL statement count regardless of tree depth (TREE-02)", () => {
  const createdWorkspaces: string[] = [];

  afterEach(async () => {
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
  });

  it("issues the same statement count for a depth-2 and a depth-6 tree", async () => {
    // Warm the debug connection once so first-query connection overhead (if any) doesn't skew
    // the shallow-vs-deep comparison below — both measured calls reuse this warmed connection.
    await debugDb.execute(sql`SELECT 1`);

    const wsShallow = await createTestWorkspace("query-count-shallow-ws");
    createdWorkspaces.push(wsShallow.id);
    let parent: string | null = null;
    for (let depth = 0; depth < 2; depth++) {
      const created = await createFolder(wsShallow.id, parent, `depth-${depth}`);
      parent = created.id;
    }

    queryCount = 0;
    await getWorkspaceFolders(wsShallow.id, debugDb);
    const shallowCount = queryCount;

    const wsDeep = await createTestWorkspace("query-count-deep-ws");
    createdWorkspaces.push(wsDeep.id);
    parent = null;
    for (let depth = 0; depth < 6; depth++) {
      const created = await createFolder(wsDeep.id, parent, `depth-${depth}`);
      parent = created.id;
    }

    queryCount = 0;
    await getWorkspaceFolders(wsDeep.id, debugDb);
    const deepCount = queryCount;

    expect(shallowCount).toBeGreaterThan(0);
    expect(deepCount).toBe(shallowCount);
  });
});
