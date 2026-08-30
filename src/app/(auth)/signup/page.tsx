import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { SignupForm } from "./signup-form";
import styles from "./page.module.css";

// 사이트맵에 올린 공개 페이지라 개별 title/description을 준다. 루트 layout의
// template가 "%s · markdown-kms" 로 감싼다. canonical은 자기 경로로 덮어쓴다.
export const metadata: Metadata = {
  title: "가입하기",
  description: "무료로 가입하면 기본 워크스페이스가 바로 생깁니다.",
  alternates: { canonical: "/signup" },
};

// E2 — same centered auth card position/width as login (UI-SPEC Visual Hierarchy), reading
// order title → name → email → password → CTA → login link.
export default function SignupPage() {
  return (
    <main className={styles.page}>
      <Card className={styles.card}>
        <h1 className={styles.title}>가입하기</h1>
        <SignupForm />
        <p className={styles.footer}>
          이미 계정이 있으신가요? <Link href="/login">로그인</Link>
        </p>
      </Card>
    </main>
  );
}
