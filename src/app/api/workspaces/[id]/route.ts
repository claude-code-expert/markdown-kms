import { eq } from "drizzle-orm";
import { db } from "@/db";
import { workspace } from "@/db/schema";
import { ForbiddenError, forbiddenResponse, requireRole } from "@/lib/rbac";

export const runtime = "nodejs";

// WS-02/D-15 개정: DELETE /api/workspaces/:id — OWNER-only SOFT delete. requireRole is the
// server-only gate (CLAUDE.md) and runs FIRST, before any lookup — never trust a client-supplied
// role. The default workspace (is_default=true) is never deletable. Sets is_deleted=true; the
// row and its workspace_member rows are preserved (restorable once Phase 4's trash UI lands).
export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  try {
    await requireRole(id, "OWNER");
  } catch (err) {
    if (err instanceof ForbiddenError) return forbiddenResponse();
    throw err;
  }

  const [ws] = await db.select({ isDefault: workspace.isDefault }).from(workspace).where(eq(workspace.id, id));
  if (ws?.isDefault) {
    return Response.json({ error: "기본 워크스페이스는 삭제할 수 없습니다." }, { status: 400 });
  }

  await db.update(workspace).set({ isDeleted: true }).where(eq(workspace.id, id));

  return new Response(null, { status: 204 });
}
