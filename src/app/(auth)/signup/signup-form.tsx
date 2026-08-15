"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { signupSchema } from "@/lib/validation";
import { Form, FormField, FormLabel, FormError, FormSubmit } from "@/components/ui/Form";
import { Input } from "@/components/ui/Input";
import styles from "./page.module.css";

const GENERIC_ERROR = "일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.";

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    // T-03-02: client validates with the SAME schema the server re-validates (Pitfall 5) —
    // convenience only, the server route remains the real boundary.
    const parsed = signupSchema.safeParse({ name, email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? GENERIC_ERROR);
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
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
      </FormField>

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

      <FormSubmit disabled={submitting}>{submitting ? "가입하는 중…" : "가입하기"}</FormSubmit>

      {/* UI-SPEC Copywriting Contract "Google 로그인 placeholder" — 비활성
          전용, onClick/signIn 프로바이더 호출 없음(Phase 8 descope 유지). */}
      <button type="button" disabled className={styles.googleButton}>
        Google로 계속하기
      </button>
    </Form>
  );
}
