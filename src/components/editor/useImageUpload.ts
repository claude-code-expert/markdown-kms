"use client";

// EDIT-09 upload orchestration (RESEARCH Pattern 1/2, Pitfall 2). Lives at
// EditorPreviewLayout's level, not inside plugins/image.ts — the plugin stays a pure
// run(state) function (TRD §6), this hook is the non-plugin concern that owns fetch +
// dispatch. Placeholder position is tracked by literal string search (Pattern 2), not
// CodeMirror decorations: the upload is async, so the (from, to) offset captured at
// dispatch time can be invalidated by the user's own further edits before the response
// returns — searching for the fixed placeholder text avoids the changes-mapping
// bookkeeping that coordinate tracking would require.
import { useCallback, useRef, type ChangeEvent } from "react";
import { useParams } from "next/navigation";
import type { EditorView } from "@codemirror/view";

const PLACEHOLDER = "![업로드 중...]()";

export function useImageUpload(getView: () => EditorView | null) {
  const params = useParams<{ wsId?: string }>();
  const wsId = params?.wsId;
  const inputRef = useRef<HTMLInputElement>(null);
  // Pitfall 2: a single in-flight flag rather than a queue — UI-SPEC defines no multi-upload
  // UI, so a second attempt while one is pending is simply ignored (button click no-ops).
  const uploadingRef = useRef(false);

  const openFilePicker = useCallback(() => {
    if (uploadingRef.current) return;
    inputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      event.target.value = ""; // allow re-selecting the same file on a later attempt
      if (!file || uploadingRef.current || !wsId) return;

      const view = getView();
      if (!view) return;

      uploadingRef.current = true;
      const insertAt = view.state.selection.main.from;
      view.dispatch({ changes: { from: insertAt, insert: PLACEHOLDER } });

      try {
        const formData = new FormData();
        formData.set("file", file);
        const res = await fetch(`/api/uploads?wsId=${wsId}`, { method: "POST", body: formData });
        const body: { url?: string } = await res.json().catch(() => ({}));

        const currentView = getView();
        if (!currentView) return;
        const doc = currentView.state.doc.toString();
        const at = doc.indexOf(PLACEHOLDER);
        if (at === -1) return; // user already edited the placeholder away — nothing to replace

        if (res.ok && body.url) {
          currentView.dispatch({
            changes: { from: at, to: at + PLACEHOLDER.length, insert: `![${file.name}](${body.url})` },
          });
        } else {
          currentView.dispatch({ changes: { from: at, to: at + PLACEHOLDER.length, insert: "" } });
        }
      } finally {
        uploadingRef.current = false;
      }
    },
    [getView, wsId],
  );

  return { inputRef, openFilePicker, handleFileChange };
}
