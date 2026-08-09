"use client";

// UI-SPEC Dashboard Join-Request Contract (WS-03). CreateWorkspaceModal.tsx's client-validate +
// fetch + inline-error handleSubmit skeleton, reworked as an inline input row instead of a modal.
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import styles from "./JoinWorkspaceInput.module.css";

const INVALID_ID = "잘못된 워크스페이스 ID예요.";
const DUPLICATE_OR_MEMBER = "이미 멤버이거나 이미 신청한 워크스페이스예요.";
const GENERIC_FAIL = "일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.";
const SUCCESS = "참여 신청을 보냈어요. 관리자 승인을 기다려 주세요.";

export function JoinWorkspaceInput() {
  const [wsIdInput, setWsIdInput] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleChange(value: string) {
    setWsIdInput(value);
    // UI-SPEC: the feedback line clears on the next keystroke -- no timer.
    setFeedback(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    if (!z.uuid().safeParse(wsIdInput).success) {
      setFeedback({ type: "error", message: INVALID_ID });
      return;
    }

    setSubmitting(true);
    const res = await fetch(`/api/workspaces/${wsIdInput}/join-requests`, { method: "POST" });
    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setFeedback({ type: "error", message: body?.error ?? (res.status === 400 ? DUPLICATE_OR_MEMBER : GENERIC_FAIL) });
      return;
    }

    setWsIdInput("");
    setFeedback({ type: "success", message: SUCCESS });
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className={styles.row}>
        <Input
          className={styles.input}
          value={wsIdInput}
          onChange={(event) => handleChange(event.target.value)}
          placeholder="워크스페이스 ID"
          aria-label="워크스페이스 ID"
        />
        <Button type="submit" variant="secondary" disabled={submitting}>
          {submitting ? "신청하는 중…" : "신청"}
        </Button>
      </div>
      {feedback && (
        <p className={`${styles.feedback} ${feedback.type === "success" ? styles.feedbackSuccess : styles.feedbackError}`}>
          {feedback.message}
        </p>
      )}
    </form>
  );
}
