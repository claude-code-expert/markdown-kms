import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { workspaceJoinRequest, workspaceMember } from "@/db/schema";
import { createJoinRequest } from "@/lib/join-requests";
import { forbiddenResponse } from "@/lib/rbac";

export const runtime = "nodejs";

// WS-03 / T-07-03-SPOOF: no requireRole call here — the applicant is not yet a workspace member,
// so requireRole would always throw 403 (RESEARCH Anti-pattern). userId is taken from the session
// only, never from the request body, so an applicant can never file a request on someone else's
// behalf.
export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id: wsId } = await context.params;
  if (!z.uuid().safeParse(wsId).success) {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const session = await auth();
  if (!session?.user?.id) return forbiddenResponse();
  const userId = session.user.id;

  const [existingMember] = await db
    .select()
    .from(workspaceMember)
    .where(and(eq(workspaceMember.workspaceId, wsId), eq(workspaceMember.userId, userId)));
  if (existingMember) {
    return Response.json({ error: "이미 멤버이거나 이미 신청한 워크스페이스예요." }, { status: 400 });
  }

  const [existingPending] = await db
    .select()
    .from(workspaceJoinRequest)
    .where(
      and(
        eq(workspaceJoinRequest.workspaceId, wsId),
        eq(workspaceJoinRequest.userId, userId),
        eq(workspaceJoinRequest.status, "PENDING"),
      ),
    );
  if (existingPending) {
    return Response.json({ error: "이미 멤버이거나 이미 신청한 워크스페이스예요." }, { status: 400 });
  }

  const created = await createJoinRequest(wsId, userId);
  return Response.json({ id: created.id }, { status: 201 });
}
