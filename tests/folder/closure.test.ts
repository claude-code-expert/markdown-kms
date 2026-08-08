// TDD RED (03-02 Task 1): imports @/lib/closure and @/app/api/folders/route, neither of which
// exist yet — this file fails to even collect until Task 2 lands (TRD §10 TDD order).
// Reuses tests/rbac/helpers.ts factories + the vi.mock("@/auth") pattern from
// tests/rbac/matrix.test.ts so route-level RBAC/IDOR assertions don't reinvent session mocking.
//
// 03-03 Task 1 (RED): adds getSubtree/moveFolder/softDeleteFolder describe blocks — importing
// CycleError/getSubtree/moveFolder/softDeleteFolder from @/lib/closure fails until Task 2/3 land.
import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { folder, folderClosure, user, workspace } from "@/db/schema";
import { CycleError, createFolder, getSubtree, getWorkspaceFolders, moveFolder, softDeleteFolder } from "@/lib/closure";
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

describe("closure.getSubtree — ancestor-based single-query subtree (TREE-02)", () => {
  const createdWorkspaces: string[] = [];

  afterEach(async () => {
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
  });

  // Tree: A > B > C, A > D
  async function buildTree(wsId: string) {
    const a = await createFolder(wsId, null, "A");
    const b = await createFolder(wsId, a.id, "B");
    const c = await createFolder(wsId, b.id, "C");
    const d = await createFolder(wsId, a.id, "D");
    return { a, b, c, d };
  }

  it("getSubtree(A) returns {A,B,C,D}", async () => {
    const ws = await createTestWorkspace("subtree-a-ws");
    createdWorkspaces.push(ws.id);
    const { a, b, c, d } = await buildTree(ws.id);

    const rows = await getSubtree(a.id);
    expect(new Set(rows.map((f) => f.id))).toEqual(new Set([a.id, b.id, c.id, d.id]));
  });

  it("getSubtree(B) returns {B,C}", async () => {
    const ws = await createTestWorkspace("subtree-b-ws");
    createdWorkspaces.push(ws.id);
    const { b, c } = await buildTree(ws.id);

    const rows = await getSubtree(b.id);
    expect(new Set(rows.map((f) => f.id))).toEqual(new Set([b.id, c.id]));
  });

  it("excludes soft-deleted folders from the subtree", async () => {
    const ws = await createTestWorkspace("subtree-softdel-ws");
    createdWorkspaces.push(ws.id);
    const { a, b, c, d } = await buildTree(ws.id);
    await db.update(folder).set({ isDeleted: true }).where(eq(folder.id, c.id));

    const rows = await getSubtree(a.id);
    expect(rows.map((f) => f.id)).not.toContain(c.id);
    expect(new Set(rows.map((f) => f.id))).toEqual(new Set([a.id, b.id, d.id]));
  });
});

