// WS-05 / T-07-02-ADMIN / T-07-02-MASS: POST /api/workspaces/:id/invitations. mailer is mocked
// (no real console noise, and lets us assert the exact link shape). Committed before
// src/app/api/workspaces/[id]/invitations/route.ts exists (TDD RED first).
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { invitation } from "@/db/schema";
import { parseInvitationToken } from "@/lib/invitation-token";
import { POST } from "@/app/api/workspaces/[id]/invitations/route";
import { addMember, createTestUser, createTestWorkspace, mockSessionFor } from "../rbac/helpers";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/mailer", () => ({ sendInvitationEmail: vi.fn().mockResolvedValue(undefined) }));

import { sendInvitationEmail } from "@/lib/mailer";

// WR-01: the accept link's origin comes from the trusted AUTH_URL env var, not the request's
// Host header — stub a fixed trusted origin so every test in this file has one configured.
const TRUSTED_ORIGIN = "http://localhost:3000";

function createRequest(body: unknown) {
  return new Request("http://localhost/api/workspaces/test/invitations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function malformedRequest() {
  return new Request("http://localhost/api/workspaces/test/invitations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{not json",
  });
}

function callRoute(wsId: string, body: unknown) {
  return POST(createRequest(body), { params: Promise.resolve({ id: wsId }) });
}

describe("POST /api/workspaces/:id/invitations", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_URL", TRUSTED_ORIGIN);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("ADMIN success: creates invitation row + sends exactly the right accept link", async () => {
    const admin = await createTestUser("inv-admin");
    const invitee = await createTestUser("inv-invitee");
    const ws = await createTestWorkspace("invitations-admin-success");
    await addMember(ws.id, admin.id, "ADMIN");
    mockSessionFor(admin.id);

    const res = await callRoute(ws.id, { inviteeId: invitee.id });
    expect(res.status).toBe(201);
    const body = await res.json();

    const [row] = await db.select().from(invitation).where(eq(invitation.id, body.id));
    expect(row).toBeDefined();
    expect(row.inviteeId).toBe(invitee.id);
    expect(row.workspaceId).toBe(ws.id);

    expect(sendInvitationEmail).toHaveBeenCalledTimes(1);
    const [toArg, linkArg] = vi.mocked(sendInvitationEmail).mock.calls[0];
    expect(toArg).toBe(invitee.email);
    expect(linkArg).toContain("/invitations/accept?token=");

    const token = new URL(linkArg).searchParams.get("token")!;
    const parsed = parseInvitationToken(token);
    expect(parsed?.invitationId).toBe(row.id);
  });

  it("WR-01: accept link uses the configured AUTH_URL origin, not a spoofed request Host", async () => {
    const admin = await createTestUser("inv-admin-spoof");
    const invitee = await createTestUser("inv-invitee-spoof");
    const ws = await createTestWorkspace("invitations-spoofed-host");
    await addMember(ws.id, admin.id, "ADMIN");
    mockSessionFor(admin.id);

    const spoofedReq = new Request("http://evil.example.com/api/workspaces/test/invitations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ inviteeId: invitee.id }),
    });
    const res = await POST(spoofedReq, { params: Promise.resolve({ id: ws.id }) });
    expect(res.status).toBe(201);

    const [, linkArg] = vi.mocked(sendInvitationEmail).mock.calls[0];
    expect(linkArg.startsWith(TRUSTED_ORIGIN)).toBe(true);
    expect(linkArg).not.toContain("evil.example.com");
  });

  it.each(["VIEWER", "EDITOR"] as const)("RBAC: %s cannot invite (403, no row created)", async (role) => {
    const member = await createTestUser(`inv-${role.toLowerCase()}`);
    const invitee = await createTestUser("inv-target");
    const ws = await createTestWorkspace(`invitations-rbac-${role}`);
    await addMember(ws.id, member.id, role);
    mockSessionFor(member.id);

    const res = await callRoute(ws.id, { inviteeId: invitee.id });
    expect(res.status).toBe(403);

    const rows = await db.select().from(invitation).where(eq(invitation.inviteeId, invitee.id));
    expect(rows).toHaveLength(0);
    expect(sendInvitationEmail).not.toHaveBeenCalled();
  });

  it("RBAC: non-member cannot invite (403)", async () => {
    const outsider = await createTestUser("inv-outsider");
    const invitee = await createTestUser("inv-target-outsider");
    const ws = await createTestWorkspace("invitations-rbac-nonmember");
    mockSessionFor(outsider.id);

    const res = await callRoute(ws.id, { inviteeId: invitee.id });
    expect(res.status).toBe(403);
    expect(sendInvitationEmail).not.toHaveBeenCalled();
  });

  it("RBAC: unauthenticated request is rejected (403)", async () => {
    const ws = await createTestWorkspace("invitations-rbac-anon");
    const invitee = await createTestUser("inv-target-anon");
    mockSessionFor(null);

    const res = await callRoute(ws.id, { inviteeId: invitee.id });
    expect(res.status).toBe(403);
    expect(sendInvitationEmail).not.toHaveBeenCalled();
  });

  it("rejects inviting an existing member (400, no row/mail)", async () => {
    const admin = await createTestUser("inv-admin2");
    const existingMember = await createTestUser("inv-existing");
    const ws = await createTestWorkspace("invitations-already-member");
    await addMember(ws.id, admin.id, "ADMIN");
    await addMember(ws.id, existingMember.id, "VIEWER");
    mockSessionFor(admin.id);

    const res = await callRoute(ws.id, { inviteeId: existingMember.id });
    expect(res.status).toBe(400);

    const rows = await db.select().from(invitation).where(eq(invitation.inviteeId, existingMember.id));
    expect(rows).toHaveLength(0);
    expect(sendInvitationEmail).not.toHaveBeenCalled();
  });

  it("rejects a nonexistent invitee (400)", async () => {
    const admin = await createTestUser("inv-admin3");
    const ws = await createTestWorkspace("invitations-no-such-user");
    await addMember(ws.id, admin.id, "ADMIN");
    mockSessionFor(admin.id);

    const res = await callRoute(ws.id, { inviteeId: "00000000-0000-0000-0000-000000000000" });
    expect(res.status).toBe(400);
  });

  it("rejects a non-uuid workspace id (400)", async () => {
    const admin = await createTestUser("inv-admin4");
    mockSessionFor(admin.id);
    const res = await callRoute("not-a-uuid", { inviteeId: admin.id });
    expect(res.status).toBe(400);
  });

  it("rejects a malformed body (missing/non-uuid inviteeId, and malformed JSON)", async () => {
    const admin = await createTestUser("inv-admin5");
    const ws = await createTestWorkspace("invitations-bad-body");
    await addMember(ws.id, admin.id, "ADMIN");
    mockSessionFor(admin.id);

    const missing = await callRoute(ws.id, {});
    expect(missing.status).toBe(400);

    const nonUuid = await callRoute(ws.id, { inviteeId: "not-a-uuid" });
    expect(nonUuid.status).toBe(400);

    const malformed = await POST(malformedRequest(), { params: Promise.resolve({ id: ws.id }) });
    expect(malformed.status).toBe(400);
  });
});
