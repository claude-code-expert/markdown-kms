// Phase 9 09-02 Task 1 (D-08): listMembershipsForUser's aggregate extension — real
// owner/createdAt/docCount/folderCount for workspace cards, no hardcoded placeholders.
import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { document, folder, user, workspace } from "@/db/schema";
import { listMembershipsForUser } from "@/lib/db-membership";
import { createFolder } from "@/lib/closure";
import { addMember, createTestUser, createTestWorkspace } from "../rbac/helpers";
import { createTestDocument } from "../documents/helpers";

// tests/rbac/helpers.ts imports @/auth transitively, which pulls in next-auth's
// next/server resolution — mocked here to avoid the module-resolution failure
// (same pattern as tests/folder/query-count.test.ts / cross-workspace.test.ts).
vi.mock("@/auth", () => ({ auth: vi.fn() }));

describe("listMembershipsForUser — aggregate fields (Phase 9 D-08)", () => {
  const createdUsers: string[] = [];
  const createdWorkspaces: string[] = [];

  afterEach(async () => {
    await Promise.all(
      createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))),
    );
    await Promise.all(createdUsers.splice(0).map((id) => db.delete(user).where(eq(user.id, id))));
  });

  it("returns real docCount/folderCount/ownerName/createdAt for a populated workspace", async () => {
    const owner = await createTestUser("membership-owner");
    createdUsers.push(owner.id);
    const ws = await createTestWorkspace("membership-populated");
    createdWorkspaces.push(ws.id);
    await addMember(ws.id, owner.id, "OWNER");

    const f1 = await createFolder(ws.id, null, "F1");
    await createFolder(ws.id, null, "F2");
    await createTestDocument(ws.id, f1.id);
    await createTestDocument(ws.id, null);
    await createTestDocument(ws.id, null);

    const result = await listMembershipsForUser(owner.id);
    const row = result.find((m) => m.id === ws.id);

    expect(row).toBeDefined();
    expect(row!.ownerName).toBe(owner.name);
    expect(row!.docCount).toBe(3);
    expect(row!.folderCount).toBe(2);
    expect(row!.createdAt).toBeInstanceOf(Date);
  });

  it("returns 0/0 for a brand new workspace with no documents or folders", async () => {
    const owner = await createTestUser("membership-empty");
    createdUsers.push(owner.id);
    const ws = await createTestWorkspace("membership-empty-ws");
    createdWorkspaces.push(ws.id);
    await addMember(ws.id, owner.id, "OWNER");

    const result = await listMembershipsForUser(owner.id);
    const row = result.find((m) => m.id === ws.id);

    expect(row!.docCount).toBe(0);
    expect(row!.folderCount).toBe(0);
  });

  it("returns ownerName null when the workspace has no OWNER member (seed-style all-EDITOR workspace)", async () => {
    const editor = await createTestUser("membership-no-owner");
    createdUsers.push(editor.id);
    const ws = await createTestWorkspace("membership-no-owner-ws");
    createdWorkspaces.push(ws.id);
    await addMember(ws.id, editor.id, "EDITOR");

    const result = await listMembershipsForUser(editor.id);
    const row = result.find((m) => m.id === ws.id);

    expect(row!.ownerName).toBeNull();
  });

  it("excludes soft-deleted (is_deleted=true) workspaces entirely", async () => {
    const owner = await createTestUser("membership-softdel");
    createdUsers.push(owner.id);
    const ws = await createTestWorkspace("membership-softdel-ws");
    createdWorkspaces.push(ws.id);
    await addMember(ws.id, owner.id, "OWNER");
    await db.update(workspace).set({ isDeleted: true }).where(eq(workspace.id, ws.id));

    const result = await listMembershipsForUser(owner.id);

    expect(result.find((m) => m.id === ws.id)).toBeUndefined();
  });

  it("excludes soft-deleted documents/folders and trash-root folders from the counts", async () => {
    const owner = await createTestUser("membership-partial-del");
    createdUsers.push(owner.id);
    const ws = await createTestWorkspace("membership-partial-del-ws");
    createdWorkspaces.push(ws.id);
    await addMember(ws.id, owner.id, "OWNER");

    await createFolder(ws.id, null, "Active");
    const deletedFolder = await createFolder(ws.id, null, "Deleted");
    await db.update(folder).set({ isDeleted: true }).where(eq(folder.id, deletedFolder.id));
    // Trash root: physically not deleted, but must not count as a "real" folder (behavior spec).
    const trashRoot = await createFolder(ws.id, null, "휴지통");
    await db.update(folder).set({ isTrashRoot: true }).where(eq(folder.id, trashRoot.id));

    await createTestDocument(ws.id, null);
    const deletedDoc = await createTestDocument(ws.id, null);
    await db.update(document).set({ isDeleted: true }).where(eq(document.id, deletedDoc.id));

    const result = await listMembershipsForUser(owner.id);
    const row = result.find((m) => m.id === ws.id);

    expect(row!.docCount).toBe(1);
    expect(row!.folderCount).toBe(1);
  });
});
