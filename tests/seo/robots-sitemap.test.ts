// robots/sitemap은 "무엇을 검색엔진에 노출하지 않는가"가 본질이라, 실수로 비공개 경로가
// 열리는 회귀를 잡는 것이 이 파일의 목적이다.
import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { SITE_URL } from "@/lib/site";

describe("robots.txt", () => {
  const rules = robots();

  it("사이트맵 주소를 SITE_URL 기준으로 낸다", () => {
    expect(rules.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });

  // 이 목록이 줄어들면 로그인 뒤 영역이나 토큰 URL이 크롤러에 열린다.
  it.each(["/api/", "/dashboard", "/w/", "/invitations/"])("%s 를 막는다", (path) => {
    const rule = Array.isArray(rules.rules) ? rules.rules[0] : rules.rules!;
    expect(rule.disallow).toContain(path);
  });

  it("공개 랜딩은 허용한다", () => {
    const rule = Array.isArray(rules.rules) ? rules.rules[0] : rules.rules!;
    expect(rule.allow).toBe("/");
  });
});

describe("sitemap.xml", () => {
  const entries = sitemap();
  const urls = entries.map((e) => e.url);

  it("공개 페이지 3개만 싣는다", () => {
    expect(urls).toEqual([SITE_URL, `${SITE_URL}/signup`, `${SITE_URL}/login`]);
  });

  // 문서·워크스페이스는 워크스페이스 멤버에게만 보인다. 사이트맵에 올리면 존재 자체가
  // 노출되고, 크롤러는 어차피 로그인 리다이렉트만 받는다.
  it("로그인 뒤 경로를 절대 싣지 않는다", () => {
    for (const url of urls) {
      expect(url).not.toContain("/w/");
      expect(url).not.toContain("/dashboard");
      expect(url).not.toContain("/invitations");
      expect(url).not.toContain("/api/");
    }
  });

  it("모든 항목이 SITE_URL 로 시작하는 절대 URL이다", () => {
    for (const url of urls) expect(url.startsWith(SITE_URL)).toBe(true);
  });

  it("가입을 로그인보다 높은 우선순위로 둔다", () => {
    const signup = entries.find((e) => e.url.endsWith("/signup"))!;
    const login = entries.find((e) => e.url.endsWith("/login"))!;
    expect(signup.priority!).toBeGreaterThan(login.priority!);
  });
});
