"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { DeleteWorkspaceDialog } from "./DeleteWorkspaceDialog";
import styles from "./WorkspaceCard.module.css";

interface WorkspaceCardProps {
  id: string;
  name: string;
  role: string;
  ownerName: string | null;
  createdAt: Date | string;
  docCount: number;
  folderCount: number;
}

function formatCreatedAt(createdAt: Date | string): string {
  const date = createdAt instanceof Date ? createdAt : new Date(createdAt);
  return date.toISOString().slice(0, 10);
}

// E3/E5 — one card per membership. Title truncates to one line with an ellipsis
// (ui-kit .kit-item-name pattern); active/emphasis is weight/lightness, never color
// (UI-SPEC Color — accent is not spent here).
// The delete affordance is UX convenience only, gated on role === "OWNER" — the real
// authorization boundary is the server's requireRole gate on DELETE (CLAUDE.md, T-05-01).
// The seeded default workspace has no OWNER (D-09, all members are EDITOR), so it never
// shows this affordance without any extra isDefault check.
// Phase 9 D-08: meta line is real DB data (listMembershipsForUser), never a hardcoded
// placeholder — a brand-new workspace renders "문서 0개 · 폴더 0개", not an empty/hidden line.
export function WorkspaceCard({ id, name, role, ownerName, createdAt, docCount, folderCount }: WorkspaceCardProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <Card className={styles.card}>
      <div className={styles.body}>
        <Link href={`/w/${id}`} className={styles.name}>
          {name}
        </Link>
        <p className={styles.meta}>
          소유자 {ownerName ?? "-"} · 생성일 {formatCreatedAt(createdAt)} · 문서 {docCount}개 · 폴더 {folderCount}개
        </p>
      </div>
      {role === "OWNER" && (
        <>
          <button
            type="button"
            className={styles.deleteButton}
            onClick={() => setDeleteOpen(true)}
            aria-label={`${name} 삭제`}
          >
            <Trash2 size={16} />
          </button>
          <DeleteWorkspaceDialog
            open={deleteOpen}
            workspaceId={id}
            workspaceName={name}
            onClose={() => setDeleteOpen(false)}
            onDeleted={() => router.refresh()}
          />
        </>
      )}
    </Card>
  );
}
