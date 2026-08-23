"use client";

// 히어로 미니 프리뷰 — 제품의 핵심(에디터·미리보기 듀얼 뷰)을 그대로 축약해 보여준다.
// 왼쪽엔 마크다운 원문이 타이핑되고, 각 줄이 완성되는 순간 오른쪽에 그 렌더링 결과가
// 나타난다. 서버 컴포넌트인 page.tsx에서 setInterval 상태가 필요해 별도 client
// 컴포넌트로 분리(page.tsx는 그대로 async 서버 컴포넌트).
import { useEffect, useState, type ReactNode } from "react";
import styles from "./page.module.css";

interface PreviewBlock {
  markdown: string; // 빈 문자열이면 빈 줄(원문에는 남지만 렌더 결과는 없음)
  render: () => ReactNode;
}

const BLOCKS: PreviewBlock[] = [
  { markdown: "# 온보딩 가이드", render: () => <span className={styles.rH1}>온보딩 가이드</span> },
  { markdown: "", render: () => null },
  { markdown: "첫 주에 볼 문서를 정리했다.", render: () => <p className={styles.rBody}>첫 주에 볼 문서를 정리했다.</p> },
  { markdown: "", render: () => null },
  { markdown: "## 준비물", render: () => <span className={styles.rH2}>준비물</span> },
  {
    markdown: "- [x] 사내 계정 발급",
    render: () => (
      <span className={styles.rCheckDone}>
        <span className={styles.rCheckbox} />
        사내 계정 발급
      </span>
    ),
  },
  {
    markdown: "- [ ] 저장소 접근 요청",
    render: () => (
      <span className={styles.rCheck}>
        <span className={styles.rCheckboxEmpty} />
        저장소 접근 요청
      </span>
    ),
  },
];

const SOURCE = BLOCKS.map((block) => block.markdown).join("\n");
const TYPE_MS = 35; // 글자당 타이핑 간격
const PAUSE_MS = 2200; // 다 친 뒤 멈췄다가 처음부터 다시

// typedLength만큼 타이핑됐을 때, 원문 몇 번째 블록까지 "완성"됐는지(오른쪽에 렌더할 개수).
function completedBlockCount(typedLength: number): number {
  let pos = 0;
  let count = 0;
  for (const block of BLOCKS) {
    const end = pos + block.markdown.length;
    if (typedLength < end) break;
    count += 1;
    pos = end + 1; // 줄바꿈 한 글자
  }
  return count;
}

export function HeroPreview() {
  const [length, setLength] = useState(0);
  // prefers-reduced-motion: 반복 타이핑 대신 완성된 결과를 바로 보여준다(캐럿 깜빡임도
  // page.module.css의 같은 media query로 꺼짐).
  const [reducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    if (reducedMotion) {
      setLength(SOURCE.length);
      return;
    }
    const done = length >= SOURCE.length;
    const timer = setTimeout(
      () => setLength((current) => (done ? 0 : current + 1)),
      done ? PAUSE_MS : TYPE_MS,
    );
    return () => clearTimeout(timer);
  }, [length, reducedMotion]);

  const rendered = BLOCKS.slice(0, completedBlockCount(length));

  return (
    <div className={styles.heroPreview} aria-hidden="true">
      <div className={styles.previewChrome}>
        <span className={styles.previewDot} />
        <span className={styles.previewDot} />
        <span className={styles.previewDot} />
      </div>
      <div className={styles.previewBody}>
        <pre className={styles.previewSource}>
          {SOURCE.slice(0, length)}
          <span className={styles.previewCaret} />
        </pre>
        <div className={styles.previewRendered}>
          {rendered.map((block, index) => (
            <div key={index}>{block.render()}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
