// TDD RED (04-02 Task 2): the pure autosave controller doesn't exist yet. This is the
// correctness core of EDIT-07 — debounce + seq comparison, entirely React-less so it runs under
// plain vitest node env with vi.useFakeTimers() and a manually-resolved injected `send`.
// NFR-1.2 (no cancellation): never AbortController/fetch signal — stale responses are silently
// discarded by comparing against the latest-SENT seq, not by cancelling the request itself.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAutosaveController, type SaveStatus } from "@/components/document/autosave-controller";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createAutosaveController — debounce", () => {
  it("does not call send before 1000ms elapses, and calls exactly once after (last call wins)", () => {
    const send = vi.fn(() => new Promise<{ ok: boolean }>(() => {}));
    const controller = createAutosaveController({ initialSeq: 0, send, onStatus: vi.fn() });

    controller.scheduleSave("a", "title");
    vi.advanceTimersByTime(500);
    controller.scheduleSave("ab", "title"); // resets the pending timer — only the last call fires
    vi.advanceTimersByTime(999);
    expect(send).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("ab", "title", 1);
  });

  it("calls onStatus('saving') exactly when the debounced send fires", () => {
    const send = vi.fn(() => new Promise<{ ok: boolean }>(() => {}));
    const statuses: SaveStatus[] = [];
    const controller = createAutosaveController({
      initialSeq: 0,
      send,
      onStatus: (s) => statuses.push(s),
    });

    controller.scheduleSave("x", "t");
    expect(statuses).toEqual([]);
    vi.advanceTimersByTime(1000);
    expect(statuses).toEqual(["saving"]);
  });
});

