import { ForbiddenError, forbiddenResponse, requireRole } from "@/lib/rbac";
import { MAX_UPLOAD_BYTES, saveUpload } from "@/lib/storage";

export const runtime = "nodejs"; // Pitfall 4: fs access requires the Node runtime, not Edge

// CR-02 (05-REVIEW): multipart bodies carry a little overhead beyond the raw file bytes
// (boundary markers, per-part headers) — this buffer keeps the pre-parse Content-Length
// check from false-rejecting a file that's just under MAX_UPLOAD_BYTES.
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

// EDIT-09: uploads are workspace-scoped but not document-scoped (a document isn't created
// yet the first time a user drags an image in) — wsId comes in as a query param rather than
// a route segment, unlike documents/[id]/route.ts. Plain Request (not NextRequest) mirrors
// documents/[id]/route.ts's handler signature and is what the route-level tests construct
// directly — req.url is parsed with URL like any other route in this codebase.
// requireRole's UUID_RE fail-closed guard already rejects a malformed wsId (rbac.ts:15,42),
// so no separate zod check is needed here.
export async function POST(req: Request) {
  const wsId = new URL(req.url).searchParams.get("wsId");
  if (!wsId) return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });

  try {
    await requireRole(wsId, "EDITOR"); // CONTEXT: EDITOR+ 게이트, 서버 전용
  } catch (err) {
    if (err instanceof ForbiddenError) return forbiddenResponse();
    throw err;
  }

  // CR-02: reject an obviously oversized body via Content-Length BEFORE req.formData() buffers
  // the entire multipart body into memory. The post-parse file.size check in saveUpload stays
  // as defense in depth — Content-Length can be absent or spoofed.
  const contentLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES) {
    return Response.json({ error: "이미지 크기는 5MB를 넘을 수 없어요." }, { status: 413 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const result = await saveUpload(file);
  if ("error" in result) {
    const message =
      result.error === "TOO_LARGE"
        ? "이미지 크기는 5MB를 넘을 수 없어요."
        : "PNG, JPEG, GIF, WEBP 형식만 업로드할 수 있어요."; // UI-SPEC Copywriting Contract
    return Response.json({ error: message }, { status: 400 });
  }

  return Response.json({ url: result.url }, { status: 200 });
  // Original filename is not echoed back — the client already has file.name (used as alt text).
}
