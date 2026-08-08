// TRD §8 "저장 함수 하나 교체로 끝나도록 업로드 경로를 한 모듈에 가둔다" — saveUpload is the
// ONLY export. Nothing outside this module knows the storage directory or naming scheme, so an
// S3-style swap later is a rewrite of this file alone.
//
// EDIT-09 / Pitfall 1: the client's File.type/File.name are never trusted for the stored
// extension — the server sniffs the actual bytes (magic numbers) and decides for itself.
// EDIT-09 / Pitfall 3: size is checked BEFORE arrayBuffer() reads the file into memory, so an
// oversized upload never has its bytes read.
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
// Exported so the route handler can reject an oversized Content-Length before req.formData()
// ever buffers the body (CR-02, 05-REVIEW) — single source of truth for the 5MB cap.
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // CONTEXT: 최대 5MB
const MAX_BYTES = MAX_UPLOAD_BYTES;

// Magic-byte signatures, offset 0. [CITED: 웹서치 cross-check, PNG Wikipedia + file-signature 레퍼런스]
function sniffImageType(buf: Buffer): { ext: string } | null {
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return { ext: "png" };
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: "jpg" };
  }
  if (
    buf.length >= 6 &&
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38 &&
    (buf[4] === 0x37 || buf[4] === 0x39) &&
    buf[5] === 0x61
  ) {
    return { ext: "gif" };
  }
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return { ext: "webp" };
  }
  return null;
}

export async function saveUpload(
  file: File,
): Promise<{ url: string } | { error: "TOO_LARGE" | "BAD_TYPE" }> {
  if (file.size > MAX_BYTES) return { error: "TOO_LARGE" }; // Pitfall 3: size cap before any byte read

  const buf = Buffer.from(await file.arrayBuffer());
  const sniffed = sniffImageType(buf); // Pitfall 1: file.type/file.name are never consulted
  if (!sniffed) return { error: "BAD_TYPE" };

  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${randomUUID()}.${sniffed.ext}`; // CONTEXT: uuid 파일명, 클라 경로 미신뢰
  await writeFile(path.join(UPLOAD_DIR, filename), buf);

  // WR-02 (05-REVIEW, accepted risk — do NOT fix without a TRD/PRD update): this URL is served
  // by Next.js's default static file serving with NO server-side authz check. requireRole gates
  // the POST (write) above, but the GET of `/uploads/<uuid>.ext` is wide open — anyone who has
  // (or guesses) the UUID can fetch the image regardless of workspace membership, even after
  // the owning document is deleted. TRD scopes storage as "dev local disk to start", and the
  // UUID filename is unguessable, so this is treated as an acceptable trade-off for now rather
  // than a bug to patch here.
  // Upgrade path when this needs closing: move serving behind an
  // `/api/uploads/[filename]` route that resolves the file's owning document/workspace and
  // calls `requireRole(workspaceId, "VIEWER")` before streaming it — or, when moving off local
  // disk (S3/object storage), serve via short-lived presigned/signed GET URLs instead of a
  // permanent public path.
  return { url: `/uploads/${filename}` }; // public/uploads/ → Next.js 기본 정적 서빙
}
