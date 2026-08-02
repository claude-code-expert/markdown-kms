"use client";

// Renders the shared markdown pipeline's React output (lib/markdown/pipeline.ts,
// TRD §5 — single source, shared with Phase 8 presentation later). The pipeline's
// sanitize stage (rehype-sanitize/defaultSchema) is the only place unsafe content
// is ever dropped; this component never uses dangerouslySetInnerHTML (T-02-01).
import { renderMarkdown } from "@/lib/markdown/pipeline";
import styles from "./PreviewPane.module.css";

interface PreviewPaneProps {
  content: string;
}

export function PreviewPane({ content }: PreviewPaneProps) {
  if (!content.trim()) {
    return (
      <div className={styles.pane} data-testid="preview-pane">
        <p className={styles.state}>여기에 미리보기가 표시됩니다</p>
      </div>
    );
  }

  try {
    return (
      <div className={styles.pane} data-testid="preview-pane">
        {renderMarkdown(content)}
      </div>
    );
  } catch {
    // Sanitize-stripped content is dropped silently upstream — this catch only
    // guards a pipeline exception itself (UI-SPEC Copywriting Error state;
    // T-02-05). Never echoes the offending content back to the user.
    return (
      <div className={styles.pane} data-testid="preview-pane">
        <p className={styles.state}>미리보기를 표시할 수 없어요.</p>
      </div>
    );
  }
}
