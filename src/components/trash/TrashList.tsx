"use client";

// UI-SPEC Trash Contract. Structure + permission gating land here (Task 1) — restore/permanent-
// delete wiring, RestoreRootBanner, and ConfirmDialog land in Task 2 (04-05-PLAN.md task split).
import { Folder, FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ROLE_RANK, type Role } from "@/lib/rbac";
import styles from "./TrashList.module.css";

export interface TrashItemRow {
  type: "folder" | "document";
  id: string;
  name: string;
  deletedAt: Date | null;
}

interface TrashListProps {
  items: TrashItemRow[];
  role: Role;
  wsId: string;
}

const RESTORE_GATE_HINT = "편집자 이상만 복원할 수 있어요.";
const PERMANENT_DELETE_GATE_HINT = "관리자만 완전 삭제할 수 있어요.";

// Intl.RelativeTimeFormat is a native platform API — no date library needed for "3일 전"
// (UI-SPEC Trash Contract example copy matches this formatter's output verbatim).
function formatDeletedAt(date: Date): string {
  const rtf = new Intl.RelativeTimeFormat("ko", { numeric: "auto" });
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.round(diffMs / 60_000);
  if (Math.abs(diffMinutes) < 60) return rtf.format(-diffMinutes, "minute");
  const diffHours = Math.round(diffMs / 3_600_000);
  if (Math.abs(diffHours) < 24) return rtf.format(-diffHours, "hour");
  const diffDays = Math.round(diffMs / 86_400_000);
  return rtf.format(-diffDays, "day");
}

export function TrashList({ items, role }: TrashListProps) {
  const canRestore = ROLE_RANK[role] >= ROLE_RANK.EDITOR;
  const canPermanentDelete = ROLE_RANK[role] >= ROLE_RANK.ADMIN;

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>휴지통</h1>
      {items.length === 0 && (
        <p className={styles.empty}>
          휴지통이 비어있어요
          <br />
          삭제된 폴더와 문서가 여기 표시돼요.
        </p>
      )}
      {items.map((item) => {
        const Icon = item.type === "folder" ? Folder : FileText;
        const name = item.name || "제목 없음";
        return (
          <div key={`${item.type}-${item.id}`} className={styles.row}>
            <Icon size={16} className={styles.icon} />
            <span className={styles.name}>{name}</span>
            <span className={styles.deletedAt}>{item.deletedAt ? formatDeletedAt(item.deletedAt) : ""}</span>
            <div className={styles.actions}>
              <Button variant="secondary" disabled={!canRestore}>
                복원
              </Button>
              {!canRestore && <span className={styles.gateHint}>{RESTORE_GATE_HINT}</span>}
              <Button variant="danger" disabled={!canPermanentDelete}>
                완전 삭제
              </Button>
              {!canPermanentDelete && <span className={styles.gateHint}>{PERMANENT_DELETE_GATE_HINT}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