describe("createAutosaveController — saveNow (explicit manual-save button)", () => {
  it("fires immediately, without waiting for the 1000ms debounce", () => {
    const send = vi.fn(() => new Promise<{ ok: boolean }>(() => {}));
    const controller = createAutosaveController({ initialSeq: 0, send, onStatus: vi.fn() });

    controller.saveNow("content", "title");

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("content", "title", 1);
  });

  it("cancels a pending debounce timer so the debounced call doesn't ALSO fire a duplicate save", () => {
    const send = vi.fn(() => new Promise<{ ok: boolean }>(() => {}));
    const controller = createAutosaveController({ initialSeq: 0, send, onStatus: vi.fn() });

    controller.scheduleSave("typed content", "title");
    vi.advanceTimersByTime(300); // debounce timer still pending (needs 1000ms)
    controller.saveNow("typed content", "title");
    expect(send).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000); // the cleared debounce timer must NOT also fire
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("bumps seq on every call, same as scheduleSave — a later saveNow's response is authoritative", async () => {
    const deferredBySeq = new Map<number, ReturnType<typeof deferred<{ ok: boolean }>>>();
    const send = vi.fn((_content: string, _title: string, seq: number) => {
      const d = deferred<{ ok: boolean }>();
      deferredBySeq.set(seq, d);
      return d.promise;
    });
    const statuses: SaveStatus[] = [];
    const controller = createAutosaveController({ initialSeq: 0, send, onStatus: (s) => statuses.push(s) });

    controller.saveNow("v1", "title"); // seq=1
    controller.saveNow("v2", "title"); // seq=2

    deferredBySeq.get(2)!.resolve({ ok: true });
    await Promise.resolve();
    await Promise.resolve();
    expect(statuses).toEqual(["saving", "saving", "saved"]);

    deferredBySeq.get(1)!.resolve({ ok: true }); // stale — must not flip status
    await Promise.resolve();
    await Promise.resolve();
    expect(statuses).toEqual(["saving", "saving", "saved"]);
  });
});

describe("createAutosaveController — stale response is ignored (core EDIT-07 correctness)", () => {
  it("send A then send B (newer); A resolves late — A's response does not change status", async () => {
    const deferredBySeq = new Map<number, ReturnType<typeof deferred<{ ok: boolean }>>>();
    const send = vi.fn((_content: string, _title: string, seq: number) => {
      const d = deferred<{ ok: boolean }>();
      deferredBySeq.set(seq, d);
      return d.promise;
    });
    const statuses: SaveStatus[] = [];
    const controller = createAutosaveController({
      initialSeq: 0,
      send,
      onStatus: (s) => statuses.push(s),
    });

    controller.scheduleSave("A content", "title");
    vi.advanceTimersByTime(1000); // fires seq=1 (A)
    controller.scheduleSave("B content", "title");
    vi.advanceTimersByTime(1000); // fires seq=2 (B)

    expect(send).toHaveBeenCalledTimes(2);
    expect(deferredBySeq.has(1)).toBe(true);
    expect(deferredBySeq.has(2)).toBe(true);

    // B (the newer, latest-sent seq) resolves first.
    deferredBySeq.get(2)!.resolve({ ok: true });
    await Promise.resolve();
    await Promise.resolve();
    expect(statuses).toEqual(["saving", "saving", "saved"]);

    // A (the stale seq) resolves late — must NOT flip status back or touch it at all.
    deferredBySeq.get(1)!.resolve({ ok: true });
    await Promise.resolve();
    await Promise.resolve();
    expect(statuses).toEqual(["saving", "saving", "saved"]); // unchanged
  });

  it("a stale error response does not overwrite a newer saved status", async () => {
    const deferredBySeq = new Map<number, ReturnType<typeof deferred<{ ok: boolean }>>>();
    const send = vi.fn((_content: string, _title: string, seq: number) => {
      const d = deferred<{ ok: boolean }>();
      deferredBySeq.set(seq, d);
      return d.promise;
    });
    const statuses: SaveStatus[] = [];
    const controller = createAutosaveController({
      initialSeq: 0,
      send,
      onStatus: (s) => statuses.push(s),
    });

    controller.scheduleSave("A content", "title");
    vi.advanceTimersByTime(1000);
    controller.scheduleSave("B content", "title");
    vi.advanceTimersByTime(1000);

    deferredBySeq.get(2)!.resolve({ ok: true });
    await Promise.resolve();
    await Promise.resolve();
    expect(statuses.at(-1)).toBe("saved");

    deferredBySeq.get(1)!.resolve({ ok: false }); // stale failure
    await Promise.resolve();
    await Promise.resolve();
    expect(statuses.at(-1)).toBe("saved"); // still saved — stale error discarded
  });
});

describe("createAutosaveController — reset (document switch, Pitfall 2)", () => {
  it("reset() clears the pending timer — a stale document's pending save never fires", () => {
    const send = vi.fn(() => Promise.resolve({ ok: true }));
    const controller = createAutosaveController({ initialSeq: 5, send, onStatus: vi.fn() });

    controller.scheduleSave("old doc content", "t");
    controller.reset(10); // document switched before the 1s timer fired
    vi.advanceTimersByTime(5000);

    expect(send).not.toHaveBeenCalled();
  });

  it("after reset(), a fresh scheduleSave sends with a seq based on the new initialSeq", () => {
    const send = vi.fn(() => new Promise<{ ok: boolean }>(() => {}));
    const controller = createAutosaveController({ initialSeq: 5, send, onStatus: vi.fn() });

    controller.reset(10);
    controller.scheduleSave("new doc content", "t");
    vi.advanceTimersByTime(1000);

    expect(send).toHaveBeenCalledWith("new doc content", "t", 11);
  });
});

describe("createAutosaveController — retry", () => {
  it("retry() immediately re-sends the last pending content with a new seq", () => {
    const send = vi.fn(() => new Promise<{ ok: boolean }>(() => {}));
    const controller = createAutosaveController({ initialSeq: 0, send, onStatus: vi.fn() });

    controller.scheduleSave("content", "title");
    vi.advanceTimersByTime(1000);
    expect(send).toHaveBeenNthCalledWith(1, "content", "title", 1);

    controller.retry();
    expect(send).toHaveBeenNthCalledWith(2, "content", "title", 2);
  });
});

describe("createAutosaveController — dispose", () => {
  it("dispose() clears a pending timer so it never fires after unmount", () => {
    const send = vi.fn(() => Promise.resolve({ ok: true }));
    const controller = createAutosaveController({ initialSeq: 0, send, onStatus: vi.fn() });

    controller.scheduleSave("x", "t");
    controller.dispose();
    vi.advanceTimersByTime(5000);

    expect(send).not.toHaveBeenCalled();
  });
});
