import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { cookies } from "next/headers"; // [CITED: nextjs.org/docs/app/api-reference/functions/cookies]
import Script from "next/script";
import "./globals.css";

// UI-SPEC Design System: IBM Plex Sans (본문), IBM Plex Mono (코드·숫자 라벨) — docs/ui-kit.html.
const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
  weight: ["400", "600"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: "markdown-kms",
  description: "워크스페이스 기반 마크다운 문서 관리",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // RSC reads the theme cookie so the first HTML render already carries the
  // right data-theme (no-FOUC) — client toggle writes this same cookie
  // directly (RESEARCH Pattern 6). No cookie yet (first visit) means no
  // data-theme attribute at all; globals.css's @media (prefers-color-scheme)
  // fallback takes over in that case (05-RESEARCH Pitfall 9: this opts every
  // route into dynamic rendering, an accepted trade-off — requireRole's DB
  // reads already make authenticated routes dynamic).
  const cookieStore = await cookies();
  // WR-04 (05-REVIEW): allow-list the cookie the same way layoutMode/splitRatio are validated
  // (d/[docId]/page.tsx) — an invalid/tampered value falls back to undefined (same as absent),
  // not a forced "light", so the @media prefers-color-scheme fallback still applies.
  const themeCookie = cookieStore.get("theme")?.value;
  const theme = themeCookie === "dark" || themeCookie === "light" ? themeCookie : undefined;

  // suppressHydrationWarning: 브라우저 확장(Trancy·Grammarly·Dark Reader 등)이 <html>에 속성을
  // 주입해 생기는 hydration 불일치를 억제. 이 요소 한 레벨만 적용, 자식 트리 실제 mismatch는 그대로 잡힘.
  return (
    <html
      lang="ko"
      className={`${ibmPlexSans.variable} ${ibmPlexMono.variable}`}
      data-theme={theme}
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
