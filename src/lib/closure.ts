import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { folder, folderClosure } from "@/db/schema";

// TRD §4 "폴더 이동" — moving into a cycle (self or a descendant). Rejected before any rewiring
// happens (RESEARCH Pitfall 1, TOCTOU: check + rewiring share one transaction).
export class CycleError extends Error {}

// TRD §4 "폴더 이동" — newParentId belongs to a different workspace (RESEARCH Pitfall 2).
export class CrossWorkspaceError extends Error {}

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

// TRD §4 / RESEARCH Pattern 2: ancestor-based subtree (self included), single closure-join
// query, depth-independent (TREE-02). Used by cascade soft-delete — always pass `tx` there so
// the read stays inside the same transaction as the UPDATE (RESEARCH Pitfall 4, read-skew).
export async function getSubtree(folderId: string, client: DbClient = db) {
  return client
    .select({
      id: folder.id,
      parentId: folder.parentId,
      name: folder.name,
      workspaceId: folder.workspaceId,
    })
    .from(folder)
    .innerJoin(folderClosure, eq(folderClosure.descendantId, folder.id))
    .where(and(eq(folderClosure.ancestorId, folderId), eq(folder.isDeleted, false)));
}

// TRD §4 / RESEARCH Pattern 4: cycle check (same transaction, first statement) + cross-workspace
// rejection + DELETE external ancestor links + CROSS JOIN INSERT new ancestors x subtree +
// folder.parentId update. Throwing rolls the whole transaction back (RESEARCH: db.transaction
// auto-rollback on throw) — a cycle/cross-workspace rejection never touches a single row.
export async function moveFolder(folderId: string, newParentId: string | null, client: DbClient = db) {
  return client.transaction(async (tx) => {
    if (newParentId) {
      // Cycle check MUST be the transaction's first statement (TOCTOU, RESEARCH Pitfall 1).
      // A closure row (folderId -> newParentId) exists when newParentId is folderId itself
      // (self row) or a descendant of folderId.
      const [cycle] = await tx
        .select({ hit: sql<number>`1` })
        .from(folderClosure)
        .where(and(eq(folderClosure.ancestorId, folderId), eq(folderClosure.descendantId, newParentId)));
      if (cycle) throw new CycleError("Cannot move a folder into itself or its own descendant.");

      const [target] = await tx.select({ workspaceId: folder.workspaceId }).from(folder).where(eq(folder.id, folderId));
      const [newParent] = await tx
        .select({ workspaceId: folder.workspaceId })
        .from(folder)
        .where(eq(folder.id, newParentId));
      if (!newParent || !target || newParent.workspaceId !== target.workspaceId) {
        throw new CrossWorkspaceError("Cannot move a folder into a different workspace.");
      }
    }

    // Drop the subtree's external (outside-subtree) ancestor links only — internal links between
    // subtree members are preserved.
    await tx.execute(sql`
      DELETE FROM folder_closure
      WHERE descendant_id IN (SELECT descendant_id FROM folder_closure WHERE ancestor_id = ${folderId})
        AND ancestor_id NOT IN (SELECT descendant_id FROM folder_closure WHERE ancestor_id = ${folderId})
    `);

    if (newParentId) {
      await tx.execute(sql`
        INSERT INTO folder_closure (ancestor_id, descendant_id, depth)
        SELECT p.ancestor_id, c.descendant_id, p.depth + c.depth + 1
        FROM folder_closure p
        CROSS JOIN folder_closure c
        WHERE p.descendant_id = ${newParentId} AND c.ancestor_id = ${folderId}
      `);
    }

    await tx.update(folder).set({ parentId: newParentId, updatedAt: new Date() }).where(eq(folder.id, folderId));
  });
}
