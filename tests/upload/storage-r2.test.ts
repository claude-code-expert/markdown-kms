import { describe, expect, it } from "vitest";
import { buildKey, isR2Configured, R2_PUBLIC_PREFIX, workspaceIdFromKey } from "@/lib/storage-r2";

const WS = "11111111-2222-3333-4444-555555555555";

describe("buildKey", () => {
  it("puts the workspace id in the key so the read route can authorize from the key alone", () => {
    const key = buildKey(WS, "png");
    expect(key).toMatch(new RegExp(`^w/${WS}/[0-9a-f-]{36}\\.png$`));
  });

  it("never reuses a name", () => {
    const keys = new Set(Array.from({ length: 50 }, () => buildKey(WS, "png")));
    expect(keys.size).toBe(50);
  });
});

describe("workspaceIdFromKey", () => {
  it("round-trips the workspace id that buildKey embedded", () => {
    expect(workspaceIdFromKey(buildKey(WS, "webp"))).toBe(WS);
  });

  // 이 함수가 무르면 읽기 라우트의 권한 검증이 통째로 무너진다 — 공격자가 키를 지어내
  // 남의 워크스페이스 자원을 자기 것처럼 통과시킬 수 있다.
  it("rejects keys that do not match the exact w/<id>/<file> shape", () => {
    expect(workspaceIdFromKey("")).toBeNull();
    expect(workspaceIdFromKey("file.png")).toBeNull();
    expect(workspaceIdFromKey(`w/${WS}`)).toBeNull();
    expect(workspaceIdFromKey(`x/${WS}/a.png`)).toBeNull();
    // 디렉터리를 더 파고들어 검증을 우회하려는 시도
    expect(workspaceIdFromKey(`w/${WS}/nested/a.png`)).toBeNull();
    // 상위 경로 탈출
    expect(workspaceIdFromKey("w/../../etc/passwd")).toBeNull();
    expect(workspaceIdFromKey(`w//${WS}/a.png`)).toBeNull();
  });
});

describe("isR2Configured", () => {
  // env가 하나라도 빠지면 false여야 한다. true로 새면 라우트가 503 대신 500을 낸다.
  it("requires all four variables", () => {
    const keys = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"];
    const original = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
    try {
      keys.forEach((k) => (process.env[k] = "x"));
      expect(isR2Configured()).toBe(true);

      for (const missing of keys) {
        delete process.env[missing];
        expect(isR2Configured()).toBe(false);
        process.env[missing] = "x";
      }
    } finally {
      for (const [k, v] of Object.entries(original)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });
});

describe("R2_PUBLIC_PREFIX", () => {
  // 마크다운 본문에 그대로 저장되는 경로다. 바꾸면 이미 저장된 문서의 이미지가 전부 깨진다.
  it("is the route that serves the objects", () => {
    expect(R2_PUBLIC_PREFIX).toBe("/api/uploads/r2");
  });
});
