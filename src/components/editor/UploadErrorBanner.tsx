"use client";

// UI-SPEC Image Upload Contract "에러 배너" — same left-border/surface-2 pattern as
// RestoreRootBanner (Phase 4), no auto-dismiss timer: stays until the user closes it or the
// next upload attempt replaces its text (useImageUpload clears it at the start of each attempt).
import { AlertCircle, X } from "lucide-react";
import styles from "./UploadErrorBanner.module.css";

interface UploadErrorBannerProps {
  message: string;
  onClose: () => void;
}

export function UploadErrorBanner({ message, onClose }: UploadErrorBannerProps) {
  return (
    <div className={styles.banner} role="alert">
      <AlertCircle size={16} className={styles.icon} />
      <p className={styles.text}>{message}</p>
      <button type="button" className={styles.close} aria-label="에러 안내 닫기" onClick={onClose}>
        <X size={16} />
      </button>
    </div>
  );
}
