import { z } from "zod";
import { getDocument, resolveWorkspaceIdForDocument } from "@/lib/documents";
import { contentDispositionHeader } from "@/lib/export";
import { ForbiddenError, forbiddenResponse, requireRole } from "@/lib/rbac";

export const runtime = "nodejs";

// EXP-01 / NFR-5.2: document.content is streamed byte-for-byte — never passed through
// lib/markdown (CLAUDE.md invariant: "export는 document.content 원문 그대로"). 06-PATTERNS
// confirmed code, IDOR shape lifted from the sibling DELETE in ../route.ts with requireRole
// dropped to VIEWER (read-only export vs. EDITOR-gated mutation).
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const target = await resolveWorkspaceIdForDocument(id);
  if (!target) return forbiddenResponse();

  try {
    await requireRole(target.workspaceId, "VIEWER");
  } catch (err) {
    if (err instanceof ForbiddenError) return forbiddenResponse();
    throw err;
  }

  const doc = await getDocument(id, target.workspaceId);
  if (!doc) return forbiddenResponse();

  // Pitfall 5: filename* alone breaks on browsers/downloaders that don't understand RFC 5987 —
  // always send both.
  const filename = `${doc.title}.md`;
  return new Response(doc.content, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": contentDispositionHeader(filename),
    },
  });
}
