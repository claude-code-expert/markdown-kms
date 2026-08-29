// 업로드 이미지의 **검증 규칙**만 담는 모듈. 저장은 storage-r2.ts가 한다(TRD §8).
//
// 원래는 여기에 로컬 디스크 저장(saveUpload)이 함께 있었지만, 서버리스 파일시스템이 읽기
// 전용이라 프로덕션에서 동작하지 않았고 정적 서빙 경로에 권한 검증도 없었다(WR-02). R2로
// 옮기면서 그 함수를 지웠고, 저장 위치와 무관한 규칙인 아래 둘만 남겨 R2 쪽이 가져다 쓴다.
//
// EDIT-09 / Pitfall 1: the client's File.type/File.name are never trusted for the stored
// extension — the server sniffs the actual bytes (magic numbers) and decides for itself.
// EDIT-09 / Pitfall 3: size is checked BEFORE arrayBuffer() reads the file into memory, so an
// oversized upload never has its bytes read.

// Exported so the route handler can reject an oversized Content-Length before req.formData()
// ever buffers the body (CR-02, 05-REVIEW) — single source of truth for the 5MB cap.
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // CONTEXT: 최대 5MB

// Magic-byte signatures, offset 0. [CITED: 웹서치 cross-check, PNG Wikipedia + file-signature 레퍼런스]
// storage-r2.ts가 그대로 가져다 쓴다 — 어떤 바이트를 이미지로 인정하는지는 저장 위치와
//무관한 규칙이라 두 벌로 갈라두면 한쪽만 고쳐지는 사고가 난다.
export function sniffImageType(buf: Buffer): { ext: string } | null {
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
