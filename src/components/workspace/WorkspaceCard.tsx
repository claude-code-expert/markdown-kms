import { Card } from "@/components/ui/Card";
import styles from "./WorkspaceCard.module.css";

interface WorkspaceCardProps {
  name: string;
}

// E3 — one workspace card per membership. Title truncates to one line with an ellipsis
// (ui-kit .kit-item-name pattern); active/emphasis is weight/lightness, never color
// (UI-SPEC Color — accent is not spent here).
export function WorkspaceCard({ name }: WorkspaceCardProps) {
  return (
    <Card className={styles.card}>
      <span className={styles.name}>{name}</span>
    </Card>
  );
}
