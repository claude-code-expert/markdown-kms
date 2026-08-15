// Pure autosave controller (React-less, zero new dependencies) — the correctness core of
// EDIT-07. `send` is injected so tests can control resolution order without touching real
// fetch/timers beyond vi.useFakeTimers(). NFR-1.2: previous save requests are NEVER cancelled
// (no AbortController, no fetch `signal`) — a stale response is discarded purely by comparing
// its seq against the latest-SENT seq, matching TRD §7's "취소 없이(without cancellation)".
export type SaveStatus = "saving" | "saved" | "error";

export interface AutosaveControllerOptions {
  initialSeq: number;
  send: (content: string, title: string, seq: number) => Promise<{ ok: boolean }>;
  onStatus: (status: SaveStatus) => void;
}

export interface AutosaveController {
  scheduleSave(content: string, title: string): void;
  // Explicit manual-save entry point (a "저장" button, distinct from the debounced autosave):
  // fires immediately with the given content/title, cancelling any pending debounce timer first
  // so the same edit is never sent twice. Shares `fire`'s seq bump / stale-response-discard path,
  // so a manual save and a debounced save racing each other resolve the same way any two
  // `scheduleSave` calls would (latest-sent seq wins, TRD §7). Returns whether THIS call's
  // response actually landed ok — the caller (a "저장되었습니다" confirmation dialog) needs the
  // real outcome, not the debounce path's fire-and-forget status callback.
  saveNow(content: string, title: string): Promise<boolean>;
  retry(): void;
  reset(initialSeq: number): void;
  dispose(): void;
}

const DEBOUNCE_MS = 1000;

export function createAutosaveController({
  initialSeq,
  send,
  onStatus,
}: AutosaveControllerOptions): AutosaveController {
  let seq = initialSeq;
  let latestSentSeq = initialSeq;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: { content: string; title: string } | null = null;

  function fire(content: string, title: string): Promise<boolean> {
    seq += 1;
    const sentSeq = seq;
    latestSentSeq = sentSeq;
    onStatus("saving");
    return send(content, title, sentSeq)
      .then((res) => {
        // Response arrived out of order (a newer save was sent after this one) — discard
        // silently. The request itself was never cancelled; only its effect on the status
        // bar is suppressed (TRD §7 / NFR-1.2).
        if (sentSeq !== latestSentSeq) return res.ok;
        onStatus(res.ok ? "saved" : "error");
        return res.ok;
      })
      .catch(() => {
        if (sentSeq === latestSentSeq) onStatus("error");
        return false;
      });
  }

  return {
    scheduleSave(content, title) {
      pending = { content, title };
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        if (pending) void fire(pending.content, pending.title);
      }, DEBOUNCE_MS);
    },
    saveNow(content, title) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      pending = { content, title };
      return fire(content, title);
    },
    retry() {
      if (pending) void fire(pending.content, pending.title);
    },
    reset(newInitialSeq) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      seq = newInitialSeq;
      latestSentSeq = newInitialSeq;
      pending = null;
    },
    dispose() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}
