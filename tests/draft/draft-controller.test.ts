// TDD RED (05-04 Task 3): the pure draft controller doesn't exist yet. Same fake-timer shape as
// tests/documents/autosave-controller.test.ts, but the correctness core here is "dirty flag +
// fixed interval" instead of debounce — no input since the last upsert must NOT fire.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDraftController } from "@/components/document/draft-controller";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createDraftController — dirty-flag + 60s interval", () => {
  it("does not call send when no input occurred since the last tick", () => {
    const send = vi.fn(() => Promise.resolve({ ok: true }));
    createDraftController({ send, intervalMs: 60_000 });

    vi.advanceTimersByTime(60_000);

    expect(send).not.toHaveBeenCalled();
  });

  it("calls send exactly once with the latest content after input + 60s", () => {
    const send = vi.fn(() => Promise.resolve({ ok: true }));
    const controller = createDraftController({ send, intervalMs: 60_000 });

    controller.onContentChange("x");
    vi.advanceTimersByTime(60_000);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("x");
  });

  it("resets the dirty flag after firing — a second 60s with no further input does not re-send", () => {
    const send = vi.fn(() => Promise.resolve({ ok: true }));
    const controller = createDraftController({ send, intervalMs: 60_000 });

    controller.onContentChange("x");
    vi.advanceTimersByTime(60_000);
    expect(send).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60_000);
    expect(send).toHaveBeenCalledTimes(1); // still 1 — no new input since the last tick
  });

  it("multiple onContentChange calls before the tick send only the latest content, once", () => {
    const send = vi.fn(() => Promise.resolve({ ok: true }));
    const controller = createDraftController({ send, intervalMs: 60_000 });

    controller.onContentChange("first");
    controller.onContentChange("second");
    controller.onContentChange("third");
    vi.advanceTimersByTime(60_000);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("third");
  });

  it("dispose() stops the timer — no further sends even after more input and elapsed time", () => {
    const send = vi.fn(() => Promise.resolve({ ok: true }));
    const controller = createDraftController({ send, intervalMs: 60_000 });

    controller.onContentChange("x");
    controller.dispose();
    vi.advanceTimersByTime(120_000);

    expect(send).not.toHaveBeenCalled();
  });
});
