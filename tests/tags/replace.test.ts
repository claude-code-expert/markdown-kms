// TDD RED (06-02 Task 1): replaceTags/getTags service-level behavior (single transaction,
// COUNT>3 backstop rollback, replace-all semantics, case-insensitive dedup with first-seen
// casing preserved) plus the PUT /api/documents/[id]/tags route's 200/400 shape. Mirrors
// tests/documents/idor.test.ts's real-DB setup convention for the route describe block.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user, workspace } from "@/db/schema";
import { getTags, replaceTags, TagLimitError } from "@/lib/documents";
import { createTestDocument } from "../documents/helpers";
import { addMember, createTestUser, createTestWorkspace, mockSessionFor } from "../rbac/helpers";
import { getTagRows } from "./helpers";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

describe("replaceTags / getTags", () => {
  const createdWorkspaces: string[] = [];

  afterEach(async () => {
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
  });

  it("stores up to 3 tags and getTags returns them", async () => {
    const ws = await createTestWorkspace("tags-replace-basic");
    createdWorkspaces.push(ws.id);
    const doc = await createTestDocument(ws.id, null, { title: "문서" });

    const result = await replaceTags(doc.id, ["a", "b", "c"]);
    expect(result).toHaveLength(3);

    const tags = await getTags(doc.id);
    expect(tags).toHaveLength(3);
  });

  it("rejects a 4th tag with TagLimitError and rolls back — the previous tag set is untouched", async () => {
    const ws = await createTestWorkspace("tags-replace-rollback");
    createdWorkspaces.push(ws.id);
    const doc = await createTestDocument(ws.id, null, { title: "문서" });
    await replaceTags(doc.id, ["x"]);

    await expect(replaceTags(doc.id, ["a", "b", "c", "d"])).rejects.toThrow(TagLimitError);

    const rows = await getTagRows(doc.id);
    expect(rows.map((r) => r.tag)).toEqual(["x"]);
  });

  it("is replace-all: a second call fully replaces the first tag set", async () => {
    const ws = await createTestWorkspace("tags-replace-all");
    createdWorkspaces.push(ws.id);
    const doc = await createTestDocument(ws.id, null, { title: "문서" });

    await replaceTags(doc.id, ["a", "b"]);
    await replaceTags(doc.id, ["c"]);

    const tags = await getTags(doc.id);
    expect(tags).toEqual(["c"]);
  });

  it("dedups case-insensitively, preserving the first-seen casing", async () => {
    const ws = await createTestWorkspace("tags-replace-dedup");
    createdWorkspaces.push(ws.id);
    const doc = await createTestDocument(ws.id, null, { title: "문서" });

    const result = await replaceTags(doc.id, ["React", "react"]);
    expect(result).toEqual(["React"]);
  });
});

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function putRequest(id: string, body: unknown) {
  return new Request(`http://localhost/api/documents/${id}/tags`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PUT /api/documents/[id]/tags", () => {
  let tagsRoute: typeof import("@/app/api/documents/[id]/tags/route").PUT;
  const createdWorkspaces: string[] = [];
  const createdUsers: string[] = [];

  beforeAll(async () => {
    ({ PUT: tagsRoute } = await import("@/app/api/documents/[id]/tags/route"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
    await Promise.all(createdUsers.splice(0).map((id) => db.delete(user).where(eq(user.id, id))));
  });

  it("returns 200 and saves up to 3 tags for an EDITOR", async () => {
    const ws = await createTestWorkspace("tags-route-ok");
    createdWorkspaces.push(ws.id);
    const editor = await createTestUser("tags-route-editor");
    createdUsers.push(editor.id);
    await addMember(ws.id, editor.id, "EDITOR");
    mockSessionFor(editor.id);
    const doc = await createTestDocument(ws.id, null, { title: "문서" });

    const res = await tagsRoute(putRequest(doc.id, { tags: ["a", "b", "c"] }), ctx(doc.id));
    expect(res.status).toBe(200);
  });

  it("returns 400 for a 4th tag", async () => {
    const ws = await createTestWorkspace("tags-route-limit");
    createdWorkspaces.push(ws.id);
    const editor = await createTestUser("tags-route-limit-editor");
    createdUsers.push(editor.id);
    await addMember(ws.id, editor.id, "EDITOR");
    mockSessionFor(editor.id);
    const doc = await createTestDocument(ws.id, null, { title: "문서" });

    const res = await tagsRoute(putRequest(doc.id, { tags: ["a", "b", "c", "d"] }), ctx(doc.id));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a malformed (non-uuid) document id", async () => {
    mockSessionFor("00000000-0000-4000-8000-000000000000");
    const res = await tagsRoute(putRequest("not-a-uuid", { tags: ["a"] }), ctx("not-a-uuid"));
    expect(res.status).toBe(400);
  });
});
