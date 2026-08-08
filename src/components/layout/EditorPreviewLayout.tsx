"use client";

// Assemblable 2-pane host (D-P2-01/03): height:100% only — Phase 4 wraps this
// with a tree sidebar + status bar without touching editor/preview internals.
// initialContent/onChange are optional (Phase 4 DocumentWorkspace passes both to wire
// server-loaded content + autosave; standalone callers keep the old non-persistent behavior).
//
// Pitfall 6 (05-RESEARCH): forwardRef + useImperativeHandle exposes getView to callers ABOVE
// this component (mirrors EditorHost's own handle pattern) — 05-05's draft recovery reuses the
// exact same handle, dispatching straight into the live, uncontrolled EditorView.
import { forwardRef, useImperativeHandle, useRef, useState, type DragEvent } from "react";
import type { EditorView } from "@codemirror/view";
import { EditorHost, type EditorHostHandle } from "../editor/EditorHost";
import { ImageDropzone } from "../editor/ImageDropzone";
import { Toolbar } from "../editor/Toolbar";
import { useImageUpload } from "../editor/useImageUpload";
import { UploadErrorBanner } from "../editor/UploadErrorBanner";
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
    const [isDraggingFile, setIsDraggingFile] = useState(false);
    const hostRef = useRef<EditorHostHandle>(null);
    const getView = () => hostRef.current?.getView() ?? null;

    useImperativeHandle(ref, () => ({ getView }));

    // EDIT-09 tracer: upload orchestration is owned here (RESEARCH Pattern 1), not by the
    // Toolbar or the image plugin — Toolbar only intercepts the click to open this hidden input.
    const { inputRef, openFilePicker, handleFileChange, errorMessage, dismissError } =
      useImageUpload(getView);

    function handleChange(next: string) {
      setContent(next);
      onChange?.(next);
    }

    // UI-SPEC "트리거 2 — 드래그 드롭": same upload path as the toolbar button. Rather than
    // duplicating useImageUpload's fetch/placeholder logic, the dropped file is fed into the
    // same hidden <input> via a synthetic DataTransfer + "change" event dispatch, so
    // handleFileChange (05-01) runs unmodified for both entry points.
    function handleDragEnter(event: DragEvent<HTMLDivElement>) {
      if (!event.dataTransfer.types.includes("Files")) return;
      event.preventDefault();
      setIsDraggingFile(true);
    }

    function handleDragOver(event: DragEvent<HTMLDivElement>) {
      if (!event.dataTransfer.types.includes("Files")) return;
      event.preventDefault(); // required so the browser allows a drop
    }

    function handleDragLeave(event: DragEvent<HTMLDivElement>) {
      // ImageDropzone has pointer-events:none, so this only fires when the pointer actually
      // leaves .editorPane's bounds — no enter/leave flicker from a child taking the hit-test.
      if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
      setIsDraggingFile(false);
    }

    function handleDrop(event: DragEvent<HTMLDivElement>) {
      event.preventDefault();
      setIsDraggingFile(false);
      const file = event.dataTransfer.files[0];
      if (!file || !inputRef.current) return;
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      inputRef.current.files = dataTransfer.files;
      inputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
    }

    return (
      <div className={styles.grid}>
        <div
          className={styles.editorPane}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
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
          {isDraggingFile && <ImageDropzone />}
          {errorMessage && <UploadErrorBanner message={errorMessage} onClose={dismissError} />}
        </div>
        <div className={styles.previewPane}>
          <PreviewPane content={content} />
        </div>
      </div>
    );
  },
);
