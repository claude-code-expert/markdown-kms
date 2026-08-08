import { z } from "zod";
import { resolveWorkspaceIdForTrashItem, restoreFolder } from "@/lib/closure";
import { restoreDocument } from "@/lib/documents";
import { ForbiddenError, forbiddenResponse, requireRole } from "@/lib/rbac";

export const runtime = "nodejs";

const trashTypeSchema = z.enum(["folder", "document"]);

// TRD §8 통합 휴지통 라우트: POST /api/trash/:type/:id/restore (EDITOR+). URL에 wsId가 없다 —
// resolveWorkspaceIdForTrashItem(is_deleted 필터 없음)으로 서버가 workspaceId를 재유도한 뒤
// requireRole을 통과한다(move/route.ts와 동형, T-04-04-IDOR-TRASH). 클라이언트가 보낸 값은
// 인가에 절대 쓰지 않는다.
export async function POST(req: Request, context: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = await context.params;
  const parsedType = trashTypeSchema.safeParse(type);
  if (!parsedType.success || !z.uuid().safeParse(id).success) {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const target = await resolveWorkspaceIdForTrashItem(parsedType.data, id);
  if (!target) return forbiddenResponse(); // no row = membership can't be established = 403

  try {
    await requireRole(target.workspaceId, "EDITOR");
  } catch (err) {
    if (err instanceof ForbiddenError) return forbiddenResponse();
    throw err;
  }

  if (parsedType.data === "folder") {
    const result = await restoreFolder(id);
    return Response.json(result ?? {}, { status: 200 });
  }

  // 04-05: restoreDocument now mirrors restoreFolder's { relocatedToRoot } shape (Open Q #2
  // parity fix) — the trash UI reads this to decide whether to show RestoreRootBanner, so both
  // types must respond with the same JSON contract instead of document-only 204.
  const result = await restoreDocument(id);
  return Response.json(result ?? {}, { status: 200 });
}
