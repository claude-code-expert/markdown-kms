import { eq } from "drizzle-orm";
import { z } from "zod";
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

  // WR-05: validate the param shape before it reaches a `uuid`-typed column — an
  // unparseable id would otherwise surface as a raw Postgres "invalid input syntax" error
  // instead of a controlled 400.
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

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
