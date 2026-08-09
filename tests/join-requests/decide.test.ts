// WS-03/WS-04 / T-07-03-TOCTOU: createJoinRequest (simple insert) + decideJoinRequest (guard-update
// transaction). Committed before src/lib/join-requests.ts exists (TDD RED first) — mirrors
// tests/invitations/accept.test.ts's guard-update proof for the acceptInvitation transaction.
import { and, eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { workspaceJoinRequest, workspaceMember } from "@/db/schema";
import { AlreadyDecidedError, createJoinRequest, decideJoinRequest } from "@/lib/join-requests";
import { PATCH } from "@/app/api/workspaces/[id]/join-requests/[reqId]/route";
import { addMember, createTestUser, createTestWorkspace, mockSessionFor } from "../rbac/helpers";

// tests/rbac/helpers.ts imports @/auth transitively — first-applied precedent in
// tests/invitations/accept.test.ts, same reason (next-auth fails to resolve next/server under
// Vitest's non-Next runtime without this mock).
vi.mock("@/auth", () => ({ auth: vi.fn() }));

async function isMember(workspaceId: string, userId: string) {
  const [row] = await db
    .select()
    .from(workspaceMember)
    .where(and(eq(workspaceMember.workspaceId, workspaceId), eq(workspaceMember.userId, userId)));
  return row ?? null;
}

function callPatchRoute(wsId: string, reqId: string, body: unknown) {
  return PATCH(
    new Request(`http://localhost/api/workspaces/${wsId}/join-requests/${reqId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: wsId, reqId }) },
  );
}

describe("createJoinRequest / decideJoinRequest", () => {
  it("createJoinRequest inserts a PENDING row", async () => {
    const applicant = await createTestUser("jr-applicant");
    const ws = await createTestWorkspace("jr-create");

    const created = await createJoinRequest(ws.id, applicant.id);
    expect(created.status).toBe("PENDING");

    const [row] = await db.select().from(workspaceJoinRequest).where(eq(workspaceJoinRequest.id, created.id));
    expect(row.workspaceId).toBe(ws.id);
    expect(row.userId).toBe(applicant.id);
    expect(row.decidedBy).toBeNull();
    expect(row.decidedAt).toBeNull();
  });

  it("approve: PENDING -> APPROVED + decidedBy/decidedAt set + EDITOR membership created", async () => {
    const admin = await createTestUser("jr-admin");
    const applicant = await createTestUser("jr-applicant-approve");
    const ws = await createTestWorkspace("jr-approve");
    await addMember(ws.id, admin.id, "ADMIN");
    const created = await createJoinRequest(ws.id, applicant.id);

    const result = await decideJoinRequest(created.id, "APPROVED", admin.id);
    expect(result.decision).toBe("APPROVED");

    const [row] = await db.select().from(workspaceJoinRequest).where(eq(workspaceJoinRequest.id, created.id));
    expect(row.status).toBe("APPROVED");
    expect(row.decidedBy).toBe(admin.id);
    expect(row.decidedAt).not.toBeNull();

    const member = await isMember(ws.id, applicant.id);
    expect(member).not.toBeNull();
    expect(member?.role).toBe("EDITOR");
  });

  it("reject: PENDING -> REJECTED, no membership row created", async () => {
    const admin = await createTestUser("jr-admin2");
    const applicant = await createTestUser("jr-applicant-reject");
    const ws = await createTestWorkspace("jr-reject");
    await addMember(ws.id, admin.id, "ADMIN");
    const created = await createJoinRequest(ws.id, applicant.id);

    const result = await decideJoinRequest(created.id, "REJECTED", admin.id);
    expect(result.decision).toBe("REJECTED");

    const [row] = await db.select().from(workspaceJoinRequest).where(eq(workspaceJoinRequest.id, created.id));
    expect(row.status).toBe("REJECTED");
    expect(row.decidedBy).toBe(admin.id);

    const member = await isMember(ws.id, applicant.id);
    expect(member).toBeNull();
  });

  it("already-decided: deciding an already-APPROVED request throws AlreadyDecidedError, state unchanged", async () => {
    const admin = await createTestUser("jr-admin3");
    const applicant = await createTestUser("jr-applicant-already");
    const ws = await createTestWorkspace("jr-already");
    await addMember(ws.id, admin.id, "ADMIN");
    const created = await createJoinRequest(ws.id, applicant.id);

    await decideJoinRequest(created.id, "APPROVED", admin.id);

    await expect(decideJoinRequest(created.id, "REJECTED", admin.id)).rejects.toThrow(AlreadyDecidedError);

    const [row] = await db.select().from(workspaceJoinRequest).where(eq(workspaceJoinRequest.id, created.id));
    expect(row.status).toBe("APPROVED"); // unchanged by the rejected re-decision attempt
  });

  it("idempotent admission: applicant already a member -> approve sets status only, no duplicate member row", async () => {
    const admin = await createTestUser("jr-admin4");
    const applicant = await createTestUser("jr-applicant-member");
    const ws = await createTestWorkspace("jr-idempotent");
    await addMember(ws.id, admin.id, "ADMIN");
    await addMember(ws.id, applicant.id, "VIEWER"); // already a member with a different role
    const created = await createJoinRequest(ws.id, applicant.id);

    await decideJoinRequest(created.id, "APPROVED", admin.id);

    const [row] = await db.select().from(workspaceJoinRequest).where(eq(workspaceJoinRequest.id, created.id));
    expect(row.status).toBe("APPROVED");

    const rows = await db
      .select()
      .from(workspaceMember)
      .where(and(eq(workspaceMember.workspaceId, ws.id), eq(workspaceMember.userId, applicant.id)));
    expect(rows).toHaveLength(1); // onConflictDoNothing: no duplicate row, original VIEWER role preserved
    expect(rows[0].role).toBe("VIEWER");
  });

  it("concurrent double approve: 2nd decideJoinRequest call on the same reqId throws AlreadyDecidedError", async () => {
    const admin = await createTestUser("jr-admin5");
    const applicant = await createTestUser("jr-applicant-double");
    const ws = await createTestWorkspace("jr-double");
    await addMember(ws.id, admin.id, "ADMIN");
    const created = await createJoinRequest(ws.id, applicant.id);

    await decideJoinRequest(created.id, "APPROVED", admin.id);
    await expect(decideJoinRequest(created.id, "APPROVED", admin.id)).rejects.toThrow(AlreadyDecidedError);

    const rows = await db
      .select()
      .from(workspaceMember)
      .where(and(eq(workspaceMember.workspaceId, ws.id), eq(workspaceMember.userId, applicant.id)));
    expect(rows).toHaveLength(1); // second approve never re-inserts
  });
});

describe("PATCH /api/workspaces/:id/join-requests/:reqId", () => {
  it.each(["VIEWER", "EDITOR"] as const)("RBAC: %s cannot decide (403)", async (role) => {
    const member = await createTestUser(`jr-patch-${role.toLowerCase()}`);
    const applicant = await createTestUser(`jr-patch-target-${role.toLowerCase()}`);
    const ws = await createTestWorkspace(`jr-patch-rbac-${role}`);
    await addMember(ws.id, member.id, role);
    const created = await createJoinRequest(ws.id, applicant.id);
    mockSessionFor(member.id);

    const res = await callPatchRoute(ws.id, created.id, { decision: "APPROVED" });
    expect(res.status).toBe(403);

    const [row] = await db.select().from(workspaceJoinRequest).where(eq(workspaceJoinRequest.id, created.id));
    expect(row.status).toBe("PENDING");
  });

  it("RBAC: non-member cannot decide (403)", async () => {
    const outsider = await createTestUser("jr-patch-outsider");
    const applicant = await createTestUser("jr-patch-target-outsider");
    const ws = await createTestWorkspace("jr-patch-rbac-nonmember");
    const created = await createJoinRequest(ws.id, applicant.id);
    mockSessionFor(outsider.id);

    const res = await callPatchRoute(ws.id, created.id, { decision: "APPROVED" });
    expect(res.status).toBe(403);
  });

  it("rejects an out-of-enum decision value (400)", async () => {
    const admin = await createTestUser("jr-patch-admin-baddecision");
    const applicant = await createTestUser("jr-patch-target-baddecision");
    const ws = await createTestWorkspace("jr-patch-bad-decision");
    await addMember(ws.id, admin.id, "ADMIN");
    const created = await createJoinRequest(ws.id, applicant.id);
    mockSessionFor(admin.id);

    const res = await callPatchRoute(ws.id, created.id, { decision: "MAYBE" });
    expect(res.status).toBe(400);
  });

  it("rejects a nonexistent reqId (409)", async () => {
    const admin = await createTestUser("jr-patch-admin-nosuchreq");
    const ws = await createTestWorkspace("jr-patch-no-such-req");
    await addMember(ws.id, admin.id, "ADMIN");
    mockSessionFor(admin.id);

    const res = await callPatchRoute(ws.id, "00000000-0000-0000-0000-000000000000", { decision: "APPROVED" });
    expect(res.status).toBe(409);
  });

  it("rejects deciding an already-decided reqId (409)", async () => {
    const admin = await createTestUser("jr-patch-admin-already");
    const applicant = await createTestUser("jr-patch-target-already");
    const ws = await createTestWorkspace("jr-patch-already");
    await addMember(ws.id, admin.id, "ADMIN");
    const created = await createJoinRequest(ws.id, applicant.id);
    mockSessionFor(admin.id);

    const first = await callPatchRoute(ws.id, created.id, { decision: "APPROVED" });
    expect(first.status).toBe(200);

    const second = await callPatchRoute(ws.id, created.id, { decision: "REJECTED" });
    expect(second.status).toBe(409);
  });

  it("rejects a non-uuid reqId (400)", async () => {
    const admin = await createTestUser("jr-patch-admin-baduuid");
    const ws = await createTestWorkspace("jr-patch-bad-reqid-uuid");
    await addMember(ws.id, admin.id, "ADMIN");
    mockSessionFor(admin.id);

    const res = await callPatchRoute(ws.id, "not-a-uuid", { decision: "APPROVED" });
    expect(res.status).toBe(400);
  });
});
