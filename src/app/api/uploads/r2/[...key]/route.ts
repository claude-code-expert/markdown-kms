export const runtime = "nodejs";

import { ForbiddenError, requireRole } from "@/lib/rbac";
import { getFromR2, isR2Configured, workspaceIdFromKey } from "@/lib/storage-r2";

/**
 * 업로드된 이미지를 앱을 거쳐 서빙한다. 버킷은 비공개로 두고 이 라우트만 열어두는 구조다.
 *
 * 기존 로컬 디스크 업로드(storage.ts WR-02)는 `/uploads/<uuid>.ext`를 Next.js 정적 서빙에
 * 맡겨서 **권한 검증이 전혀 없었다** — UUID만 알면 워크스페이스 멤버가 아니어도, 문서가
 * 삭제된 뒤에도 받아갈 수 있었다. 여기서는 키에 박아둔 워크스페이스 id로 requireRole을
 * 걸어 그 구멍을 닫는다. storage.ts 주석이 적어둔 "업그레이드 경로"가 이것이다.
 *
 * presigned GET을 쓰지 않는 이유: 마크다운 본문에 URL이 그대로 저장되므로(NFR-5.2 원문
 * 보존) 만료되는 URL을 넣으면 시간이 지난 문서의 이미지가 전부 깨진다.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key: segments } = await params;
  const key = segments.join("/");

  const workspaceId = workspaceIdFromKey(key);
  // 형식이 어긋난 키는 존재 여부를 알려주지 않고 404로 접는다.
  if (!workspaceId) return new Response(null, { status: 404 });

  if (!isR2Configured()) return new Response(null, { status: 503 });

  try {
    await requireRole(workspaceId, "VIEWER"); // 읽기는 멤버면 충분
  } catch (err) {
    // 403 대신 404 — 권한 없는 사람에게 "그 키는 존재한다"를 알려줄 이유가 없다.
    if (err instanceof ForbiddenError) return new Response(null, { status: 404 });
    throw err;
  }

  const object = await getFromR2(key);
  if (!object) return new Response(null, { status: 404 });

  return new Response(object.body, {
    headers: {
      "content-type": object.contentType,
      ...(object.contentLength ? { "content-length": String(object.contentLength) } : {}),
      // 키가 uuid라 내용이 바뀌는 일이 없다. 다만 권한이 바뀔 수 있으므로 공유 캐시(CDN)에는
      // 올리지 않고 브라우저 캐시만 허용한다 — private이 그 뜻이다.
      "cache-control": "private, max-age=31536000, immutable",
      // 저장 시 스니핑으로 확정한 타입만 나가지만, 브라우저의 콘텐츠 추측도 막아둔다.
      "x-content-type-options": "nosniff",
    },
  });
}
