"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { buildTree, isDescendantOrSelf, type FolderRow, type FolderTreeNode as TreeNode } from "./tree-utils";
import styles from "./MoveFolderModal.module.css";

const MOVE_ERROR = "폴더를 이동하지 못했어요. 다시 시도해 주세요.";
const ROOT_ID = "__root__";

interface MoveFolderModalProps {
  open: boolean;
  folderId: string;
  folderName: string;
  folders: FolderRow[];
  onClose: () => void;
}

// UI-SPEC "이동" 폴백 모달 — DeleteWorkspaceDialog's own fetch/submitting/error skeleton
// (03-PATTERNS.md analog), Modal reused per UI-SPEC's explicit component choice. The dragged
// folder's own subtree is greyed out via isDescendantOrSelf (same client pre-judgment DnD
// uses) — the server re-validates regardless (T-03-05-CLIENTTRUST).
export function MoveFolderModal({ open, folderId, folderName, folders, onClose }: MoveFolderModalProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelected(null);
      setSubmitting(false);
      setError(null);
    }
  }, [open]);

  async function handleConfirm() {
    if (!selected) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/folders/${folderId}/move`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ newParentId: selected === ROOT_ID ? null : selected }),
      });
      if (!res.ok) {
        setError(MOVE_ERROR);
        setSubmitting(false);
        return;
      }
      onClose();
      router.refresh();
    } catch {
      setError(MOVE_ERROR);
      setSubmitting(false);
    }
  }

  const tree = buildTree(folders);

  return (
    <Modal open={open} onClose={onClose} title={`'${folderName}' 이동`}>
      <ul className={styles.list}>
        <li>
          <button
            type="button"
            className={selected === ROOT_ID ? styles.itemSelected : styles.item}
            style={{ paddingLeft: 8 }}
            onClick={() => setSelected(ROOT_ID)}
          >
            워크스페이스 루트
          </button>
        </li>
        {tree.map((node) => (
          <MoveListItem
            key={node.id}
            node={node}
            depth={0}
            folders={folders}
            draggedId={folderId}
            selected={selected}
            onSelect={setSelected}
          />
        ))}
      </ul>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.actions}>
        <Button type="button" variant="secondary" onClick={onClose}>
          취소
        </Button>
        <Button type="button" variant="primary" onClick={handleConfirm} disabled={!selected || submitting}>
          {submitting ? "이동하는 중…" : "이동"}
        </Button>
      </div>
    </Modal>
  );
}

function MoveListItem({
  node,
  depth,
  folders,
  draggedId,
  selected,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  folders: FolderRow[];
  draggedId: string;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const disabled = isDescendantOrSelf(folders, draggedId, node.id);
  const paddingLeft = 8 + 16 * depth;
  const className = disabled ? styles.itemDisabled : selected === node.id ? styles.itemSelected : styles.item;

  return (
    <li>
      <button
        type="button"
        className={className}
        style={{ paddingLeft }}
        disabled={disabled}
        onClick={() => onSelect(node.id)}
      >
        {node.name}
      </button>
      {node.children.map((child) => (
        <MoveListItem
          key={child.id}
          node={child}
          depth={depth + 1}
          folders={folders}
          draggedId={draggedId}
          selected={selected}
          onSelect={onSelect}
        />
      ))}
    </li>
  );
}
