"use client";

import { useMemo, useState, type DragEvent as ReactDragEvent, type KeyboardEvent, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertCircle,
  Download,
  FilePlus2,
  FileText,
  FolderDown,
  FolderPlus,
  Pencil,
  FolderInput,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { documentSchema, folderSchema } from "@/lib/validation";
import { DocumentTreeLeaf } from "./DocumentTreeLeaf";
import { downloadExport } from "./download-export";
import { buildTree, type DocumentRow, type DraggedItem, type FolderRow } from "./tree-utils";
import { FolderTreeNode, type FolderTreeNodeCtx } from "./FolderTreeNode";
import { FolderContextMenu, type FolderMenuItem } from "./FolderContextMenu";
import { MoveFolderModal } from "./MoveFolderModal";
import { SearchBox, SearchResultsList, useSearchResults } from "./SearchBox";
import { ToneToggle } from "@/components/layout/ToneToggle";
import nodeStyles from "./FolderTreeNode.module.css";
import styles from "./FolderTree.module.css";

const CREATE_ERROR = "폴더를 만들지 못했어요. 다시 시도해 주세요.";
const RENAME_ERROR = "이름을 변경하지 못했어요. 다시 시도해 주세요.";
const MOVE_ERROR = "폴더를 이동하지 못했어요. 다시 시도해 주세요.";
const MOVE_DOCUMENT_ERROR = "문서를 이동하지 못했어요. 다시 시도해 주세요.";
const DELETE_ERROR = "폴더를 삭제하지 못했어요. 다시 시도해 주세요.";
const CREATE_DOCUMENT_ERROR = "문서를 만들지 못했어요. 다시 시도해 주세요.";
const DELETE_DOCUMENT_ERROR = "문서를 삭제하지 못했어요. 다시 시도해 주세요.";
const EXPORT_ERROR = "내보내기에 실패했어요. 다시 시도해 주세요.";
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
  const [dragged, setDragged] = useState<DraggedItem | null>(null);
  const [rootDropActive, setRootDropActive] = useState(false);
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
  const [exportError, setExportError] = useState(false);
  const search = useSearchResults(workspaceId);
  const searchActive = search.status !== "idle";

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

  // FolderPathPicker(문서 제목 앞 브레드크럼 드롭다운, 06-08)가 이미 쓰던 것과 같은
  // POST /api/documents/:id/move — 여기서는 트리 D&D의 드롭 결과로 호출한다.
  async function moveDocumentTo(id: string, newFolderId: string | null) {
    setActionError(null);
    setPendingId(id);
    const res = await fetch(`/api/documents/${id}/move`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ newFolderId }),
    });
    setPendingId(null);
    if (!res.ok) {
      setActionError({ id, message: MOVE_DOCUMENT_ERROR });
      return;
    }
    router.refresh();
  }

  function handleRootDragOver(event: ReactDragEvent<HTMLDivElement>) {
    if (!dragged) return;
    event.preventDefault();
    setRootDropActive(true);
  }

  function handleRootDrop(event: ReactDragEvent<HTMLDivElement>) {
    event.preventDefault();
    setRootDropActive(false);
    if (!dragged) return;
    if (dragged.type === "folder") void moveFolderTo(dragged.id, null);
    else void moveDocumentTo(dragged.id, null);
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
    // confirmDeleteDocument와 같은 이유로 순서를 push 먼저: refresh()를 push()보다 먼저 부르면
    // 곧이어 시작되는 네비게이션이 그 RSC 재조회를 가로채 유실시켜(레이아웃의 문서 목록이
    // 새로고침되지 않은 채로 남는다), 방금 만든 루트 문서가 사이드바에 안 보이는 채로 새
    // 문서 화면에 진입하게 된다.
    router.push(`/w/${workspaceId}/d/${created.id}`);
    router.refresh();
  }

  // EXP-01/EXP-02 — UI-SPEC Export Menu Contract: no downloading-state UI (browser download
  // chrome owns progress), no success toast (file landing in Downloads is the feedback), only a
  // failure banner. Falls back to "제목 없음" for a blank title, matching the tree's own display
  // fallback (DocumentTreeLeaf/FolderTreeNode).
  async function exportDocument(docId: string, docTitle: string) {
    const ok = await downloadExport(`/api/documents/${docId}/export`, `${docTitle || "제목 없음"}.md`);
    if (!ok) setExportError(true);
  }

  async function exportFolder(folderId: string, folderName: string) {
    const ok = await downloadExport(`/api/folders/${folderId}/export`, `${folderName || "제목 없음"}.zip`);
    if (!ok) setExportError(true);
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
    dragged,
    onDragStart: setDragged,
    onDragEnd: () => setDragged(null),
    onDropOn: (targetId) => {
      if (!dragged) return;
      if (dragged.type === "folder") void moveFolderTo(dragged.id, targetId);
      else void moveDocumentTo(dragged.id, targetId);
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

  // EXP-02 / UI-SPEC Export Menu Contract: ".zip 내보내기" sits after "이동...", before "삭제" —
  // destructive items stay array-last.
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
          label: ".zip 내보내기",
          icon: FolderDown,
          onClick: () => exportFolder(menu.folderId, menu.folderName),
        },
        {
          label: "삭제",
          icon: Trash2,
          destructive: true,
          onClick: () => setDeleteTarget({ id: menu.folderId, name: menu.folderName }),
        },
      ]
    : [];

  // UI-SPEC Tree Node Contract — document nodes get a 2-item menu (no rename/move entry
  // points; renaming happens in the document's own title input, moving is out of scope/YAGNI).
  // EXP-01 / UI-SPEC Export Menu Contract: ".md 내보내기" before "삭제".
  const docMenuItems: FolderMenuItem[] = docMenu
    ? [
        {
          label: ".md 내보내기",
          icon: Download,
          onClick: () => exportDocument(docMenu.docId, docMenu.docTitle),
        },
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
      <SearchBox
        query={search.query}
        onQueryChange={search.setQuery}
        onClear={search.clear}
        loading={search.status === "loading"}
      />
      <div className={styles.header}>
        <span className={styles.headerLabel}>FOLDERS</span>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.headerButton}
            aria-label="새 폴더"
            onClick={() => setCreatingRoot(true)}
          >
            <FolderPlus size={17} />
          </button>
          <button
            type="button"
            className={styles.headerButton}
            aria-label="새 문서"
            onClick={() => setCreatingDocumentRoot(true)}
          >
            <FilePlus2 size={17} />
          </button>
        </div>
      </div>
      {/* 드래그 중에만 눈에 보이는 "루트로 이동" 드롭존 — 항상 렌더하고 visibility로만 토글한다.
          {dragged && ...}로 조건부 마운트하면 드래그 시작 순간 트리 전체가 그만큼 아래로
          밀려서, 드래그 중인 좌표 기반 동작(e2e dragTo 포함)이 어긋난다(레이아웃 시프트).
          항상 자리를 차지해두면 그 문제가 없다. 트리가 꽉 차 빈 공간이 없어도 루트로 뺄 수
          있어야 해서 트리 바깥(header 바로 아래) 고정 위치에 둔다. */}
      <div
        className={[
          styles.rootDropZone,
          dragged ? styles.rootDropZoneVisible : "",
          rootDropActive ? styles.rootDropZoneActive : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onDragOver={handleRootDragOver}
        onDragLeave={() => setRootDropActive(false)}
        onDrop={handleRootDrop}
      >
        워크스페이스 루트로 이동
      </div>
      {/* UI-SPEC Export Menu Contract "error" — sits above whichever of .tree/.searchResults is
          showing; no auto-dismiss timer (same principle as RestoreRootBanner/UploadErrorBanner). */}
      {exportError && (
        <div className={styles.exportErrorBanner} role="alert">
          <AlertCircle size={16} className={styles.exportErrorIcon} />
          <p className={styles.exportErrorText}>{EXPORT_ERROR}</p>
          <button
            type="button"
            className={styles.exportErrorClose}
            aria-label="내보내기 실패 안내 닫기"
            onClick={() => setExportError(false)}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {searchActive ? (
        <SearchResultsList
          workspaceId={workspaceId}
          status={search.status}
          query={search.query}
          results={search.results}
          onRetry={search.retry}
        />
      ) : (
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
            <DocumentTreeLeaf
              key={doc.id}
              doc={doc}
              depth={0}
              workspaceId={workspaceId}
              onOpenMenu={openDocMenu}
              dragged={dragged}
              onDragStart={setDragged}
              onDragEnd={() => setDragged(null)}
              error={actionError?.id === doc.id ? actionError.message : null}
            />
          ))}
        </div>
      )}
      {/* 리디자인(1a 목업) — 휴지통/멤버/톤세그먼트를 하나의 border-top 그룹으로 묶는다
          (개별 border-top 대신 그룹 전체를 감싸는 6px 패딩 박스). */}
      <div className={styles.bottomGroup}>
        <Link
          href={`/w/${workspaceId}/trash`}
          className={[styles.trashLink, pathname === `/w/${workspaceId}/trash` ? styles.trashLinkActive : ""]
            .filter(Boolean)
            .join(" ")}
        >
          <Trash2 size={14} />
          <span>휴지통</span>
        </Link>
        <Link
          href={`/w/${workspaceId}/members`}
          className={[styles.membersLink, pathname === `/w/${workspaceId}/members` ? styles.membersLinkActive : ""]
            .filter(Boolean)
            .join(" ")}
        >
          <Users size={14} />
          <span>멤버</span>
        </Link>
        <ToneToggle />
      </div>
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
  onSubmit: (name: string) => void | Promise<void>;
  onCancel: () => void;
  error: string | null;
}) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // IME(한글 등) 조합 확정 Enter도 keydown "Enter"를 발생시켜, 체크 없으면 확정+제출 두 번 발화.
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter" && value.trim() && !submitting) {
      const parsed = folderSchema.safeParse({ name: value });
      if (parsed.success) {
        setSubmitting(true);
        Promise.resolve(onSubmit(parsed.data.name)).finally(() => setSubmitting(false));
      }
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
          disabled={submitting}
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
  onSubmit: (title: string) => void | Promise<void>;
  onCancel: () => void;
  error: string | null;
}) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter" && value.trim() && !submitting) {
      const parsed = documentSchema.pick({ title: true }).safeParse({ title: value });
      if (parsed.success) {
        setSubmitting(true);
        Promise.resolve(onSubmit(parsed.data.title)).finally(() => setSubmitting(false));
      }
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
          disabled={submitting}
          autoFocus
        />
      </div>
      {error && <p className={nodeStyles.error}>{error}</p>}
    </div>
  );
}
