"use client";

// UI-SPEC "Draft Recovery Dialog Contract" (EDIT-11): ConfirmDialog used directly (no new shell
// component) with the "폐기" choice added via the children slot — same pattern the ConfirmDialog
// author already earmarked for Phase 5's delete-workspace re-type field (ConfirmDialog.tsx:20).
// "복원" is the primary/accent action (destructive prop NOT used — restoring is not destructive).
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import styles from "./DraftRecoveryDialog.module.css";

interface DraftRecoveryDialogProps {
  open: boolean;
  onRestore: () => void;
  onDiscard: () => void;
  onDismiss: () => void;
}

export function DraftRecoveryDialog({ open, onRestore, onDiscard, onDismiss }: DraftRecoveryDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      title="임시 저장된 내용이 있어요"
      cancelLabel="나중에"
      confirmLabel="복원"
      onCancel={onDismiss}
      onConfirm={onRestore}
    >
      <p>마지막 저장 이후 자동으로 임시 저장된 더 최신 내용이 있어요. 복원할까요?</p>
      <button type="button" className={styles.discard} onClick={onDiscard}>
        폐기
      </button>
    </ConfirmDialog>
  );
}