describe("closure.moveFolder — TOCTOU-safe cycle check + rewiring + cross-workspace rejection", () => {
  const createdWorkspaces: string[] = [];

  afterEach(async () => {
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
  });

  // Tree: A > B > C, A > D, plus an unrelated root E (not under A) — E is used as a move
  // target that shares no ancestor with A, so a genuine external-link drop is observable
  // (moving into D, itself a child of A, would keep A as a transitive ancestor via D).
  async function buildTree(wsId: string) {
    const a = await createFolder(wsId, null, "A");
    const b = await createFolder(wsId, a.id, "B");
    const c = await createFolder(wsId, b.id, "C");
    const d = await createFolder(wsId, a.id, "D");
    const e = await createFolder(wsId, null, "E");
    return { a, b, c, d, e };
  }

  async function closureSnapshot() {
    const rows = await db.select().from(folderClosure);
    return rows.sort((x, y) => `${x.ancestorId}:${x.descendantId}`.localeCompare(`${y.ancestorId}:${y.descendantId}`));
  }

  it("moves B (with subtree B,C) under E: drops external ancestor links, keeps internal links, rewrites new-parent ancestors x subtree, updates parentId", async () => {
    const ws = await createTestWorkspace("move-basic-ws");
    createdWorkspaces.push(ws.id);
    const { a, b, c, e } = await buildTree(ws.id);

    await moveFolder(b.id, e.id);

    const bRows = await db.select().from(folderClosure).where(eq(folderClosure.descendantId, b.id));
    const cRows = await db.select().from(folderClosure).where(eq(folderClosure.descendantId, c.id));
    const byAncestorB = new Map(bRows.map((r) => [r.ancestorId, r.depth]));
    const byAncestorC = new Map(cRows.map((r) => [r.ancestorId, r.depth]));

    // external ancestor links to A dropped (A shares no ancestry with E)
    expect(byAncestorB.has(a.id)).toBe(false);
    expect(byAncestorC.has(a.id)).toBe(false);
    // internal links preserved
    expect(byAncestorB.get(b.id)).toBe(0);
    expect(byAncestorC.get(b.id)).toBe(1);
    expect(byAncestorC.get(c.id)).toBe(0);
    // new-parent ancestors x subtree rewritten
    expect(byAncestorB.get(e.id)).toBe(1);
    expect(byAncestorC.get(e.id)).toBe(2);

    const [updated] = await db.select().from(folder).where(eq(folder.id, b.id));
    expect(updated.parentId).toBe(e.id);
  });

  it("rejects moving a folder into its own descendant (cycle) before any rewiring", async () => {
    const ws = await createTestWorkspace("move-cycle-ws");
    createdWorkspaces.push(ws.id);
    const { a, c } = await buildTree(ws.id);

    const before = await closureSnapshot();
    await expect(moveFolder(a.id, c.id)).rejects.toThrow(CycleError);
    const after = await closureSnapshot();

    expect(after).toEqual(before);
  });

  it("rejects moving a folder onto itself (self row triggers the cycle check)", async () => {
    const ws = await createTestWorkspace("move-self-ws");
    createdWorkspaces.push(ws.id);
    const { b } = await buildTree(ws.id);

    const before = await closureSnapshot();
    await expect(moveFolder(b.id, b.id)).rejects.toThrow(CycleError);
    const after = await closureSnapshot();

    expect(after).toEqual(before);
  });

  it("moves a folder to the workspace root (newParentId=null): drops external ancestor links, no new ancestor rows, parentId=null", async () => {
    const ws = await createTestWorkspace("move-root-ws");
    createdWorkspaces.push(ws.id);
    const { a, b, c } = await buildTree(ws.id);

    await moveFolder(c.id, null);

    const cRows = await db.select().from(folderClosure).where(eq(folderClosure.descendantId, c.id));
    const byAncestor = new Map(cRows.map((r) => [r.ancestorId, r.depth]));
    expect(byAncestor.has(a.id)).toBe(false);
    expect(byAncestor.has(b.id)).toBe(false);
    expect(byAncestor.get(c.id)).toBe(0);
    expect(cRows).toHaveLength(1);

    const [updated] = await db.select().from(folder).where(eq(folder.id, c.id));
    expect(updated.parentId).toBeNull();
  });

  it("rejects moving into a folder from a different workspace, without changing any closure rows", async () => {
    const wsA = await createTestWorkspace("move-xws-a");
    const wsB = await createTestWorkspace("move-xws-b");
    createdWorkspaces.push(wsA.id, wsB.id);
    const { b } = await buildTree(wsA.id);
    const foreign = await createFolder(wsB.id, null, "Foreign");

    const before = await closureSnapshot();
    await expect(moveFolder(b.id, foreign.id)).rejects.toThrow();
    const after = await closureSnapshot();

    expect(after).toEqual(before);
  });
});

describe("closure.softDeleteFolder — cascade soft-delete, closure preserved", () => {
  const createdWorkspaces: string[] = [];

  afterEach(async () => {
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
  });

  it("marks the whole subtree is_deleted, sets is_trash_root only on the target, and preserves closure rows", async () => {
    const ws = await createTestWorkspace("softdelete-cascade-ws");
    createdWorkspaces.push(ws.id);
    const a = await createFolder(ws.id, null, "A");
    const b = await createFolder(ws.id, a.id, "B");
    const c = await createFolder(ws.id, b.id, "C");

    const closureCountBefore = (await db.select().from(folderClosure)).length;

    await softDeleteFolder(a.id);

    const rows = await db.select().from(folder).where(eq(folder.workspaceId, ws.id));
    const byId = new Map(rows.map((f) => [f.id, f]));

    expect(byId.get(a.id)?.isDeleted).toBe(true);
    expect(byId.get(a.id)?.deletedAt).not.toBeNull();
    expect(byId.get(a.id)?.isTrashRoot).toBe(true);

    expect(byId.get(b.id)?.isDeleted).toBe(true);
    expect(byId.get(b.id)?.deletedAt).not.toBeNull();
    expect(byId.get(b.id)?.isTrashRoot).toBe(false);

    expect(byId.get(c.id)?.isDeleted).toBe(true);
    expect(byId.get(c.id)?.deletedAt).not.toBeNull();
    expect(byId.get(c.id)?.isTrashRoot).toBe(false);

    const closureCountAfter = (await db.select().from(folderClosure)).length;
    expect(closureCountAfter).toBe(closureCountBefore);
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
