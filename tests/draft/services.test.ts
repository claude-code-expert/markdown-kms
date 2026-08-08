// TDD RED (05-03 Task 3): upsertDraft/getDraft/deleteDraft don't exist yet on
// src/lib/documents.ts — this import fails to typecheck/resolve until Task 3's GREEN step lands.
// Real-DB integration test (PG16 @ 5433) per TRD §10 — the 1-row-per-document invariant (NFR-2.1)
// is a DB-level guarantee (onConflictDoUpdate target), so it must be proven against the real DB,
// not a mock.
import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { document, documentDraft, workspace } from "@/db/schema";
import { deleteDraft, getDraft, upsertDraft } from "@/lib/documents";
import { createTestDocument, createTestWorkspace } from "./helpers";

describe("upsertDraft / getDraft / deleteDraft (document_draft, 1-row-per-document)", () => {
  const createdWorkspaces: string[] = [];

  afterEach(async () => {
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
  });

  it("upsertDraft then getDraft returns the saved content", async () => {
    const ws = await createTestWorkspace("draft-basic-ws");
    createdWorkspaces.push(ws.id);
    const doc = await createTestDocument(ws.id, null);

    await upsertDraft(doc.id, "v1");
    const row = await getDraft(doc.id);

    expect(row).not.toBeNull();
    expect(row?.documentId).toBe(doc.id);
    expect(row?.content).toBe("v1");
  });

  it("re-upserting the same document keeps exactly 1 row and updates content (onConflictDoUpdate)", async () => {
    const ws = await createTestWorkspace("draft-reupsert-ws");
    createdWorkspaces.push(ws.id);
    const doc = await createTestDocument(ws.id, null);

    await upsertDraft(doc.id, "v1");
    await upsertDraft(doc.id, "v2");

    const rows = await db.select().from(documentDraft).where(eq(documentDraft.documentId, doc.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].content).toBe("v2");

    const row = await getDraft(doc.id);
    expect(row?.content).toBe("v2");
  });

  it("deleteDraft removes the row; getDraft then returns null", async () => {
    const ws = await createTestWorkspace("draft-delete-ws");
    createdWorkspaces.push(ws.id);
    const doc = await createTestDocument(ws.id, null);

    await upsertDraft(doc.id, "v1");
    await deleteDraft(doc.id);

    const row = await getDraft(doc.id);
    expect(row).toBeNull();
  });

  it("getDraft returns null for a document with no draft", async () => {
    const ws = await createTestWorkspace("draft-none-ws");
    createdWorkspaces.push(ws.id);
    const doc = await createTestDocument(ws.id, null);

    const row = await getDraft(doc.id);
    expect(row).toBeNull();
  });

  it("deleting the document cascades to its draft row (TRD §3 ON DELETE CASCADE)", async () => {
    const ws = await createTestWorkspace("draft-cascade-ws");
    createdWorkspaces.push(ws.id);
    const doc = await createTestDocument(ws.id, null);

    await upsertDraft(doc.id, "v1");
    await db.delete(document).where(eq(document.id, doc.id));

    const rows = await db.select().from(documentDraft).where(eq(documentDraft.documentId, doc.id));
    expect(rows).toHaveLength(0);
  });
});
