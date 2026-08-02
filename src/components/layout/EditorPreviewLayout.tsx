"use client";

// Assemblable 2-pane host (D-P2-01/03): height:100% only — Phase 4 wraps this
// with a tree sidebar + status bar without touching editor/preview internals.
// Owns editor content in local component state only (D-P2-02 non-persistent —
// no document API exists yet; refresh-loses-content is expected behavior).
import { useRef, useState } from "react";
import { EditorHost, type EditorHostHandle } from "../editor/EditorHost";
import { Toolbar } from "../editor/Toolbar";
import { PreviewPane } from "../preview/PreviewPane";
import styles from "./EditorPreviewLayout.module.css";

export function EditorPreviewLayout() {
  const [content, setContent] = useState("");
  const hostRef = useRef<EditorHostHandle>(null);

  return (
    <div className={styles.grid}>
      <div className={styles.editorPane}>
        <Toolbar getView={() => hostRef.current?.getView() ?? null} />
        <EditorHost ref={hostRef} onChange={setContent} />
      </div>
      <div className={styles.previewPane}>
        <PreviewPane content={content} />
      </div>
    </div>
  );
}
