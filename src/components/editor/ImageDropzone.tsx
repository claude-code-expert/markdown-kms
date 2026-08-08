"use client";

// UI-SPEC Image Upload Contract "hover-drop" — conditionally rendered by the parent
// (EditorPreviewLayout) only while a file is being dragged over .editorPane; never toggled
// via display:none so idle costs zero DOM/reflow. pointer-events:none keeps every drag event
// targeting .editorPane itself (this overlay has no interactive content), which sidesteps the
// classic dragenter/dragleave flicker that comes from a child element entering the hit-test path.
import { Upload } from "lucide-react";
import styles from "./ImageDropzone.module.css";

export function ImageDropzone() {
  return (
    <div className={styles.overlay} aria-hidden="true">
      <Upload size={24} className={styles.icon} />
      <p className={styles.text}>여기에 이미지를 놓아 업로드</p>
    </div>
  );
}
