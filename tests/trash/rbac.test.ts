// 04-04 Task 3 (RED): POST /api/trash/[type]/[id]/restore and DELETE /api/trash/[type]/[id]
// don't exist yet — dynamic imports inside beforeAll fail until Task 3 lands (mirrors
// tests/folder/rbac.test.ts's dynamic-import pattern). PRD §3 matrix: restore = EDITOR+,
// permanent delete = ADMIN+. type/id are re-derived server-side (IDOR) via
// resolveWorkspaceIdForTrashItem — never trust a client-supplied workspaceId.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { document, folder, user, workspace } from "@/db/schema";
import { createFolder, softDeleteFolder } from "@/lib/closure";
import { addMember, createTestUser, createTestWorkspace, mockSessionFor, type Role } from "../rbac/helpers";
import { createTestDocument } from "../documents/helpers";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const FORBIDDEN_COPY = "이 작업을 수행할 권한이 없습니다.";

function ctx(type: string, id: string) {
  return { params: Promise.resolve({ type, id }) };
}

function restoreRequest(type: string, id: string) {
  return new Request(`http://localhost/api/trash/${type}/${id}/restore`, { method: "POST" });
}

function deleteRequest(type: string, id: string) {
  return new Request(`http://localhost/api/trash/${type}/${id}`, { method: "DELETE" });
}

