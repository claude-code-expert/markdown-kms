import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans_KR } from "next/font/google";
import { cookies } from "next/headers"; // [CITED: nextjs.org/docs/app/api-reference/functions/cookies]
import Script from "next/script";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

// 리디자인(docs/claude_design): DM Sans/Mono 자체호스팅 → IBM Plex Sans KR/Mono로 교체.
// 변수명 --font-ibm-plex-sans/mono는 이제 실제 폰트와 이름이 일치한다(그동안은 레거시
// 이름이었음). next/font/google — 이 프로젝트에 자체호스팅용 IBM Plex 폰트 파일이
// 없어(PAGE-ANALYSIS.md §1) Google Fonts 최적화 로더를 그대로 쓴다.
const ibmPlexSans = IBM_Plex_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  // metadataBase가 없으면 openGraph/canonical의 상대 경로가 절대 URL로 확장되지 않는다
  // (Next가 빌드 경고를 낸다). SITE_URL은 AUTH_URL에서 나오므로 초대 메일 링크와 같은 origin이다.
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    // 하위 페이지가 title을 주면 "가입하기 · markdown-kms" 형태가 된다.
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  // 랜딩이 유일한 색인 대상이라 canonical을 루트로 고정한다. 하위 공개 페이지가 늘면
  // 각 page.tsx가 alternates.canonical을 덮어쓴다.
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      // 검색결과 스니펫·미리보기 제한을 두지 않는다(기본값이 보수적일 때가 있다).
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  // Search Console을 **URL 접두어 속성 + HTML 태그**로 확인할 때만 필요하다. env가 없으면
  // 태그 자체가 나가지 않는다 — 도메인 속성(DNS TXT)으로 확인했다면 설정할 필요 없다.
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 리디자인 결정(PAGE-ANALYSIS.md §0-1): 라이트/다크 수동 토글은 폐지 — 사이드바 하단
  // 자리는 tone(쿨/웜) 세그먼트가 대체한다. 다크는 @media (prefers-color-scheme)만
  // 따르므로 여기서 theme 쿠키를 읽지 않는다(과거엔 여기서 읽었다). RSC는 tone 쿠키만
  // 읽어 no-FOUC data-tone을 세팅 — 기존 theme 쿠키와 동일한 패턴(RESEARCH Pattern 6),
  // 값이 없거나 손상됐으면 속성 자체를 안 찍어 globals.css의 :root 기본값(쿨)으로 폴백.
  const cookieStore = await cookies();
  const toneCookie = cookieStore.get("tone")?.value;
  const tone = toneCookie === "cool" || toneCookie === "warm" ? toneCookie : undefined;

  // suppressHydrationWarning: 브라우저 확장(Trancy·Grammarly·Dark Reader 등)이 <html>에 속성을
  // 주입해 생기는 hydration 불일치를 억제. 이 요소 한 레벨만 적용, 자식 트리 실제 mismatch는 그대로 잡힘.
  return (
    <html
      lang="ko"
      className={`${ibmPlexSans.variable} ${ibmPlexMono.variable}`}
      data-tone={tone}
      suppressHydrationWarning
    >
      <head>
        {/* dev 전용 디버그 도구 — UI 엘리먼트 선택 시 컴포넌트 소스 위치를 클립보드로 복사
            (⌘C/Ctrl+C). https://github.com/aidenybai/react-grab */}
        {process.env.NODE_ENV === "development" && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
      </head>
      <body>{children}</body>
    </html>
  );
}
