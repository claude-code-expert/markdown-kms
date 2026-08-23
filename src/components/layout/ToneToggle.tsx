"use client";

// 리디자인(PAGE-ANALYSIS.md §0-1) — ThemeToggle(라이트/다크 수동 토글)을 대체한다.
// 같은 사이드바 하단 자리, 같은 client-write 쿠키 패턴(RESEARCH Pattern 6: document.cookie
// 직접 기록 + DOM 속성 즉시 반영, API 라우트 없음)이지만 다크 전환 로직은 없다 — 다크는
// 이제 오직 prefers-color-scheme만 따른다(globals.css).
import { useState } from "react";
import styles from "./ToneToggle.module.css";

type Tone = "cool" | "warm";

interface ToneToggleProps {
  // RSC(layout.tsx)가 tone 쿠키를 이미 읽어 넘겨주면 그걸 쓰고, 없으면(클라이언트
  // 전용 트리에서 렌더되는 경우) RSC가 <html>에 이미 찍어둔 값을 DOM에서 읽는다 —
  // 기존 ThemeToggle의 initialTheme/readDomTheme 관례 그대로.
  initialTone?: Tone;
}

function readDomTone(): Tone {
  if (typeof document === "undefined") return "cool";
  return document.documentElement.dataset.tone === "warm" ? "warm" : "cool";
}

export function ToneToggle({ initialTone }: ToneToggleProps) {
  const [tone, setTone] = useState<Tone>(initialTone ?? readDomTone);

  function select(next: Tone) {
    if (next === tone) return;
    document.cookie = `tone=${next}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.dataset.tone = next;
    setTone(next);
  }

  return (
    <div className={styles.row}>
      <div className={styles.segment}>
        <button
          type="button"
          className={tone === "cool" ? styles.active : styles.item}
          onClick={() => select("cool")}
        >
          쿨 테마
        </button>
        <button
          type="button"
          className={tone === "warm" ? styles.active : styles.item}
          onClick={() => select("warm")}
        >
          웜 테마
        </button>
      </div>
    </div>
  );
}
