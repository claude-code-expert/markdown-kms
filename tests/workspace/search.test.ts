// WS-03 개정 — searchWorkspacesByName은 member-search.test.ts와 동일 뼈대(ILIKE 부분일치 +
// 이스케이프 + injection-safe + 빈 q). isMember 대신 isMember/hasPendingRequest 두 플래그를
// 검증한다. 라우트 레벨은 requireRole이 없다는 게 핵심 계약 — 세션만 있으면 어떤 워크스페이스의
// 이름도 검색 대상에 오른다(가입 전 "찾기" 단계이므로).
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user, workspace } from "@/db/schema";
import { searchWorkspacesByName } from "@/lib/workspace-search";
import { createJoinRequest } from "@/lib/join-requests";
import { addMember, createTestUser, createTestWorkspace, mockSessionFor } from "../rbac/helpers";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

function searchRequest(q: string) {
  return new Request(`http://localhost/api/workspaces/search?q=${encodeURIComponent(q)}`);
}

describe("searchWorkspacesByName -- 이름 ILIKE + isMember/hasPendingRequest", () => {
  const createdWorkspaces: string[] = [];
  const createdUsers: string[] = [];

  afterEach(async () => {
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
    await Promise.all(createdUsers.splice(0).map((id) => db.delete(user).where(eq(user.id, id))));
  });

  it("matches on a partial name substring", async () => {
    const target = await createTestWorkspace("ws-search-markdown-kms");
    createdWorkspaces.push(target.id);
    const searcher = await createTestUser("ws-search-searcher");
    createdUsers.push(searcher.id);

    const results = await searchWorkspacesByName(searcher.id, "markdown-kms");
    expect(results.map((r) => r.id)).toContain(target.id);
  });

  it("flags isMember=true for a workspace the user already belongs to", async () => {
    const ws = await createTestWorkspace("ws-search-ismember");
    createdWorkspaces.push(ws.id);
    const member = await createTestUser("ws-search-ismember-user");
    createdUsers.push(member.id);
    await addMember(ws.id, member.id, "VIEWER");

    const hit = (await searchWorkspacesByName(member.id, "ws-search-ismember")).find((r) => r.id === ws.id);
    expect(hit?.isMember).toBe(true);
    expect(hit?.hasPendingRequest).toBe(false);
  });

  it("flags hasPendingRequest=true after the user files a join request", async () => {
    const ws = await createTestWorkspace("ws-search-pending");
    createdWorkspaces.push(ws.id);
    const applicant = await createTestUser("ws-search-pending-user");
    createdUsers.push(applicant.id);
    await createJoinRequest(ws.id, applicant.id);

    const hit = (await searchWorkspacesByName(applicant.id, "ws-search-pending")).find((r) => r.id === ws.id);
    expect(hit?.isMember).toBe(false);
    expect(hit?.hasPendingRequest).toBe(true);
  });

  it("treats '%' and '_' as literal characters, not ILIKE wildcards", async () => {
    const literal = await createTestWorkspace("ws-escape-a_b");
    const decoy = await createTestWorkspace("ws-escape-axb");
    createdWorkspaces.push(literal.id, decoy.id);
    const searcher = await createTestUser("ws-escape-searcher");
    createdUsers.push(searcher.id);

    const results = await searchWorkspacesByName(searcher.id, "escape-a_b");
    expect(results.map((r) => r.id)).toContain(literal.id);
    expect(results.map((r) => r.id)).not.toContain(decoy.id);
  });

  it("does not let a SQL-metacharacter query return unrelated workspaces (injection-safe)", async () => {
    const target = await createTestWorkspace("ws-sqli-target");
    createdWorkspaces.push(target.id);
    const searcher = await createTestUser("ws-sqli-searcher");
    createdUsers.push(searcher.id);

    const results = await searchWorkspacesByName(searcher.id, "%' OR '1'='1");
    expect(results.map((r) => r.id)).not.toContain(target.id);
  });

  it("returns an empty array for an empty q", async () => {
    const searcher = await createTestUser("ws-search-empty-q");
    createdUsers.push(searcher.id);
    expect(await searchWorkspacesByName(searcher.id, "")).toEqual([]);
  });

  it("excludes soft-deleted workspaces", async () => {
    const ws = await createTestWorkspace("ws-search-deleted");
    createdWorkspaces.push(ws.id);
    await db.update(workspace).set({ isDeleted: true }).where(eq(workspace.id, ws.id));
    const searcher = await createTestUser("ws-search-deleted-searcher");
    createdUsers.push(searcher.id);

    const results = await searchWorkspacesByName(searcher.id, "ws-search-deleted");
    expect(results.map((r) => r.id)).not.toContain(ws.id);
  });
});

describe("GET /api/workspaces/search", () => {
  let searchRoute: typeof import("@/app/api/workspaces/search/route").GET;
  const createdWorkspaces: string[] = [];
  const createdUsers: string[] = [];

  beforeAll(async () => {
    ({ GET: searchRoute } = await import("@/app/api/workspaces/search/route"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
    await Promise.all(createdUsers.splice(0).map((id) => db.delete(user).where(eq(user.id, id))));
  });

  it("rejects an unauthenticated caller with 403", async () => {
    mockSessionFor(null);
    const res = await searchRoute(searchRequest("아무거나"));
    expect(res.status).toBe(403);
  });

  // WS-03 개정 핵심 계약: 가입 전 "찾기" 단계라 requireRole이 없다 — 어떤 워크스페이스의
  // 멤버도 아닌 로그인 사용자도 이름 검색 결과를 받아야 한다(members/search와의 의도적 차이).
  it("allows a non-member logged-in caller and returns matching workspaces", async () => {
    const ws = await createTestWorkspace("ws-search-route-nonmember");
    createdWorkspaces.push(ws.id);
    const outsider = await createTestUser("ws-search-route-outsider");
    createdUsers.push(outsider.id);
    mockSessionFor(outsider.id);

    const res = await searchRoute(searchRequest("ws-search-route-nonmember"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results.map((r: { id: string }) => r.id)).toContain(ws.id);
  });

  it("returns an empty result array for an empty q, without error", async () => {
    const searcher = await createTestUser("ws-search-route-empty-q");
    createdUsers.push(searcher.id);
    mockSessionFor(searcher.id);

    const res = await searchRoute(searchRequest(""));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toEqual([]);
  });
});
