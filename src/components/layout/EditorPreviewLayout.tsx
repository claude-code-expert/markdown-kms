"use client";

// Assemblable 2-pane host (D-P2-01/03): height:100% only — Phase 4 wraps this
// with a tree sidebar + status bar without touching editor/preview internals.
// initialContent/onChange are optional (Phase 4 DocumentWorkspace passes both to wire
// server-loaded content + autosave; standalone callers keep the old non-persistent behavior).
//
// Pitfall 6 (05-RESEARCH): forwardRef + useImperativeHandle exposes getView to callers ABOVE
// this component (mirrors EditorHost's own handle pattern) — 05-05's draft recovery reuses the
// exact same handle, dispatching straight into the live, uncontrolled EditorView.
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import type { EditorView } from "@codemirror/view";
import { EditorHost, type EditorHostHandle } from "../editor/EditorHost";
import { Toolbar } from "../editor/Toolbar";
import { useImageUpload } from "../editor/useImageUpload";
import { PreviewPane } from "../preview/PreviewPane";
import styles from "./EditorPreviewLayout.module.css";

export interface EditorPreviewLayoutHandle {
  getView: () => EditorView | null;
}

interface EditorPreviewLayoutProps {
  initialContent?: string;
  onChange?: (content: string) => void;
}

export const EditorPreviewLayout = forwardRef<EditorPreviewLayoutHandle, EditorPreviewLayoutProps>(
  function EditorPreviewLayout({ initialContent, onChange }, ref) {
    const [content, setContent] = useState(initialContent ?? "");
    const hostRef = useRef<EditorHostHandle>(null);
    const getView = () => hostRef.current?.getView() ?? null;

    useImperativeHandle(ref, () => ({ getView }));

    // EDIT-09 tracer: upload orchestration is owned here (RESEARCH Pattern 1), not by the
    // Toolbar or the image plugin — Toolbar only intercepts the click to open this hidden input.
    const { inputRef, openFilePicker, handleFileChange } = useImageUpload(getView);

    function handleChange(next: string) {
      setContent(next);
      onChange?.(next);
    }

    return (
      <div className={styles.grid}>
        <div className={styles.editorPane}>
          <Toolbar getView={getView} onImageButtonClick={openFilePicker} />
          <EditorHost ref={hostRef} initialContent={initialContent} onChange={handleChange} />
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            onChange={handleFileChange}
            style={{ display: "none" }}
            aria-label="이미지 파일 선택"
          />
        </div>
        <div className={styles.previewPane}>
          <PreviewPane content={content} />
        </div>
      </div>
    );
  },
);
