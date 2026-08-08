import { z } from "zod";
import { replaceTags, resolveWorkspaceIdForDocument, TagLimitError } from "@/lib/documents";
import { ForbiddenError, forbiddenResponse, requireRole } from "@/lib/rbac";
import { tagsBodySchema } from "@/lib/validation";

export const runtime = "nodejs";

// DOC-03 / T-06-TAG-IDOR: same 4-stage IDOR shape as documents/[id]/route.ts's PUT — uuid check
// -> resolveWorkspaceIdForDocument (server re-derives workspaceId, never trusts a client-implied
// one) -> requireRole -> zod parse. requireRole is "EDITOR" here (VIEWER may read tags via the
// RSC page but not write them).
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
  const parsed = tagsBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "잘못된 요청입니다." },
      { status: 400 },
    );
  }

  // T-06-TAGCAP backstop: tagsBodySchema already caps the raw body at 3, so TagLimitError is
  // only reachable here via a caller that bypasses the schema (a hand-crafted request that
  // still parses as an array of <=3 strings pre-dedup but the transaction's post-dedup COUNT
  // — see replaceTags — disagrees). The transaction rolls back on throw, so the DB never ends
  // up in a partially-written state.
  try {
    const tags = await replaceTags(id, parsed.data.tags);
    return Response.json({ tags }, { status: 200 });
  } catch (err) {
    if (err instanceof TagLimitError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
