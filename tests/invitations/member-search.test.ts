// TDD RED (07-04 Task 1, WS-05): searchUsersForInvite mirrors search.ts's ILIKE-escape + sql
// template pattern (T-06-SQLI, tests/search/like-escape.test.ts) against user.email/user.name,
// plus an isMember flag from EXISTS(workspace_member). Route-level: ADMIN-only (T-07-04-ENUM),
// mirrors tests/search/idor.test.ts's RBAC/400/empty-q cases with minRole raised to ADMIN.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user, workspace } from "@/db/schema";
import { searchUsersForInvite } from "@/lib/member-search";
import { addMember, createTestUser, createTestWorkspace, mockSessionFor } from "../rbac/helpers";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function searchRequest(wsId: string, q: string) {
  return new Request(`http://localhost/api/workspaces/${wsId}/members/search?q=${encodeURIComponent(q)}`);
}

describe("searchUsersForInvite -- 이메일/이름 ILIKE + isMember", () => {
  const createdWorkspaces: string[] = [];
  const createdUsers: string[] = [];

  afterEach(async () => {
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
    await Promise.all(createdUsers.splice(0).map((id) => db.delete(user).where(eq(user.id, id))));
  });

  it("matches on a partial email substring", async () => {
    const ws = await createTestWorkspace("ms-email-ws");
    createdWorkspaces.push(ws.id);
    const target = await createTestUser("ms-email-target");
    createdUsers.push(target.id);

    const results = await searchUsersForInvite(ws.id, target.email.slice(0, 8));
    expect(results.map((r) => r.userId)).toContain(target.id);
    const hit = results.find((r) => r.userId === target.id)!;
    expect(hit).toMatchObject({ userId: target.id, email: target.email, name: target.name });
  });

  it("matches on a partial name substring", async () => {
    const ws = await createTestWorkspace("ms-name-ws");
    createdWorkspaces.push(ws.id);
    const target = await createTestUser("ms-name-target-회원");
    createdUsers.push(target.id);

    const results = await searchUsersForInvite(ws.id, "name-target-회원");
    expect(results.map((r) => r.userId)).toContain(target.id);
  });

  it("flags isMember=true for an existing member and false for a non-member", async () => {
    const ws = await createTestWorkspace("ms-ismember-ws");
    createdWorkspaces.push(ws.id);
    const member = await createTestUser("ms-ismember-member");
    const nonMember = await createTestUser("ms-ismember-nonmember");
    createdUsers.push(member.id, nonMember.id);
    await addMember(ws.id, member.id, "VIEWER");

    const memberHit = (await searchUsersForInvite(ws.id, "ms-ismember-member")).find((r) => r.userId === member.id);
    const nonMemberHit = (await searchUsersForInvite(ws.id, "ms-ismember-nonmember")).find(
      (r) => r.userId === nonMember.id,
    );
    expect(memberHit?.isMember).toBe(true);
    expect(nonMemberHit?.isMember).toBe(false);
  });

  it("treats '%' and '_' as literal characters, not ILIKE wildcards", async () => {
    const ws = await createTestWorkspace("ms-escape-ws");
    createdWorkspaces.push(ws.id);
    const literal = await createTestUser("ms-escape-a_b");
    const decoy = await createTestUser("ms-escape-axb");
    createdUsers.push(literal.id, decoy.id);

    const results = await searchUsersForInvite(ws.id, "escape-a_b");
    expect(results.map((r) => r.userId)).toContain(literal.id);
    expect(results.map((r) => r.userId)).not.toContain(decoy.id);
  });

  it("does not let a SQL-metacharacter query return unrelated users (injection-safe)", async () => {
    const ws = await createTestWorkspace("ms-sqli-ws");
    createdWorkspaces.push(ws.id);
    const target = await createTestUser("ms-sqli-target");
    createdUsers.push(target.id);

    const results = await searchUsersForInvite(ws.id, "%' OR '1'='1");
    expect(results.map((r) => r.userId)).not.toContain(target.id);
  });

  it("returns an empty array for an empty q", async () => {
    const ws = await createTestWorkspace("ms-empty-ws");
    createdWorkspaces.push(ws.id);
    expect(await searchUsersForInvite(ws.id, "")).toEqual([]);
  });
});

describe("RBAC -- GET /api/workspaces/[id]/members/search", () => {
  let membersSearchRoute: typeof import("@/app/api/workspaces/[id]/members/search/route").GET;
  const createdWorkspaces: string[] = [];
  const createdUsers: string[] = [];

  beforeAll(async () => {
    ({ GET: membersSearchRoute } = await import("@/app/api/workspaces/[id]/members/search/route"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
    await Promise.all(createdUsers.splice(0).map((id) => db.delete(user).where(eq(user.id, id))));
  });

  it("rejects a VIEWER with 403", async () => {
    const ws = await createTestWorkspace("ms-rbac-viewer");
    createdWorkspaces.push(ws.id);
    const viewer = await createTestUser("ms-rbac-viewer-user");
    createdUsers.push(viewer.id);
    await addMember(ws.id, viewer.id, "VIEWER");
    mockSessionFor(viewer.id);

    const res = await membersSearchRoute(searchRequest(ws.id, "아무거나"), ctx(ws.id));
    expect(res.status).toBe(403);
  });

  it("rejects an EDITOR with 403", async () => {
    const ws = await createTestWorkspace("ms-rbac-editor");
    createdWorkspaces.push(ws.id);
    const editor = await createTestUser("ms-rbac-editor-user");
    createdUsers.push(editor.id);
    await addMember(ws.id, editor.id, "EDITOR");
    mockSessionFor(editor.id);

    const res = await membersSearchRoute(searchRequest(ws.id, "아무거나"), ctx(ws.id));
    expect(res.status).toBe(403);
  });

  it("rejects a non-member with 403", async () => {
    const ws = await createTestWorkspace("ms-rbac-nonmember");
    createdWorkspaces.push(ws.id);
    const outsider = await createTestUser("ms-rbac-outsider");
    createdUsers.push(outsider.id);
    mockSessionFor(outsider.id);

    const res = await membersSearchRoute(searchRequest(ws.id, "아무거나"), ctx(ws.id));
    expect(res.status).toBe(403);
  });

  it("allows an ADMIN and returns results", async () => {
    const ws = await createTestWorkspace("ms-rbac-admin");
    createdWorkspaces.push(ws.id);
    const admin = await createTestUser("ms-rbac-admin-user");
    const target = await createTestUser("ms-rbac-admin-target");
    createdUsers.push(admin.id, target.id);
    await addMember(ws.id, admin.id, "ADMIN");
    mockSessionFor(admin.id);

    const res = await membersSearchRoute(searchRequest(ws.id, "rbac-admin-target"), ctx(ws.id));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results.map((r: { userId: string }) => r.userId)).toContain(target.id);
  });

  it("returns 400 for a malformed (non-uuid) workspace id", async () => {
    mockSessionFor("00000000-0000-4000-8000-000000000000");
    const res = await membersSearchRoute(searchRequest("not-a-uuid", "x"), ctx("not-a-uuid"));
    expect(res.status).toBe(400);
  });

  it("returns an empty result array for an empty q, without error", async () => {
    const ws = await createTestWorkspace("ms-rbac-empty-q");
    createdWorkspaces.push(ws.id);
    const admin = await createTestUser("ms-rbac-empty-q-admin");
    createdUsers.push(admin.id);
    await addMember(ws.id, admin.id, "ADMIN");
    mockSessionFor(admin.id);

    const res = await membersSearchRoute(searchRequest(ws.id, ""), ctx(ws.id));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toEqual([]);
  });
});
