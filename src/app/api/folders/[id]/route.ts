import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { folder } from "@/db/schema";
import { resolveActiveWorkspaceId, softDeleteFolder } from "@/lib/closure";
import { ForbiddenError, forbiddenResponse, requireRole } from "@/lib/rbac";
import { folderSchema } from "@/lib/validation";

export const runtime = "nodejs";

// TREE-03: rename. EDITOR+. Body: { name }.
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const target = await resolveActiveWorkspaceId(id);
  if (!target) return forbiddenResponse();

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
  const parsed = folderSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "잘못된 요청입니다." }, { status: 400 });
  }

  await db.update(folder).set({ name: parsed.data.name, updatedAt: new Date() }).where(eq(folder.id, id));
  return new Response(null, { status: 204 });
}

// TREE-03 / PRD §2-2: soft-delete cascade (subtree is_deleted=true, is_trash_root=true on the
// direct target only). EDITOR+. Permanent delete (ADMIN, trash) is Phase 4 — out of scope here.
export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const target = await resolveActiveWorkspaceId(id);
  if (!target) return forbiddenResponse();

  try {
    await requireRole(target.workspaceId, "EDITOR");
  } catch (err) {
    if (err instanceof ForbiddenError) return forbiddenResponse();
    throw err;
  }

  await softDeleteFolder(id);
  return new Response(null, { status: 204 });
}
