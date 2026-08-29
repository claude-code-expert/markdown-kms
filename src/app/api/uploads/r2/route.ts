export const runtime = "nodejs"; // AWS SDK는 Node 런타임 전용

import { ForbiddenError, forbiddenResponse, requireRole } from "@/lib/rbac";
import { MAX_UPLOAD_BYTES } from "@/lib/storage";
import { isR2Configured, saveUploadToR2 } from "@/lib/storage-r2";

// /api/uploads/route.ts와 같은 값 — multipart 경계·파트 헤더 오버헤드 때문에 딱 5MB짜리
// 파일이 Content-Length 선검사에서 오탐되지 않게 여유를 둔다(CR-02, 05-REVIEW).
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

export async function POST(req: Request) {
  const wsId = new URL(req.url).searchParams.get("wsId");
  if (!wsId) return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });

  // env 미설정을 500으로 흘리지 않는다 — 원인이 코드가 아니라 설정이라는 걸 응답에서 바로 안다.
  if (!isR2Configured()) {
    return Response.json(
      { error: "클라우드 저장소가 설정되지 않았어요. 관리자에게 문의해 주세요." },
      { status: 503 },
    );
  }

  try {
    await requireRole(wsId, "EDITOR"); // 쓰기는 EDITOR+ (기존 업로드 라우트와 동일)
  } catch (err) {
    if (err instanceof ForbiddenError) return forbiddenResponse();
    throw err;
  }

  // req.formData()가 본문 전체를 메모리에 올리기 전에 막는다.
  const contentLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES) {
    return Response.json({ error: "이미지 크기는 5MB를 넘을 수 없어요." }, { status: 413 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  try {
    const result = await saveUploadToR2(file, wsId);
    if ("error" in result) {
      const message =
        result.error === "TOO_LARGE"
          ? "이미지 크기는 5MB를 넘을 수 없어요."
          : "PNG, JPEG, GIF, WEBP 형식만 업로드할 수 있어요.";
      return Response.json({ error: message }, { status: 400 });
    }
    return Response.json({ url: result.url }, { status: 200 });
  } catch (err) {
    // 자격증명 오류·네트워크 실패는 사용자가 할 수 있는 게 없다. 원문은 로그에만 남긴다.
    console.error("r2 upload failed", err);
    return Response.json(
      { error: "이미지를 업로드하지 못했어요. 잠시 후 다시 시도해 주세요." },
      { status: 502 },
    );
  }
}
