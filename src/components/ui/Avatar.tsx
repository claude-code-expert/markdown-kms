import styles from "./Avatar.module.css";

interface AvatarProps {
  name: string;
  // 헤더(26px)와 멤버 목록(30px)이 크기가 달라 명시적으로 받는다 — 기본값은 더 흔한
  // 멤버 목록 크기.
  size?: number;
}

// 리디자인(PAGE-ANALYSIS.md §0-2) — 이름 첫 글자 이니셜 원형 배지. 사진 없음(NFR 스코프
// 밖), 무채색(역할 배지와 같은 원칙 — 장식이 아니라 식별용).
export function Avatar({ name, size = 30 }: AvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      className={styles.avatar}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}
