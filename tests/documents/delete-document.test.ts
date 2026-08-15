// Document-view delete button (DocumentWorkspace titleRow) — same pure fetch-result extraction
// as discardDraft (tests/draft/discard-draft.test.ts): a network failure resolves to false, same
// as a non-ok response, so the caller's confirm dialog stays open with an inline error rather
// than throwing inside a React event handler.
import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteDocument } from "@/components/document/DocumentWorkspace";

describe("deleteDocument (document-view delete button)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns true when the DELETE succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: true } as Response)),
    );

    await expect(deleteDocument("doc-1")).resolves.toBe(true);
  });

  it("returns false when the DELETE responds with a failure status (e.g. 403 non-EDITOR)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: false } as Response)),
    );

    await expect(deleteDocument("doc-1")).resolves.toBe(false);
  });

  it("returns false (not a rejection) when fetch itself throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("offline"))),
    );

    await expect(deleteDocument("doc-1")).resolves.toBe(false);
  });

  it("calls DELETE on /api/documents/:id (the existing 04-03 soft-delete route, no new endpoint)", async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true } as Response));
    vi.stubGlobal("fetch", fetchMock);

    await deleteDocument("doc-42");

    expect(fetchMock).toHaveBeenCalledWith("/api/documents/doc-42", { method: "DELETE" });
  });
});
