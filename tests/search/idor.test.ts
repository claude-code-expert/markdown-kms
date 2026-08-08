// TDD RED (06-03 Task 1): IDOR/RBAC defenses for searchWorkspace (lib) and
// GET /api/workspaces/[id]/search (route) -- mirrors tests/documents/idor.test.ts /
// tests/tags/rbac.test.ts's cross-workspace pattern. wsId is directly in the URL (no
// resolveWorkspaceIdForDocument indirection, unlike the document-scoped routes) so
// requireRole(wsId, "VIEWER") runs straight off the validated param (T-06-SEARCH-IDOR).
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user, workspace } from "@/db/schema";
import { searchWorkspace } from "@/lib/search";
import { createTestDocument } from "../documents/helpers";
import { addMember, createTestUser, createTestWorkspace, mockSessionFor } from "../rbac/helpers";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function searchRequest(wsId: string, q: string) {
  return new Request(`http://localhost/api/workspaces/${wsId}/search?q=${encodeURIComponent(q)}`);
}

describe("searchWorkspace -- 워크스페이스 스코프 (IDOR, lib-level)", () => {
  const createdWorkspaces: string[] = [];

  afterEach(async () => {
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
  });

  it("never returns a document from a different workspace, even with the same matching title", async () => {
    const w1 = await createTestWorkspace("search-idor-w1");
    const w2 = await createTestWorkspace("search-idor-w2");
    createdWorkspaces.push(w1.id, w2.id);
    await createTestDocument(w1.id, null, { title: "공유제목", content: "" });
    const foreignDoc = await createTestDocument(w2.id, null, { title: "공유제목", content: "" });

    const results = await searchWorkspace(w1.id, "공유제목");
    expect(results.map((r) => r.id)).not.toContain(foreignDoc.id);
  });
});

describe("RBAC/IDOR -- GET /api/workspaces/[id]/search", () => {
  let searchRoute: typeof import("@/app/api/workspaces/[id]/search/route").GET;
  const createdWorkspaces: string[] = [];
  const createdUsers: string[] = [];

  beforeAll(async () => {
    ({ GET: searchRoute } = await import("@/app/api/workspaces/[id]/search/route"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
    await Promise.all(createdUsers.splice(0).map((id) => db.delete(user).where(eq(user.id, id))));
  });

  it("rejects a non-member with 403", async () => {
    const ws = await createTestWorkspace("search-rbac-nonmember");
    createdWorkspaces.push(ws.id);
    const outsider = await createTestUser("search-rbac-outsider");
    createdUsers.push(outsider.id);
    mockSessionFor(outsider.id);

    const res = await searchRoute(searchRequest(ws.id, "아무거나"), ctx(ws.id));
    expect(res.status).toBe(403);
  });

  it("allows a VIEWER and returns only same-workspace results", async () => {
    const ws = await createTestWorkspace("search-rbac-viewer");
    createdWorkspaces.push(ws.id);
    const viewer = await createTestUser("search-rbac-viewer-user");
    createdUsers.push(viewer.id);
    await addMember(ws.id, viewer.id, "VIEWER");
    mockSessionFor(viewer.id);
    const doc = await createTestDocument(ws.id, null, { title: "뷰어검색테스트", content: "" });

    const res = await searchRoute(searchRequest(ws.id, "뷰어검색테스트"), ctx(ws.id));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results.map((r: { id: string }) => r.id)).toContain(doc.id);
  });

  it("returns 400 for a malformed (non-uuid) workspace id", async () => {
    mockSessionFor("00000000-0000-4000-8000-000000000000");
    const res = await searchRoute(searchRequest("not-a-uuid", "x"), ctx("not-a-uuid"));
    expect(res.status).toBe(400);
  });

  it("returns an empty result array for an empty q, without error", async () => {
    const ws = await createTestWorkspace("search-rbac-empty-q");
    createdWorkspaces.push(ws.id);
    const viewer = await createTestUser("search-rbac-empty-q-user");
    createdUsers.push(viewer.id);
    await addMember(ws.id, viewer.id, "VIEWER");
    mockSessionFor(viewer.id);

    const res = await searchRoute(searchRequest(ws.id, ""), ctx(ws.id));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toEqual([]);
  });
});
