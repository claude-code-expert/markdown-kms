"use client";

import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus, Pencil, FolderInput, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { folderSchema } from "@/lib/validation";
import { buildTree, type FolderRow } from "./tree-utils";
import { FolderTreeNode, type FolderTreeNodeCtx } from "./FolderTreeNode";
import { FolderContextMenu, type FolderMenuItem } from "./FolderContextMenu";
import { MoveFolderModal } from "./MoveFolderModal";
import nodeStyles from "./FolderTreeNode.module.css";
import styles from "./FolderTree.module.css";

const CREATE_ERROR = "폴더를 만들지 못했어요. 다시 시도해 주세요.";
const RENAME_ERROR = "이름을 변경하지 못했어요. 다시 시도해 주세요.";
const MOVE_ERROR = "폴더를 이동하지 못했어요. 다시 시도해 주세요.";
const DELETE_ERROR = "폴더를 삭제하지 못했어요. 다시 시도해 주세요.";
const ROOT_ERROR_ID = "__root__";

interface FolderTreeProps {
  folders: FolderRow[];
  workspaceId: string;
}

interface MenuState {
  x: number;
  y: number;
  folderId: string;
  folderName: string;
}

// Owns every piece of transient tree-interaction state (expand/select/drag/menu/modal) —
// FolderTreeNode stays presentational, wired via the FolderTreeNodeCtx bundle. All mutations
// are server-confirmed only (router.refresh() after the fetch resolves — no optimistic UI,
// CONTEXT.md).
export function FolderTree({ folders, workspaceId }: FolderTreeProps) {
  const router = useRouter();
  const tree = buildTree(folders);

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creatingRoot, setCreatingRoot] = useState(false);
  const [creatingChildOf, setCreatingChildOf] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<{ id: string; name: string } | null>(null);
  const [actionError, setActionError] = useState<{ id: string; message: string } | null>(null);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submitCreate(parentId: string | null, name: string) {
    const key = parentId ?? ROOT_ERROR_ID;
    setActionError(null);
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, parentId, workspaceId }),
    });
    if (!res.ok) {
      setActionError({ id: key, message: CREATE_ERROR });
      return;
    }
    if (parentId) {
      setCreatingChildOf(null);
      setExpanded((prev) => new Set(prev).add(parentId));
    } else {
      setCreatingRoot(false);
    }
    router.refresh();
  }

  async function submitRename(id: string, name: string) {
    setActionError(null);
    setPendingId(id);
    const res = await fetch(`/api/folders/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setPendingId(null);
    if (!res.ok) {
      setActionError({ id, message: RENAME_ERROR });
      return;
    }
    setRenamingId(null);
    router.refresh();
  }

  function cancelRename() {
    setRenamingId(null);
    setActionError(null);
  }

  async function moveFolderTo(id: string, newParentId: string | null) {
    setActionError(null);
    setPendingId(id);
    const res = await fetch(`/api/folders/${id}/move`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ newParentId }),
    });
    setPendingId(null);
    if (!res.ok) {
      setActionError({ id, message: MOVE_ERROR });
      return;
    }
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    setDeleteError(null);
    const res = await fetch(`/api/folders/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteSubmitting(false);
    if (!res.ok) {
      setDeleteError(DELETE_ERROR);
      return;
    }
    setDeleteTarget(null);
    router.refresh();
  }

  function openMenu(event: MouseEvent, folderId: string, folderName: string) {
    setMenu({ x: event.clientX, y: event.clientY, folderId, folderName });
  }

  const ctx: FolderTreeNodeCtx = {
    folders,
    expanded,
    onToggle: toggle,
    selectedId,
    onSelect: (id) => setSelectedId((prev) => (prev === id ? null : id)),
    renamingId,
    onRenameSubmit: submitRename,
    onRenameCancel: cancelRename,
    pendingId,
    draggedId,
    onDragStart: setDraggedId,
    onDragEnd: () => setDraggedId(null),
    onDropOn: (targetId) => {
      if (draggedId) void moveFolderTo(draggedId, targetId);
    },
    creatingChildOf,
    onSubmitCreateChild: submitCreate,
    onCancelCreateChild: () => {
      setCreatingChildOf(null);
      setActionError(null);
    },
    onOpenMenu: openMenu,
    errorFor: (id) => (actionError?.id === id ? actionError.message : null),
  };

  const menuItems: FolderMenuItem[] = menu
    ? [
        { label: "새 하위 폴더", icon: FolderPlus, onClick: () => setCreatingChildOf(menu.folderId) },
        { label: "이름 변경", icon: Pencil, onClick: () => setRenamingId(menu.folderId) },
        {
          label: "이동...",
          icon: FolderInput,
          onClick: () => setMoveTarget({ id: menu.folderId, name: menu.folderName }),
        },
        {
          label: "삭제",
          icon: Trash2,
          destructive: true,
          onClick: () => setDeleteTarget({ id: menu.folderId, name: menu.folderName }),
        },
      ]
    : [];

  return (
    <nav className={styles.sidebar} aria-label="폴더 트리">
      <div className={styles.header}>
        <span className={styles.headerLabel}>폴더</span>
        <button
          type="button"
          className={styles.headerButton}
          aria-label="새 폴더"
          onClick={() => setCreatingRoot(true)}
        >
          <FolderPlus size={16} />
        </button>
      </div>
      <div className={styles.tree}>
        {creatingRoot && (
          <CreateRootInput
            onSubmit={(name) => submitCreate(null, name)}
            onCancel={() => {
              setCreatingRoot(false);
              setActionError(null);
            }}
            error={actionError?.id === ROOT_ERROR_ID ? actionError.message : null}
          />
        )}
        {tree.length === 0 && !creatingRoot && (
          <p className={styles.empty}>
            폴더가 없어요
            <br />
            새 폴더를 만들어 문서를 정리해 보세요.
          </p>
        )}
        {tree.map((node) => (
          <FolderTreeNode key={node.id} node={node} depth={0} ctx={ctx} />
        ))}
      </div>
      {menu && <FolderContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />}
      {deleteTarget && (
        <ConfirmDialog
          open
          title={`'${deleteTarget.name}' 폴더를 삭제할까요?`}
          onCancel={() => {
            setDeleteTarget(null);
            setDeleteError(null);
          }}
          onConfirm={confirmDelete}
          confirmLabel={deleteSubmitting ? "삭제하는 중…" : "삭제"}
          confirmDisabled={deleteSubmitting}
          destructive
        >
          <p>하위 폴더와 문서가 함께 휴지통으로 이동합니다. 휴지통에서 복원할 수 있어요.</p>
          {deleteError && <p className={nodeStyles.error}>{deleteError}</p>}
        </ConfirmDialog>
      )}
      {moveTarget && (
        <MoveFolderModal
          open
          folderId={moveTarget.id}
          folderName={moveTarget.name}
          folders={folders}
          onClose={() => setMoveTarget(null)}
        />
      )}
    </nav>
  );
}

function CreateRootInput({
  onSubmit,
  onCancel,
  error,
}: {
  onSubmit: (name: string) => void;
  onCancel: () => void;
  error: string | null;
}) {
  const [value, setValue] = useState("");

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && value.trim()) {
      const parsed = folderSchema.safeParse({ name: value });
      if (parsed.success) onSubmit(parsed.data.name);
    }
    if (event.key === "Escape") onCancel();
  }

  return (
    <div>
      <div className={styles.node} style={{ paddingLeft: 8 }}>
        <input
          className={styles.inlineInput}
          placeholder="새 폴더"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={onCancel}
          autoFocus
        />
      </div>
      {error && <p className={nodeStyles.error}>{error}</p>}
    </div>
  );
}
