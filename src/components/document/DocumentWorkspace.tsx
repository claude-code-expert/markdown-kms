"use client";

// UI-SPEC Document Workspace Contract — 3-row vertical: title input / EditorPreviewLayout
// (unmodified internals, D-P2-03) / SaveStatusBar. Rendered with key={docId} by the parent RSC
// page so switching documents fully remounts this tree (title/content local state and the
// useAutosave controller all start fresh — the cleanest fix for RESEARCH Pitfall 2, on top of
// the controller's own reset()/dispose() defense).
import { useRef, useState, type ChangeEvent } from "react";
import { EditorPreviewLayout, type LayoutMode } from "@/components/layout/EditorPreviewLayout";
import { LayoutModeToggle } from "@/components/layout/LayoutModeToggle";
import { SaveStatusBar } from "./SaveStatusBar";
import { useAutosave } from "./useAutosave";
import styles from "./DocumentWorkspace.module.css";

interface DocumentWorkspaceProps {
  docId: string;
  initialTitle: string;
  initialContent: string;
  initialSeq: number;
  // RSC (d/[docId]/page.tsx) reads these from cookies for no-FOUC first render
  // (05-08 Task 3) — default here covers any other/older caller.
  initialLayoutMode?: LayoutMode;
  initialSplitRatio?: number;
}

export function DocumentWorkspace({
  docId,
  initialTitle,
  initialContent,
  initialSeq,
  initialLayoutMode = "split",
  initialSplitRatio = 50,
}: DocumentWorkspaceProps) {
  const [title, setTitle] = useState(initialTitle);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(initialLayoutMode);
  // Body content is owned by EditorPreviewLayout's internal state (D-P2 uncontrolled editor) —
  // this ref just tracks the latest value so a title-only edit can still send the current body.
  const contentRef = useRef(initialContent);
  const { status, scheduleSave, retry } = useAutosave(docId, initialSeq);

  function handleContentChange(next: string) {
    contentRef.current = next;
    scheduleSave(next, title);
  }

  function handleTitleChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    setTitle(next);
    scheduleSave(contentRef.current, next);
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
      <div className={styles.body}>
        <EditorPreviewLayout
          initialContent={initialContent}
          onChange={handleContentChange}
          layoutMode={layoutMode}
          initialSplitRatio={initialSplitRatio}
        />
      </div>
      <SaveStatusBar status={status} onRetry={retry} />
    </div>
  );
}
