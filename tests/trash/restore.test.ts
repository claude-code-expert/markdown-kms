// 04-04 Task 1 (RED): restoreFolder/restoreDocument/resolveWorkspaceIdForTrashItem/getTrashItems
// don't exist in @/lib/closure or @/lib/documents yet — this file fails to collect until Task 1
// lands (TRD §10 TDD order). Covers RESEARCH Pattern 5 + Pitfall 5 (Open Question #2: a document
// independently trashed before its parent folder is deleted must NOT be revived by restore).
import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { document, folder, workspace } from "@/db/schema";
import { createFolder, getTrashItems, resolveWorkspaceIdForTrashItem, restoreFolder, softDeleteFolder } from "@/lib/closure";
import { restoreDocument, softDeleteDocument } from "@/lib/documents";
import { createTestWorkspace } from "../rbac/helpers";
import { createTestDocument } from "../documents/helpers";

// tests/rbac/helpers.ts imports "@/auth" (next-auth) at module scope — mocked here even though
// this file never calls mockSessionFor (tests/documents/autosave-seq-guard.test.ts precedent).
vi.mock("@/auth", () => ({ auth: vi.fn() }));

describe("closure.restoreFolder — cascade restore, independent-trash preserved (Open Q #2)", () => {
  const createdWorkspaces: string[] = [];

  afterEach(async () => {
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
  });

  it("restores a deleted folder's subtree (folders + cascaded documents) to active", async () => {
    const ws = await createTestWorkspace("restore-basic-ws");
    createdWorkspaces.push(ws.id);
    const a = await createFolder(ws.id, null, "A");
    const b = await createFolder(ws.id, a.id, "B");
    const x = await createTestDocument(ws.id, a.id, { title: "X" });
    const y = await createTestDocument(ws.id, b.id, { title: "Y" });

    await softDeleteFolder(a.id);
    const result = await restoreFolder(a.id);

    const [restoredA] = await db.select().from(folder).where(eq(folder.id, a.id));
    const [restoredB] = await db.select().from(folder).where(eq(folder.id, b.id));
    const [restoredX] = await db.select().from(document).where(eq(document.id, x.id));
    const [restoredY] = await db.select().from(document).where(eq(document.id, y.id));

    expect(restoredA.isDeleted).toBe(false);
    expect(restoredA.deletedAt).toBeNull();
    expect(restoredA.isTrashRoot).toBe(false);
    expect(restoredB.isDeleted).toBe(false);
    expect(restoredX.isDeleted).toBe(false);
    expect(restoredY.isDeleted).toBe(false);
    expect(result?.relocatedToRoot).toBe(false);
  });

  // Open Question #2, the plan's explicit scenario: document X is trashed independently BEFORE
  // its parent folder A is deleted. Restoring A must NOT revive X — X stays in the trash.
  it("does not revive a document that was independently trashed before its parent folder was deleted", async () => {
    const ws = await createTestWorkspace("restore-openq2-ws");
    createdWorkspaces.push(ws.id);
    const a = await createFolder(ws.id, null, "A");
    const x = await createTestDocument(ws.id, a.id, { title: "X" });
    await softDeleteDocument(x.id); // independent trash, X.isTrashRoot=true

    await softDeleteFolder(a.id); // cascade skips X (already is_deleted=true)
    await restoreFolder(a.id);

    const [restoredA] = await db.select().from(folder).where(eq(folder.id, a.id));
    const [stillTrashedX] = await db.select().from(document).where(eq(document.id, x.id));

    expect(restoredA.isDeleted).toBe(false);
    expect(stillTrashedX.isDeleted).toBe(true);
    expect(stillTrashedX.isTrashRoot).toBe(true);
  });

  // Independent-trash preservation applies to nested folders too — a folder trashed on its own
  // before an ancestor's cascade must not be swept back in by the ancestor's restore.
  it("does not revive a folder that was independently trashed before an ancestor was deleted", async () => {
    const ws = await createTestWorkspace("restore-nested-openq2-ws");
    createdWorkspaces.push(ws.id);
    const a = await createFolder(ws.id, null, "A");
    const b = await createFolder(ws.id, a.id, "B");
    await softDeleteFolder(b.id); // independent trash, B.isTrashRoot=true

    await softDeleteFolder(a.id); // cascade skips B (getSubtree only returns active rows)
    await restoreFolder(a.id);

    const [restoredA] = await db.select().from(folder).where(eq(folder.id, a.id));
    const [stillTrashedB] = await db.select().from(folder).where(eq(folder.id, b.id));

    expect(restoredA.isDeleted).toBe(false);
    expect(stillTrashedB.isDeleted).toBe(true);
    expect(stillTrashedB.isTrashRoot).toBe(true);
  });

  it("relocates to workspace root (reusing moveFolder) when the original parent is deleted", async () => {
    const ws = await createTestWorkspace("restore-root-relocate-ws");
    createdWorkspaces.push(ws.id);
    const parent = await createFolder(ws.id, null, "Parent");
    const a = await createFolder(ws.id, parent.id, "A");

    await softDeleteFolder(a.id); // A directly trashed while Parent is still active
    await softDeleteFolder(parent.id); // Parent independently trashed afterwards; cascade skips A

    const result = await restoreFolder(a.id);

    const [restoredA] = await db.select().from(folder).where(eq(folder.id, a.id));
    expect(restoredA.isDeleted).toBe(false);
    expect(restoredA.parentId).toBeNull();
    expect(result?.relocatedToRoot).toBe(true);
  });

  it("returns null and does nothing for a folder that is not a trash root (not directly deleted)", async () => {
    const ws = await createTestWorkspace("restore-not-root-ws");
    createdWorkspaces.push(ws.id);
    const a = await createFolder(ws.id, null, "A");

    const result = await restoreFolder(a.id); // never deleted
    expect(result).toBeNull();
    const [row] = await db.select().from(folder).where(eq(folder.id, a.id));
    expect(row.isDeleted).toBe(false);
  });
});

