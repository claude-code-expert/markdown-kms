// TDD RED (07-04 Task 2, WS-05): getWorkspaceMembers/getPendingJoinRequests mirror
// db-membership.ts's listMembershipsForUser innerJoin convention, reversed to
// workspace_member+user (and workspace_join_request+user for PENDING requests). RSC-consumed
// (07-05 members/page.tsx), so no route layer here.
import { describe, expect, it, vi } from "vitest";
import { createJoinRequest, decideJoinRequest } from "@/lib/join-requests";
import { getPendingJoinRequests, getWorkspaceMembers } from "@/lib/members";
import { addMember, createTestUser, createTestWorkspace } from "../rbac/helpers";

// tests/join-requests/decide.test.ts precedent -- @/auth is imported transitively via
// tests/rbac/helpers.ts.
vi.mock("@/auth", () => ({ auth: vi.fn() }));

describe("getWorkspaceMembers", () => {
  it("returns every member of the workspace with role, scoped to that workspace only", async () => {
    const ws = await createTestWorkspace("members-list-ws");
    const owner = await createTestUser("members-list-owner");
    const editor = await createTestUser("members-list-editor");
    await addMember(ws.id, owner.id, "OWNER");
    await addMember(ws.id, editor.id, "EDITOR");

    const otherWs = await createTestWorkspace("members-list-other-ws");
    const otherMember = await createTestUser("members-list-other-member");
    await addMember(otherWs.id, otherMember.id, "VIEWER");

    const members = await getWorkspaceMembers(ws.id);
    expect(members).toHaveLength(2);
    expect(members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: owner.id, name: owner.name, email: owner.email, role: "OWNER" }),
        expect.objectContaining({ userId: editor.id, name: editor.name, email: editor.email, role: "EDITOR" }),
      ]),
    );
    expect(members.map((m) => m.userId)).not.toContain(otherMember.id);
  });
});

describe("getPendingJoinRequests", () => {
  it("returns only PENDING requests for the workspace, with applicant info", async () => {
    const ws = await createTestWorkspace("members-pending-ws");
    const admin = await createTestUser("members-pending-admin");
    await addMember(ws.id, admin.id, "ADMIN");

    const applicant1 = await createTestUser("members-pending-applicant1");
    const applicant2 = await createTestUser("members-pending-applicant2");
    const approvedApplicant = await createTestUser("members-pending-approved-applicant");

    const req1 = await createJoinRequest(ws.id, applicant1.id);
    const req2 = await createJoinRequest(ws.id, applicant2.id);
    const approvedReq = await createJoinRequest(ws.id, approvedApplicant.id);
    await decideJoinRequest(ws.id, approvedReq.id, "APPROVED", admin.id);

    const otherWs = await createTestWorkspace("members-pending-other-ws");
    const otherApplicant = await createTestUser("members-pending-other-applicant");
    await createJoinRequest(otherWs.id, otherApplicant.id);

    const pending = await getPendingJoinRequests(ws.id);
    expect(pending).toHaveLength(2);
    expect(pending.map((p) => p.reqId)).toEqual(expect.arrayContaining([req1.id, req2.id]));
    expect(pending.map((p) => p.userId)).not.toContain(approvedApplicant.id);
    expect(pending.map((p) => p.userId)).not.toContain(otherApplicant.id);

    const hit = pending.find((p) => p.reqId === req1.id)!;
    expect(hit).toMatchObject({ userId: applicant1.id, name: applicant1.name, email: applicant1.email });
    expect(hit.createdAt).toBeInstanceOf(Date);
  });
});
