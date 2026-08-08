"use client";

// UI-SPEC Trash Contract. Structure + permission gating (Task 1) plus restore/permanent-delete
// wiring, RestoreRootBanner, and ConfirmDialog (Task 2). Mutation pattern mirrors FolderTree.tsx
// (fetch → inline error on failure, router.refresh() on success, no optimistic UI).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Folder, FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ROLE_RANK, type Role } from "@/lib/rbac";
import { RestoreRootBanner } from "./RestoreRootBanner";
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
const RESTORE_ERROR = "복원하지 못했어요. 다시 시도해 주세요.";
const PERMANENT_DELETE_ERROR = "완전히 삭제하지 못했어요. 다시 시도해 주세요.";

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
  const router = useRouter();
  const canRestore = ROLE_RANK[role] >= ROLE_RANK.EDITOR;
  const canPermanentDelete = ROLE_RANK[role] >= ROLE_RANK.ADMIN;

  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<{ id: string; message: string } | null>(null);
  const [bannerName, setBannerName] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "folder" | "document"; id: string; name: string } | null>(
    null,
  );
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // UI-SPEC "복원 클릭" — no confirmation (reversible), fetch immediately. relocatedToRoot
  // (both restoreFolder and restoreDocument now share this shape — 04-05 parity fix) drives the
  // banner; a non-relocating restore leaves any existing banner as-is (only a relocating restore
  // replaces its content, per UI-SPEC "다음 복원 동작이 배너 내용을 교체").
  async function handleRestore(item: TrashItemRow) {
    setRestoreError(null);
    setRestoringId(item.id);
    const res = await fetch(`/api/trash/${item.type}/${item.id}/restore`, { method: "POST" });
    setRestoringId(null);
    if (!res.ok) {
      setRestoreError({ id: item.id, message: RESTORE_ERROR });
      return;
    }
    const body = await res.json().catch(() => null);
    if (body?.relocatedToRoot) setBannerName(item.name || "제목 없음");
    router.refresh();
  }

  async function confirmPermanentDelete() {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    setDeleteError(null);
    const res = await fetch(`/api/trash/${deleteTarget.type}/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteSubmitting(false);
    if (!res.ok) {
      setDeleteError(PERMANENT_DELETE_ERROR);
      return;
    }
    setDeleteTarget(null);
    router.refresh();
  }

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>휴지통</h1>
      {bannerName && <RestoreRootBanner name={bannerName} onClose={() => setBannerName(null)} />}
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
        const isRestoring = restoringId === item.id;
        return (
          <div key={`${item.type}-${item.id}`} className={styles.row}>
            <Icon size={16} className={styles.icon} />
            <span className={styles.name}>{name}</span>
            <span className={styles.deletedAt}>{item.deletedAt ? formatDeletedAt(item.deletedAt) : ""}</span>
            <div className={styles.actions}>
              <Button
                variant="secondary"
                disabled={!canRestore || isRestoring}
                onClick={() => handleRestore(item)}
              >
                {isRestoring ? "복원하는 중…" : "복원"}
              </Button>
              {!canRestore && <span className={styles.gateHint}>{RESTORE_GATE_HINT}</span>}
              <Button
                variant="danger"
                disabled={!canPermanentDelete}
                onClick={() => setDeleteTarget({ type: item.type, id: item.id, name })}
              >
                완전 삭제
              </Button>
              {!canPermanentDelete && <span className={styles.gateHint}>{PERMANENT_DELETE_GATE_HINT}</span>}
            </div>
            {restoreError?.id === item.id && <p className={styles.errorText}>{restoreError.message}</p>}
          </div>
        );
      })}
      {deleteTarget && (
        <ConfirmDialog
          open
          title={`'${deleteTarget.name}' 완전 삭제할까요?`}
          onCancel={() => {
            setDeleteTarget(null);
            setDeleteError(null);
          }}
          onConfirm={confirmPermanentDelete}
          confirmLabel={deleteSubmitting ? "삭제하는 중…" : "완전 삭제"}
          confirmDisabled={deleteSubmitting}
          destructive
        >
          <p>이 작업은 되돌릴 수 없어요. 폴더/문서와 하위 항목이 영구 삭제됩니다.</p>
          {deleteError && <p className={styles.errorText}>{deleteError}</p>}
        </ConfirmDialog>
      )}
    </div>
  );
}
