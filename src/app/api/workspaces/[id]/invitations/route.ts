// src/app/api/workspaces/[id]/invitations/route.ts — requireRole(ADMIN) -> zod parse -> lib call,
// same structure as workspaces/[id]/search/route.ts (uuid param guard + requireRole) and
// workspaces/route.ts (malformed-JSON guard + transaction insert).
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { user, workspaceMember } from "@/db/schema";
import { ForbiddenError, forbiddenResponse, requireRole } from "@/lib/rbac";
import { encodeInvitationToken } from "@/lib/invitation-token";
import { createInvitation } from "@/lib/invitations";
import { sendInvitationEmail } from "@/lib/mailer";

export const runtime = "nodejs";

const bodySchema = z.object({ inviteeId: z.uuid() });
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // CONTEXT: 7일

// T-07-02-MASS: bodySchema only ever admits inviteeId — the membership role is never
// client-suppliable, acceptInvitation hardcodes 'EDITOR'.
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id: wsId } = await context.params;
  if (!z.uuid().safeParse(wsId).success) {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  let session;
  try {
    session = await requireRole(wsId, "ADMIN");
  } catch (err) {
    if (err instanceof ForbiddenError) return forbiddenResponse();
    throw err;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const [invitee] = await db.select().from(user).where(eq(user.id, parsed.data.inviteeId));
  if (!invitee) return Response.json({ error: "존재하지 않는 회원입니다." }, { status: 400 });

  const [existingMember] = await db
    .select()
    .from(workspaceMember)
    .where(and(eq(workspaceMember.workspaceId, wsId), eq(workspaceMember.userId, invitee.id)));
  if (existingMember) return Response.json({ error: "이미 멤버예요." }, { status: 400 });

  const expiresAt = new Date(Date.now() + TTL_MS);
  const created = await createInvitation(wsId, invitee.id, session.userId, expiresAt);

  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not configured"); // RESEARCH Pitfall 7
  const token = encodeInvitationToken(created.id, created.expiresAt, secret);
  const origin = new URL(req.url).origin; // A3: no new env var, request origin builds the link
  await sendInvitationEmail(invitee.email, `${origin}/invitations/accept?token=${token}`);

  return Response.json({ id: created.id }, { status: 201 });
}
