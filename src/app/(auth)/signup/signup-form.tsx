"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { signupSchema } from "@/lib/validation";
import { Form, FormField, FormLabel, FormError, FormSubmit } from "@/components/ui/Form";
import { Input } from "@/components/ui/Input";
import styles from "./page.module.css";

const GENERIC_ERROR = "일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.";

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
}

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // 필드별 인라인 에러(2c 목업) — 브라우저 기본 required 팝업 대신, 필드마다 빨간 테두리 +
  // 그 아래 문구로 보여준다. 서버 쪽 실패(네트워크 등)만 폼 하단 error에 남는다.
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    // T-03-02: client validates with the SAME schema the server re-validates (Pitfall 5) —
    // convenience only, the server route remains the real boundary.
    const parsed = signupSchema.safeParse({ name, email, password });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        if (!next[key]) next[key] = issue.message; // 필드당 첫 에러만
      }
      setFieldErrors(next);
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? GENERIC_ERROR);
        setSubmitting(false);
        return;
      }

      // D-02: signup immediately establishes the session — no email verification step.
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

  return (
    <Form onSubmit={handleSubmit}>
      <FormField>
        <FormLabel htmlFor="name">이름</FormLabel>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="김민지"
          error={Boolean(fieldErrors.name)}
        />
        <FormError>{fieldErrors.name}</FormError>
      </FormField>

      <FormField>
        <FormLabel htmlFor="email">이메일</FormLabel>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="kim@weve.co.kr"
          error={Boolean(fieldErrors.email)}
        />
        <FormError>{fieldErrors.email}</FormError>
      </FormField>

      <FormField>
        <FormLabel htmlFor="password">비밀번호</FormLabel>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="8자 이상"
          error={Boolean(fieldErrors.password)}
        />
        <FormError>{fieldErrors.password}</FormError>
      </FormField>

      {error && <FormError>{error}</FormError>}

      <FormSubmit disabled={submitting}>{submitting ? "가입하는 중…" : "가입하기"}</FormSubmit>

      {/* UI-SPEC Copywriting Contract "Google 로그인 placeholder" — 비활성
          전용, onClick/signIn 프로바이더 호출 없음(Phase 8 descope 유지). */}
      <button type="button" disabled className={styles.googleButton}>
        Google로 계속하기
      </button>
    </Form>
  );
}
