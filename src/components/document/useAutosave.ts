"use client";

// Thin React wrapper around the pure autosave-controller — owns only the `status` useState and
// the fetch-based `send` closure. All debounce/seq/stale-discard logic lives in the pure
// controller (tested independently in tests/documents/autosave-controller.test.ts).
import { useEffect, useMemo, useState } from "react";
import { createAutosaveController, type SaveStatus } from "./autosave-controller";

export function useAutosave(docId: string, initialSeq: number) {
  const [status, setStatus] = useState<SaveStatus>("saved");

  // Recreated only when docId changes — a document switch gets a brand-new controller instance
  // (Pitfall 2: the old instance's pending timer is cleared by the cleanup below, so a
  // half-typed save from the previous document can never fire against the new one).
  const controller = useMemo(
    () =>
      createAutosaveController({
        initialSeq,
        send: async (content, title, seq) => {
          const res = await fetch(`/api/documents/${docId}`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ content, title, seq }),
          });
          return { ok: res.ok };
        },
        onStatus: setStatus,
      }),
    // initialSeq is deliberately excluded: it only matters at controller construction time;
    // later changes are applied via reset() in the effect below, not by recreating the
    // controller (recreating on every initialSeq render would defeat memoization entirely).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [docId],
  );

  useEffect(() => {
    controller.reset(initialSeq);
    setStatus("saved");
    return () => controller.dispose();
  }, [controller, initialSeq]);

  return { status, scheduleSave: controller.scheduleSave, retry: controller.retry };
}
