"use client";

// UI-SPEC Document Workspace Contract — 3-row vertical: title input / EditorPreviewLayout
// (unmodified internals, D-P2-03) / SaveStatusBar. Rendered with key={docId} by the parent RSC
// page so switching documents fully remounts this tree (title/content local state and the
// useAutosave controller all start fresh — the cleanest fix for RESEARCH Pitfall 2, on top of
// the controller's own reset()/dispose() defense).
import { useRef, useState, type ChangeEvent } from "react";
import {
  EditorPreviewLayout,
  type EditorPreviewLayoutHandle,
  type LayoutMode,
} from "@/components/layout/EditorPreviewLayout";
import { LayoutModeToggle } from "@/components/layout/LayoutModeToggle";
import { DraftRecoveryDialog } from "./DraftRecoveryDialog";
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

interface DocumentWorkspaceProps {
  docId: string;
  initialTitle: string;
  initialContent: string;
  initialSeq: number;
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
}

export function DocumentWorkspace({
  docId,
  initialTitle,
  initialContent,
  initialSeq,
  initialLayoutMode = "split",
  initialSplitRatio = 50,
  hasNewerDraft = false,
  draftContent = null,
  initialTags = [],
}: DocumentWorkspaceProps) {
  const [title, setTitle] = useState(initialTitle);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(initialLayoutMode);
  const [showRecovery, setShowRecovery] = useState(hasNewerDraft);
  // Body content is owned by EditorPreviewLayout's internal state (D-P2 uncontrolled editor) —
  // this ref just tracks the latest value so a title-only edit can still send the current body.
  const contentRef = useRef(initialContent);
  // Pitfall 6: DocumentWorkspace never imports CodeMirror/EditorView directly — this ref only
  // holds EditorPreviewLayout's forwardRef handle, and dispatch() is reached structurally through
  // getView()'s declared return type, no @codemirror/* import needed in this file.
  const layoutRef = useRef<EditorPreviewLayoutHandle>(null);
  const { status, scheduleSave, retry } = useAutosave(docId, initialSeq);
  const draft = useDraft(docId);

  function handleContentChange(next: string) {
    contentRef.current = next;
    scheduleSave(next, title);
    draft.onContentChange(next);
  }

  function handleTitleChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    setTitle(next);
    scheduleSave(contentRef.current, next);
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

  return (
    <div className={styles.workspace}>
      <div className={styles.titleRow}>
        <input
          className={styles.titleInput}
          value={title}
          onChange={handleTitleChange}
          placeholder="제목 없음"
          aria-label="문서 제목"
        />
        <LayoutModeToggle mode={layoutMode} onChange={setLayoutMode} />
      </div>
      <TagBar documentId={docId} initialTags={initialTags} />
      <div className={styles.body}>
        <EditorPreviewLayout
          ref={layoutRef}
          initialContent={initialContent}
          onChange={handleContentChange}
          layoutMode={layoutMode}
          initialSplitRatio={initialSplitRatio}
        />
      </div>
      <SaveStatusBar status={status} onRetry={retry} />
      <DraftRecoveryDialog
        open={showRecovery}
        onRestore={handleRestore}
        onDiscard={handleDiscard}
        onDismiss={handleDismiss}
      />
    </div>
  );
}
