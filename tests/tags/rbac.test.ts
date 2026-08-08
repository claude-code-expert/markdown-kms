// TDD (06-02 Task 2): RBAC/IDOR defenses for PUT /api/documents/[id]/tags — mirrors
// tests/documents/idor.test.ts's cross-workspace pattern plus a VIEWER-role rejection
// (tests/rbac/matrix.test.ts's role-assert convention). The route's IDOR/RBAC shape was
// already written in Task 1 (mirroring documents/[id]/route.ts's PUT exactly) — these tests
// confirm that shape holds for the tags route specifically, including a DB-unchanged assertion
// tags/replace.test.ts doesn't cover.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user, workspace } from "@/db/schema";
import { createTestDocument } from "../documents/helpers";
import { addMember, createTestUser, createTestWorkspace, mockSessionFor } from "../rbac/helpers";
import { getTagRows } from "./helpers";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function putRequest(id: string, body: unknown) {
  return new Request(`http://localhost/api/documents/${id}/tags`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("RBAC/IDOR — PUT /api/documents/[id]/tags", () => {
  let tagsRoute: typeof import("@/app/api/documents/[id]/tags/route").PUT;
  const createdWorkspaces: string[] = [];
  const createdUsers: string[] = [];

  beforeAll(async () => {
    ({ PUT: tagsRoute } = await import("@/app/api/documents/[id]/tags/route"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
    await Promise.all(createdUsers.splice(0).map((id) => db.delete(user).where(eq(user.id, id))));
  });

  it("rejects a VIEWER with 403 and leaves document_tag unchanged", async () => {
    const ws = await createTestWorkspace("tags-rbac-viewer");
    createdWorkspaces.push(ws.id);
    const viewer = await createTestUser("tags-rbac-viewer-user");
    createdUsers.push(viewer.id);
    await addMember(ws.id, viewer.id, "VIEWER");
    mockSessionFor(viewer.id);
    const doc = await createTestDocument(ws.id, null, { title: "문서" });

    const res = await tagsRoute(putRequest(doc.id, { tags: ["hack"] }), ctx(doc.id));
    expect(res.status).toBe(403);

    const rows = await getTagRows(doc.id);
    expect(rows).toHaveLength(0);
  });

  it("rejects an EDITOR-elsewhere caller saving a foreign-workspace document id with 403, DB unchanged", async () => {
    const w1 = await createTestWorkspace("tags-rbac-w1");
    const w2 = await createTestWorkspace("tags-rbac-w2");
    createdWorkspaces.push(w1.id, w2.id);
    const caller = await createTestUser("tags-rbac-caller");
    createdUsers.push(caller.id);
    await addMember(w1.id, caller.id, "EDITOR");
    mockSessionFor(caller.id);
    const foreignDoc = await createTestDocument(w2.id, null, { title: "Foreign" });

    const res = await tagsRoute(putRequest(foreignDoc.id, { tags: ["탈취"] }), ctx(foreignDoc.id));
    expect(res.status).toBe(403);

    const rows = await getTagRows(foreignDoc.id);
    expect(rows).toHaveLength(0);
  });

  it("returns 400 for a malformed (non-uuid) document id", async () => {
    mockSessionFor("00000000-0000-4000-8000-000000000000");
    const res = await tagsRoute(putRequest("not-a-uuid", { tags: ["a"] }), ctx("not-a-uuid"));
    expect(res.status).toBe(400);
  });
});
