// src/lib/invitation-token.ts — CLAUDE.md "1기능 1파일" 정신을 크립토 헬퍼에도 적용(순수 함수,
// DOM/DB 없음 — components/editor/plugins의 run(state) 순수 함수 관례와 동일 이유: 유닛 테스트가
// DB 없이 "문자열 넣고 결과 단언"으로 가능해진다). secret은 인자로만 받는다 — process.env 참조 금지.
import { createHmac, timingSafeEqual } from "node:crypto";

const DELIMITER = "."; // base64url 알파벳(A-Z a-z 0-9 - _)엔 "."이 없어 안전한 구분자

// TRD §9 리터럴 공식: HMAC-SHA256(secret, invitation_id + expires_at) — id와 expires_at 사이에
// 구분자가 없다(RESEARCH Pitfall 2 — 위조 가능성 없음, DB에 이미 존재하는 행의 실제 expires_at과만
// 대조된다). expires_at은 epoch-ms 정수로 직렬화한다(RESEARCH Pitfall 3 — ISO 문자열 대신 쓰는 이유,
// 발급 시 Date와 검증 시 Date가 서로 다른 직렬화 경로를 거쳐도 .getTime()은 항상 동일한 정수).
function computeMac(invitationId: string, expiresAtMs: number, secret: string): string {
  return createHmac("sha256", secret).update(`${invitationId}${expiresAtMs}`).digest("base64url");
}

export function encodeInvitationToken(invitationId: string, expiresAt: Date, secret: string): string {
  const mac = computeMac(invitationId, expiresAt.getTime(), secret);
  // TRD §9: token = base64url(invitation_id + "." + HMAC(...)) — "." + mac까지 합친 전체를 다시
  // base64url로 감싼다(이중 인코딩이 아니라, 공식이 원래 그렇게 정의되어 있다).
  return Buffer.from(`${invitationId}${DELIMITER}${mac}`, "utf8").toString("base64url");
}

export type ParsedToken = { invitationId: string; mac: string };

// 실패는 예외가 아니라 null — 호출부(acceptInvitation)가 invalid-signature로 매핑한다.
export function parseInvitationToken(token: string): ParsedToken | null {
  let payload: string;
  try {
    payload = Buffer.from(token, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const sepIndex = payload.indexOf(DELIMITER);
  if (sepIndex < 0) return null;
  const invitationId = payload.slice(0, sepIndex);
  const mac = payload.slice(sepIndex + 1);
  if (!invitationId || !mac) return null;
  return { invitationId, mac };
}

// 상수시간 비교 — timingSafeEqual은 길이가 다르면 던진다(Node 문서) 그래서 길이를 먼저 확인한다.
export function verifyMac(invitationId: string, expiresAt: Date, secret: string, mac: string): boolean {
  const expected = computeMac(invitationId, expiresAt.getTime(), secret);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
