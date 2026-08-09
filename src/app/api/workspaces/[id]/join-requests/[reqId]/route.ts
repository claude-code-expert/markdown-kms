import { z } from "zod";
import { AlreadyDecidedError, decideJoinRequest } from "@/lib/join-requests";
import { ForbiddenError, forbiddenResponse, requireRole } from "@/lib/rbac";

export const runtime = "nodejs";

const bodySchema = z.object({ decision: z.enum(["APPROVED", "REJECTED"]) });

// WS-04 / T-07-03-ADMIN / T-07-03-TOCTOU: requireRole(ADMIN) is the server gate (decide.test.ts's
// 4-role matrix proves it). AlreadyDecidedError -> 409 covers both "already decided" and
// "nonexistent reqId" (decideJoinRequest's guard-update can't distinguish them, and folding them
// together avoids an existence-enumeration oracle — the invitations.ts not-found convention).
export async function PATCH(req: Request, context: { params: Promise<{ id: string; reqId: string }> }) {
  const { id: wsId, reqId } = await context.params;
  if (!z.uuid().safeParse(wsId).success || !z.uuid().safeParse(reqId).success) {
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

  try {
    await decideJoinRequest(reqId, parsed.data.decision, session.userId);
  } catch (err) {
    if (err instanceof AlreadyDecidedError) {
      return Response.json({ error: "이미 처리된 신청이에요." }, { status: 409 });
    }
    throw err;
  }

  return new Response(null, { status: 200 });
}
