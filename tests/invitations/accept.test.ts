// WS-05 / T-07-02-IDOR / T-07-02-REPLAY: acceptInvitation's 5-state result + one-time transactional
// admission, proven against the real test DB (RED first — this file is written before
// src/lib/invitations.ts exists per the plan's tdd="true" gate).
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { invitation, workspaceMember } from "@/db/schema";
import { encodeInvitationToken } from "@/lib/invitation-token";
import { acceptInvitation } from "@/lib/invitations";
import { createTestUser, createTestWorkspace } from "../rbac/helpers";
import { createTestInvitation } from "./helpers";

// tests/rbac/helpers.ts imports @/auth transitively (mockSessionFor) — even though this file
// never calls it, the import chain still resolves next-auth, which fails under Vitest's non-Next
// runtime without this mock (tests/folder/query-count.test.ts precedent).
vi.mock("@/auth", () => ({ auth: vi.fn() }));

const SECRET = process.env.AUTH_SECRET;

async function isMember(workspaceId: string, userId: string) {
  const [row] = await db
    .select()
    .from(workspaceMember)
    .where(and(eq(workspaceMember.workspaceId, workspaceId), eq(workspaceMember.userId, userId)));
  return !!row;
}

describe("acceptInvitation", () => {
  beforeEach(() => {
    if (!SECRET) throw new Error("AUTH_SECRET must be set for this test run");
  });

  it("success: valid token + invited user → EDITOR membership + used_at set", async () => {
    const admin = await createTestUser("admin");
    const invitee = await createTestUser("invitee");
    const ws = await createTestWorkspace("accept-success");
    const { row } = await createTestInvitation({ workspaceId: ws.id, inviteeId: invitee.id, createdBy: admin.id });

    const token = encodeInvitationToken(row.id, row.expiresAt, SECRET!);
    const result = await acceptInvitation(token, invitee.id);

    expect(result).toEqual({ status: "success", workspaceId: ws.id, workspaceName: ws.name });
    expect(await isMember(ws.id, invitee.id)).toBe(true);

    const [updated] = await db.select().from(invitation).where(eq(invitation.id, row.id));
    expect(updated.usedAt).not.toBeNull();
  });

  it("invalid-signature: tampered mac → rejected, no membership created", async () => {
    const admin = await createTestUser("admin");
    const invitee = await createTestUser("invitee");
    const ws = await createTestWorkspace("accept-tampered");
    const { row } = await createTestInvitation({ workspaceId: ws.id, inviteeId: invitee.id, createdBy: admin.id });

    const token = encodeInvitationToken(row.id, row.expiresAt, SECRET!);
    const tampered = token.slice(0, -2) + (token.at(-1) === "A" ? "Bx" : "Ax");

    const result = await acceptInvitation(tampered, invitee.id);
    expect(result).toEqual({ status: "invalid-signature" });
    expect(await isMember(ws.id, invitee.id)).toBe(false);
  });

  it("invalid-signature: nonexistent invitation id folded into invalid-signature (no enumeration oracle)", async () => {
    const invitee = await createTestUser("invitee");
    // Base64url-encode a syntactically well-formed but nonexistent id.mac payload.
    const fakeToken = Buffer.from("00000000-0000-0000-0000-000000000000.fakemac", "utf8").toString(
      "base64url",
    );

    const result = await acceptInvitation(fakeToken, invitee.id);
    expect(result).toEqual({ status: "invalid-signature" });
  });

  it("expired: expiresAt in the past → rejected, no membership created", async () => {
    const admin = await createTestUser("admin");
    const invitee = await createTestUser("invitee");
    const ws = await createTestWorkspace("accept-expired");
    const pastExpiry = new Date(Date.now() - 1000);
    const { row } = await createTestInvitation({
      workspaceId: ws.id,
      inviteeId: invitee.id,
      createdBy: admin.id,
      expiresAt: pastExpiry,
    });

    const token = encodeInvitationToken(row.id, row.expiresAt, SECRET!);
    const result = await acceptInvitation(token, invitee.id);
    expect(result).toEqual({ status: "expired" });
    expect(await isMember(ws.id, invitee.id)).toBe(false);
  });

  it("already-used: usedAt already set → rejected", async () => {
    const admin = await createTestUser("admin");
    const invitee = await createTestUser("invitee");
    const ws = await createTestWorkspace("accept-used");
    const { row } = await createTestInvitation({
      workspaceId: ws.id,
      inviteeId: invitee.id,
      createdBy: admin.id,
      usedAt: new Date(),
    });

    const token = encodeInvitationToken(row.id, row.expiresAt, SECRET!);
    const result = await acceptInvitation(token, invitee.id);
    expect(result).toEqual({ status: "already-used" });
  });

  it("wrong-user: session user is not the invitee → rejected, no membership created (IDOR defense)", async () => {
    const admin = await createTestUser("admin");
    const invitee = await createTestUser("invitee");
    const attacker = await createTestUser("attacker");
    const ws = await createTestWorkspace("accept-wrong-user");
    const { row } = await createTestInvitation({ workspaceId: ws.id, inviteeId: invitee.id, createdBy: admin.id });

    const token = encodeInvitationToken(row.id, row.expiresAt, SECRET!);
    const result = await acceptInvitation(token, attacker.id);
    expect(result).toEqual({ status: "wrong-user" });
    expect(await isMember(ws.id, attacker.id)).toBe(false);
    expect(await isMember(ws.id, invitee.id)).toBe(false);
  });

  it("atomicity/idempotency: already-member success is a no-op insert, and a 2nd accept is already-used", async () => {
    const admin = await createTestUser("admin");
    const invitee = await createTestUser("invitee");
    const ws = await createTestWorkspace("accept-idempotent");
    const { row } = await createTestInvitation({ workspaceId: ws.id, inviteeId: invitee.id, createdBy: admin.id });

    const token = encodeInvitationToken(row.id, row.expiresAt, SECRET!);
    const first = await acceptInvitation(token, invitee.id);
    expect(first.status).toBe("success");

    const rowsAfterFirst = await db
      .select()
      .from(workspaceMember)
      .where(and(eq(workspaceMember.workspaceId, ws.id), eq(workspaceMember.userId, invitee.id)));
    expect(rowsAfterFirst.length).toBe(1);

    const second = await acceptInvitation(token, invitee.id);
    expect(second).toEqual({ status: "already-used" });

    const rowsAfterSecond = await db
      .select()
      .from(workspaceMember)
      .where(and(eq(workspaceMember.workspaceId, ws.id), eq(workspaceMember.userId, invitee.id)));
    expect(rowsAfterSecond.length).toBe(1); // no duplicate row from onConflictDoNothing
  });
});
