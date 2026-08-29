"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Form, FormField, FormLabel, FormError, FormSubmit } from "@/components/ui/Form";
import { Input } from "@/components/ui/Input";
import styles from "./page.module.css";

// T-03-01: a single generic message — never branch by cause (no such user vs. wrong password).
const LOGIN_ERROR = "이메일 또는 비밀번호가 올바르지 않습니다.";

export function LoginForm({ initialError }: { initialError?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    // required 네이티브 팝업 대신 빈 값도 같은 일반 오류로 안내 — T-03-01 "원인별로 분기하지
    // 않는다"와 같은 이유로, 빈 칸 제출과 오답을 구분할 필요 없이 네트워크 호출도 아낀다.
    if (!email.trim() || !password) {
      setError(LOGIN_ERROR);
      return;
    }

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
          placeholder="kim@weve.co.kr"
        />
      </FormField>

      <FormField>
        <FormLabel htmlFor="password">비밀번호</FormLabel>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
        />
        <FormError>{error}</FormError>
      </FormField>

      <FormSubmit disabled={submitting}>{submitting ? "로그인하는 중…" : "로그인"}</FormSubmit>

      {/* FR-A2. redirect: false 를 쓰는 위 credentials 경로와 달리 여기선 브라우저가 Google로
          떠나야 하므로 리다이렉트를 막지 않는다. redirectTo 가 v5 옵션이다(callbackUrl 은 deprecated). */}
      <button
        type="button"
        className={styles.googleButton}
        onClick={() => signIn("google", { redirectTo: "/dashboard" })}
      >
        Google로 계속하기
      </button>
    </Form>
  );
}
