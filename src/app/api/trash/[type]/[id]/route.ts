import { z } from "zod";
import { permanentlyDeleteFolder, resolveWorkspaceIdForTrashItem } from "@/lib/closure";
import { permanentlyDeleteDocument } from "@/lib/documents";
import { ForbiddenError, forbiddenResponse, requireRole } from "@/lib/rbac";

export const runtime = "nodejs";

const trashTypeSchema = z.enum(["folder", "document"]);

// TRD §8 통합 휴지통 라우트: DELETE /api/trash/:type/:id (완전 삭제, ADMIN+, 비가역).
// resolveWorkspaceIdForTrashItem(비활성 허용) 재유도 → requireRole(ADMIN) — T-04-04-PRIV.
export async function DELETE(req: Request, context: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = await context.params;
  const parsedType = trashTypeSchema.safeParse(type);
  if (!parsedType.success || !z.uuid().safeParse(id).success) {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const target = await resolveWorkspaceIdForTrashItem(parsedType.data, id);
  if (!target) return forbiddenResponse();

  try {
    await requireRole(target.workspaceId, "ADMIN");
  } catch (err) {
    if (err instanceof ForbiddenError) return forbiddenResponse();
    throw err;
  }

  if (parsedType.data === "folder") {
    await permanentlyDeleteFolder(id);
  } else {
    await permanentlyDeleteDocument(id);
  }

  return new Response(null, { status: 204 });
}
