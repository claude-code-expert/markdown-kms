"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Form, FormField, FormLabel, FormError, FormSubmit } from "@/components/ui/Form";
import { Input } from "@/components/ui/Input";
import styles from "./page.module.css";

// T-03-01: a single generic message — never branch by cause (no such user vs. wrong password).
const LOGIN_ERROR = "이메일 또는 비밀번호가 올바르지 않습니다.";
const UNVERIFIED_ERROR = "이메일 인증이 아직 끝나지 않았어요. 받은 코드로 인증을 완료해 주세요.";

export function LoginForm({ initialError }: { initialError?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [submitting, setSubmitting] = useState(false);
  // auth.ts가 비밀번호를 맞힌 뒤에만 이 코드를 주므로, 재발송 버튼이 보인다는 것 자체가
  // 이미 자격증명을 아는 사람에게만 노출된다(TRD §9.1 — 열거 oracle 아님).
  const [unverified, setUnverified] = useState(false);
  const [resendNotice, setResendNotice] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setUnverified(false);
    setResendNotice(null);

    // required 네이티브 팝업 대신 빈 값도 같은 일반 오류로 안내 — T-03-01 "원인별로 분기하지
    // 않는다"와 같은 이유로, 빈 칸 제출과 오답을 구분할 필요 없이 네트워크 호출도 아낀다.
    if (!email.trim() || !password) {
      setError(LOGIN_ERROR);
      return;
    }

    setSubmitting(true);

    const result = await signIn("credentials", { email, password, redirect: false });

    if (result?.error) {
      const isUnverified = result.code === "email_unverified";
      setError(isUnverified ? UNVERIFIED_ERROR : LOGIN_ERROR);
      setUnverified(isUnverified);
      setSubmitting(false);
      return;
    }

    router.push("/dashboard");
  }

  async function handleResend() {
    setResendNotice(null);
    // 라우트가 항상 200이라 성공/실패를 나누지 않는다.
    await fetch("/api/auth/verify-email/resend", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => null);
    setResendNotice("인증 코드를 다시 보냈어요. 메일함을 확인해 주세요.");
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

      {unverified && !resendNotice && (
        <button type="button" className={styles.linkButton} onClick={handleResend}>
          인증 코드 다시 받기
        </button>
      )}
      {resendNotice && <p className={styles.notice}>{resendNotice}</p>}

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
