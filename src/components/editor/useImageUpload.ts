"use client";

// EDIT-09 upload orchestration (RESEARCH Pattern 1/2, Pitfall 2). Lives at
// EditorPreviewLayout's level, not inside plugins/image.ts — the plugin stays a pure
// run(state) function (TRD §6), this hook is the non-plugin concern that owns fetch +
// dispatch. Placeholder position is tracked by literal string search (Pattern 2), not
// CodeMirror decorations: the upload is async, so the (from, to) offset captured at
// dispatch time can be invalidated by the user's own further edits before the response
// returns — searching for the fixed placeholder text avoids the changes-mapping
// bookkeeping that coordinate tracking would require.
import { useCallback, useRef, useState, type ChangeEvent } from "react";
import { useParams } from "next/navigation";
import type { EditorView } from "@codemirror/view";

const PLACEHOLDER = "![업로드 중...]()";
// UI-SPEC Copywriting Contract "일반 실패" — used only when the server never responded at all
// (fetch itself threw, e.g. offline). Size/format failures use the server's own 400 body.error,
// which already contains the exact TOO_LARGE/BAD_TYPE copy (route.ts) — no duplication here.
const GENERIC_UPLOAD_ERROR = "이미지를 업로드하지 못했어요. 다시 시도해 주세요.";

// WR-01 (05-REVIEW): file.name is client-controlled and never validated server-side — strip
// markdown-structural characters before splicing it into alt text, so a crafted filename
// (e.g. `x](evil) [y`) can't close the alt early and inject a sibling markdown link/image.
export function sanitizeAlt(name: string): string {
  return name.replace(/[[\]()`\r\n]/g, "");
}

/**
 * @param endpoint 업로드를 받을 라우트. 로컬 디스크(`/api/uploads`)와 R2(`/api/uploads/r2`)가
 *   같은 요청·응답 계약(multipart `file` → `{ url }` / `{ error }`)을 쓰므로, 훅을 복제하지
 *   않고 이 인자만 바꿔 두 번 인스턴스화한다. 플레이스홀더·에러 처리 로직이 한 벌로 유지된다.
 */
export function useImageUpload(
  getView: () => EditorView | null,
  endpoint: string = "/api/uploads",
) {
  const params = useParams<{ wsId?: string }>();
  const wsId = params?.wsId;
  const inputRef = useRef<HTMLInputElement>(null);
  // Pitfall 2: a single in-flight flag rather than a queue — UI-SPEC defines no multi-upload
  // UI, so a second attempt while one is pending is simply ignored (button click no-ops).
  const uploadingRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const openFilePicker = useCallback(() => {
    if (uploadingRef.current) return;
    inputRef.current?.click();
  }, []);

  const dismissError = useCallback(() => setErrorMessage(null), []);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      event.target.value = ""; // allow re-selecting the same file on a later attempt
      if (!file || uploadingRef.current || !wsId) return;

      const view = getView();
      if (!view) return;

      uploadingRef.current = true;
      setErrorMessage(null); // a new attempt replaces any stale banner (UI-SPEC: no auto-timer)
      const insertAt = view.state.selection.main.from;
      view.dispatch({ changes: { from: insertAt, insert: PLACEHOLDER } });

      const removePlaceholder = () => {
        const currentView = getView();
        if (!currentView) return;
        const doc = currentView.state.doc.toString();
        const at = doc.indexOf(PLACEHOLDER);
        if (at === -1) return; // user already edited the placeholder away — nothing to remove
        currentView.dispatch({ changes: { from: at, to: at + PLACEHOLDER.length, insert: "" } });
      };

      try {
        const formData = new FormData();
        formData.set("file", file);
        const res = await fetch(`${endpoint}?wsId=${wsId}`, { method: "POST", body: formData });
        const body: { url?: string; error?: string } = await res.json().catch(() => ({}));

        if (res.ok && body.url) {
          const currentView = getView();
          if (!currentView) return;
          const doc = currentView.state.doc.toString();
          const at = doc.indexOf(PLACEHOLDER);
          if (at === -1) return; // user already edited the placeholder away — nothing to replace
          currentView.dispatch({
            changes: {
              from: at,
              to: at + PLACEHOLDER.length,
              insert: `![${sanitizeAlt(file.name)}](${body.url})`,
            },
          });
        } else {
          removePlaceholder();
          setErrorMessage(body.error ?? GENERIC_UPLOAD_ERROR);
        }
      } catch {
        // fetch itself threw (network down) — no response body to read, use the generic copy
        removePlaceholder();
        setErrorMessage(GENERIC_UPLOAD_ERROR);
      } finally {
        uploadingRef.current = false;
      }
    },
    [getView, wsId, endpoint],
  );

  return { inputRef, openFilePicker, handleFileChange, errorMessage, dismissError };
}