describe("documents.restoreDocument — single-document restore", () => {
  const createdWorkspaces: string[] = [];

  afterEach(async () => {
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
  });

  it("restores a directly-trashed document to active", async () => {
    const ws = await createTestWorkspace("restore-doc-ws");
    createdWorkspaces.push(ws.id);
    const doc = await createTestDocument(ws.id, null, { title: "Solo" });
    await softDeleteDocument(doc.id);

    await restoreDocument(doc.id);

    const [restored] = await db.select().from(document).where(eq(document.id, doc.id));
    expect(restored.isDeleted).toBe(false);
    expect(restored.deletedAt).toBeNull();
    expect(restored.isTrashRoot).toBe(false);
  });

  it("is a no-op for a document that isn't a trash root", async () => {
    const ws = await createTestWorkspace("restore-doc-not-root-ws");
    createdWorkspaces.push(ws.id);
    const doc = await createTestDocument(ws.id, null, { title: "Active" });

    await restoreDocument(doc.id);

    const [row] = await db.select().from(document).where(eq(document.id, doc.id));
    expect(row.isDeleted).toBe(false);
  });
});

describe("closure.resolveWorkspaceIdForTrashItem — is_deleted-agnostic IDOR lookup", () => {
  const createdWorkspaces: string[] = [];

  afterEach(async () => {
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
  });

  it("resolves workspaceId for an is_deleted=true folder (getSubtree/resolveActiveWorkspaceId would miss this)", async () => {
    const ws = await createTestWorkspace("resolve-trash-folder-ws");
    createdWorkspaces.push(ws.id);
    const a = await createFolder(ws.id, null, "A");
    await softDeleteFolder(a.id);

    const result = await resolveWorkspaceIdForTrashItem("folder", a.id);
    expect(result?.workspaceId).toBe(ws.id);
  });

  it("resolves workspaceId for an is_deleted=true document", async () => {
    const ws = await createTestWorkspace("resolve-trash-doc-ws");
    createdWorkspaces.push(ws.id);
    const doc = await createTestDocument(ws.id, null, { title: "Solo" });
    await softDeleteDocument(doc.id);

    const result = await resolveWorkspaceIdForTrashItem("document", doc.id);
    expect(result?.workspaceId).toBe(ws.id);
  });

  it("returns null for a nonexistent id", async () => {
    const result = await resolveWorkspaceIdForTrashItem("folder", "00000000-0000-0000-0000-000000000000");
    expect(result).toBeNull();
  });
});

describe("closure.getTrashItems — folder ∪ document is_trash_root=true", () => {
  const createdWorkspaces: string[] = [];

  afterEach(async () => {
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
  });

  it("lists directly-deleted folders and documents, excluding cascaded (non-trash-root) descendants", async () => {
    const ws = await createTestWorkspace("trash-items-ws");
    createdWorkspaces.push(ws.id);
    const a = await createFolder(ws.id, null, "A");
    const b = await createFolder(ws.id, a.id, "B"); // cascaded, not a trash root
    const solo = await createTestDocument(ws.id, null, { title: "Solo" });
    await softDeleteFolder(a.id);
    await softDeleteDocument(solo.id);

    const items = await getTrashItems(ws.id);
    const ids = items.map((i) => i.id);

    expect(ids).toContain(a.id);
    expect(ids).toContain(solo.id);
    expect(ids).not.toContain(b.id);
  });
});
