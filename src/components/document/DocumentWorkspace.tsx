"use client";

// UI-SPEC Document Workspace Contract — 3-row vertical: title input / EditorPreviewLayout
// (unmodified internals, D-P2-03) / SaveStatusBar. Rendered with key={docId} by the parent RSC
// page so switching documents fully remounts this tree (title/content local state and the
// useAutosave controller all start fresh — the cleanest fix for RESEARCH Pitfall 2, on top of
// the controller's own reset()/dispose() defense).
import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  EditorPreviewLayout,
  type EditorPreviewLayoutHandle,
  type LayoutMode,
} from "@/components/layout/EditorPreviewLayout";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import type { FolderRow } from "@/components/tree/tree-utils";
import { DraftRecoveryDialog } from "./DraftRecoveryDialog";
import { FolderPathPicker } from "./FolderPathPicker";
import { SaveStatusBar } from "./SaveStatusBar";
import { TagBar } from "./TagBar";
import { useAutosave } from "./useAutosave";
import { useDraft } from "./useDraft";
import styles from "./DocumentWorkspace.module.css";

// WR-03 (05-REVIEW): pure fetch-result extraction, exported so the failure/rejection paths are
// unit-testable without rendering the component. Never throws — a rejected fetch (offline etc.)
// resolves to false, same as a non-ok response.
export async function discardDraft(docId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/documents/${docId}/draft`, { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}

// Same pure fetch-result extraction as discardDraft — the DELETE route (documents/[id]/route.ts)
// is the existing 04-03 soft-delete endpoint, already EDITOR+/IDOR-enforced server-side; this
// component only decides whether to render the confirm dialog and where to navigate on success.
export async function deleteDocument(docId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/documents/${docId}`, { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}

interface DocumentWorkspaceProps {
  docId: string;
  // Needed only to build the post-delete redirect target (`/w/${workspaceId}`) — never sent to
  // the DELETE route itself, which re-derives workspace_id server-side (IDOR, T-04-03-IDOR).
  workspaceId: string;
  initialTitle: string;
  initialContent: string;
  initialSeq: number;
  // 상위 폴더 브레드크럼 드롭다운(FolderPathPicker)에 그대로 전달 — 사이드바 FolderTree와
  // 같은 flat 목록(getWorkspaceFolders, 1 SQL) 재사용, 별도 API 없음.
  initialFolderId: string | null;
  folders: FolderRow[];
  // RSC (d/[docId]/page.tsx) reads these from cookies for no-FOUC first render
  // (05-08 Task 3) — default here covers any other/older caller.
  initialLayoutMode?: LayoutMode;
  initialSplitRatio?: number;
  // RSC (d/[docId]/page.tsx, 05-05 Task 1) computes these server-side (Pitfall 7 — no client
  // clock comparison) and passes them down; full recovery-dialog wiring lands in Task 3.
  hasNewerDraft?: boolean;
  draftContent?: string | null;
  // 06-02: RSC (d/[docId]/page.tsx) reads getTags(docId) in the same Promise.all as the
  // document/draft lookup and passes the result down — TagBar owns all subsequent local state.
  initialTags?: string[];
  // Server-computed EDITOR+ check (d/[docId]/page.tsx) — gates BOTH the manual "저장" button
  // (saveNow) and the "삭제" button, since both are EDITOR+ writes. Hiding them for a VIEWER is
  // UX only — the PUT/DELETE routes enforce the real boundary. Defaults false so any other/older
  // caller doesn't silently expose a button that would 403.
  canDelete?: boolean;
}

export function DocumentWorkspace({
  docId,
  workspaceId,
  initialTitle,
  initialContent,
  initialSeq,
  initialFolderId,
  folders,
  initialLayoutMode = "split",
  initialSplitRatio = 50,
  hasNewerDraft = false,
  draftContent = null,
  initialTags = [],
  canDelete = false,
}: DocumentWorkspaceProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(initialLayoutMode);
  const [showRecovery, setShowRecovery] = useState(hasNewerDraft);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Body content is owned by EditorPreviewLayout's internal state (D-P2 uncontrolled editor) —
  // this ref just tracks the latest value so a title-only edit can still send the current body.
  const contentRef = useRef(initialContent);
  // 리디자인(PAGE-ANALYSIS.md §0-2) — SaveStatusBar 글자수 카운터용. contentRef는 리렌더를
  // 안 일으키는 ref라 별도 state로 둔다(매 키입력마다 handleContentChange에서 갱신).
  const [charCount, setCharCount] = useState(initialContent.length);
  // Pitfall 6: DocumentWorkspace never imports CodeMirror/EditorView directly — this ref only
  // holds EditorPreviewLayout's forwardRef handle, and dispatch() is reached structurally through
  // getView()'s declared return type, no @codemirror/* import needed in this file.
  const layoutRef = useRef<EditorPreviewLayoutHandle>(null);
  const { status, scheduleSave, saveNow, retry } = useAutosave(docId, initialSeq);
  const draft = useDraft(docId);

  function handleContentChange(next: string) {
    contentRef.current = next;
    setCharCount(next.length);
    scheduleSave(next, title);
    draft.onContentChange(next);
  }

  function handleTitleChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    setTitle(next);
    scheduleSave(contentRef.current, next);
  }

  // Explicit manual save (titleRow "저장" button) — bypasses the 1s debounce and hits the same
  // PUT /api/documents/:id route immediately with the current in-memory title/content, going
  // through the same seq-guarded write path as autosave (TRD §7). Not a second save mechanism:
  // saveNow() shares fire()/the seq counter with scheduleSave(), so a manual save mid-typing and
  // the pending debounced save resolve exactly like two racing scheduleSave calls always do.
  async function handleSaveNow() {
    const ok = await saveNow(contentRef.current, title);
    if (ok) {
      setSaveConfirmOpen(true);
      // 트리(FolderTree)는 RSC 서버 렌더 — title이 바뀌었을 수 있으니 좌측 목록도 다시 가져온다.
      router.refresh();
    }
  }

  // Pattern 5: one dispatch, nothing else. It re-triggers EditorHost's updateListener ->
  // handleContentChange -> scheduleSave, and that autosave's own success is what deletes the
  // draft server-side (documents/[id]/route.ts, 05-04) — no separate force-save/delete call here.
  function handleRestore() {
    const view = layoutRef.current?.getView();
    if (view && draftContent != null) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: draftContent } });
    }
    setShowRecovery(false);
  }

  async function handleDiscard() {
    if (await discardDraft(docId)) setShowRecovery(false);
    // WR-03: on failure, leave the dialog open — the server still has the draft, so closing it
    // would tell the user "discarded" when it wasn't.
  }

  function handleDismiss() {
    // Draft stays on the server — re-prompts next time this page is entered if still newer.
    setShowRecovery(false);
  }

  // Mirrors FolderTree.confirmDeleteDocument's tree-menu delete: same route, same copy, same
  // destructive ConfirmDialog. Unlike the tree (which may or may not have the deleted doc open),
  // this view IS the open document — a successful delete always navigates to the workspace's
  // empty index, no wasOpen check needed.
  async function confirmDelete() {
    setDeleteSubmitting(true);
    setDeleteError(null);
    const ok = await deleteDocument(docId);
    setDeleteSubmitting(false);
    if (!ok) {
      setDeleteError("문서를 삭제하지 못했어요. 다시 시도해 주세요.");
      return;
    }
    setDeleteOpen(false);
    router.push(`/w/${workspaceId}`);
    router.refresh();
  }

  // savedSeq는 문서 생성 시 0에서 시작하고 첫 저장(autosave/수동)에서만 올라간다(TRD §7) — 한
  // 번도 저장된 적 없는 "새 문서"는 저장 버튼만, 이미 저장된 적 있는 문서(조회)는 수정/삭제만
  // 노출한다. initialSeq는 RSC가 마운트 시 1회 읽은 값이라 이 세션 내 첫 저장 이후에도 버튼
  // 세트는 안 바뀌고, 다음에 문서를 다시 열 때(page.tsx 재조회) "조회"로 넘어간다.
  const isNew = initialSeq === 0;
  const actions = canDelete && (
    <>
      {isNew ? (
        <Button type="button" variant="primary" onClick={handleSaveNow}>
          저장
        </Button>
      ) : (
        <>
          <Button type="button" variant="primary" onClick={handleSaveNow}>
            수정
          </Button>
          <Button type="button" variant="danger" onClick={() => setDeleteOpen(true)}>
            삭제
          </Button>
        </>
      )}
    </>
  );

  return (
    <div className={styles.workspace}>
      <div className={styles.titleRow}>
        <FolderPathPicker documentId={docId} folders={folders} initialFolderId={initialFolderId} />
        <input
          className={styles.titleInput}
          value={title}
          onChange={handleTitleChange}
          placeholder="제목 없음"
          aria-label="문서 제목"
        />
      </div>
      <TagBar documentId={docId} initialTags={initialTags} actions={actions} />
      <div className={styles.body}>
        <EditorPreviewLayout
          ref={layoutRef}
          initialContent={initialContent}
          onChange={handleContentChange}
          layoutMode={layoutMode}
          onLayoutModeChange={setLayoutMode}
          initialSplitRatio={initialSplitRatio}
        />
      </div>
      <SaveStatusBar status={status} onRetry={retry} charCount={charCount} />
      <DraftRecoveryDialog
        open={showRecovery}
        onRestore={handleRestore}
        onDiscard={handleDiscard}
        onDismiss={handleDismiss}
      />
      <ConfirmDialog
        open={deleteOpen}
        title={`'${title || "제목 없음"}' 문서를 삭제할까요?`}
        onCancel={() => {
          setDeleteOpen(false);
          setDeleteError(null);
        }}
        onConfirm={confirmDelete}
        confirmLabel={deleteSubmitting ? "삭제하는 중…" : "삭제"}
        confirmDisabled={deleteSubmitting}
        destructive
      >
        <p>휴지통으로 이동합니다. 휴지통에서 복원할 수 있어요.</p>
        {deleteError && <p className={styles.error}>{deleteError}</p>}
      </ConfirmDialog>
      <Modal open={saveConfirmOpen} onClose={() => setSaveConfirmOpen(false)} title="저장 완료">
        <p>저장되었습니다.</p>
        <div className={styles.modalFooter}>
          <Button type="button" variant="primary" onClick={() => setSaveConfirmOpen(false)}>
            확인
          </Button>
        </div>
      </Modal>
    </div>
  );
}
