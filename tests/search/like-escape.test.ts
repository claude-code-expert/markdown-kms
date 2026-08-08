// TDD RED (IN-02, 06-REVIEW): q is parameter-bound (no SQL injection, T-06-SQLI already covers
// that in nfc-normalize.test.ts) but `%`/`_` inside q are still interpreted as ILIKE wildcards
// rather than literal characters, so a query like "50%" matches any string containing "50", not
// just strings that literally contain "50%". Mirrors nfc-normalize.test.ts's real-DB setup.
import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { workspace } from "@/db/schema";
import { searchWorkspace } from "@/lib/search";
import { createTestDocument } from "../documents/helpers";
import { createTestWorkspace } from "../rbac/helpers";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

describe("searchWorkspace -- LIKE 메타문자 이스케이프 (IN-02)", () => {
  const createdWorkspaces: string[] = [];

  afterEach(async () => {
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
  });

  it("matches only the literal '50%' substring, not any string that merely contains '50'", async () => {
    const ws = await createTestWorkspace("search-like-percent");
    createdWorkspaces.push(ws.id);
    const literalDoc = await createTestDocument(ws.id, null, { title: "할인 50% 세일", content: "" });
    await createTestDocument(ws.id, null, { title: "1502번 문서", content: "" }); // contains "50", not "50%"

    const results = await searchWorkspace(ws.id, "50%");
    expect(results.map((r) => r.id)).toEqual([literalDoc.id]);
  });

  it("matches only the literal underscore, not any single character in its place", async () => {
    const ws = await createTestWorkspace("search-like-underscore");
    createdWorkspaces.push(ws.id);
    const literalDoc = await createTestDocument(ws.id, null, { title: "a_b 표기", content: "" });
    await createTestDocument(ws.id, null, { title: "axb 표기", content: "" });

    const results = await searchWorkspace(ws.id, "a_b");
    expect(results.map((r) => r.id)).toEqual([literalDoc.id]);
  });
});
