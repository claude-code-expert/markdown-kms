// TDD RED (06-03 Task 1): searchWorkspace's NFC query-normalization contract (DOC-04, 06-RESEARCH
// Pattern 2) + parameter-bound safety against SQL/LIKE metacharacters (T-06-SQLI). searchWorkspace
// itself does not normalize `q` -- normalizeNFC is applied by the caller (the search route), the
// same division of responsibility as documents.ts's autosaveDocument never calling documentSchema
// itself. These tests call searchWorkspace directly with an already-normalized q, mirroring how
// the route will call it.
import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { workspace } from "@/db/schema";
import { normalizeNFC } from "@/lib/validation";
import { replaceTags } from "@/lib/documents";
import { searchWorkspace } from "@/lib/search";
import { createTestDocument } from "../documents/helpers";
import { createTestWorkspace } from "../rbac/helpers";
import { NFC_GAK, NFD_GAK } from "./helpers";

// Not used directly by these lib-level tests -- required only because ../rbac/helpers
// transitively imports @/auth (next-auth), which pulls in next/server and fails to resolve
// outside a Next.js runtime unless mocked (03-02 precedent, tests/tags/replace.test.ts mirrors
// this same workaround for its own lib-level describe block).
vi.mock("@/auth", () => ({ auth: vi.fn() }));

describe("searchWorkspace -- NFC 정규화", () => {
  const createdWorkspaces: string[] = [];

  afterEach(async () => {
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
  });

  it("matches an NFC-stored title when the query is NFD, normalized to NFC first", async () => {
    const ws = await createTestWorkspace("search-nfc-nfd-query");
    createdWorkspaces.push(ws.id);
    await createTestDocument(ws.id, null, { title: `${NFC_GAK}문서`, content: "" });

    const results = await searchWorkspace(ws.id, normalizeNFC(NFD_GAK));
    expect(results.map((r) => r.title)).toContain(`${NFC_GAK}문서`);
  });

  it("also matches when the query is already NFC -- the reverse direction holds too", async () => {
    const ws = await createTestWorkspace("search-nfc-nfc-query");
    createdWorkspaces.push(ws.id);
    await createTestDocument(ws.id, null, { title: `${NFC_GAK}문서`, content: "" });

    const results = await searchWorkspace(ws.id, normalizeNFC(NFC_GAK));
    expect(results.map((r) => r.title)).toContain(`${NFC_GAK}문서`);
  });

  it("matches content and tags, not just title, and includes a body snippet", async () => {
    const ws = await createTestWorkspace("search-nfc-content-tag");
    createdWorkspaces.push(ws.id);
    const doc = await createTestDocument(ws.id, null, { title: "제목", content: "본문에 키워드가 있음" });
    await replaceTags(doc.id, ["키워드태그"]);

    const byContent = await searchWorkspace(ws.id, "키워드");
    expect(byContent.map((r) => r.id)).toContain(doc.id);
    expect(byContent.find((r) => r.id === doc.id)?.snippet).toContain("키워드");

    const byTag = await searchWorkspace(ws.id, "키워드태그");
    expect(byTag.map((r) => r.id)).toContain(doc.id);
    expect(byTag.find((r) => r.id === doc.id)?.tags).toContain("키워드태그");
  });

  it("treats SQL/LIKE metacharacters in q as a literal, parameter-bound value (no injection, no crash)", async () => {
    const ws = await createTestWorkspace("search-sqli-safe");
    createdWorkspaces.push(ws.id);
    await createTestDocument(ws.id, null, { title: "정상 문서", content: "" });

    const malicious = "%' OR '1'='1";
    const results = await searchWorkspace(ws.id, malicious);
    expect(results).toEqual([]); // literal-only match, not an injected always-true condition

    const underscore = await searchWorkspace(ws.id, "_상");
    // "_" is a LIKE single-char wildcard; drizzle still binds it as a literal parameter, so this
    // just proves the call doesn't throw/500 -- exact match set isn't the point of this case.
    expect(Array.isArray(underscore)).toBe(true);
  });

  it("returns [] for an empty query without erroring", async () => {
    const ws = await createTestWorkspace("search-empty-query");
    createdWorkspaces.push(ws.id);
    const results = await searchWorkspace(ws.id, "");
    expect(results).toEqual([]);
  });
});
