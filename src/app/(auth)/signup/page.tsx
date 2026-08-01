import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { SignupForm } from "./signup-form";
import styles from "./page.module.css";

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
