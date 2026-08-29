// 서버 측 매직바이트 게이트(EDIT-09 / Pitfall 1). 원래 saveUpload(로컬 디스크 저장)를 통해
// 검증했지만 그 함수는 R2 전환으로 사라졌고, 규칙 자체는 저장 위치와 무관하므로 sniffImageType을
// 직접 검증한다. 가장 중요한 건 위조 케이스다 — 이름이 ".png"이고 Content-Type이 "image/png"라도
// 바이트가 아니면 거부돼야 한다. 스니퍼는 file.name/file.type을 아예 보지 않는다.
import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, sniffImageType } from "@/lib/storage";

// 각 픽스처는 스니퍼의 최소 길이 검사(png>=8, jpeg>=3, gif>=6, webp>=12)를 통과하도록
// 시그니처 뒤에 채움 바이트를 붙였다. 실제 이미지 데이터를 단언하지는 않는다.
const PNG_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00];
const JPEG_BYTES = [0xff, 0xd8, 0xff, 0x00, 0x00];
const GIF87_BYTES = [0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0x00, 0x00];
const GIF89_BYTES = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00];
const WEBP_BYTES = [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];

const buf = (bytes: number[]) => Buffer.from(bytes);

describe("sniffImageType — magic-byte sniffing (EDIT-09)", () => {
  it("accepts a png signature", () => {
    expect(sniffImageType(buf(PNG_BYTES))).toEqual({ ext: "png" });
  });

  it("accepts a jpeg signature", () => {
    expect(sniffImageType(buf(JPEG_BYTES))).toEqual({ ext: "jpg" });
  });

  it("accepts a gif87a signature", () => {
    expect(sniffImageType(buf(GIF87_BYTES))).toEqual({ ext: "gif" });
  });

  it("accepts a gif89a signature", () => {
    expect(sniffImageType(buf(GIF89_BYTES))).toEqual({ ext: "gif" });
  });

  it("accepts a webp (RIFF....WEBP) signature", () => {
    expect(sniffImageType(buf(WEBP_BYTES))).toEqual({ ext: "webp" });
  });

  // 이 케이스가 뚫리면 확장자만 바꾼 실행 파일·HTML을 저장소에 심을 수 있다.
  it("rejects text bytes regardless of what the filename or Content-Type claimed", () => {
    expect(sniffImageType(Buffer.from("not an image, just text bytes"))).toBeNull();
  });

  // 시그니처 앞부분만 맞고 길이가 모자란 경우 — 길이 검사가 빠지면 여기서 오탐이 난다.
  it("rejects a truncated signature", () => {
    expect(sniffImageType(buf(PNG_BYTES.slice(0, 4)))).toBeNull();
    expect(sniffImageType(buf(WEBP_BYTES.slice(0, 8)))).toBeNull();
    expect(sniffImageType(Buffer.alloc(0))).toBeNull();
  });

  // RIFF 컨테이너지만 WEBP가 아닌 것(예: WAV)은 통과하면 안 된다.
  it("rejects a RIFF container that is not WEBP", () => {
    const wav = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45];
    expect(sniffImageType(buf(wav))).toBeNull();
  });
});

describe("MAX_UPLOAD_BYTES", () => {
  // 라우트의 Content-Length 선검사와 저장 함수의 file.size 검사가 같은 값을 봐야 한다.
  it("is the 5MB cap both the route and the storage layer read", () => {
    expect(MAX_UPLOAD_BYTES).toBe(5 * 1024 * 1024);
  });
});
