// TDD RED (03-02 Task 1): imports @/lib/closure and @/app/api/folders/route, neither of which
// exist yet — this file fails to even collect until Task 2 lands (TRD §10 TDD order).
// Reuses tests/rbac/helpers.ts factories + the vi.mock("@/auth") pattern from
// tests/rbac/matrix.test.ts so route-level RBAC/IDOR assertions don't reinvent session mocking.
import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { folder, folderClosure, user, workspace } from "@/db/schema";
import { createFolder, getWorkspaceFolders } from "@/lib/closure";
import { POST } from "@/app/api/folders/route";
import { addMember, createTestUser, createTestWorkspace, mockSessionFor } from "../rbac/helpers";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

describe("closure.createFolder — closure row correctness", () => {
  const createdWorkspaces: string[] = [];

  afterEach(async () => {
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
  });

  it("creates a root folder (parentId=null) with only a self closure row — no ancestor rows copied", async () => {
    const ws = await createTestWorkspace("closure-root-ws");
    createdWorkspaces.push(ws.id);

    const a = await createFolder(ws.id, null, "A");

    const rows = await db.select().from(folderClosure).where(eq(folderClosure.descendantId, a.id));
    expect(rows).toEqual([{ ancestorId: a.id, descendantId: a.id, depth: 0 }]);
  });

  it("copies the parent's ancestor rows at depth+1 plus a self row when creating a child", async () => {
    const ws = await createTestWorkspace("closure-child-ws");
    createdWorkspaces.push(ws.id);

    const a = await createFolder(ws.id, null, "A");
    const b = await createFolder(ws.id, a.id, "B");

    const rows = await db.select().from(folderClosure).where(eq(folderClosure.descendantId, b.id));
    const byAncestor = new Map(rows.map((row) => [row.ancestorId, row.depth]));
    expect(rows).toHaveLength(2);
    expect(byAncestor.get(b.id)).toBe(0);
    expect(byAncestor.get(a.id)).toBe(1);
  });

  it("accumulates depth through the grandparent for a third-level folder", async () => {
    const ws = await createTestWorkspace("closure-grandchild-ws");
    createdWorkspaces.push(ws.id);

    const a = await createFolder(ws.id, null, "A");
    const b = await createFolder(ws.id, a.id, "B");
    const c = await createFolder(ws.id, b.id, "C");

    const rows = await db.select().from(folderClosure).where(eq(folderClosure.descendantId, c.id));
    const byAncestor = new Map(rows.map((row) => [row.ancestorId, row.depth]));
    expect(rows).toHaveLength(3);
    expect(byAncestor.get(c.id)).toBe(0);
    expect(byAncestor.get(b.id)).toBe(1);
    expect(byAncestor.get(a.id)).toBe(2);
  });
});

describe("closure.getWorkspaceFolders — TREE-02", () => {
  const createdWorkspaces: string[] = [];

  afterEach(async () => {
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
  });

  it("returns only active (non-soft-deleted) folders", async () => {
    const ws = await createTestWorkspace("closure-softdel-ws");
    createdWorkspaces.push(ws.id);

    const a = await createFolder(ws.id, null, "A");
    const b = await createFolder(ws.id, null, "B");
    await db.update(folder).set({ isDeleted: true }).where(eq(folder.id, b.id));

    const active = await getWorkspaceFolders(ws.id);
    expect(active.map((f) => f.id)).toEqual([a.id]);
  });
});

describe("POST /api/folders — IDOR-safe workspaceId resolution + RBAC", () => {
  const createdUsers: string[] = [];
  const createdWorkspaces: string[] = [];

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
    await Promise.all(createdUsers.splice(0).map((id) => db.delete(user).where(eq(user.id, id))));
  });

  function req(body: unknown) {
    return new Request("http://localhost/api/folders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("creates a root folder for an EDITOR member and returns 201", async () => {
    const ws = await createTestWorkspace("folders-route-editor-ws");
    createdWorkspaces.push(ws.id);
    const editor = await createTestUser("folders-route-editor");
    createdUsers.push(editor.id);
    await addMember(ws.id, editor.id, "EDITOR");
    mockSessionFor(editor.id);

    const res = await POST(req({ name: "New Folder", parentId: null, workspaceId: ws.id }));
    expect(res.status).toBe(201);
  });

  it("rejects a VIEWER with 403", async () => {
    const ws = await createTestWorkspace("folders-route-viewer-ws");
    createdWorkspaces.push(ws.id);
    const viewer = await createTestUser("folders-route-viewer");
    createdUsers.push(viewer.id);
    await addMember(ws.id, viewer.id, "VIEWER");
    mockSessionFor(viewer.id);

    const res = await POST(req({ name: "New Folder", parentId: null, workspaceId: ws.id }));
    expect(res.status).toBe(403);
  });

  it("rejects a non-member caller with 403", async () => {
    const ws = await createTestWorkspace("folders-route-outsider-ws");
    createdWorkspaces.push(ws.id);
    const outsider = await createTestUser("folders-route-outsider");
    createdUsers.push(outsider.id);
    mockSessionFor(outsider.id);

    const res = await POST(req({ name: "New Folder", parentId: null, workspaceId: ws.id }));
    expect(res.status).toBe(403);
  });

  it("rejects a parentId belonging to a different workspace with 400 (IDOR — never trust body.workspaceId)", async () => {
    const wsA = await createTestWorkspace("folders-route-xws-a");
    const wsB = await createTestWorkspace("folders-route-xws-b");
    createdWorkspaces.push(wsA.id, wsB.id);
    const editor = await createTestUser("folders-route-xws-editor");
    createdUsers.push(editor.id);
    await addMember(wsA.id, editor.id, "EDITOR");
    mockSessionFor(editor.id);

    const foreign = await createFolder(wsB.id, null, "Foreign");

    const res = await POST(req({ name: "New Folder", parentId: foreign.id, workspaceId: wsA.id }));
    expect(res.status).toBe(400);
  });
});
