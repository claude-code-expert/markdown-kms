// TDD RED (06-04 Task 2): @/lib/export doesn't exist yet — sanitizeZipSegment is the pure
// zip-slip defense (T-06-ZIPSLIP) that buildZipEntries/the folders export route both funnel
// every path segment through. Pure unit tests, no DB.
import { describe, expect, it } from "vitest";
import { sanitizeZipSegment } from "@/lib/export";

describe("sanitizeZipSegment — zip-slip defense (T-06-ZIPSLIP)", () => {
  it("neutralizes a multi-level traversal title into a single flat token (no separators, no '..')", () => {
    const result = sanitizeZipSegment("../../etc");
    expect(result).not.toMatch(/[/\\]/);
    expect(result).not.toMatch(/\.\./);
  });

  it("replaces forward slashes with a hyphen", () => {
    expect(sanitizeZipSegment("a/b")).toBe("a-b");
  });

  it("replaces backslashes with a hyphen", () => {
    expect(sanitizeZipSegment("a\\b")).toBe("a-b");
  });

  it("collapses a bare parent-directory reference", () => {
    expect(sanitizeZipSegment("..")).not.toContain("..");
  });

  it("strips control characters", () => {
    expect(sanitizeZipSegment("a\x00\x1fb")).toBe("ab");
  });

  it("substitutes a placeholder when sanitizing leaves nothing", () => {
    expect(sanitizeZipSegment("")).toBe("제목 없음");
    expect(sanitizeZipSegment("   ")).toBe("제목 없음");
    expect(sanitizeZipSegment("\x00\x01")).toBe("제목 없음");
  });

  it("leaves an ordinary Korean/ASCII title unchanged", () => {
    expect(sanitizeZipSegment("프로젝트 문서")).toBe("프로젝트 문서");
  });

  // WR-02: colon is a Windows drive-letter/ADS separator (e.g. "C:\Windows\System32") that
  // survived sanitization untouched; a trailing dot on an odd-length dot run ("....." -> "__.")
  // also survived because /\.\./g only ever consumes non-overlapping pairs.
  it("strips a colon (Windows drive-letter vector)", () => {
    expect(sanitizeZipSegment("C:evil")).not.toContain(":");
  });

  it("leaves no trailing dot after sanitizing an odd-length dot run", () => {
    expect(sanitizeZipSegment("a...")).not.toMatch(/\.$/);
  });

  it("leaves no trailing dot when a name ends in a single dot", () => {
    expect(sanitizeZipSegment("문서.")).not.toMatch(/\.$/);
  });
});
