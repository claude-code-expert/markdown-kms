// TDD RED (WR-03, 06-REVIEW): under PostgreSQL's default READ COMMITTED isolation, two concurrent
// replaceTags calls for the same document can race their DELETE/INSERT/COUNT statements such that
// a legitimate <=3-tag request is spuriously rejected with TagLimitError (see 06-REVIEW.md WR-03
// for the full interleaving). Reproducing the exact race deterministically in a test would require
// injecting timing hooks into replaceTags itself -- disproportionate for a concurrency fix whose
// contract is "take a lock before touching any rows". A source assertion is the documented
// fallback for this finding (06-REVIEW.md WR-03 fix note): serialization is guaranteed by a
// per-document pg_advisory_xact_lock taken as the transaction's first statement, before the
// DELETE that starts the replace-all sequence.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("replaceTags -- per-document advisory lock (WR-03)", () => {
  it("takes pg_advisory_xact_lock(hashtext(documentId)) before the DELETE, serializing concurrent replace-all calls", () => {
    const source = readFileSync(new URL("../../src/lib/documents.ts", import.meta.url), "utf-8");
    const fnMatch = source.match(/export async function replaceTags[\s\S]*?\n}\n/);
    expect(fnMatch).not.toBeNull();
    const body = fnMatch![0];

    const lockIndex = body.indexOf("pg_advisory_xact_lock");
    const deleteIndex = body.indexOf("tx.delete(documentTag)");

    expect(lockIndex).toBeGreaterThan(-1);
    expect(deleteIndex).toBeGreaterThan(-1);
    expect(lockIndex).toBeLessThan(deleteIndex);
  });
});
