"use client";

// Assemblable 2-pane host (D-P2-01/03): height:100% only — Phase 4 wraps this
// with a tree sidebar + status bar without touching editor/preview internals.
// initialContent/onChange are optional (Phase 4 DocumentWorkspace passes both to wire
// server-loaded content + autosave; standalone callers keep the old non-persistent behavior).
import { useRef, useState } from "react";
import { EditorHost, type EditorHostHandle } from "../editor/EditorHost";
import { Toolbar } from "../editor/Toolbar";
import { PreviewPane } from "../preview/PreviewPane";
import styles from "./EditorPreviewLayout.module.css";

interface EditorPreviewLayoutProps {
  initialContent?: string;
  onChange?: (content: string) => void;
}

export function EditorPreviewLayout({ initialContent, onChange }: EditorPreviewLayoutProps = {}) {
  const [content, setContent] = useState(initialContent ?? "");
  const hostRef = useRef<EditorHostHandle>(null);

  function handleChange(next: string) {
    setContent(next);
    onChange?.(next);
  }

  return (
    <div className={styles.grid}>
      <div className={styles.editorPane}>
        <Toolbar getView={() => hostRef.current?.getView() ?? null} />
        <EditorHost ref={hostRef} initialContent={initialContent} onChange={handleChange} />
      </div>
      <div className={styles.previewPane}>
        <PreviewPane content={content} />
      </div>
    </div>
  );
}
