// src/lib/verification-code.ts — invitation-token.ts와 같은 자리의 순수 크립토 헬퍼(DB·DOM 없음,
// secret은 인자로만 받고 process.env 참조 금지). 유닛 테스트가 "문자열 넣고 결과 단언"으로 끝난다.
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export const CODE_LENGTH = 6;

/**
 * 6자리 숫자 코드. Math.random()은 예측 가능해 쓰지 않는다 — randomInt는 CSPRNG이고 모듈로
 * 편향 없이 균등하게 뽑아준다(상한 배타적).
 */
export function generateCode(): string {
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
}

/**
 * TRD §9.1: code_hash = HMAC-SHA256(AUTH_SECRET, code).
 *
 * 평문 SHA-256이 아니라 키 있는 HMAC인 이유 — 6자리는 10^6 공간이라 DB가 유출되면 평문 해시는
 * 몇 초 만에 전수 역산된다. 비밀키가 섞여야 해시만으로는 코드를 되찾을 수 없다.
 */
export function hashCode(code: string, secret: string): string {
  return createHmac("sha256", secret).update(code).digest("base64url");
}

// 상수시간 비교 — timingSafeEqual은 길이가 다르면 던진다(Node 문서). 그래서 길이를 먼저 본다.
// invitation-token.ts:42-48과 같은 관용구.
export function verifyCodeHash(code: string, secret: string, expectedHash: string): boolean {
  const a = Buffer.from(hashCode(code, secret));
  const b = Buffer.from(expectedHash);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
