import { z } from "zod";
import { ForbiddenError, forbiddenResponse, requireRole } from "@/lib/rbac";
import { searchWorkspace } from "@/lib/search";
import { normalizeNFC } from "@/lib/validation";

export const runtime = "nodejs";

// DOC-04 / 06-RESEARCH Architecture Diagram [검색]: wsId is already in the URL (unlike the
// document-scoped tags/export routes), so there is no resolveWorkspaceIdForDocument indirection
// step -- validate the shape then requireRole directly against it (T-06-SEARCH-IDOR). An empty
// or missing q returns an empty result list, never an error.
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id: wsId } = await context.params;
  if (!z.uuid().safeParse(wsId).success) {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  try {
    await requireRole(wsId, "VIEWER");
  } catch (err) {
    if (err instanceof ForbiddenError) return forbiddenResponse();
    throw err;
  }

  const rawQ = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  const results = rawQ ? await searchWorkspace(wsId, normalizeNFC(rawQ)) : [];
  return Response.json({ results });
}
