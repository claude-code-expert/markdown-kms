import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { cookies } from "next/headers"; // [CITED: nextjs.org/docs/app/api-reference/functions/cookies]
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
  const theme = cookieStore.get("theme")?.value;

  // suppressHydrationWarning: 브라우저 확장(Trancy·Grammarly·Dark Reader 등)이 <html>에 속성을
  // 주입해 생기는 hydration 불일치를 억제. 이 요소 한 레벨만 적용, 자식 트리 실제 mismatch는 그대로 잡힘.
  return (
    <html
      lang="ko"
      className={`${ibmPlexSans.variable} ${ibmPlexMono.variable}`}
      data-theme={theme}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
}
