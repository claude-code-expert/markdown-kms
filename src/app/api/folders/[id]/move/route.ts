import { z } from "zod";
import { CrossWorkspaceError, CycleError, moveFolder, resolveActiveWorkspaceId } from "@/lib/closure";
import { ForbiddenError, forbiddenResponse, requireRole } from "@/lib/rbac";

export const runtime = "nodejs";

const moveBodySchema = z.object({ newParentId: z.uuid().nullable() });

// TREE-03: move. EDITOR+. Body: { newParentId }. T-03-04-IDOR: no wsId in the URL — the server
// re-derives workspace_id from the target folder row (never the client) before requireRole.
// CycleError -> 409, CrossWorkspaceError -> 400 (closure.ts's moveFolder judges both inside the
// same transaction as the rewiring, RESEARCH Pitfall 1/2).
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const target = await resolveActiveWorkspaceId(id);
  if (!target) return forbiddenResponse(); // no row (or soft-deleted) = membership can't be established = 403

  try {
    await requireRole(target.workspaceId, "EDITOR");
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
  const parsed = moveBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "잘못된 요청입니다." }, { status: 400 });
  }

  try {
    await moveFolder(id, parsed.data.newParentId);
  } catch (err) {
    if (err instanceof CycleError) {
      return Response.json({ error: "자기 자신 또는 하위 폴더로 이동할 수 없습니다." }, { status: 409 });
    }
    if (err instanceof CrossWorkspaceError) {
      return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    throw err;
  }

  return new Response(null, { status: 204 });
}
