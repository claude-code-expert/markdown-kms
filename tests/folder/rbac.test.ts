// TDD RED (03-04 Task 1): PATCH/DELETE /api/folders/[id] and POST /api/folders/[id]/move don't
// exist yet — dynamic imports inside each describe's beforeAll fail until Task 2/3 land (TRD §10
// TDD order), mirroring tests/rbac/matrix.test.ts's dynamic-import pattern for a not-yet-built
// route so `-t "PATCH"` etc. can target one route without needing the others to exist.
//
// Role x route matrix per PRD §3: create/rename/move/soft-delete = EDITOR+. OWNER/ADMIN/EDITOR
// succeed, VIEWER/non-member/unauthenticated = 403.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user, workspace } from "@/db/schema";
import { createFolder } from "@/lib/closure";
import { addMember, createTestUser, createTestWorkspace, mockSessionFor, type Role } from "../rbac/helpers";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const ROLES: Role[] = ["OWNER", "ADMIN", "EDITOR"];
const FORBIDDEN_COPY = "이 작업을 수행할 권한이 없습니다.";

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function patchRequest(id: string, body: unknown) {
  return new Request(`http://localhost/api/folders/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function deleteRequest(id: string) {
  return new Request(`http://localhost/api/folders/${id}`, { method: "DELETE" });
}

function moveRequest(id: string, newParentId: string | null) {
  return new Request(`http://localhost/api/folders/${id}/move`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ newParentId }),
  });
}

