"use client";

// Assemblable 2-pane host (D-P2-01/03): height:100% only — Phase 4 wraps this
// with a tree sidebar + status bar without touching editor/preview internals.
// initialContent/onChange are optional (Phase 4 DocumentWorkspace passes both to wire
// server-loaded content + autosave; standalone callers keep the old non-persistent behavior).
//
// Pitfall 6 (05-RESEARCH): forwardRef + useImperativeHandle exposes getView to callers ABOVE
// this component (mirrors EditorHost's own handle pattern) — 05-05's draft recovery reuses the
// exact same handle, dispatching straight into the live, uncontrolled EditorView.
import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
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

export type LayoutMode = "split" | "editor-only" | "preview-only";

// UI-SPEC Split-Pane Resize Contract: 20-80% (neither pane may shrink to
// near-invisible). Exported standalone — tests/layout/resize-clamp.test.ts
// (05-08 Task 1, TDD) asserts the boundary without mounting the component,
// and it's also applied to the RSC-sourced initial ratio below so a
// tampered splitRatio cookie (T-05-08-COOKIE) can't render out of range.
export function clampRatio(pct: number): number {
  return Math.min(80, Math.max(20, pct));
}

interface EditorPreviewLayoutProps {
  initialContent?: string;
  onChange?: (content: string) => void;
  layoutMode?: LayoutMode;
  onLayoutModeChange?: (next: LayoutMode) => void;
  initialSplitRatio?: number;
}

export const EditorPreviewLayout = forwardRef<EditorPreviewLayoutHandle, EditorPreviewLayoutProps>(
  function EditorPreviewLayout(
    { initialContent, onChange, layoutMode = "split", onLayoutModeChange, initialSplitRatio = 50 },
    ref,
  ) {
    const [content, setContent] = useState(initialContent ?? "");
    const [isDraggingFile, setIsDraggingFile] = useState(false);
    const [ratio, setRatio] = useState(() => clampRatio(initialSplitRatio));
    // mousemove's onMove closure captures ratio at drag-start time, so mouseup
    // reads the latest value through a ref instead (RESEARCH Pattern 7).
    const ratioRef = useRef(ratio);
    ratioRef.current = ratio;
    const gridRef = useRef<HTMLDivElement>(null);
    const hostRef = useRef<EditorHostHandle>(null);
    const getView = () => hostRef.current?.getView() ?? null;

    useImperativeHandle(ref, () => ({ getView }));

    // EDIT-09 tracer: upload orchestration is owned here (RESEARCH Pattern 1), not by the
    // Toolbar or the image plugin — Toolbar only intercepts the click to open this hidden input.
    const { inputRef, openFilePicker, handleFileChange, errorMessage, dismissError } =
      useImageUpload(getView);

    // R2 업로드 — 같은 훅을 엔드포인트만 바꿔 한 번 더 인스턴스화한다. 플레이스홀더 삽입·치환,
    // 중복 업로드 가드, 에러 문구 처리가 로컬 경로와 한 벌로 유지된다.
    const {
      inputRef: cloudInputRef,
      openFilePicker: openCloudFilePicker,
      handleFileChange: handleCloudFileChange,
      errorMessage: cloudErrorMessage,
      dismissError: dismissCloudError,
    } = useImageUpload(getView, "/api/uploads/r2");

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

    // RESEARCH Pattern 7: drag starts on the 6px handle, but mousemove/mouseup
    // are tracked on window (not the handle) so a fast drag that outruns the
    // 6px hit area keeps updating. splitRatio is written to the cookie exactly
    // once, on mouseup — UI-SPEC "저장 시점" forbids a write per mousemove.
    function handleResizeMouseDown(event: ReactMouseEvent<HTMLDivElement>) {
      event.preventDefault();
      const container = gridRef.current;
      if (!container) return;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none"; // Pitfall 10: no stray text selection mid-drag

      function onMove(moveEvent: MouseEvent) {
        const rect = container!.getBoundingClientRect();
        setRatio(clampRatio(((moveEvent.clientX - rect.left) / rect.width) * 100));
      }

      function onUp() {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.cookie = `splitRatio=${ratioRef.current}; path=/; max-age=31536000; samesite=lax`;
      }

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    }

    const showEditor = layoutMode !== "preview-only";
    const showPreview = layoutMode !== "editor-only";
    // Fixed .module.css grid-template-columns/-areas assume 2 columns; override
    // both inline per mode (UI-SPEC "값만 조건부" — class names stay fixed).
    const gridStyle =
      layoutMode === "split"
        ? { gridTemplateColumns: `${ratio}% minmax(0, 1fr)` }
        : layoutMode === "editor-only"
          ? { gridTemplateColumns: "1fr", gridTemplateAreas: '"editor"' }
          : { gridTemplateColumns: "1fr", gridTemplateAreas: '"preview"' };

    return (
      <div className={styles.wrapper}>
        {/* 에디터+프리뷰 전체 폭을 쓰는 단일 툴바 — split 모드에서 좁은 editorPane 폭에
            갇혀 아이콘이 프리뷰 영역까지 넘치던 문제를 없앤다. layoutMode와 무관하게 항상
            렌더한다 — 보기모드 토글이 이 안에 있어서, showEditor에 묶어두면 preview-only로
            전환한 뒤 되돌아올 토글 자체가 사라지는 막다른 상태가 된다. preview-only에서는
            EditorHost가 없어 getView()가 null이라 서식 버튼 클릭은 조용히 무시된다(플러그인
            onClick의 기존 null 가드, Toolbar.tsx). */}
        <Toolbar
          getView={getView}
          onImageButtonClick={openFilePicker}
          onCloudImageButtonClick={openCloudFilePicker}
          layoutMode={layoutMode}
          onLayoutModeChange={onLayoutModeChange}
        />
        <div className={styles.grid} style={gridStyle} ref={gridRef}>
          {showEditor && (
            <div
              className={styles.editorPane}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {/* content (not the initialContent prop) so toggling out of and back into
                  preview-only re-mounts EditorHost with the latest doc, not the stale
                  first-mount value (EditorHost is uncontrolled/mount-once, RESEARCH Pitfall 3) */}
              <EditorHost ref={hostRef} initialContent={content} onChange={handleChange} />
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={handleFileChange}
                style={{ display: "none" }}
                aria-label="이미지 파일 선택"
              />
              <input
                ref={cloudInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={handleCloudFileChange}
                style={{ display: "none" }}
                aria-label="클라우드 이미지 파일 선택"
              />
              {isDraggingFile && <ImageDropzone />}
              {/* 두 업로드 경로가 각자 에러 상태를 들고 있지만 배너는 하나만 띄운다 — 한 번에
                  하나만 진행되고, 둘을 동시에 보여줄 자리도 없다. */}
              {errorMessage && <UploadErrorBanner message={errorMessage} onClose={dismissError} />}
              {!errorMessage && cloudErrorMessage && (
                <UploadErrorBanner message={cloudErrorMessage} onClose={dismissCloudError} />
              )}
              {layoutMode === "split" && (
                <div
                  className={styles.resizeHandle}
                  onMouseDown={handleResizeMouseDown}
                  aria-hidden="true"
                />
              )}
            </div>
          )}
          {showPreview && (
            <div className={styles.previewPane}>
              <PreviewPane content={content} />
            </div>
          )}
        </div>
      </div>
    );
  },
);
