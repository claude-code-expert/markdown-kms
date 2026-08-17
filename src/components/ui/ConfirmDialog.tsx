"use client";

import { useEffect, type ReactNode } from "react";
import { Button } from "./Button";
import styles from "./ConfirmDialog.module.css";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  cancelLabel?: string;
  confirmDisabled?: boolean;
  destructive?: boolean;
  children: ReactNode;
}

// Ported from docs/ui-kit.html id:'confirm' (#33). Generic block/confirm shell — `children`
// hosts arbitrary body content so Plan 05's delete-workspace re-type-name field (D-15) can
// reuse this same component instead of a one-off dialog.
export function ConfirmDialog({
  open,
  title,
  onCancel,
  onConfirm,
  confirmLabel,
  cancelLabel = "취소",
  confirmDisabled = false,
  destructive = false,
  children,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className={styles.backdrop}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <h3 className={styles.title} id="confirm-title">
          {title}
        </h3>
        {children}
        <div className={styles.actions}>
          <Button type="button" variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? "danger" : "primary"}
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
