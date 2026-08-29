"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Form, FormField, FormLabel, FormError, FormSubmit } from "@/components/ui/Form";
import { Input } from "@/components/ui/Input";
import styles from "./page.module.css";

const GENERIC_ERROR = "일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.";

interface Props {
  email: string;
  /** 인증 성공 직후 세션을 만들기 위해 가입 단계의 비밀번호를 그대로 넘겨받는다. */
  password: string;
  onBack: () => void;
}

export function VerifyStep({ email, password, onBack }: Props) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    // 서버가 어차피 재검증하지만, 자릿수 미달을 왕복 없이 잡아준다(signup-form의 Pitfall 5 관례).
    if (!/^\d{6}$/.test(code.trim())) {
      setError("인증 코드는 6자리 숫자입니다.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, code: code.trim() }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? GENERIC_ERROR);
        setSubmitting(false);
        return;
      }

      // 인증이 끝난 지금에야 세션을 만든다 — D-02 시절과 달리 가입 시점엔 로그인하지 않는다.
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError(GENERIC_ERROR);
        setSubmitting(false);
        return;
      }

      router.push("/dashboard");
    } catch {
      setError(GENERIC_ERROR);
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setError(null);
    setNotice(null);
    setResending(true);
    try {
      // 라우트가 계정 유무·쿨다운과 무관하게 항상 200을 주므로 안내 문구도 하나뿐이다.
      await fetch("/api/auth/verify-email/resend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setNotice("인증 코드를 다시 보냈어요. 메일함을 확인해 주세요.");
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setResending(false);
    }
  }

  return (
    <Form onSubmit={handleSubmit}>
      <p className={styles.sentTo}>
        <strong>{email}</strong>로 6자리 인증 코드를 보냈어요. 10분 안에 입력해 주세요.
      </p>

      <FormField>
        <FormLabel htmlFor="code">인증 코드</FormLabel>
        <Input
          id="code"
          className={styles.codeInput}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          error={Boolean(error)}
        />
        <FormError>{error}</FormError>
      </FormField>

      <FormSubmit disabled={submitting}>{submitting ? "확인하는 중…" : "인증하고 시작하기"}</FormSubmit>

      {notice && <p className={styles.notice}>{notice}</p>}

      <div className={styles.resendRow}>
        <button type="button" className={styles.linkButton} onClick={onBack}>
          이메일 주소 바꾸기
        </button>
        <button
          type="button"
          className={styles.linkButton}
          onClick={handleResend}
          disabled={resending}
        >
          {resending ? "보내는 중…" : "코드 다시 받기"}
        </button>
      </div>
    </Form>
  );
}
