"use client";

// UI-SPEC Document Workspace Contract — 저장 상태 바. "저장됨" stays neutral (var(--muted)),
// never accent/green (Color section rationale: autosave repeats every second, a strong color
// on every cycle would be visual noise). Only "저장 실패" uses destructive — the one state a
// user must actually notice.
import { AlertCircle, Check } from "lucide-react";
import type { SaveStatus } from "./autosave-controller";
import styles from "./SaveStatusBar.module.css";

interface SaveStatusBarProps {
  status: SaveStatus;
  onRetry: () => void;
}

export function SaveStatusBar({ status, onRetry }: SaveStatusBarProps) {
  return (
    <div className={styles.bar}>
      {status === "saving" && (
        <>
          <span className={styles.spinner} aria-hidden="true" />
          <span className={styles.textMuted}>저장 중…</span>
        </>
      )}
      {status === "saved" && (
        <>
          <Check size={14} className={styles.iconMuted} aria-hidden="true" />
          <span className={styles.textMuted}>저장됨</span>
        </>
      )}
      {status === "error" && (
        <>
          <AlertCircle size={14} className={styles.iconDestructive} aria-hidden="true" />
          <span className={styles.textDestructive}>저장 실패</span>
          <button type="button" className={styles.retryButton} onClick={onRetry}>
            재시도
          </button>
        </>
      )}
    </div>
  );
}
