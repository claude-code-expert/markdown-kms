// Document CRUD/soft-delete/autosave service — mirrors src/lib/closure.ts's DbClient injection
// pattern exactly (see closure.ts:12-17 for the union type's rationale: tx isn't structurally
// typeof db, so the alias unions both).
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { document, documentDraft, folder } from "@/db/schema";

type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

// TREE-02 analog (closure.ts getWorkspaceFolders): flat workspace_id filter, always exactly 1 SQL
// statement. Only active documents — soft-deleted rows are excluded from the tree listing.
export async function getWorkspaceDocuments(workspaceId: string, client: DbClient = db) {
  return client
    .select({ id: document.id, folderId: document.folderId, title: document.title })
    .from(document)
    .where(and(eq(document.workspaceId, workspaceId), eq(document.isDeleted, false)));
}

// RESEARCH Pitfall 6 / T-04-01-IDOR: scoped by workspaceId, not just documentId — a document id
// guessed/enumerated from another workspace never resolves here. Soft-deleted documents are
// treated as nonexistent, same as resolveActiveWorkspaceId's convention in closure.ts.
export async function getDocument(documentId: string, workspaceId: string, client: DbClient = db) {
  const [row] = await client
    .select()
    .from(document)
    .where(and(eq(document.id, documentId), eq(document.workspaceId, workspaceId), eq(document.isDeleted, false)));
  return row ?? null;
}

// PUT (autosave) route's IDOR/existence guard — active documents only (a trashed document is not
// a valid autosave target). resolveActiveWorkspaceId(closure.ts:35-41) analog.
//
// WR-03: single source of truth for "workspaceId from a document id" — closure.ts's
// resolveWorkspaceIdForTrashItem reuses this (via { trashRootOnly: true }) instead of
// reimplementing the same select with a different filter.
export async function resolveWorkspaceIdForDocument(
  documentId: string,
  client: DbClient = db,
  opts: { trashRootOnly?: boolean } = {},
) {
  const filter = opts.trashRootOnly
    ? and(eq(document.id, documentId), eq(document.isTrashRoot, true))
    : and(eq(document.id, documentId), eq(document.isDeleted, false));
  const [row] = await client.select({ workspaceId: document.workspaceId }).from(document).where(filter);
  return row ?? null;
}

export async function createDocument(
  workspaceId: string,
  folderId: string | null,
  title: string,
  client: DbClient = db,
) {
  const [created] = await client.insert(document).values({ workspaceId, folderId, title }).returning();
  return created;
}

// WR-01 analog (closure.ts softDeleteFolder): `AND is_deleted=false` makes a second call a no-op
// instead of unconditionally overwriting deletedAt/isTrashRoot on an already-trashed document.
export async function softDeleteDocument(documentId: string, client: DbClient = db) {
  await client
    .update(document)
    .set({ isDeleted: true, deletedAt: new Date(), isTrashRoot: true })
    .where(and(eq(document.id, documentId), eq(document.isDeleted, false)));
}

// closure.ts restoreFolder's single-document analog — only a directly-trashed document
// (is_trash_root=true) is restorable; a document still cascaded under a trashed folder is
// restored via restoreFolder, not this function. 04-05 Rule 2 parity fix: mirrors
// restoreFolder's root-relocation (Open Q #2) — a document trashed independently while its
// folder was still active, then left behind (not revived) when that folder was later deleted,
// must not resurface under a still-deleted folderId (it would vanish from the tree, no active
// parent node to render under). No closure table to rewrite for a document, so relocation is
// a plain folderId=null update (no moveFolder reuse needed, unlike restoreFolder).
export async function restoreDocument(documentId: string, client: DbClient = db) {
  return client.transaction(async (tx) => {
    const [target] = await tx
      .select({ folderId: document.folderId })
      .from(document)
      .where(and(eq(document.id, documentId), eq(document.isTrashRoot, true)));
    if (!target) return null; // not a trash root — no-op, matches softDeleteDocument's WR-01 convention

    await tx
      .update(document)
      .set({ isDeleted: false, deletedAt: null, isTrashRoot: false })
      .where(and(eq(document.id, documentId), eq(document.isTrashRoot, true)));

    if (target.folderId) {
      const [parent] = await tx.select({ isDeleted: folder.isDeleted }).from(folder).where(eq(folder.id, target.folderId));
      if (!parent || parent.isDeleted) {
        await tx.update(document).set({ folderId: null }).where(eq(document.id, documentId));
        return { relocatedToRoot: true };
      }
    }
    return { relocatedToRoot: false };
  });
}

// closure.ts permanentlyDeleteFolder's single-row analog — a document has no children, so no
// FK-order concern (Pitfall 4 only applies to folder's document/folder_closure dependents).
export async function permanentlyDeleteDocument(documentId: string, client: DbClient = db) {
  await client.delete(document).where(eq(document.id, documentId));
}

// TRD §7 / T-04-01-SEQ: the WHERE clause is the concurrency judge, not this function — a stale
// (lower-or-equal) seq matches 0 rows and is silently ignored (not an error). Mass-assignment
// guard (T-04-01-MASS): only content/title/savedSeq/updatedAt are ever set, never arbitrary
// client-supplied fields. Content is never trimmed/transformed (NFR-5.2, markdown-meaningful
// whitespace preserved as-is).
export async function autosaveDocument(
  documentId: string,
  content: string,
  title: string,
  seq: number,
  client: DbClient = db,
) {
  const rows = await client
    .update(document)
    .set({ content, title, savedSeq: seq, updatedAt: new Date() })
    .where(and(eq(document.id, documentId), lt(document.savedSeq, seq)))
    .returning({ id: document.id });
  return rows.length === 1;
}

// TRD §3 / §7 (FR-E10, NFR-2.1): document_id is the PK — onConflictDoUpdate is the DB-level
// enforcement of "exactly 1 draft row per document" (T-05-03-MULTIROW). No seq guard (unlike
// autosaveDocument) — draft has no ordering concept, it's a 1-minute-interval upsert.
export async function upsertDraft(documentId: string, content: string, client: DbClient = db) {
  await client
    .insert(documentDraft)
    .values({ documentId, content, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: documentDraft.documentId,
      set: { content, updatedAt: new Date() },
    });
}

export async function getDraft(documentId: string, client: DbClient = db) {
  const [row] = await client.select().from(documentDraft).where(eq(documentDraft.documentId, documentId));
  return row ?? null;
}

export async function deleteDraft(documentId: string, client: DbClient = db) {
  await client.delete(documentDraft).where(eq(documentDraft.documentId, documentId));
}

// 05-05 Pitfall 7: the ONLY place draft-vs-document recency is decided. Pure (no DB, no client
// clock) — callers (d/[docId]/page.tsx, RSC) must feed it two timestamps read in the SAME
// request context so no network-induced clock skew can leak into the comparison. A tie is NOT
// newer (strict >) — a draft saved at the exact instant of a successful autosave isn't a crash
// artifact worth recovering.
export function isDraftNewer(
  draft: { updatedAt: Date } | null,
  doc: { updatedAt: Date },
): boolean {
  if (!draft) return false;
  return draft.updatedAt > doc.updatedAt;
}
