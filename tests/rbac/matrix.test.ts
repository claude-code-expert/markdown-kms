// WS-01: the role x route matrix. Enumerates all four roles + a non-member/unauthenticated
// caller against the two Phase-1-actionable mutating routes (POST /api/workspaces,
// DELETE /api/workspaces/:id) and asserts the PRD §3 outcome. Committed BEFORE src/lib/rbac.ts
// exists (TRD §10 TDD) — this file is expected to fail to even import until Task 2/4 land.
//
// The DELETE route (Task 4) lands after a checkpoint, later than the create route (Task 2) —
// its handler is imported dynamically inside the "delete" describe block's beforeAll, not
// statically at the top of the file, so `-t "create"` can run the create matrix standalone
// against Task 2's implementation without needing Task 4's route module to exist yet.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user, workspace } from "@/db/schema";
import { POST as createWorkspace } from "@/app/api/workspaces/route";
import { addMember, createTestUser, createTestWorkspace, mockSessionFor, type Role } from "./helpers";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const ROLES: Role[] = ["OWNER", "ADMIN", "EDITOR", "VIEWER"];
const FORBIDDEN_COPY = "이 작업을 수행할 권한이 없습니다.";

function createRequest(body: unknown) {
  return new Request("http://localhost/api/workspaces", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function deleteRequest(id: string) {
  return new Request(`http://localhost/api/workspaces/${id}`, { method: "DELETE" });
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("RBAC matrix — create (POST /api/workspaces, any logged-in member)", () => {
  const createdUsers: string[] = [];
  const createdWorkspaces: string[] = [];

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
    await Promise.all(createdUsers.splice(0).map((id) => db.delete(user).where(eq(user.id, id))));
  });

  it.each(ROLES)("succeeds for a %s member — create is role-independent", async (role) => {
    const caller = await createTestUser(`matrix-create-${role}`);
    createdUsers.push(caller.id);
    const contextWs = await createTestWorkspace(`matrix-create-context-${role}`);
    createdWorkspaces.push(contextWs.id);
    await addMember(contextWs.id, caller.id, role);
    mockSessionFor(caller.id);

    const res = await createWorkspace(createRequest({ name: `matrix-created-${role}` }));
    expect(res.status).toBe(201);
    const body = await res.json();
    createdWorkspaces.push(body.id);
  });

  it("is rejected for an unauthenticated caller", async () => {
    mockSessionFor(null);
    const res = await createWorkspace(createRequest({ name: "matrix-create-anon" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe(FORBIDDEN_COPY);
  });
});

describe("RBAC matrix — delete (DELETE /api/workspaces/:id, OWNER only)", () => {
  const createdUsers: string[] = [];
  const createdWorkspaces: string[] = [];
  let deleteWorkspace: typeof import("@/app/api/workspaces/[id]/route").DELETE;

  beforeAll(async () => {
    ({ DELETE: deleteWorkspace } = await import("@/app/api/workspaces/[id]/route"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
    await Promise.all(createdUsers.splice(0).map((id) => db.delete(user).where(eq(user.id, id))));
  });

  it("succeeds for OWNER", async () => {
    const ws = await createTestWorkspace("matrix-delete-owner-ws");
    const owner = await createTestUser("matrix-delete-owner");
    createdUsers.push(owner.id);
    await addMember(ws.id, owner.id, "OWNER");
    mockSessionFor(owner.id);

    const res = await deleteWorkspace(deleteRequest(ws.id), ctx(ws.id));
    expect(res.status).toBe(204);
  });

  it.each(["ADMIN", "EDITOR", "VIEWER"] as Role[])("is rejected with 403 for %s", async (role) => {
    const ws = await createTestWorkspace(`matrix-delete-${role}-ws`);
    createdWorkspaces.push(ws.id);
    const member = await createTestUser(`matrix-delete-${role}`);
    createdUsers.push(member.id);
    await addMember(ws.id, member.id, role);
    mockSessionFor(member.id);

    const res = await deleteWorkspace(deleteRequest(ws.id), ctx(ws.id));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe(FORBIDDEN_COPY);
  });

  it("is rejected for a non-member", async () => {
    const ws = await createTestWorkspace("matrix-delete-nonmember-ws");
    createdWorkspaces.push(ws.id);
    const outsider = await createTestUser("matrix-delete-outsider");
    createdUsers.push(outsider.id);
    mockSessionFor(outsider.id);

    const res = await deleteWorkspace(deleteRequest(ws.id), ctx(ws.id));
    expect(res.status).toBe(403);
  });

  it("is rejected for an unauthenticated caller", async () => {
    const ws = await createTestWorkspace("matrix-delete-anon-ws");
    createdWorkspaces.push(ws.id);
    mockSessionFor(null);

    const res = await deleteWorkspace(deleteRequest(ws.id), ctx(ws.id));
    expect(res.status).toBe(403);
  });

});

// requireRole is the shared gate; the /w/[wsId] page calls it with an unvalidated URL param,
// so a malformed (non-uuid) workspaceId must fail-closed as ForbiddenError rather than crash the
// uuid-typed membership query with a raw Postgres "invalid input syntax" 500.
describe("requireRole — malformed workspace id fails closed", () => {
  afterEach(() => vi.restoreAllMocks());

  it("throws ForbiddenError for a non-uuid id before hitting the DB", async () => {
    const { requireRole, ForbiddenError } = await import("@/lib/rbac");
    mockSessionFor("00000000-0000-4000-8000-000000000000");

    await expect(requireRole("1", "VIEWER")).rejects.toBeInstanceOf(ForbiddenError);
  });
});
