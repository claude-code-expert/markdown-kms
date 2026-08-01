import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

type Variant = "primary" | "secondary" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANT_CLASS: Record<Variant, string> = {
  primary: styles.primary,
  secondary: styles.secondary,
  danger: styles.danger,
};

// Ported from docs/ui-kit.html id:'button' (#4). Padding stays the ui-kit original (8px 16px) —
// not re-rounded to the 8-point layout scale (UI-SPEC Spacing note).
export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  const classes = [styles.btn, VARIANT_CLASS[variant], className].filter(Boolean).join(" ");
  return <button className={classes} {...props} />;
}
