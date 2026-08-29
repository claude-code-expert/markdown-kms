// src/lib/storage-r2.ts — Cloudflare R2 업로드/조회. storage.ts와 같은 원칙(TRD §8): 저장소를
// 아는 코드는 이 파일뿐이고, 바깥은 URL 문자열만 안다.
//
// R2는 S3 호환 API를 제공하므로 전용 SDK 없이 @aws-sdk/client-s3를 그대로 쓴다. region은
// R2가 무시하지만 SDK가 필수로 요구해서 "auto"를 넣는다.
import { randomUUID } from "node:crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { MAX_UPLOAD_BYTES, sniffImageType } from "@/lib/storage";

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

/** 브라우저가 마크다운 안에서 여는 경로. 영구 URL이어야 한다 — 문서 본문에 그대로 저장된다. */
export const R2_PUBLIC_PREFIX = "/api/uploads/r2";

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET,
  );
}

// 모듈 로드 시점이 아니라 호출 시점에 만든다. 상단에서 바로 생성하면 env가 없는 환경(로컬,
// 테스트)에서 이 파일을 import하는 것만으로 죽는다.
let client: S3Client | null = null;

function r2(): S3Client {
  if (!isR2Configured()) throw new Error("R2 환경변수가 설정되지 않았습니다.");
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  return client;
}

function bucket(): string {
  return process.env.R2_BUCKET!;
}

/**
 * 오브젝트 키에 워크스페이스 id를 박아 넣는다. 이게 이 파일의 핵심 설계다 — 조회 라우트가
 * 키만 보고 어느 워크스페이스 자원인지 알 수 있어, 이미지 한 장 서빙할 때마다 DB를 뒤지지
 * 않고 requireRole을 걸 수 있다.
 */
export function buildKey(workspaceId: string, ext: string): string {
  return `w/${workspaceId}/${randomUUID()}.${ext}`;
}

/** 키에서 워크스페이스 id를 되뽑는다. 형식이 어긋나면 null — 호출부가 403/404로 막는다. */
export function workspaceIdFromKey(key: string): string | null {
  const match = /^w\/([^/]+)\/[^/]+$/.exec(key);
  return match ? match[1] : null;
}

export async function saveUploadToR2(
  file: File,
  workspaceId: string,
): Promise<{ url: string } | { error: "TOO_LARGE" | "BAD_TYPE" }> {
  // storage.ts와 같은 순서 — 바이트를 읽기 전에 크기부터 막는다(EDIT-09 Pitfall 3).
  if (file.size > MAX_UPLOAD_BYTES) return { error: "TOO_LARGE" };

  const buf = Buffer.from(await file.arrayBuffer());
  // 클라이언트가 준 file.type/file.name은 여전히 믿지 않는다(EDIT-09 Pitfall 1).
  const sniffed = sniffImageType(buf);
  if (!sniffed) return { error: "BAD_TYPE" };

  const key = buildKey(workspaceId, sniffed.ext);

  await r2().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: buf,
      // 스니핑으로 확정한 타입만 넣는다. 클라이언트 값을 그대로 실으면 text/html 같은 걸
      // 심어 저장소를 XSS 벡터로 쓸 수 있다.
      ContentType: CONTENT_TYPES[sniffed.ext],
    }),
  );

  return { url: `${R2_PUBLIC_PREFIX}/${key}` };
}

export interface R2Object {
  body: ReadableStream;
  contentType: string;
  contentLength?: number;
}

/** 조회. 없으면 null — 호출부가 404로 매핑한다. */
export async function getFromR2(key: string): Promise<R2Object | null> {
  try {
    const res = await r2().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
    if (!res.Body) return null;
    return {
      body: res.Body.transformToWebStream(),
      // 업로드 때 스니핑으로 확정해 저장한 값이다. 그래도 없으면 옥텟 스트림으로 떨어뜨려
      // 브라우저가 렌더를 시도하지 않게 한다.
      contentType: res.ContentType ?? "application/octet-stream",
      contentLength: res.ContentLength,
    };
  } catch (err) {
    if ((err as { name?: string }).name === "NoSuchKey") return null;
    throw err;
  }
}
