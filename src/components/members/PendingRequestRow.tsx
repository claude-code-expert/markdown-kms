"use client";

// UI-SPEC Members Page Contract — 승인 대기 (WS-03/WS-04). TrashList.tsx mutation pattern:
// per-row submitting state, ConfirmDialog confirm-before-mutate, inline error inside the dialog
// (dialog stays open on failure), router.refresh() on success (no toast, no optimistic removal).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import styles from "./MembersView.module.css";

export interface PendingRequestRowData {
  reqId: string;
  userId: string;
  name: string;
  email: string;
  createdAt: Date;
}

type Decision = "APPROVED" | "REJECTED";

const FAIL_COPY: Record<Decision, string> = {
  APPROVED: "승인하지 못했어요. 다시 시도해 주세요.",
  REJECTED: "거절하지 못했어요. 다시 시도해 주세요.",
};

// ponytail: duplicated from TrashList.tsx (single reused pattern, not yet a shared util) —
// UI-SPEC explicitly calls this "Intl.RelativeTimeFormat 재사용", extract to src/lib if a third
// call site shows up.
function formatRequestedAt(date: Date): string {
  const rtf = new Intl.RelativeTimeFormat("ko", { numeric: "auto" });
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.round(diffMs / 60_000);
  if (Math.abs(diffMinutes) < 60) return rtf.format(-diffMinutes, "minute");
  const diffHours = Math.round(diffMs / 3_600_000);
  if (Math.abs(diffHours) < 24) return rtf.format(-diffHours, "hour");
  const diffDays = Math.round(diffMs / 86_400_000);
  return rtf.format(-diffDays, "day");
}

interface PendingRequestRowProps {
  request: PendingRequestRowData;
  wsId: string;
}

export function PendingRequestRow({ request, wsId }: PendingRequestRowProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<Decision | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!confirming) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/workspaces/${wsId}/join-requests/${request.reqId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: confirming }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(FAIL_COPY[confirming]);
      return;
    }
    setConfirming(null);
    router.refresh();
  }

  return (
    <div className={styles.row}>
      <Avatar name={request.name} />
      <div className={styles.identity}>
        <span className={styles.name}>{request.name}</span>
        <span className={styles.email}>{request.email}</span>
      </div>
      <span className={styles.requestedAt}>{formatRequestedAt(request.createdAt)}</span>
      <div className={styles.actions}>
        <Button variant="primary" onClick={() => setConfirming("APPROVED")}>
          승인
        </Button>
        <Button variant="danger" onClick={() => setConfirming("REJECTED")}>
          거절
        </Button>
      </div>
      {confirming && (
        <ConfirmDialog
          open
          title={
            confirming === "APPROVED"
              ? `'${request.email}'님을 승인할까요?`
              : `'${request.email}'님의 요청을 거절할까요?`
          }
          onCancel={() => {
            setConfirming(null);
            setError(null);
          }}
          onConfirm={handleConfirm}
          confirmLabel={
            submitting
              ? confirming === "APPROVED"
                ? "승인하는 중…"
                : "거절하는 중…"
              : confirming === "APPROVED"
                ? "승인"
                : "거절"
          }
          confirmDisabled={submitting}
          destructive={confirming === "REJECTED"}
        >
          <p>
            {confirming === "APPROVED"
              ? "승인하면 편집자 권한으로 워크스페이스에 합류합니다."
              : "거절하면 목록에서 제거돼요. 다시 신청할 수 있어요."}
          </p>
          {error && <p className={styles.errorText}>{error}</p>}
        </ConfirmDialog>
      )}
    </div>
  );
}
