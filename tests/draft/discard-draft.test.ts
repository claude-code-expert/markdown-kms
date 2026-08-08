// WR-03 (05-REVIEW): DocumentWorkspace's discard handler used to call DELETE and close the
// recovery dialog unconditionally, ignoring a failed response and swallowing a rejected fetch
// (unhandled rejection in an async event handler). discardDraft is the pure fetch-result-to-
// boolean extraction so this stays a unit test — no React rendering needed.
import { afterEach, describe, expect, it, vi } from "vitest";
import { discardDraft } from "@/components/document/DocumentWorkspace";

describe("discardDraft (WR-03: draft-discard failure must not close the dialog)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns true when the DELETE succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: true } as Response)),
    );

    await expect(discardDraft("doc-1")).resolves.toBe(true);
  });

  it("returns false when the DELETE responds with a failure status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: false } as Response)),
    );

    await expect(discardDraft("doc-1")).resolves.toBe(false);
  });

  it("returns false (not a rejection) when fetch itself throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("offline"))),
    );

    await expect(discardDraft("doc-1")).resolves.toBe(false);
  });
});
