"use client";

// UI-SPEC "Layout Mode Toggle Contract" (EDIT-12) — 3-button segment, title
// input row's right side. Mirrors ThemeToggle's cookie pattern (05-07,
// RESEARCH Pattern 6): click writes document.cookie directly, no API route,
// since layoutMode is a non-sensitive, client-owned setting.
// 리디자인(README Assets — layout 아이콘도 lucide 목록에서 빠졌다): 아이콘 대신 짧은
// 텍스트 라벨("분할"/"에디터"/"미리보기")로 노출 — 라벨 자체가 이미 읽히므로 hover
// 툴팁은 더 필요 없어 뺐다(ToneToggle과 동일한 세그먼트 시각 패턴).
import type { LayoutMode } from "./EditorPreviewLayout";
import styles from "./LayoutModeToggle.module.css";

interface LayoutModeToggleProps {
  mode: LayoutMode;
  onChange: (next: LayoutMode) => void;
}

const OPTIONS: { mode: LayoutMode; label: string }[] = [
  { mode: "split", label: "분할" },
  { mode: "editor-only", label: "에디터" },
  { mode: "preview-only", label: "미리보기" },
];

export function LayoutModeToggle({ mode, onChange }: LayoutModeToggleProps) {
  function select(next: LayoutMode) {
    document.cookie = `layoutMode=${next}; path=/; max-age=31536000; samesite=lax`;
    onChange(next);
  }

  return (
    <div className={styles.segment}>
      {OPTIONS.map(({ mode: optionMode, label }) => (
        <button
          key={optionMode}
          type="button"
          className={optionMode === mode ? styles.active : styles.item}
          onClick={() => select(optionMode)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
