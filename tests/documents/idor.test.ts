// TDD RED (04-02 Task 1): cross-workspace IDOR for PUT /api/documents/[id] — the route has no
// wsId in the URL, so it must re-derive workspace_id from the target document row
// (resolveWorkspaceIdForDocument) before calling requireRole, never trusting a client-implied
// workspace (T-04-02-IDOR). Mirrors tests/folder/cross-workspace.test.ts's pattern.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { document, user, workspace } from "@/db/schema";
import { createTestDocument } from "./helpers";
import { addMember, createTestUser, createTestWorkspace, mockSessionFor } from "../rbac/helpers";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function putRequest(id: string, body: unknown) {
  return new Request(`http://localhost/api/documents/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("cross-workspace IDOR — PUT /api/documents/[id]", () => {
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

  it("rejects an EDITOR-elsewhere caller saving a foreign-workspace document id with 403", async () => {
    const w1 = await createTestWorkspace("doc-idor-w1");
    const w2 = await createTestWorkspace("doc-idor-w2");
    createdWorkspaces.push(w1.id, w2.id);
    const caller = await createTestUser("doc-idor-caller");
    createdUsers.push(caller.id);
    await addMember(w1.id, caller.id, "EDITOR");
    mockSessionFor(caller.id);
    const foreignDoc = await createTestDocument(w2.id, null, { title: "Foreign" });

    const res = await autosaveRoute(
      putRequest(foreignDoc.id, { content: "탈취", title: "탈취", seq: 1 }),
      ctx(foreignDoc.id),
    );
    expect(res.status).toBe(403);

    const [row] = await db.select().from(document).where(eq(document.id, foreignDoc.id));
    expect(row.content).not.toBe("탈취");
  });

  it("returns 400 for a malformed (non-uuid) document id", async () => {
    mockSessionFor("00000000-0000-4000-8000-000000000000");
    const res = await autosaveRoute(
      putRequest("not-a-uuid", { content: "x", title: "t", seq: 1 }),
      ctx("not-a-uuid"),
    );
    expect(res.status).toBe(400);
  });

  it("returns 403 saving to an already soft-deleted document (trashed target rejected same as nonexistent)", async () => {
    const ws = await createTestWorkspace("doc-idor-trashed-ws");
    createdWorkspaces.push(ws.id);
    const editor = await createTestUser("doc-idor-trashed-editor");
    createdUsers.push(editor.id);
    await addMember(ws.id, editor.id, "EDITOR");
    mockSessionFor(editor.id);
    const doc = await createTestDocument(ws.id, null, { title: "삭제됨" });
    await db.update(document).set({ isDeleted: true }).where(eq(document.id, doc.id));

    const res = await autosaveRoute(putRequest(doc.id, { content: "x", title: "t", seq: 1 }), ctx(doc.id));
    expect(res.status).toBe(403);
  });
});
