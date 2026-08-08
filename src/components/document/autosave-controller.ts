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

  function fire(content: string, title: string) {
    seq += 1;
    const sentSeq = seq;
    latestSentSeq = sentSeq;
    onStatus("saving");
    send(content, title, sentSeq)
      .then((res) => {
        // Response arrived out of order (a newer save was sent after this one) — discard
        // silently. The request itself was never cancelled; only its effect on the status
        // bar is suppressed (TRD §7 / NFR-1.2).
        if (sentSeq !== latestSentSeq) return;
        onStatus(res.ok ? "saved" : "error");
      })
      .catch(() => {
        if (sentSeq !== latestSentSeq) return;
        onStatus("error");
      });
  }

  return {
    scheduleSave(content, title) {
      pending = { content, title };
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        if (pending) fire(pending.content, pending.title);
      }, DEBOUNCE_MS);
    },
    retry() {
      if (pending) fire(pending.content, pending.title);
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
