// src/lib/invitations.ts — createInvitation/acceptInvitation. DbClient 주입 패턴은
// documents.ts:1-8과 동일 union type(tx는 구조적으로 typeof db가 아니라서 union 필요).
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { invitation, workspace, workspaceMember } from "@/db/schema";
import { parseInvitationToken, verifyMac } from "@/lib/invitation-token";

type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export type AcceptResult =
  | { status: "success"; workspaceId: string; workspaceName: string }
  | { status: "expired" }
  | { status: "already-used" }
  | { status: "invalid-signature" }
  | { status: "wrong-user" };

// ADMIN-issued invitation row insert — no token/mac stored (NFR-3.3), only id/expiresAt.
export async function createInvitation(
  workspaceId: string,
  inviteeId: string,
  createdBy: string,
  expiresAt: Date,
  client: DbClient = db,
) {
  const [created] = await client
    .insert(invitation)
    .values({ workspaceId, inviteeId, createdBy, expiresAt })
    .returning({ id: invitation.id, expiresAt: invitation.expiresAt });
  return created;
}

// RESEARCH Pitfall 1: execution order (parse → row lookup → recompute mac → expired → used →
// invitee match) is required because the signature can only be recomputed once the DB's
// expires_at is known — the *observable* rejection-priority order (forged sig rejected before
// expiry) still matches CONTEXT.md's conceptual ordering.
export async function acceptInvitation(
  token: string,
  currentUserId: string,
  client: DbClient = db,
): Promise<AcceptResult> {
  const parsed = parseInvitationToken(token);
  if (!parsed) return { status: "invalid-signature" };

  const [row] = await client.select().from(invitation).where(eq(invitation.id, parsed.invitationId));
  if (!row) return { status: "invalid-signature" }; // Pitfall 5: not-found folded into invalid-signature (no enumeration oracle)

  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not configured"); // Pitfall 7
  if (!verifyMac(row.id, row.expiresAt, secret, parsed.mac)) {
    return { status: "invalid-signature" };
  }
  if (row.expiresAt.getTime() < Date.now()) return { status: "expired" };
  if (row.usedAt !== null) return { status: "already-used" };
  if (row.inviteeId !== currentUserId) return { status: "wrong-user" };

  const [ws] = await client
    .select({ name: workspace.name })
    .from(workspace)
    .where(eq(workspace.id, row.workspaceId));

  await client.transaction(async (tx) => {
    // Idempotent membership insert (PK is (workspaceId, userId)) — never a TOCTOU-prone
    // SELECT-then-INSERT.
    await tx
      .insert(workspaceMember)
      .values({ workspaceId: row.workspaceId, userId: currentUserId, role: "EDITOR" })
      .onConflictDoNothing();
    // Pitfall 4: the guard is the UPDATE's WHERE clause itself, re-checked against the current
    // DB state inside this transaction — not the row.usedAt read before the transaction started.
    await tx
      .update(invitation)
      .set({ usedAt: new Date() })
      .where(and(eq(invitation.id, row.id), isNull(invitation.usedAt)));
  });

  return { status: "success", workspaceId: row.workspaceId, workspaceName: ws?.name ?? "" };
}
