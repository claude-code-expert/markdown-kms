// WS-03 / T-07-03-SPOOF: POST /api/workspaces/:id/join-requests. Session-bound (never trusts a
// client-supplied userId), no requireRole call (applicant is not yet a member — RESEARCH
// Anti-pattern). Committed before the route file exists (TDD RED first).
import { and, eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { workspaceJoinRequest } from "@/db/schema";
import { POST } from "@/app/api/workspaces/[id]/join-requests/route";
import { addMember, createTestUser, createTestWorkspace, mockSessionFor } from "../rbac/helpers";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

function callRoute(wsId: string) {
  return POST(new Request(`http://localhost/api/workspaces/${wsId}/join-requests`, { method: "POST" }), {
    params: Promise.resolve({ id: wsId }),
  });
}

async function findRequest(workspaceId: string, userId: string) {
  return db
    .select()
    .from(workspaceJoinRequest)
    .where(and(eq(workspaceJoinRequest.workspaceId, workspaceId), eq(workspaceJoinRequest.userId, userId)));
}

describe("POST /api/workspaces/:id/join-requests", () => {
  it("non-member success: 201, PENDING row created for the session user", async () => {
    const applicant = await createTestUser("jr-post-applicant");
    const ws = await createTestWorkspace("jr-post-success");
    mockSessionFor(applicant.id);

    const res = await callRoute(ws.id);
    expect(res.status).toBe(201);

    const rows = await findRequest(ws.id, applicant.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("PENDING");
  });

  it("rejects an already-member applicant (400, no row created)", async () => {
    const member = await createTestUser("jr-post-member");
    const ws = await createTestWorkspace("jr-post-already-member");
    await addMember(ws.id, member.id, "VIEWER");
    mockSessionFor(member.id);

    const res = await callRoute(ws.id);
    expect(res.status).toBe(400);

    const rows = await findRequest(ws.id, member.id);
    expect(rows).toHaveLength(0);
  });

  it("rejects a duplicate PENDING request (400, no second row created)", async () => {
    const applicant = await createTestUser("jr-post-dup");
    const ws = await createTestWorkspace("jr-post-dup-ws");
    mockSessionFor(applicant.id);

    const first = await callRoute(ws.id);
    expect(first.status).toBe(201);

    const second = await callRoute(ws.id);
    expect(second.status).toBe(400);

    const rows = await findRequest(ws.id, applicant.id);
    expect(rows).toHaveLength(1);
  });

  it("rejects an unauthenticated request (403)", async () => {
    const ws = await createTestWorkspace("jr-post-anon");
    mockSessionFor(null);

    const res = await callRoute(ws.id);
    expect(res.status).toBe(403);
  });

  it("rejects a non-uuid workspace id (400)", async () => {
    const applicant = await createTestUser("jr-post-baduuid");
    mockSessionFor(applicant.id);

    const res = await callRoute("not-a-uuid");
    expect(res.status).toBe(400);
  });
});
