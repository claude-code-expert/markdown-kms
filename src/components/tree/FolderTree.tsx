"use client";

import { useMemo, useState, type KeyboardEvent, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FilePlus2, FileText, FolderPlus, Pencil, FolderInput, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { documentSchema, folderSchema } from "@/lib/validation";
import { DocumentTreeLeaf } from "./DocumentTreeLeaf";
import { buildTree, type DocumentRow, type FolderRow } from "./tree-utils";
import { FolderTreeNode, type FolderTreeNodeCtx } from "./FolderTreeNode";
import { FolderContextMenu, type FolderMenuItem } from "./FolderContextMenu";
import { MoveFolderModal } from "./MoveFolderModal";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import nodeStyles from "./FolderTreeNode.module.css";
import styles from "./FolderTree.module.css";

const CREATE_ERROR = "폴더를 만들지 못했어요. 다시 시도해 주세요.";
const RENAME_ERROR = "이름을 변경하지 못했어요. 다시 시도해 주세요.";
const MOVE_ERROR = "폴더를 이동하지 못했어요. 다시 시도해 주세요.";
const DELETE_ERROR = "폴더를 삭제하지 못했어요. 다시 시도해 주세요.";
const CREATE_DOCUMENT_ERROR = "문서를 만들지 못했어요. 다시 시도해 주세요.";
const DELETE_DOCUMENT_ERROR = "문서를 삭제하지 못했어요. 다시 시도해 주세요.";
const ROOT_ERROR_ID = "__root__";

interface FolderTreeProps {
  folders: FolderRow[];
  documents: DocumentRow[];
  workspaceId: string;
}

interface MenuState {
  x: number;
  y: number;
  folderId: string;
  folderName: string;
}

interface DocMenuState {
  x: number;
  y: number;
  docId: string;
  docTitle: string;
}

// Owns every piece of transient tree-interaction state (expand/select/drag/menu/modal) —
// FolderTreeNode stays presentational, wired via the FolderTreeNodeCtx bundle. All mutations
// are server-confirmed only (router.refresh() after the fetch resolves — no optimistic UI,
// CONTEXT.md).
export function FolderTree({ folders, documents, workspaceId }: FolderTreeProps) {
  const router = useRouter();
  const pathname = usePathname();
  const tree = buildTree(folders);

  // RESEARCH Pitfall 7 / Anti-pattern: buildTree stays folder-only — documents are grouped by
  // folderId here and merged in at render time (FolderTreeNode ctx.documentsByFolderId).
  const documentsByFolderId = useMemo(() => {
    const map = new Map<string | null, DocumentRow[]>();
    for (const doc of documents) {
      const list = map.get(doc.folderId);
      if (list) list.push(doc);
      else map.set(doc.folderId, [doc]);
    }
    return map;
  }, [documents]);
  const rootDocuments = documentsByFolderId.get(null) ?? [];

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creatingRoot, setCreatingRoot] = useState(false);
  const [creatingDocumentRoot, setCreatingDocumentRoot] = useState(false);
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
  const [docMenu, setDocMenu] = useState<DocMenuState | null>(null);
  const [docDeleteTarget, setDocDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [docDeleteSubmitting, setDocDeleteSubmitting] = useState(false);
  const [docDeleteError, setDocDeleteError] = useState<string | null>(null);

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
    setDocMenu(null); // only one context menu open at a time
    setMenu({ x: event.clientX, y: event.clientY, folderId, folderName });
  }

  function openDocMenu(event: MouseEvent, docId: string, docTitle: string) {
    setMenu(null);
    setDocMenu({ x: event.clientX, y: event.clientY, docId, docTitle });
  }

  // UI-SPEC Interaction Contract "문서 삭제(소프트)" — the currently-open document can't be left
  // dangling in the editor once it's trashed, so a match against the live pathname triggers a
  // navigate-away to the workspace's empty index right after the server confirms the delete.
  async function confirmDeleteDocument() {
    if (!docDeleteTarget) return;
    setDocDeleteSubmitting(true);
    setDocDeleteError(null);
    const res = await fetch(`/api/documents/${docDeleteTarget.id}`, { method: "DELETE" });
    setDocDeleteSubmitting(false);
    if (!res.ok) {
      setDocDeleteError(DELETE_DOCUMENT_ERROR);
      return;
    }
    const wasOpen = pathname === `/w/${workspaceId}/d/${docDeleteTarget.id}`;
    setDocDeleteTarget(null);
    // Navigate first, refresh after: the shared layout (FolderTree's document list) is only
    // re-fetched by refresh() — calling it before an immediately-following push() races the
    // RSC re-fetch against the navigation and can lose the refresh, leaving the just-deleted
    // node visible in the tree after landing on the empty state.
    if (wasOpen) router.push(`/w/${workspaceId}`);
    router.refresh();
  }

  // UI-SPEC Interaction Contract "새 문서 생성" — unlike folder creation, a successful document
  // create both refreshes the tree (new leaf appears) AND navigates straight to the new
  // document (the one deliberate exception to "creation never navigates", per UI-SPEC).
  async function submitCreateDocument(title: string) {
    setActionError(null);
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, folderId: null, workspaceId }),
    });
    if (!res.ok) {
      setActionError({ id: ROOT_ERROR_ID, message: CREATE_DOCUMENT_ERROR });
      return;
    }
    const created = await res.json();
    setCreatingDocumentRoot(false);
    router.refresh();
    router.push(`/w/${workspaceId}/d/${created.id}`);
  }

  const ctx: FolderTreeNodeCtx = {
    folders,
    workspaceId,
    documentsByFolderId,
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
    onOpenDocMenu: openDocMenu,
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

  // UI-SPEC Tree Node Contract — document nodes get a 1-item menu (no rename/move entry
  // points; renaming happens in the document's own title input, moving is out of scope/YAGNI).
  const docMenuItems: FolderMenuItem[] = docMenu
    ? [
        {
          label: "삭제",
          icon: Trash2,
          destructive: true,
          onClick: () => setDocDeleteTarget({ id: docMenu.docId, title: docMenu.docTitle }),
        },
      ]
    : [];

  return (
    <nav className={styles.sidebar} aria-label="폴더 트리">
      <div className={styles.header}>
        <span className={styles.headerLabel}>폴더</span>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.headerButton}
            aria-label="새 폴더"
            onClick={() => setCreatingRoot(true)}
          >
            <FolderPlus size={16} />
          </button>
          <button
            type="button"
            className={styles.headerButton}
            aria-label="새 문서"
            onClick={() => setCreatingDocumentRoot(true)}
          >
            <FilePlus2 size={16} />
          </button>
        </div>
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
        {creatingDocumentRoot && (
          <CreateDocumentRootInput
            onSubmit={submitCreateDocument}
            onCancel={() => {
              setCreatingDocumentRoot(false);
              setActionError(null);
            }}
            error={actionError?.id === ROOT_ERROR_ID ? actionError.message : null}
          />
        )}
        {tree.length === 0 && rootDocuments.length === 0 && !creatingRoot && !creatingDocumentRoot && (
          <p className={styles.empty}>
            폴더가 없어요
            <br />
            새 폴더를 만들어 문서를 정리해 보세요.
          </p>
        )}
        {tree.map((node) => (
          <FolderTreeNode key={node.id} node={node} depth={0} ctx={ctx} />
        ))}
        {rootDocuments.map((doc) => (
          <DocumentTreeLeaf key={doc.id} doc={doc} depth={0} workspaceId={workspaceId} onOpenMenu={openDocMenu} />
        ))}
      </div>
      {/* UI-SPEC Trash Contract "진입" — flex-shrink:0 bottom row below the flex:1 tree, same
          "current location" accent treatment as a selected tree node. */}
      <Link
        href={`/w/${workspaceId}/trash`}
        className={[styles.trashLink, pathname === `/w/${workspaceId}/trash` ? styles.trashLinkActive : ""]
          .filter(Boolean)
          .join(" ")}
      >
        <Trash2 size={16} />
        <span>휴지통</span>
      </Link>
      <ThemeToggle />
      {menu && <FolderContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />}
      {docMenu && (
        <FolderContextMenu x={docMenu.x} y={docMenu.y} items={docMenuItems} onClose={() => setDocMenu(null)} />
      )}
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
      {docDeleteTarget && (
        <ConfirmDialog
          open
          title={`'${docDeleteTarget.title || "제목 없음"}' 문서를 삭제할까요?`}
          onCancel={() => {
            setDocDeleteTarget(null);
            setDocDeleteError(null);
          }}
          onConfirm={confirmDeleteDocument}
          confirmLabel={docDeleteSubmitting ? "삭제하는 중…" : "삭제"}
          confirmDisabled={docDeleteSubmitting}
          destructive
        >
          <p>휴지통으로 이동합니다. 휴지통에서 복원할 수 있어요.</p>
          {docDeleteError && <p className={nodeStyles.error}>{docDeleteError}</p>}
        </ConfirmDialog>
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

// UI-SPEC Interaction Contract "새 문서 생성" — CreateRootInput's document-flavored twin
// (FileText icon, placeholder "새 문서", documentSchema.pick({title:true}) validation). Blank
// submission is disabled client-side even though documentSchema itself allows an empty title
// (the server default) — UI-SPEC: "빈 값 제출 비활성화(클라이언트 최소 가드)".
function CreateDocumentRootInput({
  onSubmit,
  onCancel,
  error,
}: {
  onSubmit: (title: string) => void;
  onCancel: () => void;
  error: string | null;
}) {
  const [value, setValue] = useState("");

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && value.trim()) {
      const parsed = documentSchema.pick({ title: true }).safeParse({ title: value });
      if (parsed.success) onSubmit(parsed.data.title);
    }
    if (event.key === "Escape") onCancel();
  }

  return (
    <div>
      <div className={styles.node} style={{ paddingLeft: 8 }}>
        <FileText size={16} className={nodeStyles.folderIcon} />
        <input
          className={styles.inlineInput}
          placeholder="새 문서"
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
