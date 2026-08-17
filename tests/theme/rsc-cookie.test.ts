// 리디자인(PAGE-ANALYSIS.md §0-1): 라이트/다크 수동 토글이 폐지되면서 이 파일이 검증하던
// theme 쿠키 -> data-theme RSC 배선도 함께 사라졌다(다크는 이제 prefers-color-scheme만).
// 같은 no-FOUC 쿠키 패턴이 tone(쿨/웜) 쿠키로 옮겨갔으므로, 이 테스트도 tone 쿠키 -> data-tone
// 검증으로 그대로 옮긴다(원래 구조 유지, 대상만 교체).
import { describe, expect, it, vi } from "vitest";

const mockCookieValue: { value: string | undefined } = { value: undefined };

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "tone" ? { value: mockCookieValue.value } : undefined),
  }),
}));

// next/font/google도 next/font/local과 마찬가지로 webpack/SWC 빌드타임 로더에 의존해
// vitest 아래에선 동작하지 않는다 — layout.tsx가 부르는 두 팩토리(IBM_Plex_Sans_KR/
// IBM_Plex_Mono)를 variable 프로퍼티만 있는 더미로 스텁한다.
vi.mock("next/font/google", () => ({
  IBM_Plex_Sans_KR: (opts: { variable: string }) => ({ variable: opts.variable }),
  IBM_Plex_Mono: (opts: { variable: string }) => ({ variable: opts.variable }),
}));

describe("RootLayout tone cookie -> data-tone", () => {
  it("renders no data-tone attribute when the tone cookie is absent (globals.css :root 쿨 기본값 폴백)", async () => {
    mockCookieValue.value = undefined;
    const { default: RootLayout } = await import("@/app/layout");
    const element = await RootLayout({ children: null });
    expect(element.props["data-tone"]).toBeUndefined();
  });

  it('renders data-tone="cool" when the tone cookie is "cool"', async () => {
    mockCookieValue.value = "cool";
    const { default: RootLayout } = await import("@/app/layout");
    const element = await RootLayout({ children: null });
    expect(element.props["data-tone"]).toBe("cool");
  });

  it('renders data-tone="warm" when the tone cookie is "warm"', async () => {
    mockCookieValue.value = "warm";
    const { default: RootLayout } = await import("@/app/layout");
    const element = await RootLayout({ children: null });
    expect(element.props["data-tone"]).toBe("warm");
  });

  // WR-04(05-REVIEW)와 동일 원칙: 변조/오타 값은 허용 목록을 안 타면 속성 자체가 안 찍혀
  // globals.css :root 기본값(쿨)으로 조용히 폴백한다(강제 라이트가 아니라 "부재와 동일 취급").
  it('renders no data-tone attribute when the tone cookie is an invalid value (e.g. "Warm")', async () => {
    mockCookieValue.value = "Warm";
    const { default: RootLayout } = await import("@/app/layout");
    const element = await RootLayout({ children: null });
    expect(element.props["data-tone"]).toBeUndefined();
  });
});
