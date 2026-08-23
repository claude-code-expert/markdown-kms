"use client";

// 클로징 서브텍스트 — 워드마크급 타이핑 효과(HeroPreview.tsx와 같은 패턴, 단 여긴 한 번만
// 타이핑하고 멈춘다: 보조 문구라 반복 재생은 과함). page.tsx는 서버 컴포넌트라 타이핑
// 상태가 필요한 이 부분만 분리.
import { useEffect, useState } from "react";
import styles from "./page.module.css";

const TEXT = "마크다운 기반 지식 관리 시스템 Markdown KMS";
const TYPE_MS = 45;

export function ClosingSubtext() {
  const [length, setLength] = useState(0);
  const [reducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    if (reducedMotion || length >= TEXT.length) return;
    const timer = setTimeout(() => setLength((current) => current + 1), TYPE_MS);
    return () => clearTimeout(timer);
  }, [length, reducedMotion]);

  const done = reducedMotion || length >= TEXT.length;

  return (
    <span className={styles.closingSubtext}>
      {reducedMotion ? TEXT : TEXT.slice(0, length)}
      {!done && <span className={styles.closingCaret} />}
    </span>
  );
}
