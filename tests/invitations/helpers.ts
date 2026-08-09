// Invitation row seeding factory — wraps tests/rbac/helpers.ts's user/workspace/member factories
// (createTestUser/createTestWorkspace/addMember) and seeds `invitation` rows in whatever state a
// test needs (fresh/expired/already-used), matching the row shape acceptInvitation reads.
import { db } from "@/db";
import { invitation } from "@/db/schema";

const TTL_MS = 7 * 24 * 60 * 60 * 1000; // CONTEXT: 7일 (createInvitation's TTL, mirrored for test defaults)

export async function createTestInvitation(opts: {
  workspaceId: string;
  inviteeId: string;
  createdBy: string;
  expiresAt?: Date;
  usedAt?: Date | null;
}) {
  const [row] = await db
    .insert(invitation)
    .values({
      workspaceId: opts.workspaceId,
      inviteeId: opts.inviteeId,
      createdBy: opts.createdBy,
      expiresAt: opts.expiresAt ?? new Date(Date.now() + TTL_MS),
      usedAt: opts.usedAt ?? null,
    })
    .returning();
  return { row };
}
