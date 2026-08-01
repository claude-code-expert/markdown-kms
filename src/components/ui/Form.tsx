import type {
  ButtonHTMLAttributes,
  FormHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
} from "react";
import styles from "./Form.module.css";

// Ported from docs/ui-kit.html id:'form' (#12). The submit button keeps the ui-kit original
// form-submit padding (9px 14px) — deliberately distinct from the generic Button's 8px 16px
// (UI-SPEC Spacing note: both literal values are ported infrastructure, not to be unified).

export function Form({ className, ...props }: FormHTMLAttributes<HTMLFormElement>) {
  const classes = [styles.form, className].filter(Boolean).join(" ");
  return <form className={classes} {...props} />;
}

export function FormField({ children }: { children: ReactNode }) {
  return <div className={styles.field}>{children}</div>;
}

export function FormLabel(props: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={styles.label} {...props} />;
}

export function FormError({ children }: { children?: ReactNode }) {
  return <div className={styles.error}>{children}</div>;
}

export function FormSubmit({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const classes = [styles.submit, className].filter(Boolean).join(" ");
  return <button type="submit" className={classes} {...props} />;
}
