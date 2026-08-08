"use client";

// Thin React wrapper around the pure draft-controller — owns nothing but the memoized instance
// and its dispose-on-unmount effect. No status state (draft saves have no visible feedback,
// UI-SPEC — SaveStatusBar stays autosave-only). All firing logic lives in draft-controller.ts.
import { useEffect, useMemo } from "react";
import { createDraftController } from "./draft-controller";

export function useDraft(docId: string) {
  const controller = useMemo(
    () =>
      createDraftController({
        send: async (content) => {
          const res = await fetch(`/api/documents/${docId}/draft`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ content }),
          });
          return { ok: res.ok };
        },
      }),
    [docId],
  );

  useEffect(() => () => controller.dispose(), [controller]);

  return { onContentChange: controller.onContentChange };
}
