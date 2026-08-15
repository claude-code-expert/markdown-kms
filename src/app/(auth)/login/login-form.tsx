"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Form, FormField, FormLabel, FormError, FormSubmit } from "@/components/ui/Form";
import { Input } from "@/components/ui/Input";
import styles from "./page.module.css";

// T-03-01: a single generic message — never branch by cause (no such user vs. wrong password).
const LOGIN_ERROR = "이메일 또는 비밀번호가 올바르지 않습니다.";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const result = await signIn("credentials", { email, password, redirect: false });

    if (result?.error) {
      setError(LOGIN_ERROR);
      setSubmitting(false);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <Form onSubmit={handleSubmit}>
      <FormField>
        <FormLabel htmlFor="email">이메일</FormLabel>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </FormField>

      <FormField>
        <FormLabel htmlFor="password">비밀번호</FormLabel>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </FormField>

      {error && <FormError>{error}</FormError>}

      <FormSubmit disabled={submitting}>{submitting ? "로그인하는 중…" : "로그인"}</FormSubmit>

      {/* UI-SPEC Copywriting Contract "Google 로그인 placeholder" — 비활성
          전용, onClick/signIn 프로바이더 호출 없음(Phase 8 descope 유지). */}
      <button type="button" disabled className={styles.googleButton}>
        Google로 계속하기
      </button>
    </Form>
  );
}
