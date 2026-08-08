import { z } from "zod";
import { deleteDraft, resolveWorkspaceIdForDocument, upsertDraft } from "@/lib/documents";
import { ForbiddenError, forbiddenResponse, requireRole } from "@/lib/rbac";
import { draftBodySchema } from "@/lib/validation";

export const runtime = "nodejs";

// EDIT-11 / T-05-04-IDOR / T-05-04-PRIV: same 4-stage shape as documents/[id]/route.ts (uuid ->
// resolveWorkspaceIdForDocument (server-side workspace re-derivation, active documents only) ->
// requireRole(EDITOR) -> body validation -> service call). draft has no seq guard (TRD §7 — it's
// a 1-minute-interval upsert, not an ordered save).
//
// GET is deliberately absent here too: no RSC caller needs a draft/GET endpoint — the recovery
// comparison (d/[docId]/page.tsx) calls lib/documents.getDraft directly (Pitfall 7).
export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const target = await resolveWorkspaceIdForDocument(id);
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
  const parsed = draftBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "잘못된 요청입니다." },
      { status: 400 },
    );
  }

  await upsertDraft(id, parsed.data.content);
  return Response.json({}, { status: 200 });
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const target = await resolveWorkspaceIdForDocument(id);
  if (!target) return forbiddenResponse();

  try {
    await requireRole(target.workspaceId, "EDITOR");
  } catch (err) {
    if (err instanceof ForbiddenError) return forbiddenResponse();
    throw err;
  }

  await deleteDraft(id);
  return new Response(null, { status: 204 });
}
