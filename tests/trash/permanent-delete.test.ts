// 04-04 Task 2 (RED): permanentlyDeleteFolder/permanentlyDeleteDocument don't exist yet — fails
// to collect until Task 2 lands. Covers RESEARCH Pitfall 4 (document.folder_id has no ON DELETE
// CASCADE — document rows must be DELETEd before folder rows, or Postgres raises an FK violation).
import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { document, folder, folderClosure, workspace } from "@/db/schema";
import { createFolder, permanentlyDeleteFolder } from "@/lib/closure";
import { permanentlyDeleteDocument } from "@/lib/documents";
import { createTestWorkspace } from "../rbac/helpers";
import { createTestDocument } from "../documents/helpers";

// tests/rbac/helpers.ts imports "@/auth" (next-auth) at module scope — mocked here even though
// this file never calls mockSessionFor (tests/documents/autosave-seq-guard.test.ts precedent).
vi.mock("@/auth", () => ({ auth: vi.fn() }));

describe("closure.permanentlyDeleteFolder — FK order (document before folder)", () => {
  const createdWorkspaces: string[] = [];

  afterEach(async () => {
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
  });

  it("permanently deletes a folder containing documents without an FK violation", async () => {
    const ws = await createTestWorkspace("perm-delete-fk-ws");
    createdWorkspaces.push(ws.id);
    const a = await createFolder(ws.id, null, "A");
    await createTestDocument(ws.id, a.id, { title: "X" });

    await expect(permanentlyDeleteFolder(a.id)).resolves.not.toThrow();
  });

  it("removes document, folder, and folder_closure rows for the whole subtree", async () => {
    const ws = await createTestWorkspace("perm-delete-subtree-ws");
    createdWorkspaces.push(ws.id);
    const a = await createFolder(ws.id, null, "A");
    const b = await createFolder(ws.id, a.id, "B");
    const x = await createTestDocument(ws.id, a.id, { title: "X" });
    const y = await createTestDocument(ws.id, b.id, { title: "Y" });

    await permanentlyDeleteFolder(a.id);

    const remainingFolders = await db.select().from(folder).where(eq(folder.workspaceId, ws.id));
    const remainingDocs = await db.select().from(document).where(eq(document.workspaceId, ws.id));
    const remainingClosureA = await db.select().from(folderClosure).where(eq(folderClosure.descendantId, a.id));
    const remainingClosureB = await db.select().from(folderClosure).where(eq(folderClosure.descendantId, b.id));

    expect(remainingFolders.map((f) => f.id)).not.toContain(a.id);
    expect(remainingFolders.map((f) => f.id)).not.toContain(b.id);
    expect(remainingDocs.map((d) => d.id)).not.toContain(x.id);
    expect(remainingDocs.map((d) => d.id)).not.toContain(y.id);
    expect(remainingClosureA).toHaveLength(0);
    expect(remainingClosureB).toHaveLength(0);
  });

  it("works on an already soft-deleted subtree (trash contents, not just active rows)", async () => {
    const ws = await createTestWorkspace("perm-delete-trashed-ws");
    createdWorkspaces.push(ws.id);
    const a = await createFolder(ws.id, null, "A");
    await createTestDocument(ws.id, a.id, { title: "X" });
    await db.update(folder).set({ isDeleted: true, isTrashRoot: true }).where(eq(folder.id, a.id));

    await expect(permanentlyDeleteFolder(a.id)).resolves.not.toThrow();
    const [row] = await db.select().from(folder).where(eq(folder.id, a.id));
    expect(row).toBeUndefined();
  });
});

describe("documents.permanentlyDeleteDocument — single-row physical delete", () => {
  const createdWorkspaces: string[] = [];

  afterEach(async () => {
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
  });

  it("removes the document row", async () => {
    const ws = await createTestWorkspace("perm-delete-doc-ws");
    createdWorkspaces.push(ws.id);
    const doc = await createTestDocument(ws.id, null, { title: "Solo" });

    await permanentlyDeleteDocument(doc.id);

    const [row] = await db.select().from(document).where(eq(document.id, doc.id));
    expect(row).toBeUndefined();
  });
});
