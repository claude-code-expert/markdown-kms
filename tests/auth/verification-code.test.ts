import { describe, expect, it } from "vitest";
import { CODE_LENGTH, generateCode, hashCode, verifyCodeHash } from "@/lib/verification-code";

const SECRET = "test-secret";

describe("generateCode", () => {
  it("always produces exactly 6 digits", () => {
    for (let i = 0; i < 500; i++) {
      expect(generateCode()).toMatch(/^\d{6}$/);
    }
  });

  // 0으로 시작하는 코드(예: 000042)를 문자열이 아니라 숫자로 다루면 자릿수가 무너진다.
  // 500회 중 앞자리가 0인 케이스가 한 번도 안 나올 확률은 (0.9)^500 ≈ 0 이라 이 단언은 안정적이다.
  it("zero-pads values below 100000 instead of shortening them", () => {
    const codes = Array.from({ length: 500 }, () => generateCode());
    expect(codes.some((c) => c.startsWith("0"))).toBe(true);
    expect(codes.every((c) => c.length === CODE_LENGTH)).toBe(true);
  });

  it("does not return a constant", () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe("hashCode / verifyCodeHash", () => {
  it("round-trips the code that produced the hash", () => {
    const code = "123456";
    expect(verifyCodeHash(code, SECRET, hashCode(code, SECRET))).toBe(true);
  });

  it("rejects a different code", () => {
    expect(verifyCodeHash("654321", SECRET, hashCode("123456", SECRET))).toBe(false);
  });

  // 해시가 secret에 묶여 있지 않으면 DB 유출만으로 6자리 전수 역산이 끝난다.
  it("rejects a hash computed with a different secret", () => {
    expect(verifyCodeHash("123456", SECRET, hashCode("123456", "other-secret"))).toBe(false);
  });

  it("never stores the code in the hash", () => {
    expect(hashCode("123456", SECRET)).not.toContain("123456");
  });

  // timingSafeEqual은 길이가 다르면 던진다 — 길이 선검사가 빠지면 여기서 예외가 샌다.
  it("returns false instead of throwing on a malformed hash", () => {
    expect(verifyCodeHash("123456", SECRET, "")).toBe(false);
    expect(verifyCodeHash("123456", SECRET, "short")).toBe(false);
  });
});
