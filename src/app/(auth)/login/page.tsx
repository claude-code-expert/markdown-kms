import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { LoginForm } from "./login-form";
import styles from "./page.module.css";

// auth.ts의 pages.error가 실패한 OAuth 로그인을 여기로 돌려보내며 ?error=<코드>를 붙인다.
// 코드는 그대로 노출하지 않는다 — 사용자에게 쓸모가 없고, T-03-01의 "원인별로 분기하지 않는다"
// 와도 결이 같다. AccessDenied만 따로 안내하는 이유는 사용자가 할 수 있는 일이 다르기 때문이다
// (동의 화면에서 취소했거나, 이메일 미검증 계정이라 signIn 콜백이 끊은 경우).
const OAUTH_ERRORS: Record<string, string> = {
  AccessDenied: "Google 로그인이 취소되었거나 허용되지 않은 계정입니다.",
};
const OAUTH_FALLBACK_ERROR = "Google 로그인에 실패했어요. 잠시 후 다시 시도해 주세요.";

// 사이트맵에 올린 공개 페이지라 개별 title/description을 준다. 루트 layout의
// template가 "%s · markdown-kms" 로 감싼다. canonical은 자기 경로로 덮어쓴다.
export const metadata: Metadata = {
  title: "로그인",
  description: "이미 만든 워크스페이스로 돌아가세요.",
  alternates: { canonical: "/login" },
};

// E1 — UI-SPEC Visual Hierarchy: centered auth card, reading order title → email → password →
// CTA → signup link.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // 클라이언트 useSearchParams 대신 서버에서 읽는다 — 그쪽은 Suspense 경계를 요구해 이 정적
  // 페이지의 렌더 방식을 바꾼다(WorkspaceShell의 no-FOUC 선례와 같은 이유로 서버가 값을 계산).
  const { error } = await searchParams;

  return (
    <main className={styles.page}>
      <Card className={styles.card}>
        <h1 className={styles.title}>로그인</h1>
        <LoginForm initialError={error ? (OAUTH_ERRORS[error] ?? OAUTH_FALLBACK_ERROR) : undefined} />
        <p className={styles.footer}>
          계정이 없으신가요? <Link href="/signup">가입하기</Link>
        </p>
      </Card>
    </main>
  );
}
