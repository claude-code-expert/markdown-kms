// WS-02/D-15 개정: DELETE /api/workspaces/:id — OWNER-only SOFT delete, default workspace
// protected. Committed before src/app/api/workspaces/[id]/route.ts exists (TDD).
import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user, workspace, workspaceMember } from "@/db/schema";
import { DELETE } from "@/app/api/workspaces/[id]/route";
import { listMembershipsForUser } from "@/lib/db-membership";
import { addMember, createTestUser, createTestWorkspace, mockSessionFor, type Role } from "../rbac/helpers";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

function deleteRequest(id: string) {
  return new Request(`http://localhost/api/workspaces/${id}`, { method: "DELETE" });
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("DELETE /api/workspaces/:id", () => {
  const createdUsers: string[] = [];
  const createdWorkspaces: string[] = [];

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
    await Promise.all(createdUsers.splice(0).map((id) => db.delete(user).where(eq(user.id, id))));
  });

  it("OWNER delete soft-deletes: row and workspace_member rows persist, excluded from active listings", async () => {
    const ws = await createTestWorkspace("delete-owner-ws");
    createdWorkspaces.push(ws.id);
    const owner = await createTestUser("delete-owner");
    createdUsers.push(owner.id);
    await addMember(ws.id, owner.id, "OWNER");
    mockSessionFor(owner.id);

    const res = await DELETE(deleteRequest(ws.id), ctx(ws.id));
    expect(res.status).toBe(204);

    const [remainingWs] = await db.select().from(workspace).where(eq(workspace.id, ws.id));
    expect(remainingWs).toBeTruthy();
    expect(remainingWs.isDeleted).toBe(true);

    const remainingMembers = await db
      .select()
      .from(workspaceMember)
      .where(eq(workspaceMember.workspaceId, ws.id));
    expect(remainingMembers).toHaveLength(1);

    const activeMemberships = await listMembershipsForUser(owner.id);
    expect(activeMemberships.find((m) => m.id === ws.id)).toBeUndefined();
  });

  it.each(["ADMIN", "EDITOR", "VIEWER"] as Role[])("%s cannot delete a workspace (403)", async (role) => {
    const ws = await createTestWorkspace(`delete-${role}-ws`);
    createdWorkspaces.push(ws.id);
    const member = await createTestUser(`delete-${role}`);
    createdUsers.push(member.id);
    await addMember(ws.id, member.id, role);
    mockSessionFor(member.id);

    const res = await DELETE(deleteRequest(ws.id), ctx(ws.id));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("이 작업을 수행할 권한이 없습니다.");

    const [stillThere] = await db.select().from(workspace).where(eq(workspace.id, ws.id));
    expect(stillThere).toBeTruthy();
    expect(stillThere.isDeleted).toBe(false);
  });

  it("deleting a nonexistent workspace returns 403 (not a member of it), not a 500", async () => {
    const caller = await createTestUser("delete-nonexistent-caller");
    createdUsers.push(caller.id);
    mockSessionFor(caller.id);

    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await DELETE(deleteRequest(fakeId), ctx(fakeId));
    expect(res.status).toBe(403);
  });

  it("rejects deleting the default workspace even for an OWNER-ranked caller", async () => {
    const [defaultWs] = await db.select().from(workspace).where(eq(workspace.isDefault, true));
    const owner = await createTestUser("delete-default-owner");
    createdUsers.push(owner.id); // cascade-deletes this synthetic OWNER membership in afterEach
    await addMember(defaultWs.id, owner.id, "OWNER");
    mockSessionFor(owner.id);

    const res = await DELETE(deleteRequest(defaultWs.id), ctx(defaultWs.id));
    expect(res.status).toBe(400);

    const [stillDefault] = await db.select().from(workspace).where(eq(workspace.id, defaultWs.id));
    expect(stillDefault).toBeTruthy();
    expect(stillDefault.isDeleted).toBe(false);
  });
});
