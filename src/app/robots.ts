// /robots.txt — Next.js App Router의 파일 규약(app/robots.ts)이 자동으로 라우트를 만든다.
// public/robots.txt를 손으로 두지 않는 이유: 도메인이 코드(SITE_URL)와 한 곳에서 나와야
// sitemap 주소가 어긋나지 않는다.
import type { MetadataRoute } from "next";
import { DISALLOWED_PATHS, SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // 로그인 게이트가 있어도 명시적으로 막는다 — 특히 초대 링크는 URL에 일회성 토큰이
      // 들어가므로 크롤러가 방문하는 것만으로 소진될 수 있다(lib/site.ts 주석 참조).
      disallow: DISALLOWED_PATHS,
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
