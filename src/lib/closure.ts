import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { folder, folderClosure } from "@/db/schema";

// Both functions take an optional db/tx client (RESEARCH A3) — the query-count test injects a
// debug-hooked client, and future cascade operations (move/soft-delete) will inject `tx` so
// their subtree reads stay inside the same transaction (RESEARCH Pitfall 4).
type DbClient = typeof db;

// TREE-02: the `folder` table has no row representing the workspace itself (parent_id IS NULL
// means "workspace-root child", not a root row) — so the closure-join subtree pattern (TRD §4)
// doesn't apply to "give me the whole tree". Flat `workspace_id` filter instead: always exactly
// 1 SQL statement, independent of tree depth (RESEARCH Pattern 1).
export async function getWorkspaceFolders(workspaceId: string, client: DbClient = db) {
  return client
    .select()
    .from(folder)
    .where(and(eq(folder.workspaceId, workspaceId), eq(folder.isDeleted, false)));
}

// TRD §4 / RESEARCH Pattern 3: insert the folder row, copy the parent's ancestor rows at
// depth+1, then add a self row (depth 0). When parentId is null (workspace-root creation),
// `WHERE descendant_id = NULL` matches 0 rows under SQL 3-valued logic — no special-casing
// needed, the self row is still always inserted (RESEARCH Pitfall 5).
export async function createFolder(
  workspaceId: string,
  parentId: string | null,
  name: string,
  client: DbClient = db,
) {
  return client.transaction(async (tx) => {
    const [created] = await tx.insert(folder).values({ workspaceId, parentId, name }).returning();

    await tx.execute(sql`
      INSERT INTO folder_closure (ancestor_id, descendant_id, depth)
      SELECT ancestor_id, ${created.id}, depth + 1
      FROM folder_closure
      WHERE descendant_id = ${parentId}
    `);

    await tx.insert(folderClosure).values({ ancestorId: created.id, descendantId: created.id, depth: 0 });

    return created;
  });
}
