// TDD RED (04-02 Task 1): POST /api/documents and PUT /api/documents/[id] don't exist yet —
// dynamic imports inside each describe's beforeAll fail until the routes land (same pattern as
// tests/folder/rbac.test.ts).
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { document, user, workspace } from "@/db/schema";
import { createFolder } from "@/lib/closure";
import { getWorkspaceDocuments } from "@/lib/documents";
import { createTestDocument } from "./helpers";
import { addMember, createTestUser, createTestWorkspace, mockSessionFor } from "../rbac/helpers";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function postRequest(body: unknown) {
  return new Request("http://localhost/api/documents", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function putRequest(id: string, body: unknown) {
  return new Request(`http://localhost/api/documents/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function deleteRequest(id: string) {
  return new Request(`http://localhost/api/documents/${id}`, { method: "DELETE" });
}

describe("POST /api/documents (create, EDITOR+)", () => {
  let createDocumentRoute: typeof import("@/app/api/documents/route").POST;
  const createdUsers: string[] = [];
  const createdWorkspaces: string[] = [];

  beforeAll(async () => {
    ({ POST: createDocumentRoute } = await import("@/app/api/documents/route"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
    await Promise.all(createdUsers.splice(0).map((id) => db.delete(user).where(eq(user.id, id))));
  });

  it("creates a root document (folderId null) and returns 201 { id }", async () => {
    const ws = await createTestWorkspace("doc-create-root-ws");
    createdWorkspaces.push(ws.id);
    const editor = await createTestUser("doc-create-root-editor");
    createdUsers.push(editor.id);
    await addMember(ws.id, editor.id, "EDITOR");
    mockSessionFor(editor.id);

    const res = await createDocumentRoute(postRequest({ title: "새 문서", folderId: null, workspaceId: ws.id }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeTruthy();
  });

  it("creates a document under a folder, deriving workspaceId from the folder", async () => {
    const ws = await createTestWorkspace("doc-create-folder-ws");
    createdWorkspaces.push(ws.id);
    const editor = await createTestUser("doc-create-folder-editor");
    createdUsers.push(editor.id);
    await addMember(ws.id, editor.id, "EDITOR");
    mockSessionFor(editor.id);
    const parent = await createFolder(ws.id, null, "Parent");

    const res = await createDocumentRoute(postRequest({ title: "새 문서", folderId: parent.id }));
    expect(res.status).toBe(201);
  });

  it("rejects a client workspaceId that disagrees with the folder's actual workspace with 400", async () => {
    const ws = await createTestWorkspace("doc-create-mismatch-ws");
    const otherWs = await createTestWorkspace("doc-create-mismatch-other-ws");
    createdWorkspaces.push(ws.id, otherWs.id);
    const editor = await createTestUser("doc-create-mismatch-editor");
    createdUsers.push(editor.id);
    await addMember(ws.id, editor.id, "EDITOR");
    mockSessionFor(editor.id);
    const parent = await createFolder(ws.id, null, "Parent");

    const res = await createDocumentRoute(
      postRequest({ title: "새 문서", folderId: parent.id, workspaceId: otherWs.id }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a VIEWER with 403", async () => {
    const ws = await createTestWorkspace("doc-create-viewer-ws");
    createdWorkspaces.push(ws.id);
    const viewer = await createTestUser("doc-create-viewer");
    createdUsers.push(viewer.id);
    await addMember(ws.id, viewer.id, "VIEWER");
    mockSessionFor(viewer.id);

    const res = await createDocumentRoute(postRequest({ title: "새 문서", folderId: null, workspaceId: ws.id }));
    expect(res.status).toBe(403);
  });
});

describe("PUT /api/documents/[id] (autosave, seq-guarded, EDITOR+)", () => {
  let autosaveRoute: typeof import("@/app/api/documents/[id]/route").PUT;
  const createdUsers: string[] = [];
  const createdWorkspaces: string[] = [];

  beforeAll(async () => {
    ({ PUT: autosaveRoute } = await import("@/app/api/documents/[id]/route"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
    await Promise.all(createdUsers.splice(0).map((id) => db.delete(user).where(eq(user.id, id))));
  });

  it("saves content and returns 200 { seq } for an EDITOR", async () => {
    const ws = await createTestWorkspace("doc-put-ok-ws");
    createdWorkspaces.push(ws.id);
    const editor = await createTestUser("doc-put-ok-editor");
    createdUsers.push(editor.id);
    await addMember(ws.id, editor.id, "EDITOR");
    mockSessionFor(editor.id);
    const doc = await createTestDocument(ws.id, null, { title: "제목", content: "" });

    const res = await autosaveRoute(putRequest(doc.id, { content: "본문", title: "제목", seq: 1 }), ctx(doc.id));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.seq).toBe(1);

    const [row] = await db.select().from(document).where(eq(document.id, doc.id));
    expect(row.content).toBe("본문");
    expect(row.savedSeq).toBe(1);
  });

  it("rejects a VIEWER with 403", async () => {
    const ws = await createTestWorkspace("doc-put-viewer-ws");
    createdWorkspaces.push(ws.id);
    const viewer = await createTestUser("doc-put-viewer");
    createdUsers.push(viewer.id);
    await addMember(ws.id, viewer.id, "VIEWER");
    mockSessionFor(viewer.id);
    const doc = await createTestDocument(ws.id, null);

    const res = await autosaveRoute(putRequest(doc.id, { content: "x", title: "t", seq: 1 }), ctx(doc.id));
    expect(res.status).toBe(403);
  });

  it("rejects a non-member with 403", async () => {
    const ws = await createTestWorkspace("doc-put-nonmember-ws");
    createdWorkspaces.push(ws.id);
    const outsider = await createTestUser("doc-put-nonmember");
    createdUsers.push(outsider.id);
    mockSessionFor(outsider.id);
    const doc = await createTestDocument(ws.id, null);

    const res = await autosaveRoute(putRequest(doc.id, { content: "x", title: "t", seq: 1 }), ctx(doc.id));
    expect(res.status).toBe(403);
  });

  it("returns 200 for a stale (lower) seq but keeps the server's newest content (TRD §7 seq guard)", async () => {
    const ws = await createTestWorkspace("doc-put-stale-ws");
    createdWorkspaces.push(ws.id);
    const editor = await createTestUser("doc-put-stale-editor");
    createdUsers.push(editor.id);
    await addMember(ws.id, editor.id, "EDITOR");
    mockSessionFor(editor.id);
    const doc = await createTestDocument(ws.id, null, { title: "제목", content: "" });

    await autosaveRoute(putRequest(doc.id, { content: "최신", title: "제목", seq: 2 }), ctx(doc.id));
    const staleRes = await autosaveRoute(putRequest(doc.id, { content: "옛것", title: "제목", seq: 1 }), ctx(doc.id));
    expect(staleRes.status).toBe(200);

    const [row] = await db.select().from(document).where(eq(document.id, doc.id));
    expect(row.content).toBe("최신");
  });

  it("returns 400 for an invalid body (missing seq)", async () => {
    const ws = await createTestWorkspace("doc-put-badbody-ws");
    createdWorkspaces.push(ws.id);
    const editor = await createTestUser("doc-put-badbody-editor");
    createdUsers.push(editor.id);
    await addMember(ws.id, editor.id, "EDITOR");
    mockSessionFor(editor.id);
    const doc = await createTestDocument(ws.id, null);

    const res = await autosaveRoute(putRequest(doc.id, { content: "x", title: "t" }), ctx(doc.id));
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/documents/[id] (soft-delete, EDITOR+, IDOR)", () => {
  let deleteRoute: typeof import("@/app/api/documents/[id]/route").DELETE;
  const createdUsers: string[] = [];
  const createdWorkspaces: string[] = [];

  beforeAll(async () => {
    ({ DELETE: deleteRoute } = await import("@/app/api/documents/[id]/route"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
    await Promise.all(createdUsers.splice(0).map((id) => db.delete(user).where(eq(user.id, id))));
  });

  it("soft-deletes for an EDITOR (204); the doc drops out of getWorkspaceDocuments and is_trash_root", async () => {
    const ws = await createTestWorkspace("doc-delete-ok-ws");
    createdWorkspaces.push(ws.id);
    const editor = await createTestUser("doc-delete-ok-editor");
    createdUsers.push(editor.id);
    await addMember(ws.id, editor.id, "EDITOR");
    mockSessionFor(editor.id);
    const doc = await createTestDocument(ws.id, null, { title: "삭제될 문서" });

    const res = await deleteRoute(deleteRequest(doc.id), ctx(doc.id));
    expect(res.status).toBe(204);

    const active = await getWorkspaceDocuments(ws.id);
    expect(active.find((d) => d.id === doc.id)).toBeUndefined();

    const [row] = await db.select().from(document).where(eq(document.id, doc.id));
    expect(row.isDeleted).toBe(true);
    expect(row.isTrashRoot).toBe(true);
    expect(row.deletedAt).not.toBeNull();
  });

  it("rejects a VIEWER with 403", async () => {
    const ws = await createTestWorkspace("doc-delete-viewer-ws");
    createdWorkspaces.push(ws.id);
    const viewer = await createTestUser("doc-delete-viewer");
    createdUsers.push(viewer.id);
    await addMember(ws.id, viewer.id, "VIEWER");
    mockSessionFor(viewer.id);
    const doc = await createTestDocument(ws.id, null);

    const res = await deleteRoute(deleteRequest(doc.id), ctx(doc.id));
    expect(res.status).toBe(403);
  });

  it("rejects a non-member with 403 (IDOR — workspace_id is server re-derived, never client-trusted)", async () => {
    const ws = await createTestWorkspace("doc-delete-nonmember-ws");
    createdWorkspaces.push(ws.id);
    const outsider = await createTestUser("doc-delete-nonmember");
    createdUsers.push(outsider.id);
    mockSessionFor(outsider.id);
    const doc = await createTestDocument(ws.id, null);

    const res = await deleteRoute(deleteRequest(doc.id), ctx(doc.id));
    expect(res.status).toBe(403);
  });

  it("is idempotent — deleting an already-deleted document still returns 204 (WR-01 analog)", async () => {
    const ws = await createTestWorkspace("doc-delete-idempotent-ws");
    createdWorkspaces.push(ws.id);
    const editor = await createTestUser("doc-delete-idempotent-editor");
    createdUsers.push(editor.id);
    await addMember(ws.id, editor.id, "EDITOR");
    mockSessionFor(editor.id);
    const doc = await createTestDocument(ws.id, null);

    const first = await deleteRoute(deleteRequest(doc.id), ctx(doc.id));
    expect(first.status).toBe(204);
    const second = await deleteRoute(deleteRequest(doc.id), ctx(doc.id));
    expect(second.status).toBe(204);
  });

  it("returns 400 for a malformed uuid path param", async () => {
    const ws = await createTestWorkspace("doc-delete-badid-ws");
    createdWorkspaces.push(ws.id);
    const editor = await createTestUser("doc-delete-badid-editor");
    createdUsers.push(editor.id);
    await addMember(ws.id, editor.id, "EDITOR");
    mockSessionFor(editor.id);

    const res = await deleteRoute(deleteRequest("not-a-uuid"), ctx("not-a-uuid"));
    expect(res.status).toBe(400);
  });
});