describe("RBAC matrix — POST /api/trash/[type]/[id]/restore (EDITOR+)", () => {
  let restoreRoute: typeof import("@/app/api/trash/[type]/[id]/restore/route").POST;
  const createdUsers: string[] = [];
  const createdWorkspaces: string[] = [];

  beforeAll(async () => {
    ({ POST: restoreRoute } = await import("@/app/api/trash/[type]/[id]/restore/route"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
    await Promise.all(createdUsers.splice(0).map((id) => db.delete(user).where(eq(user.id, id))));
  });

  const EDITOR_PLUS: Role[] = ["OWNER", "ADMIN", "EDITOR"];

  it.each(EDITOR_PLUS)("succeeds for a %s member", async (role) => {
    const ws = await createTestWorkspace(`rbac-trash-restore-${role}-ws`);
    createdWorkspaces.push(ws.id);
    const caller = await createTestUser(`rbac-trash-restore-${role}`);
    createdUsers.push(caller.id);
    await addMember(ws.id, caller.id, role);
    mockSessionFor(caller.id);
    const target = await createFolder(ws.id, null, "Target");
    await softDeleteFolder(target.id);

    const res = await restoreRoute(restoreRequest("folder", target.id), ctx("folder", target.id));
    expect([200, 204]).toContain(res.status);
  });

  it("is rejected with 403 for a VIEWER", async () => {
    const ws = await createTestWorkspace("rbac-trash-restore-viewer-ws");
    createdWorkspaces.push(ws.id);
    const caller = await createTestUser("rbac-trash-restore-viewer");
    createdUsers.push(caller.id);
    await addMember(ws.id, caller.id, "VIEWER");
    mockSessionFor(caller.id);
    const target = await createFolder(ws.id, null, "Target");
    await softDeleteFolder(target.id);

    const res = await restoreRoute(restoreRequest("folder", target.id), ctx("folder", target.id));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe(FORBIDDEN_COPY);
  });

  it("is rejected with 403 for a non-member", async () => {
    const ws = await createTestWorkspace("rbac-trash-restore-nonmember-ws");
    createdWorkspaces.push(ws.id);
    const outsider = await createTestUser("rbac-trash-restore-outsider");
    createdUsers.push(outsider.id);
    mockSessionFor(outsider.id);
    const target = await createFolder(ws.id, null, "Target");
    await softDeleteFolder(target.id);

    const res = await restoreRoute(restoreRequest("folder", target.id), ctx("folder", target.id));
    expect(res.status).toBe(403);
  });

  it("rejects an unknown type with 400", async () => {
    const ws = await createTestWorkspace("rbac-trash-restore-badtype-ws");
    createdWorkspaces.push(ws.id);
    const caller = await createTestUser("rbac-trash-restore-badtype");
    createdUsers.push(caller.id);
    await addMember(ws.id, caller.id, "EDITOR");
    mockSessionFor(caller.id);

    const res = await restoreRoute(
      restoreRequest("widget", "00000000-0000-0000-0000-000000000000"),
      ctx("widget", "00000000-0000-0000-0000-000000000000"),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a malformed uuid with 400", async () => {
    const res = await restoreRoute(restoreRequest("folder", "not-a-uuid"), ctx("folder", "not-a-uuid"));
    expect(res.status).toBe(400);
  });
});

describe("RBAC matrix — DELETE /api/trash/[type]/[id] (permanent delete, ADMIN+)", () => {
  let permanentDeleteRoute: typeof import("@/app/api/trash/[type]/[id]/route").DELETE;
  const createdUsers: string[] = [];
  const createdWorkspaces: string[] = [];

  beforeAll(async () => {
    ({ DELETE: permanentDeleteRoute } = await import("@/app/api/trash/[type]/[id]/route"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
    await Promise.all(createdUsers.splice(0).map((id) => db.delete(user).where(eq(user.id, id))));
  });

  const ADMIN_PLUS: Role[] = ["OWNER", "ADMIN"];

  it.each(ADMIN_PLUS)("succeeds for a %s member", async (role) => {
    const ws = await createTestWorkspace(`rbac-trash-perm-${role}-ws`);
    createdWorkspaces.push(ws.id);
    const caller = await createTestUser(`rbac-trash-perm-${role}`);
    createdUsers.push(caller.id);
    await addMember(ws.id, caller.id, role);
    mockSessionFor(caller.id);
    const target = await createFolder(ws.id, null, "Target");
    await softDeleteFolder(target.id);

    const res = await permanentDeleteRoute(deleteRequest("folder", target.id), ctx("folder", target.id));
    expect(res.status).toBe(204);
  });

  it("is rejected with 403 for an EDITOR", async () => {
    const ws = await createTestWorkspace("rbac-trash-perm-editor-ws");
    createdWorkspaces.push(ws.id);
    const caller = await createTestUser("rbac-trash-perm-editor");
    createdUsers.push(caller.id);
    await addMember(ws.id, caller.id, "EDITOR");
    mockSessionFor(caller.id);
    const target = await createFolder(ws.id, null, "Target");
    await softDeleteFolder(target.id);

    const res = await permanentDeleteRoute(deleteRequest("folder", target.id), ctx("folder", target.id));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe(FORBIDDEN_COPY);
  });

  it("is rejected with 403 for a VIEWER", async () => {
    const ws = await createTestWorkspace("rbac-trash-perm-viewer-ws");
    createdWorkspaces.push(ws.id);
    const caller = await createTestUser("rbac-trash-perm-viewer");
    createdUsers.push(caller.id);
    await addMember(ws.id, caller.id, "VIEWER");
    mockSessionFor(caller.id);
    const target = await createFolder(ws.id, null, "Target");
    await softDeleteFolder(target.id);

    const res = await permanentDeleteRoute(deleteRequest("folder", target.id), ctx("folder", target.id));
    expect(res.status).toBe(403);
  });

  it("is rejected with 403 for a non-member", async () => {
    const ws = await createTestWorkspace("rbac-trash-perm-nonmember-ws");
    createdWorkspaces.push(ws.id);
    const outsider = await createTestUser("rbac-trash-perm-outsider");
    createdUsers.push(outsider.id);
    mockSessionFor(outsider.id);
    const target = await createFolder(ws.id, null, "Target");
    await softDeleteFolder(target.id);

    const res = await permanentDeleteRoute(deleteRequest("folder", target.id), ctx("folder", target.id));
    expect(res.status).toBe(403);
  });

  it("rejects an unknown type with 400", async () => {
    const ws = await createTestWorkspace("rbac-trash-perm-badtype-ws");
    createdWorkspaces.push(ws.id);
    const caller = await createTestUser("rbac-trash-perm-badtype");
    createdUsers.push(caller.id);
    await addMember(ws.id, caller.id, "ADMIN");
    mockSessionFor(caller.id);

    const res = await permanentDeleteRoute(
      deleteRequest("widget", "00000000-0000-0000-0000-000000000000"),
      ctx("widget", "00000000-0000-0000-0000-000000000000"),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a malformed uuid with 400", async () => {
    const res = await permanentDeleteRoute(deleteRequest("folder", "not-a-uuid"), ctx("folder", "not-a-uuid"));
    expect(res.status).toBe(400);
  });

  // CR-01: permanent delete must refuse a target that isn't actually trashed (is_trash_root=true).
  // Without the guard, an ADMIN passing an active id hard-deletes it (and a folder's whole active
  // subtree) with no soft-delete step — bypassing the project's core soft-delete invariant.
  it("rejects permanent delete of an ACTIVE (non-trashed) folder and does not delete the row", async () => {
    const ws = await createTestWorkspace("rbac-trash-perm-active-folder-ws");
    createdWorkspaces.push(ws.id);
    const caller = await createTestUser("rbac-trash-perm-active-folder");
    createdUsers.push(caller.id);
    await addMember(ws.id, caller.id, "ADMIN");
    mockSessionFor(caller.id);
    const target = await createFolder(ws.id, null, "Active"); // never soft-deleted

    const res = await permanentDeleteRoute(deleteRequest("folder", target.id), ctx("folder", target.id));
    expect(res.status).toBe(403);

    const [row] = await db.select().from(folder).where(eq(folder.id, target.id));
    expect(row).toBeDefined();
  });

  it("rejects permanent delete of an ACTIVE (non-trashed) document and does not delete the row", async () => {
    const ws = await createTestWorkspace("rbac-trash-perm-active-doc-ws");
    createdWorkspaces.push(ws.id);
    const caller = await createTestUser("rbac-trash-perm-active-doc");
    createdUsers.push(caller.id);
    await addMember(ws.id, caller.id, "ADMIN");
    mockSessionFor(caller.id);
    const doc = await createTestDocument(ws.id, null, { title: "Active" }); // never soft-deleted

    const res = await permanentDeleteRoute(deleteRequest("document", doc.id), ctx("document", doc.id));
    expect(res.status).toBe(403);

    const [row] = await db.select().from(document).where(eq(document.id, doc.id));
    expect(row).toBeDefined();
  });
});
