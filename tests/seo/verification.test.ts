// 소유확인 태그는 env가 있을 때만 나가야 한다. 빈 값이 태그로 새면 검색엔진이 소유확인에
// 실패하고, 반대로 env가 있는데 안 나가면 등록 자체가 막힌다.
//
// layout.tsx가 아니라 lib/site.ts의 순수 함수를 검증한다 — layout은 next/font를 끌고 와
// 유닛 환경에서 열리지 않는다. 그래서 이 함수를 lib으로 뽑아뒀다.
import { afterEach, describe, expect, it } from "vitest";
import { buildVerification } from "@/lib/site";

function loadMetadata(env: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return { verification: buildVerification() };
}

const CLEAR = { GOOGLE_SITE_VERIFICATION: undefined, NAVER_SITE_VERIFICATION: undefined };

afterEach(() => {
  delete process.env.GOOGLE_SITE_VERIFICATION;
  delete process.env.NAVER_SITE_VERIFICATION;
});

describe("소유확인 메타태그", () => {
  it("env가 하나도 없으면 verification 자체를 내보내지 않는다", () => {
    const metadata = loadMetadata(CLEAR);
    expect(metadata.verification).toBeUndefined();
  });

  it("Google만 설정되면 google 키만 담는다", () => {
    const metadata = loadMetadata({ ...CLEAR, GOOGLE_SITE_VERIFICATION: "g-code" });
    expect(metadata.verification).toEqual({ google: "g-code" });
  });

  // 네이버는 DNS 확인 방식이 없어 이 태그가 사실상 유일한 수단이다.
  it("Naver만 설정되면 other에 naver-site-verification 을 담는다", () => {
    const metadata = loadMetadata({ ...CLEAR, NAVER_SITE_VERIFICATION: "n-code" });
    expect(metadata.verification).toEqual({
      other: { "naver-site-verification": "n-code" },
    });
  });

  it("둘 다 설정되면 둘 다 담는다", () => {
    const metadata = loadMetadata({
      GOOGLE_SITE_VERIFICATION: "g-code",
      NAVER_SITE_VERIFICATION: "n-code",
    });
    expect(metadata.verification).toEqual({
      google: "g-code",
      other: { "naver-site-verification": "n-code" },
    });
  });
});
