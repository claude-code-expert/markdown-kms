import { z } from "zod";
import { autosaveDocument, resolveWorkspaceIdForDocument } from "@/lib/documents";
import { ForbiddenError, forbiddenResponse, requireRole } from "@/lib/rbac";
import { autosaveBodySchema } from "@/lib/validation";

export const runtime = "nodejs";

// TRD §7 / T-04-02-SEQ: autosaveDocument's `WHERE saved_seq < seq` is the concurrency judge —
// a stale/tied seq affects 0 rows and this route still returns 200 (never an error, NFR-1.2:
// no cancellation, stale requests are silently ignored by the DB, not rejected by the API).
//
// GET/DELETE are deliberately absent from this file (04-02 scope): GET has no RSC caller (the
// d/[docId] page calls lib/documents.getDocument directly, RESEARCH Anti-pattern) and DELETE
// (soft-delete) is 04-03's concern.
export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  // resolveWorkspaceIdForDocument only returns active documents — a trashed document is
  // rejected the same as nonexistent (T-04-02-IDOR).
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
  const parsed = autosaveBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "잘못된 요청입니다." },
      { status: 400 },
    );
  }
  const { content, title, seq } = parsed.data;

  await autosaveDocument(id, content, title, seq);
  return Response.json({ seq }, { status: 200 });
}
