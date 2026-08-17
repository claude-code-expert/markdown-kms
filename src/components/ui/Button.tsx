import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

// 리디자인(PAGE-ANALYSIS.md §0-3): "삭제" 같은 위험 액션 트리거 버튼은 danger(아웃라인)로
// 통일하되, ConfirmDialog의 최종 확인 버튼만 솔리드로 남아야 한다는 목업 규칙이 있어
// danger 하나로는 표현이 안 된다 — dangerSolid를 별도 variant로 분리(ConfirmDialog 전용).
// accentOutline은 목업에서 반복되는 세 번째 아웃라인 패턴(대시보드 "신청", 멤버 "초대") —
// secondary와 테두리는 같지만 글자색이 accent라 별개 variant가 필요하다.
type Variant = "primary" | "secondary" | "danger" | "dangerSolid" | "accentOutline";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANT_CLASS: Record<Variant, string> = {
  primary: styles.primary,
  secondary: styles.secondary,
  danger: styles.danger,
  dangerSolid: styles.dangerSolid,
  accentOutline: styles.accentOutline,
};

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  const classes = [styles.btn, VARIANT_CLASS[variant], className].filter(Boolean).join(" ");
  return <button className={classes} {...props} />;
}
