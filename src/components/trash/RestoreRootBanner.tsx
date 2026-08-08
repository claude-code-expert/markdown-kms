"use client";

// UI-SPEC Trash Contract "복원-루트 안내 배너" — no auto-dismiss timer (spec explicitly rejects
// one); stays until the user closes it or the next relocating restore replaces its text.
import { Info, X } from "lucide-react";
import styles from "./RestoreRootBanner.module.css";

interface RestoreRootBannerProps {
  name: string;
  onClose: () => void;
}

export function RestoreRootBanner({ name, onClose }: RestoreRootBannerProps) {
  return (
    <div className={styles.banner} role="status">
      <Info size={16} className={styles.icon} />
      <p className={styles.text}>{`'${name}'의 원래 폴더가 삭제되어 워크스페이스 루트로 복원했어요.`}</p>
      <button type="button" className={styles.close} aria-label="안내 닫기" onClick={onClose}>
        <X size={16} />
      </button>
    </div>
  );
}
