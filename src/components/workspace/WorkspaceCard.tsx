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
}

// E3/E5 — one card per membership. Title truncates to one line with an ellipsis
// (ui-kit .kit-item-name pattern); active/emphasis is weight/lightness, never color
// (UI-SPEC Color — accent is not spent here).
// The delete affordance is UX convenience only, gated on role === "OWNER" — the real
// authorization boundary is the server's requireRole gate on DELETE (CLAUDE.md, T-05-01).
// The seeded default workspace has no OWNER (D-09, all members are EDITOR), so it never
// shows this affordance without any extra isDefault check.
export function WorkspaceCard({ id, name, role }: WorkspaceCardProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <Card className={styles.card}>
      <Link href={`/w/${id}`} className={styles.name}>
        {name}
      </Link>
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
