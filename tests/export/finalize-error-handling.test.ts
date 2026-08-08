// TDD RED (CR-01, 06-REVIEW): archive.finalize()'s returned Promise rejects on any zip-stream
// error (node_modules/archiver/lib/core.js), not just double-finalize/abort. `void
// archive.finalize()` discarded that Promise entirely -- an unhandled rejection crashes the whole
// Next.js process (Node v15+ default `--unhandled-rejections=throw`), a DoS any workspace member
// can trigger by aborting a folder download mid-stream. Reliably forcing a real stream error
// inside archiver's internals isn't feasible from a unit test without mocking archiver itself
// (disproportionate for a defense whose contract is "never let this Promise go unhandled") -- a
// source assertion is the documented fallback for this finding (06-REVIEW.md CR-01 fix note).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("folders export route -- archive.finalize() error handling (CR-01)", () => {
  it("attaches .catch() to archive.finalize() and registers an archive.on('error', ...) listener", () => {
    const source = readFileSync(
      new URL("../../src/app/api/folders/[id]/export/route.ts", import.meta.url),
      "utf-8",
    );
    expect(source).not.toMatch(/void\s+archive\.finalize\(\)/);
    expect(source).toMatch(/archive\.finalize\(\)[\s\S]*?\.catch\(/);
    expect(source).toMatch(/archive\.on\(\s*["']error["']/);
  });
});
