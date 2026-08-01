"use client";

import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import styles from "./DeleteWorkspaceDialog.module.css";

const DELETE_ERROR = "삭제하지 못했어요. 다시 시도해 주세요.";

interface DeleteWorkspaceDialogProps {
  open: boolean;
  workspaceId: string;
  workspaceName: string;
  onClose: () => void;
  onDeleted: () => void;
}

// E5 — GitHub-style re-type-name confirm (D-15), OWNER-only affordance (WorkspaceCard gates
// rendering). Copy reflects the AMENDED soft-delete contract (2026-08-02 product-owner
// override, TRD §3 / PRD §3 / 01-CONTEXT.md D-15): the workspace disappears from active
// listings, it is not destroyed. Deliberately does NOT use the stale UI-SPEC row's
// "영구적으로 사라지며 되돌릴 수 없습니다" copy, which predates the override.
export function DeleteWorkspaceDialog({
  open,
  workspaceId,
  workspaceName,
  onClose,
  onDeleted,
}: DeleteWorkspaceDialogProps) {
  const [typed, setTyped] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTyped("");
      setSubmitting(false);
      setError(null);
    }
  }, [open]);

  async function handleConfirm() {
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}`, { method: "DELETE" });
      if (!res.ok) {
        setError(DELETE_ERROR);
        setSubmitting(false);
        return;
      }
      onDeleted();
      onClose();
    } catch {
      setError(DELETE_ERROR);
      setSubmitting(false);
    }
  }

  return (
    <ConfirmDialog
      open={open}
      title="워크스페이스를 삭제할까요?"
      onCancel={onClose}
      onConfirm={handleConfirm}
      confirmLabel={submitting ? "삭제하는 중…" : "삭제"}
      confirmDisabled={submitting || typed !== workspaceName}
      destructive
    >
      <p className={styles.body}>
        {`'${workspaceName}' 워크스페이스가 목록에서 사라지고 더 이상 접근할 수 없게 됩니다. 계속하려면 워크스페이스 이름을 정확히 입력하세요.`}
      </p>
      <Input
        aria-label="워크스페이스 이름 확인"
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        placeholder={workspaceName}
        disabled={submitting}
      />
      {error && <p className={styles.error}>{error}</p>}
    </ConfirmDialog>
  );
}
