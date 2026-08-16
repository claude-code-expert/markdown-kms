import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { document, folder, folderClosure } from "@/db/schema";
import { resolveWorkspaceIdForDocument } from "@/lib/documents";

// TRD §4 "폴더 이동" — moving into a cycle (self or a descendant). Rejected before any rewiring
// happens (RESEARCH Pitfall 1, TOCTOU: check + rewiring share one transaction).
export class CycleError extends Error {}

// TRD §4 "폴더 이동" — newParentId belongs to a different workspace (RESEARCH Pitfall 2).
export class CrossWorkspaceError extends Error {}

// Both functions take an optional db/tx client (RESEARCH A3) — the query-count test injects a
// debug-hooked client, and cascade operations (move/soft-delete) inject the transaction's `tx`
// so their subtree reads stay inside the same transaction (RESEARCH Pitfall 4). `tx` (the
// callback param of db.transaction) isn't structurally the same type as `db` (it lacks
// `$client`), so the alias is a union of both rather than just `typeof db`.
type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

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

// T-03-04-IDOR / WR-02 / WR-03: shared "resolve workspace_id from a folder id" lookup, used by
// every mutation route that has no wsId in the URL (PATCH/DELETE/move rename target, and the
// create route's parentId lookup) instead of each reimplementing it. isDeleted=false means a
// soft-deleted folder behaves like it doesn't exist — callers treat a null return the same as a
// nonexistent id (403/400 per their existing convention), never silently mutating a trashed row.
export async function resolveActiveWorkspaceId(folderId: string, client: DbClient = db) {
  const [row] = await client
    .select({ workspaceId: folder.workspaceId })
    .from(folder)
    .where(and(eq(folder.id, folderId), eq(folder.isDeleted, false)));
  return row ?? null;
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

      // WR-02: filter isDeleted=false on both ends — a soft-deleted newParentId must be
      // rejected the same as a nonexistent one (CrossWorkspaceError -> 400), not silently
      // accepted as a move target.
      const target = await resolveActiveWorkspaceId(folderId, tx);
      const newParent = await resolveActiveWorkspaceId(newParentId, tx);
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

// moveFolder의 문서 버전 — document는 closure table에 없는 leaf라 사이클 체크·재배선이
// 필요 없다. newFolderId가 문서와 같은 workspace의 활성 폴더인지만 검증(moveFolder와 동일한
// CrossWorkspaceError 재사용, 새 에러 타입 안 만듦).
export async function moveDocument(documentId: string, newFolderId: string | null, client: DbClient = db) {
  return client.transaction(async (tx) => {
    if (newFolderId) {
      const doc = await resolveWorkspaceIdForDocument(documentId, tx);
      const newFolder = await resolveActiveWorkspaceId(newFolderId, tx);
      if (!doc || !newFolder || newFolder.workspaceId !== doc.workspaceId) {
        throw new CrossWorkspaceError("Cannot move a document into a different workspace.");
      }
    }
    await tx.update(document).set({ folderId: newFolderId, updatedAt: new Date() }).where(eq(document.id, documentId));
  });
}

// TRD §4 "폴더 삭제" / RESEARCH Pattern 5: cascade soft-delete. getSubtree(folderId, tx) reads
// the subtree id list inside the same transaction as the UPDATE (RESEARCH Pitfall 4, read-skew
// avoidance) — the whole subtree gets is_deleted=true/deleted_at, only the delete target gets
// is_trash_root=true. folder_closure rows are left untouched (restore is the inverse op, TRD §4).
// Phase 4 will extend this transaction with `document WHERE folder_id = ANY(ids)` once the
// document table exists — no document table in this phase, so no query for it here.
//
// WR-01: idempotent on an already-deleted target. A descendant already cascaded into
// is_deleted=true by an ancestor's delete has an empty subtree here (getSubtree only returns
// active rows), so the is_trash_root UPDATE below would otherwise still fire unconditionally and
// fabricate a second independent trash-root for one delete. Bail out before touching any row.
export async function softDeleteFolder(folderId: string, client: DbClient = db) {
  return client.transaction(async (tx) => {
    const [target] = await tx.select({ isDeleted: folder.isDeleted }).from(folder).where(eq(folder.id, folderId));
    if (!target || target.isDeleted) return;

    const subtree = await getSubtree(folderId, tx);
    const ids = subtree.map((f) => f.id);

    await tx.update(folder).set({ isDeleted: true, deletedAt: new Date() }).where(inArray(folder.id, ids));
    await tx.update(folder).set({ isTrashRoot: true }).where(eq(folder.id, folderId));

    // TRD §4 폴더 삭제 cascade / RESEARCH Pattern 4: subtree 소속 문서도 함께 소프트삭제.
    // `AND is_deleted=false` (WR-01 대칭): 하위 폴더가 삭제되기 전에 이미 독립적으로 트래시된
    // 문서는 건드리지 않는다 — 그 문서의 is_trash_root/deleted_at을 그대로 보존한다.
    await tx
      .update(document)
      .set({ isDeleted: true, deletedAt: new Date() })
      .where(and(inArray(document.folderId, ids), eq(document.isDeleted, false)));
  });
}

// CR-01: must resolve ONLY actual trash roots (is_trash_root=true) — resolving any row
// (active included) let an ADMIN permanently delete an active document/folder (and a folder's
// whole active subtree) via DELETE /api/trash/:type/:id with no soft-delete step ever having
// happened. softDeleteFolder/softDeleteDocument always set is_trash_root=true on the direct
// delete target, so this filter doesn't change resolution for anything actually in the trash —
// only for active rows, which now correctly fail to resolve (route responds 403/404).
// type-scoped: a trash item is always exactly one of folder|document (TRD §8 unified route).
// WR-03: document branch delegates to documents.ts's resolveWorkspaceIdForDocument instead of
// reimplementing the same select — one source of truth for "workspaceId from a document id".
export async function resolveWorkspaceIdForTrashItem(
  type: "folder" | "document",
  id: string,
  client: DbClient = db,
) {
  if (type === "folder") {
    const [row] = await client
      .select({ workspaceId: folder.workspaceId })
      .from(folder)
      .where(and(eq(folder.id, id), eq(folder.isTrashRoot, true)));
    return row ?? null;
  }
  return resolveWorkspaceIdForDocument(id, client, { trashRootOnly: true });
}

// TRD §4 복원 / RESEARCH Pattern 5: trash_root 기준 서브트리 복원. getSubtree는 is_deleted=false만
// 반환하므로 여기선 쓸 수 없다(Pitfall 3) — closure를 직접 조인해 is_deleted=true인 서브트리를
// 모은다. WR-01 대칭(Pitfall 5, Open Question #2): 서브트리 안에서 자기 자신이 아니면서
// is_trash_root=true인 항목(독립적으로 먼저 트래시된 것)은 복원 대상에서 제외한다.
export async function restoreFolder(folderId: string, client: DbClient = db) {
  return client.transaction(async (tx) => {
    const [target] = await tx
      .select({ isTrashRoot: folder.isTrashRoot, parentId: folder.parentId })
      .from(folder)
      .where(eq(folder.id, folderId));
    if (!target || !target.isTrashRoot) return null; // 직접 삭제된 항목만 복원 가능(PRD §2-2)

    const subtree = await tx
      .select({ id: folder.id, isTrashRoot: folder.isTrashRoot })
      .from(folder)
      .innerJoin(folderClosure, eq(folderClosure.descendantId, folder.id))
      .where(and(eq(folderClosure.ancestorId, folderId), eq(folder.isDeleted, true)));

    const restorableIds = subtree.filter((f) => f.id === folderId || !f.isTrashRoot).map((f) => f.id);

    await tx.update(folder).set({ isDeleted: false, deletedAt: null }).where(inArray(folder.id, restorableIds));
    await tx.update(folder).set({ isTrashRoot: false }).where(eq(folder.id, folderId));
    // cascade로 딸려온(is_trash_root=false) 문서만 복원 — 독립적으로 트래시된 문서는 그대로 둔다.
    await tx
      .update(document)
      .set({ isDeleted: false, deletedAt: null })
      .where(and(inArray(document.folderId, restorableIds), eq(document.isTrashRoot, false)));

    if (target.parentId) {
      const [parent] = await tx
        .select({ isDeleted: folder.isDeleted })
        .from(folder)
        .where(eq(folder.id, target.parentId));
      if (!parent || parent.isDeleted) {
        // 기존 moveFolder를 재사용 — closure 재작성을 두 번째로 구현하지 않는다(Don't Hand-Roll).
        await moveFolder(folderId, null, tx);
        return { relocatedToRoot: true };
      }
    }
    return { relocatedToRoot: false };
  });
}

// RESEARCH Pitfall 4: document.folder_id에 ON DELETE CASCADE가 없다 — folder보다 document를
// 먼저 DELETE한다. folder_closure 양쪽 컬럼은 ON DELETE CASCADE라 folder 삭제로 자동 정리된다.
// 서브트리 id 목록은 is_deleted 필터 없이 closure 직접 조인으로 모은다(활성/비활성 무관 — 완전
// 삭제는 휴지통에 있는 항목에 대해 호출되지만 필터를 걸 이유가 없다).
export async function permanentlyDeleteFolder(folderId: string, client: DbClient = db) {
  return client.transaction(async (tx) => {
    const subtree = await tx
      .select({ id: folder.id })
      .from(folder)
      .innerJoin(folderClosure, eq(folderClosure.descendantId, folder.id))
      .where(eq(folderClosure.ancestorId, folderId));
    const ids = subtree.map((f) => f.id);

    await tx.delete(document).where(inArray(document.folderId, ids)); // 먼저 (Pitfall 4)
    await tx.delete(folder).where(inArray(folder.id, ids)); // folder_closure는 cascade 자동정리
  });
}

// folder ∪ document의 is_trash_root=true 항목(휴지통 목록, 04-05가 소비). 두 쿼리를 병합 —
// 서로 다른 테이블이라 UNION보다 애플리케이션 레벨 병합이 타입 안전하고 명확하다.
export async function getTrashItems(workspaceId: string, client: DbClient = db) {
  const folders = await client
    .select({ id: folder.id, name: folder.name, deletedAt: folder.deletedAt })
    .from(folder)
    .where(and(eq(folder.workspaceId, workspaceId), eq(folder.isTrashRoot, true)));
  const documents = await client
    .select({ id: document.id, title: document.title, deletedAt: document.deletedAt })
    .from(document)
    .where(and(eq(document.workspaceId, workspaceId), eq(document.isTrashRoot, true)));

  return [
    ...folders.map((f) => ({ type: "folder" as const, id: f.id, name: f.name, deletedAt: f.deletedAt })),
    ...documents.map((d) => ({ type: "document" as const, id: d.id, name: d.title, deletedAt: d.deletedAt })),
  ];
}
