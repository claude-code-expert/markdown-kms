// TDD RED (04-01 Task 3): imports @/lib/documents, which doesn't exist yet — this file fails to
// even collect until Task 3's implementation lands (TRD §10 TDD order).
// Covers the plan's <behavior> block: autosaveDocument seq guard (T-04-01-SEQ), getDocument IDOR
// scope (T-04-01-IDOR), softDeleteDocument idempotency (WR-01 analog), resolveWorkspaceIdForDocument
// active-only scope, getWorkspaceDocuments flat listing.
import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { document, workspace } from "@/db/schema";
import {
  autosaveDocument,
  createDocument,
  getDocument,
  getWorkspaceDocuments,
  resolveWorkspaceIdForDocument,
  softDeleteDocument,
} from "@/lib/documents";
import { createTestWorkspace } from "../rbac/helpers";
import { createTestDocument } from "./helpers";

describe("documents.autosaveDocument — server seq guard (TRD §7 / T-04-01-SEQ)", () => {
  const createdWorkspaces: string[] = [];

  afterEach(async () => {
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
  });

  it("stale (lower) seq affects 0 rows and leaves content at the newest value", async () => {
    const ws = await createTestWorkspace("autosave-seq-ws");
    createdWorkspaces.push(ws.id);
    const doc = await createTestDocument(ws.id, null, { content: "최신 내용", savedSeq: 5 });

    const applied = await autosaveDocument(doc.id, "옛 내용", "옛 제목", 3);
    expect(applied).toBe(false);

    const [row] = await db.select().from(document).where(eq(document.id, doc.id));
    expect(row.content).toBe("최신 내용");
    expect(row.savedSeq).toBe(5);
  });

  it("equal seq (not strictly greater) also affects 0 rows — WHERE saved_seq < seq excludes ties", async () => {
    const ws = await createTestWorkspace("autosave-seq-tie-ws");
    createdWorkspaces.push(ws.id);
    const doc = await createTestDocument(ws.id, null, { content: "최신 내용", savedSeq: 5 });

    const applied = await autosaveDocument(doc.id, "덮어쓰기 시도", "제목", 5);
    expect(applied).toBe(false);

    const [row] = await db.select().from(document).where(eq(document.id, doc.id));
    expect(row.content).toBe("최신 내용");
  });

  it("newer seq is applied and returns true", async () => {
    const ws = await createTestWorkspace("autosave-seq-new-ws");
    createdWorkspaces.push(ws.id);
    const doc = await createTestDocument(ws.id, null, { content: "옛 내용", savedSeq: 5 });

    const applied = await autosaveDocument(doc.id, "새 내용", "새 제목", 6);
    expect(applied).toBe(true);

    const [row] = await db.select().from(document).where(eq(document.id, doc.id));
    expect(row.content).toBe("새 내용");
    expect(row.title).toBe("새 제목");
    expect(row.savedSeq).toBe(6);
  });
});

describe("documents.getDocument — workspace-scoped IDOR guard (T-04-01-IDOR)", () => {
  const createdWorkspaces: string[] = [];

  afterEach(async () => {
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
  });

  it("returns null when the workspaceId doesn't match the document's actual workspace", async () => {
    const wsA = await createTestWorkspace("idor-ws-a");
    const wsB = await createTestWorkspace("idor-ws-b");
    createdWorkspaces.push(wsA.id, wsB.id);
    const doc = await createTestDocument(wsA.id, null, { title: "A의 문서" });

    const result = await getDocument(doc.id, wsB.id);
    expect(result).toBeNull();
  });

  it("returns the row when the workspaceId matches", async () => {
    const ws = await createTestWorkspace("idor-ws-match");
    createdWorkspaces.push(ws.id);
    const doc = await createTestDocument(ws.id, null, { title: "내 문서" });

    const result = await getDocument(doc.id, ws.id);
    expect(result?.id).toBe(doc.id);
    expect(result?.title).toBe("내 문서");
  });

  it("returns null for a soft-deleted document even with a matching workspaceId", async () => {
    const ws = await createTestWorkspace("idor-ws-deleted");
    createdWorkspaces.push(ws.id);
    const doc = await createTestDocument(ws.id, null, { title: "삭제될 문서" });
    await softDeleteDocument(doc.id);

    const result = await getDocument(doc.id, ws.id);
    expect(result).toBeNull();
  });
});

describe("documents.softDeleteDocument — idempotent soft delete", () => {
  const createdWorkspaces: string[] = [];

  afterEach(async () => {
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
  });

  it("sets isDeleted/deletedAt/isTrashRoot on first call", async () => {
    const ws = await createTestWorkspace("softdelete-ws");
    createdWorkspaces.push(ws.id);
    const doc = await createTestDocument(ws.id, null);

    await softDeleteDocument(doc.id);

    const [row] = await db.select().from(document).where(eq(document.id, doc.id));
    expect(row.isDeleted).toBe(true);
    expect(row.isTrashRoot).toBe(true);
    expect(row.deletedAt).not.toBeNull();
  });

  it("is idempotent — a second call on an already-deleted document is a no-op", async () => {
    const ws = await createTestWorkspace("softdelete-idempotent-ws");
    createdWorkspaces.push(ws.id);
    const doc = await createTestDocument(ws.id, null);

    await softDeleteDocument(doc.id);
    const [firstRow] = await db.select().from(document).where(eq(document.id, doc.id));

    await softDeleteDocument(doc.id);
    const [secondRow] = await db.select().from(document).where(eq(document.id, doc.id));

    expect(secondRow.deletedAt?.getTime()).toBe(firstRow.deletedAt?.getTime());
  });
});

describe("documents.resolveWorkspaceIdForDocument — active-only scope", () => {
  const createdWorkspaces: string[] = [];

  afterEach(async () => {
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
  });

  it("returns workspaceId for an active document", async () => {
    const ws = await createTestWorkspace("resolve-active-ws");
    createdWorkspaces.push(ws.id);
    const doc = await createTestDocument(ws.id, null);

    const result = await resolveWorkspaceIdForDocument(doc.id);
    expect(result?.workspaceId).toBe(ws.id);
  });

  it("returns null for a soft-deleted document", async () => {
    const ws = await createTestWorkspace("resolve-deleted-ws");
    createdWorkspaces.push(ws.id);
    const doc = await createTestDocument(ws.id, null);
    await softDeleteDocument(doc.id);

    const result = await resolveWorkspaceIdForDocument(doc.id);
    expect(result).toBeNull();
  });
});

describe("documents.getWorkspaceDocuments / createDocument", () => {
  const createdWorkspaces: string[] = [];

  afterEach(async () => {
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
  });

  it("createDocument inserts a row and getWorkspaceDocuments lists only active documents", async () => {
    const ws = await createTestWorkspace("list-ws");
    createdWorkspaces.push(ws.id);
    const created = await createDocument(ws.id, null, "새 문서");
    const other = await createTestDocument(ws.id, null, { title: "삭제될 문서" });
    await softDeleteDocument(other.id);

    const list = await getWorkspaceDocuments(ws.id);
    expect(list).toEqual([{ id: created.id, folderId: null, title: "새 문서" }]);
  });
});
