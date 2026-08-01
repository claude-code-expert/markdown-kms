import { forwardRef, type InputHTMLAttributes } from "react";
import styles from "./Input.module.css";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

// Ported from docs/ui-kit.html id:'input' (#15) / form-input — identical 8px 12px padding
// in both ui-kit sources, so a single component covers both. Accent is reserved for the
// focus ring only (UI-SPEC Color); the error variant swaps the border to --destructive.
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { error, className, ...props },
  ref,
) {
  const classes = [styles.input, error ? styles.error : "", className].filter(Boolean).join(" ");
  return <input ref={ref} className={classes} {...props} />;
});
