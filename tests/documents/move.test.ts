// moveDocument (closure.ts) + POST /api/documents/[id]/move — mirrors tests/folder/closure.test.ts's
// "closure.moveFolder" lib block and tests/folder/rbac.test.ts's "POST /api/folders/[id]/move" RBAC
// matrix, minus cycle-check cases (a document is a leaf, no descendants to cycle into).
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { document, folder, user, workspace } from "@/db/schema";
import { CrossWorkspaceError, createFolder, moveDocument } from "@/lib/closure";
import { createTestDocument } from "./helpers";
import { addMember, createTestUser, createTestWorkspace, mockSessionFor, type Role } from "../rbac/helpers";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const ROLES: Role[] = ["OWNER", "ADMIN", "EDITOR"];
const FORBIDDEN_COPY = "이 작업을 수행할 권한이 없습니다.";

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function moveRequest(id: string, newFolderId: string | null) {
  return new Request(`http://localhost/api/documents/${id}/move`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ newFolderId }),
  });
}

describe("closure.moveDocument — folder reassignment + cross-workspace rejection", () => {
  const createdWorkspaces: string[] = [];

  afterEach(async () => {
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
  });

  it("sets document.folderId to the target folder", async () => {
    const ws = await createTestWorkspace("move-doc-basic-ws");
    createdWorkspaces.push(ws.id);
    const folderA = await createFolder(ws.id, null, "A");
    const doc = await createTestDocument(ws.id, null, { title: "Doc" });

    await moveDocument(doc.id, folderA.id);

    const [updated] = await db.select().from(document).where(eq(document.id, doc.id));
    expect(updated.folderId).toBe(folderA.id);
  });

  it("moves a document back to the workspace root with newFolderId=null", async () => {
    const ws = await createTestWorkspace("move-doc-root-ws");
    createdWorkspaces.push(ws.id);
    const folderA = await createFolder(ws.id, null, "A");
    const doc = await createTestDocument(ws.id, folderA.id, { title: "Doc" });

    await moveDocument(doc.id, null);

    const [updated] = await db.select().from(document).where(eq(document.id, doc.id));
    expect(updated.folderId).toBeNull();
  });

  it("rejects moving into a folder from a different workspace, without changing folderId", async () => {
    const wsA = await createTestWorkspace("move-doc-xws-a");
    const wsB = await createTestWorkspace("move-doc-xws-b");
    createdWorkspaces.push(wsA.id, wsB.id);
    const doc = await createTestDocument(wsA.id, null, { title: "Doc" });
    const foreignFolder = await createFolder(wsB.id, null, "Foreign");

    await expect(moveDocument(doc.id, foreignFolder.id)).rejects.toThrow(CrossWorkspaceError);

    const [row] = await db.select().from(document).where(eq(document.id, doc.id));
    expect(row.folderId).toBeNull();
  });

  it("rejects moving into a soft-deleted folder in the same workspace", async () => {
    const ws = await createTestWorkspace("move-doc-softdel-ws");
    createdWorkspaces.push(ws.id);
    const trashedFolder = await createFolder(ws.id, null, "Trashed");
    const doc = await createTestDocument(ws.id, null, { title: "Doc" });
    await db.update(folder).set({ isDeleted: true }).where(eq(folder.id, trashedFolder.id));

    await expect(moveDocument(doc.id, trashedFolder.id)).rejects.toThrow(CrossWorkspaceError);
  });
});

describe("RBAC matrix — POST /api/documents/[id]/move (EDITOR+)", () => {
  let moveDocumentRoute: typeof import("@/app/api/documents/[id]/move/route").POST;
  const createdUsers: string[] = [];
  const createdWorkspaces: string[] = [];

  beforeAll(async () => {
    ({ POST: moveDocumentRoute } = await import("@/app/api/documents/[id]/move/route"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
    await Promise.all(createdUsers.splice(0).map((id) => db.delete(user).where(eq(user.id, id))));
  });

  it.each(ROLES)("succeeds for a %s member", async (role) => {
    const ws = await createTestWorkspace(`rbac-doc-move-${role}-ws`);
    createdWorkspaces.push(ws.id);
    const caller = await createTestUser(`rbac-doc-move-${role}`);
    createdUsers.push(caller.id);
    await addMember(ws.id, caller.id, role);
    mockSessionFor(caller.id);
    const targetFolder = await createFolder(ws.id, null, "Target");
    const doc = await createTestDocument(ws.id, null, { title: "Doc" });

    const res = await moveDocumentRoute(moveRequest(doc.id, targetFolder.id), ctx(doc.id));
    expect([200, 204]).toContain(res.status);
  });

  it("is rejected with 403 for a VIEWER", async () => {
    const ws = await createTestWorkspace("rbac-doc-move-viewer-ws");
    createdWorkspaces.push(ws.id);
    const caller = await createTestUser("rbac-doc-move-viewer");
    createdUsers.push(caller.id);
    await addMember(ws.id, caller.id, "VIEWER");
    mockSessionFor(caller.id);
    const doc = await createTestDocument(ws.id, null, { title: "Doc" });

    const res = await moveDocumentRoute(moveRequest(doc.id, null), ctx(doc.id));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe(FORBIDDEN_COPY);
  });

  it("is rejected with 403 for a non-member", async () => {
    const ws = await createTestWorkspace("rbac-doc-move-nonmember-ws");
    createdWorkspaces.push(ws.id);
    const outsider = await createTestUser("rbac-doc-move-outsider");
    createdUsers.push(outsider.id);
    mockSessionFor(outsider.id);
    const doc = await createTestDocument(ws.id, null, { title: "Doc" });

    const res = await moveDocumentRoute(moveRequest(doc.id, null), ctx(doc.id));
    expect(res.status).toBe(403);
  });

  it("is rejected with 403 for an unauthenticated caller", async () => {
    const ws = await createTestWorkspace("rbac-doc-move-anon-ws");
    createdWorkspaces.push(ws.id);
    mockSessionFor(null);
    const doc = await createTestDocument(ws.id, null, { title: "Doc" });

    const res = await moveDocumentRoute(moveRequest(doc.id, null), ctx(doc.id));
    expect(res.status).toBe(403);
  });

  it("returns 400 for a malformed (non-uuid) document id", async () => {
    mockSessionFor("00000000-0000-4000-8000-000000000000");
    const res = await moveDocumentRoute(moveRequest("not-a-uuid", null), ctx("not-a-uuid"));
    expect(res.status).toBe(400);
  });

  it("returns 400 moving into a foreign-workspace folder (IDOR — never trust body over the resolved document workspace)", async () => {
    const wsA = await createTestWorkspace("rbac-doc-move-xws-a");
    const wsB = await createTestWorkspace("rbac-doc-move-xws-b");
    createdWorkspaces.push(wsA.id, wsB.id);
    const editor = await createTestUser("rbac-doc-move-xws-editor");
    createdUsers.push(editor.id);
    await addMember(wsA.id, editor.id, "EDITOR");
    mockSessionFor(editor.id);
    const doc = await createTestDocument(wsA.id, null, { title: "Doc" });
    const foreignFolder = await createFolder(wsB.id, null, "Foreign");

    const res = await moveDocumentRoute(moveRequest(doc.id, foreignFolder.id), ctx(doc.id));
    expect(res.status).toBe(400);
  });
});
