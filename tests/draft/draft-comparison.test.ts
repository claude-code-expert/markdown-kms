// TDD RED (05-05 Task 1): isDraftNewer doesn't exist yet on src/lib/documents.ts.
// Pure comparison, no DB — Pitfall 7 requires the actual timestamp comparison to happen
// server-side (RSC), but the comparison logic itself is trivially unit-testable in isolation.
import { describe, expect, it } from "vitest";
import { isDraftNewer } from "@/lib/documents";

describe("isDraftNewer(draft, document)", () => {
  const T = new Date("2026-08-08T00:00:00Z");

  it("returns false when there is no draft", () => {
    expect(isDraftNewer(null, { updatedAt: T })).toBe(false);
  });

  it("returns true when the draft is newer than the document", () => {
    const newer = new Date(T.getTime() + 1000);
    expect(isDraftNewer({ updatedAt: newer }, { updatedAt: T })).toBe(true);
  });

  it("returns false when the draft and document timestamps are tied", () => {
    expect(isDraftNewer({ updatedAt: T }, { updatedAt: T })).toBe(false);
  });

  it("returns false when the draft is older than the document", () => {
    const older = new Date(T.getTime() - 1000);
    expect(isDraftNewer({ updatedAt: older }, { updatedAt: T })).toBe(false);
  });
});
