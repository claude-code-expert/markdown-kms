// WS-05 (NFR-3.3): 초대 토큰 순수 HMAC 헬퍼. DB 없는 유닛 테스트 — RED 먼저 커밋(TRD §10 TDD).
// 대상: src/lib/invitation-token.ts (07-RESEARCH.md Pattern 1 리터럴 구현).
import { describe, expect, it } from "vitest";
import {
  encodeInvitationToken,
  parseInvitationToken,
  verifyMac,
} from "@/lib/invitation-token";

const SECRET = "test-secret-value";
const OTHER_SECRET = "different-secret-value";
const ID = "9c1f6b2a-1111-4a22-8b33-abcdef123456";
const EXPIRES_AT = new Date("2026-08-16T00:00:00.000Z"); // 발급 시점 +7일 예시

describe("invitation-token", () => {
  it("encode → parse round-trip yields the original invitationId and a mac", () => {
    const token = encodeInvitationToken(ID, EXPIRES_AT, SECRET);
    const parsed = parseInvitationToken(token);
    expect(parsed).not.toBeNull();
    expect(parsed?.invitationId).toBe(ID);
    expect(typeof parsed?.mac).toBe("string");
    expect(parsed?.mac.length).toBeGreaterThan(0);
  });

  it("verifyMac accepts a correctly signed token", () => {
    const token = encodeInvitationToken(ID, EXPIRES_AT, SECRET);
    const parsed = parseInvitationToken(token)!;
    expect(verifyMac(ID, EXPIRES_AT, SECRET, parsed.mac)).toBe(true);
  });

  it("rejects a tampered mac without throwing (constant-time compare)", () => {
    const token = encodeInvitationToken(ID, EXPIRES_AT, SECRET);
    const parsed = parseInvitationToken(token)!;
    const tamperedMac = parsed.mac.slice(0, -1) + (parsed.mac.at(-1) === "A" ? "B" : "A");
    expect(() => verifyMac(ID, EXPIRES_AT, SECRET, tamperedMac)).not.toThrow();
    expect(verifyMac(ID, EXPIRES_AT, SECRET, tamperedMac)).toBe(false);
  });

  it("rejects a mac signed with a different secret", () => {
    const token = encodeInvitationToken(ID, EXPIRES_AT, SECRET);
    const parsed = parseInvitationToken(token)!;
    expect(verifyMac(ID, EXPIRES_AT, OTHER_SECRET, parsed.mac)).toBe(false);
  });

  it("rejects verification against a different expiresAt (epoch-ms is signed input)", () => {
    const token = encodeInvitationToken(ID, EXPIRES_AT, SECRET);
    const parsed = parseInvitationToken(token)!;
    const shiftedExpiresAt = new Date(EXPIRES_AT.getTime() + 1);
    expect(verifyMac(ID, shiftedExpiresAt, SECRET, parsed.mac)).toBe(false);
  });

  it("is consistent across two Date instances representing the same epoch-ms (DB round-trip simulation)", () => {
    const issuedAt = new Date(EXPIRES_AT.getTime());
    const token = encodeInvitationToken(ID, issuedAt, SECRET);
    const parsed = parseInvitationToken(token)!;
    // Simulates a fresh Date built from a DB-returned epoch-ms value.
    const roundTrippedExpiresAt = new Date(issuedAt.getTime());
    expect(verifyMac(ID, roundTrippedExpiresAt, SECRET, parsed.mac)).toBe(true);
  });

  it("parseInvitationToken returns null for garbage, missing delimiter, or empty parts", () => {
    expect(parseInvitationToken("not-valid-base64url-!!!")).toBeNull();
    // Valid base64url but with no "." delimiter in the decoded payload.
    const noDelimiter = Buffer.from("nodothere", "utf8").toString("base64url");
    expect(parseInvitationToken(noDelimiter)).toBeNull();
    // Empty invitationId (delimiter at position 0).
    const emptyId = Buffer.from(".mac", "utf8").toString("base64url");
    expect(parseInvitationToken(emptyId)).toBeNull();
    // Empty mac (delimiter at the end).
    const emptyMac = Buffer.from("id.", "utf8").toString("base64url");
    expect(parseInvitationToken(emptyMac)).toBeNull();
  });
});
