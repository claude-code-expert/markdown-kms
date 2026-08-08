import { z } from "zod";
import { resolveActiveWorkspaceId } from "@/lib/closure";
import { createDocument } from "@/lib/documents";
import { ForbiddenError, forbiddenResponse, requireRole } from "@/lib/rbac";
import { documentSchema } from "@/lib/validation";

export const runtime = "nodejs";

const createDocumentBodySchema = documentSchema.pick({ title: true }).extend({
  folderId: z.uuid().nullable(),
  workspaceId: z.uuid().optional(),
});

// T-04-02-RBAC / T-04-02-IDOR: workspaceId is never taken from the client for authorization.
// When folderId is present, the target workspace is the parent folder's own workspace_id (a
// server SELECT via resolveActiveWorkspaceId) — a client-supplied workspaceId that disagrees
// is rejected with 400 before requireRole ever runs. Mirrors folders/route.ts POST exactly
// (RESEARCH Pattern-map: exact analog).
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const parsed = createDocumentBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "잘못된 요청입니다." },
      { status: 400 },
    );
  }
  const { title, folderId } = parsed.data;

  let workspaceId: string;
  if (folderId) {
    const parent = await resolveActiveWorkspaceId(folderId);
    if (!parent) {
      return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    if (parsed.data.workspaceId && parsed.data.workspaceId !== parent.workspaceId) {
      return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    workspaceId = parent.workspaceId;
  } else {
    if (!parsed.data.workspaceId) {
      return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    workspaceId = parsed.data.workspaceId;
  }

  try {
    await requireRole(workspaceId, "EDITOR");
  } catch (err) {
    if (err instanceof ForbiddenError) return forbiddenResponse();
    throw err;
  }

  const created = await createDocument(workspaceId, folderId, title);
  return Response.json({ id: created.id }, { status: 201 });
}
