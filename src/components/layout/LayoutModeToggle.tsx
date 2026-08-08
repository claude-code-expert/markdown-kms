"use client";

// UI-SPEC "Layout Mode Toggle Contract" (EDIT-12) — 3-button segment, title
// input row's right side. Mirrors ThemeToggle's cookie pattern (05-07,
// RESEARCH Pattern 6): click writes document.cookie directly, no API route,
// since layoutMode is a non-sensitive, client-owned setting.
import { Columns2, PanelLeftClose, PanelRightClose } from "lucide-react";
import type { ComponentType } from "react";
import type { LayoutMode } from "./EditorPreviewLayout";
import styles from "./LayoutModeToggle.module.css";

interface LayoutModeToggleProps {
  mode: LayoutMode;
  onChange: (next: LayoutMode) => void;
}

const OPTIONS: { mode: LayoutMode; label: string; Icon: ComponentType<{ size?: number }> }[] = [
  { mode: "split", label: "분할 보기", Icon: Columns2 },
  { mode: "editor-only", label: "에디터만", Icon: PanelRightClose },
  { mode: "preview-only", label: "미리보기만", Icon: PanelLeftClose },
];

export function LayoutModeToggle({ mode, onChange }: LayoutModeToggleProps) {
  function select(next: LayoutMode) {
    document.cookie = `layoutMode=${next}; path=/; max-age=31536000; samesite=lax`;
    onChange(next);
  }

  return (
    <div className={styles.segment}>
      {OPTIONS.map(({ mode: optionMode, label, Icon }) => (
        <div key={optionMode} className={styles.buttonWrap}>
          <button
            type="button"
            className={optionMode === mode ? `${styles.button} ${styles.active}` : styles.button}
            aria-label={label}
            onClick={() => select(optionMode)}
          >
            <Icon size={16} />
          </button>
          <span className={styles.tooltip}>{label}</span>
        </div>
      ))}
    </div>
  );
}
