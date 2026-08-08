// TDD RED (05-04 Task 2): documents/[id]/route.ts's PUT handler doesn't gate deleteDraft on
// autosaveDocument's boolean return yet — this file fails until that gate is added.
// Pitfall 5 regression: a stale/tied seq still returns 200 but autosaveDocument affects 0 rows
// (returns false) — deleting the draft in that case would silently destroy the user's only
// recovery copy. The gate must be the boolean return value, never "the route returned 200".
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user, workspace } from "@/db/schema";
import { getDraft, upsertDraft } from "@/lib/documents";
import { createTestDocument } from "../documents/helpers";
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

describe("PUT /api/documents/[id] — draft deletion gated on autosaveDocument's boolean (Pitfall 5)", () => {
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

  it("deletes the draft when autosaveDocument actually applies (newer seq -> true)", async () => {
    const ws = await createTestWorkspace("draft-autodelete-applied-ws");
    createdWorkspaces.push(ws.id);
    const editor = await createTestUser("draft-autodelete-applied-editor");
    createdUsers.push(editor.id);
    await addMember(ws.id, editor.id, "EDITOR");
    mockSessionFor(editor.id);
    const doc = await createTestDocument(ws.id, null, { content: "옛 내용", savedSeq: 5 });
    await upsertDraft(doc.id, "복구용 임시 저장 내용");

    const res = await autosaveRoute(
      putRequest(doc.id, { content: "새 내용", title: "새 제목", seq: 6 }),
      ctx(doc.id),
    );
    expect(res.status).toBe(200);

    const draft = await getDraft(doc.id);
    expect(draft).toBeNull();
  });

  it("does NOT delete the draft when autosaveDocument is a no-op (stale seq -> false, 0 rows, still 200)", async () => {
    const ws = await createTestWorkspace("draft-autodelete-stale-ws");
    createdWorkspaces.push(ws.id);
    const editor = await createTestUser("draft-autodelete-stale-editor");
    createdUsers.push(editor.id);
    await addMember(ws.id, editor.id, "EDITOR");
    mockSessionFor(editor.id);
    const doc = await createTestDocument(ws.id, null, { content: "최신 내용", savedSeq: 5 });
    await upsertDraft(doc.id, "복구용 임시 저장 내용");

    const res = await autosaveRoute(
      putRequest(doc.id, { content: "옛 내용으로 덮어쓰기 시도", title: "옛 제목", seq: 3 }),
      ctx(doc.id),
    );
    expect(res.status).toBe(200); // route still returns 200 even though 0 rows were affected

    const draft = await getDraft(doc.id);
    expect(draft?.content).toBe("복구용 임시 저장 내용"); // survives — Pitfall 5 regression guard
  });
});
