// src/lib/site.ts — 사이트 정체성(주소·이름·설명)의 단일 원천. metadata·robots·sitemap이
// 같은 값을 봐야 canonical/OG/sitemap URL이 서로 어긋나지 않는다.
//
// AUTH_URL을 재사용하는 이유: 초대 메일 링크(invitations/route.ts)와 메일 푸터(mailer.ts)가
// 이미 그 값을 origin으로 쓰고 있다. 사이트 주소를 두 군데 두면 도메인을 바꿀 때 한쪽만
// 고쳐져 canonical과 메일 링크가 다른 도메인을 가리키게 된다.
export const SITE_URL = (
  process.env.AUTH_URL ??
  process.env.NEXTAUTH_URL ??
  "https://mingleup.net"
).replace(/\/$/, "");

export const SITE_NAME = "markdown-kms";

export const SITE_DESCRIPTION =
  "폴더 트리로 조직하고, 에디터·미리보기 듀얼 뷰로 쓰고, 역할 기반 권한으로 협업하는 마크다운 문서 워크스페이스.";

/**
 * 검색엔진이 절대 크롤링하면 안 되는 경로.
 *
 * 로그인 게이트가 있으니 크롤러가 내용을 못 보긴 하지만, 명시적으로 막아야 하는 이유가 있다.
 * - `/invitations/accept?token=...` 은 **URL에 일회성 토큰이 들어간다.** 어딘가에 링크가
 *   새면 크롤러가 그 URL을 그대로 방문해 초대를 소진시킬 수 있다.
 * - `/w/`·`/dashboard` 는 전부 로그인 리다이렉트라 색인 가치가 0인데 크롤 예산만 먹는다.
 * - `/api/` 는 애초에 사람이 볼 페이지가 아니다.
 */
export const DISALLOWED_PATHS = ["/api/", "/dashboard", "/w/", "/invitations/"];

/** Next의 Metadata["verification"]과 같은 모양. layout.tsx를 import하지 않고 테스트하려고
 *  타입을 여기서 좁게 다시 쓴다(layout은 next/font를 끌고 와 유닛 테스트에서 못 연다). */
export interface SiteVerification {
  google?: string;
  other?: Record<string, string>;
}

/**
 * 설정된 소유확인 태그만 담아 반환한다. 하나도 없으면 undefined — 빈 객체를 넘기면 Next가
 * 값 없는 메타태그를 찍을 수 있어 명시적으로 걸러낸다.
 *
 * - Google: 도메인 속성(DNS TXT)으로 확인했다면 불필요. URL 접두어 속성 + HTML 태그를 쓸
 *   때만 설정한다(docs/search-console.md).
 * - Naver: 서치어드바이저에는 DNS 확인 방식이 없어 **HTML 태그가 사실상 유일한 수단**이다
 *   (docs/naver-search-advisor.md). Next의 verification에 naver 전용 키가 없어 `other`로
 *   임의 메타명을 넣는다 — 결과는 동일한 <meta name="naver-site-verification">.
 */
export function buildVerification(): SiteVerification | undefined {
  const google = process.env.GOOGLE_SITE_VERIFICATION;
  const naver = process.env.NAVER_SITE_VERIFICATION;
  if (!google && !naver) return undefined;

  return {
    ...(google ? { google } : {}),
    ...(naver ? { other: { "naver-site-verification": naver } } : {}),
  };
}
