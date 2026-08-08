// Reusable centered placeholder (UI-SPEC Copywriting Contract) — used for the workspace index
// (no document open) here, and reusable for the trash empty-list state later (Pattern-map:
// no existing "empty state" component to mirror, this is the first one).
import styles from "./EmptyState.module.css";

interface EmptyStateProps {
  heading: string;
  body: string;
}

export function EmptyState({ heading, body }: EmptyStateProps) {
  return (
    <div className={styles.wrap}>
      <p className={styles.heading}>{heading}</p>
      <p className={styles.body}>{body}</p>
    </div>
  );
}
