// /sitemap.xml — app/sitemap.ts 파일 규약.
//
// 이 앱에서 색인 대상은 **공개 페이지 3개뿐**이다. 문서·워크스페이스는 전부 로그인 뒤에
// 있고 워크스페이스 멤버에게만 보이므로 사이트맵에 올릴 수 없다(올리면 존재 자체가
// 노출되고, 크롤러는 어차피 로그인 리다이렉트만 받는다).
//
// 그래서 DB를 조회하지 않는 정적 목록이다. 나중에 공개 문서 공유 기능이 생기면 그때
// 해당 문서만 여기에 더한다.
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  // 배포 시각을 그대로 쓴다. 랜딩 카피가 바뀌면 배포도 새로 되므로 실제 변경과 맞물린다.
  const lastModified = new Date();

  return [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      // 가입 유입이 목적이라 로그인보다 우선순위를 높게 둔다.
      url: `${SITE_URL}/signup`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/login`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
