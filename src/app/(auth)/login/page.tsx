import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { LoginForm } from "./login-form";
import styles from "./page.module.css";

// E1 — UI-SPEC Visual Hierarchy: centered auth card, reading order title → email → password →
// CTA → signup link.
export default function LoginPage() {
  return (
    <main className={styles.page}>
      <Card className={styles.card}>
        <h1 className={styles.title}>로그인</h1>
        <LoginForm />
        <p className={styles.footer}>
          계정이 없으신가요? <Link href="/signup">가입하기</Link>
        </p>
      </Card>
    </main>
  );
}