describe("RBAC matrix — PATCH /api/folders/[id] (rename, EDITOR+)", () => {
  let patchFolder: typeof import("@/app/api/folders/[id]/route").PATCH;
  const createdUsers: string[] = [];
  const createdWorkspaces: string[] = [];

  beforeAll(async () => {
    ({ PATCH: patchFolder } = await import("@/app/api/folders/[id]/route"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
    await Promise.all(createdUsers.splice(0).map((id) => db.delete(user).where(eq(user.id, id))));
  });

  it.each(ROLES)("succeeds for a %s member", async (role) => {
    const ws = await createTestWorkspace(`rbac-patch-${role}-ws`);
    createdWorkspaces.push(ws.id);
    const caller = await createTestUser(`rbac-patch-${role}`);
    createdUsers.push(caller.id);
    await addMember(ws.id, caller.id, role);
    mockSessionFor(caller.id);
    const target = await createFolder(ws.id, null, "Target");

    const res = await patchFolder(patchRequest(target.id, { name: "Renamed" }), ctx(target.id));
    expect([200, 204]).toContain(res.status);
  });

  it("is rejected with 403 for a VIEWER", async () => {
    const ws = await createTestWorkspace("rbac-patch-viewer-ws");
    createdWorkspaces.push(ws.id);
    const caller = await createTestUser("rbac-patch-viewer");
    createdUsers.push(caller.id);
    await addMember(ws.id, caller.id, "VIEWER");
    mockSessionFor(caller.id);
    const target = await createFolder(ws.id, null, "Target");

    const res = await patchFolder(patchRequest(target.id, { name: "Renamed" }), ctx(target.id));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe(FORBIDDEN_COPY);
  });

  it("is rejected with 403 for a non-member", async () => {
    const ws = await createTestWorkspace("rbac-patch-nonmember-ws");
    createdWorkspaces.push(ws.id);
    const outsider = await createTestUser("rbac-patch-outsider");
    createdUsers.push(outsider.id);
    mockSessionFor(outsider.id);
    const target = await createFolder(ws.id, null, "Target");

    const res = await patchFolder(patchRequest(target.id, { name: "Renamed" }), ctx(target.id));
    expect(res.status).toBe(403);
  });

  it("is rejected with 403 for an unauthenticated caller", async () => {
    const ws = await createTestWorkspace("rbac-patch-anon-ws");
    createdWorkspaces.push(ws.id);
    mockSessionFor(null);
    const target = await createFolder(ws.id, null, "Target");

    const res = await patchFolder(patchRequest(target.id, { name: "Renamed" }), ctx(target.id));
    expect(res.status).toBe(403);
  });
});

describe("RBAC matrix — DELETE /api/folders/[id] (soft-delete cascade, EDITOR+)", () => {
  let deleteFolder: typeof import("@/app/api/folders/[id]/route").DELETE;
  const createdUsers: string[] = [];
  const createdWorkspaces: string[] = [];

  beforeAll(async () => {
    ({ DELETE: deleteFolder } = await import("@/app/api/folders/[id]/route"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
    await Promise.all(createdUsers.splice(0).map((id) => db.delete(user).where(eq(user.id, id))));
  });

  it.each(ROLES)("succeeds for a %s member", async (role) => {
    const ws = await createTestWorkspace(`rbac-delete-${role}-ws`);
    createdWorkspaces.push(ws.id);
    const caller = await createTestUser(`rbac-delete-${role}`);
    createdUsers.push(caller.id);
    await addMember(ws.id, caller.id, role);
    mockSessionFor(caller.id);
    const target = await createFolder(ws.id, null, "Target");

    const res = await deleteFolder(deleteRequest(target.id), ctx(target.id));
    expect([200, 204]).toContain(res.status);
  });

  it("is rejected with 403 for a VIEWER", async () => {
    const ws = await createTestWorkspace("rbac-delete-viewer-ws");
    createdWorkspaces.push(ws.id);
    const caller = await createTestUser("rbac-delete-viewer");
    createdUsers.push(caller.id);
    await addMember(ws.id, caller.id, "VIEWER");
    mockSessionFor(caller.id);
    const target = await createFolder(ws.id, null, "Target");

    const res = await deleteFolder(deleteRequest(target.id), ctx(target.id));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe(FORBIDDEN_COPY);
  });

  it("is rejected with 403 for a non-member", async () => {
    const ws = await createTestWorkspace("rbac-delete-nonmember-ws");
    createdWorkspaces.push(ws.id);
    const outsider = await createTestUser("rbac-delete-outsider");
    createdUsers.push(outsider.id);
    mockSessionFor(outsider.id);
    const target = await createFolder(ws.id, null, "Target");

    const res = await deleteFolder(deleteRequest(target.id), ctx(target.id));
    expect(res.status).toBe(403);
  });

  it("is rejected with 403 for an unauthenticated caller", async () => {
    const ws = await createTestWorkspace("rbac-delete-anon-ws");
    createdWorkspaces.push(ws.id);
    mockSessionFor(null);
    const target = await createFolder(ws.id, null, "Target");

    const res = await deleteFolder(deleteRequest(target.id), ctx(target.id));
    expect(res.status).toBe(403);
  });
});

describe("RBAC matrix — POST /api/folders/[id]/move (EDITOR+)", () => {
  let moveFolderRoute: typeof import("@/app/api/folders/[id]/move/route").POST;
  const createdUsers: string[] = [];
  const createdWorkspaces: string[] = [];

  beforeAll(async () => {
    ({ POST: moveFolderRoute } = await import("@/app/api/folders/[id]/move/route"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
    await Promise.all(createdUsers.splice(0).map((id) => db.delete(user).where(eq(user.id, id))));
  });

  it.each(ROLES)("succeeds for a %s member", async (role) => {
    const ws = await createTestWorkspace(`rbac-move-${role}-ws`);
    createdWorkspaces.push(ws.id);
    const caller = await createTestUser(`rbac-move-${role}`);
    createdUsers.push(caller.id);
    await addMember(ws.id, caller.id, role);
    mockSessionFor(caller.id);
    const target = await createFolder(ws.id, null, "Target");
    const newParent = await createFolder(ws.id, null, "NewParent");

    const res = await moveFolderRoute(moveRequest(target.id, newParent.id), ctx(target.id));
    expect([200, 204]).toContain(res.status);
  });

  it("is rejected with 403 for a VIEWER", async () => {
    const ws = await createTestWorkspace("rbac-move-viewer-ws");
    createdWorkspaces.push(ws.id);
    const caller = await createTestUser("rbac-move-viewer");
    createdUsers.push(caller.id);
    await addMember(ws.id, caller.id, "VIEWER");
    mockSessionFor(caller.id);
    const target = await createFolder(ws.id, null, "Target");
    const newParent = await createFolder(ws.id, null, "NewParent");

    const res = await moveFolderRoute(moveRequest(target.id, newParent.id), ctx(target.id));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe(FORBIDDEN_COPY);
  });

  it("is rejected with 403 for a non-member", async () => {
    const ws = await createTestWorkspace("rbac-move-nonmember-ws");
    createdWorkspaces.push(ws.id);
    const outsider = await createTestUser("rbac-move-outsider");
    createdUsers.push(outsider.id);
    mockSessionFor(outsider.id);
    const target = await createFolder(ws.id, null, "Target");
    const newParent = await createFolder(ws.id, null, "NewParent");

    const res = await moveFolderRoute(moveRequest(target.id, newParent.id), ctx(target.id));
    expect(res.status).toBe(403);
  });

  it("is rejected with 403 for an unauthenticated caller", async () => {
    const ws = await createTestWorkspace("rbac-move-anon-ws");
    createdWorkspaces.push(ws.id);
    mockSessionFor(null);
    const target = await createFolder(ws.id, null, "Target");
    const newParent = await createFolder(ws.id, null, "NewParent");

    const res = await moveFolderRoute(moveRequest(target.id, newParent.id), ctx(target.id));
    expect(res.status).toBe(403);
  });
});
