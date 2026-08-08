import { z } from "zod";
import { createFolder, resolveActiveWorkspaceId } from "@/lib/closure";
import { ForbiddenError, forbiddenResponse, requireRole } from "@/lib/rbac";
import { folderSchema } from "@/lib/validation";

export const runtime = "nodejs";

const createFolderBodySchema = folderSchema.extend({
  parentId: z.uuid().nullable(),
  workspaceId: z.uuid().optional(),
});

// T-03-02-IDOR / T-03-02-XWS: workspaceId is never taken from the client for authorization.
// When parentId is present, the target workspace is the parent folder's own workspace_id (a
// server SELECT) — a client-supplied workspaceId that disagrees with it is rejected with 400
// before requireRole ever runs (RESEARCH Pitfall 2/3). When parentId is null (root creation),
// workspaceId must come from the body and is validated as a uuid.
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const parsed = createFolderBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "잘못된 요청입니다." },
      { status: 400 },
    );
  }
  const { name, parentId } = parsed.data;

  let workspaceId: string;
  if (parentId) {
    const parent = await resolveActiveWorkspaceId(parentId);
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

  const created = await createFolder(workspaceId, parentId, name);
  return Response.json({ id: created.id, name: created.name }, { status: 201 });
}
