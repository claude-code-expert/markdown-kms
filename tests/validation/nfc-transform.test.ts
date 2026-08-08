import { describe, expect, it } from "vitest";
import { documentSchema, normalizeNFC, tagsBodySchema } from "@/lib/validation";

// "각"의 NFD(자모 분리형, 3 코드포인트) vs NFC(완성형, 1 코드포인트). 06-RESEARCH Pattern 2 —
// pg_trgm GIN 인덱스가 plain 컬럼 위에 있어(함수형 아님) 쓰기 시점 정규화가 검색 정확성(DOC-04)을
// 얻는 유일한 경로다.
const NFD_GAK = "각"; // ᄀ + ᅡ + ᆨ
const NFC_GAK = "각";

describe("normalizeNFC", () => {
  it("NFD 자모분리형을 NFC 완성형으로 변환한다", () => {
    expect(NFD_GAK).not.toBe(NFC_GAK); // 사전 조건: 실제로 다른 코드포인트 시퀀스
    expect(normalizeNFC(NFD_GAK)).toBe(NFC_GAK);
  });
});

describe("documentSchema NFC transform", () => {
  it("NFD로 들어온 title/content를 NFC로 변환해 반환한다", () => {
    const parsed = documentSchema.parse({ title: NFD_GAK, content: NFD_GAK });
    expect(parsed.title).toBe(NFC_GAK);
    expect(parsed.content).toBe(NFC_GAK);
  });

  it("content의 앞뒤 개행/공백을 보존한다 (trim 하지 않음, NFR-5.2)", () => {
    const parsed = documentSchema.parse({ title: "제목", content: "\n  본문  \n" });
    expect(parsed.content).toBe("\n  본문  \n");
  });

  it("title은 여전히 trim하고 255자 초과 시 검증 에러를 낸다", () => {
    const parsed = documentSchema.parse({ title: "  제목  ", content: "" });
    expect(parsed.title).toBe("제목");

    expect(() => documentSchema.parse({ title: "가".repeat(256), content: "" })).toThrow();
  });
});

describe("tagsBodySchema", () => {
  it("tags 배열을 trim/min(1) 검증하며 3개까지 허용한다", () => {
    const parsed = tagsBodySchema.parse({ tags: [" a ", "b", "c"] });
    expect(parsed.tags).toEqual(["a", "b", "c"]);
  });

  it("4개 이상이면 검증 에러를 낸다", () => {
    expect(() => tagsBodySchema.parse({ tags: ["a", "b", "c", "d"] })).toThrow();
  });

  it("빈 문자열 태그는 min(1)에 걸려 거부된다", () => {
    expect(() => tagsBodySchema.parse({ tags: ["  "] })).toThrow();
  });
});
