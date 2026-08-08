// Pure draft controller (React-less, zero new dependencies) — mirrors autosave-controller.ts's
// design (send injected, testable with vi.useFakeTimers() alone), but the firing rule differs:
// autosave debounces on input (setTimeout reset), draft fires on a fixed interval gated by a
// dirty flag (TRD §7 "마지막 임시 저장 후 입력이 있었을 때만 1분 타이머가 upsert"). No seq
// guard/retry here — draft has no ordering concept, unlike autosave's stale-response discard.
export interface DraftControllerOptions {
  send: (content: string) => Promise<{ ok: boolean }>;
  intervalMs?: number; // default 60_000, override only for tests
}

export interface DraftController {
  onContentChange(content: string): void;
  dispose(): void;
}

export function createDraftController({
  send,
  intervalMs = 60_000,
}: DraftControllerOptions): DraftController {
  let dirty = false;
  let latestContent = "";
  const timer = setInterval(() => {
    if (!dirty) return;
    dirty = false;
    void send(latestContent);
  }, intervalMs);

  return {
    onContentChange(content) {
      latestContent = content;
      dirty = true;
    },
    dispose() {
      clearInterval(timer);
    },
  };
}
