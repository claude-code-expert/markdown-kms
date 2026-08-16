import { z } from "zod";
import { CrossWorkspaceError, moveDocument } from "@/lib/closure";
import { resolveWorkspaceIdForDocument } from "@/lib/documents";
import { ForbiddenError, forbiddenResponse, requireRole } from "@/lib/rbac";

export const runtime = "nodejs";

const moveBodySchema = z.object({ newFolderId: z.uuid().nullable() });

// folders/[id]/move와 동일 패턴. EDITOR+. Body: { newFolderId }. IDOR: URL엔 wsId 없음 —
// 문서 행에서 workspace_id를 재조회한 뒤 requireRole. CrossWorkspaceError -> 400.
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const target = await resolveWorkspaceIdForDocument(id);
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
    await moveDocument(id, parsed.data.newFolderId);
  } catch (err) {
    if (err instanceof CrossWorkspaceError) {
      return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    throw err;
  }

  return new Response(null, { status: 204 });
}
