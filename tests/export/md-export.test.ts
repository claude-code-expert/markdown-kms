// TDD RED (06-04 Task 1): GET /api/documents/[id]/export doesn't exist yet — this file fails to
// collect until Task 1 lands the route. Mirrors tests/documents/idor.test.ts's IDOR/RBAC pattern
// (resolveWorkspaceIdForDocument + requireRole shape), but the behavior under test is EXP-01 /
// NFR-5.2: the response body must be document.content byte-for-byte, no lib/markdown pipeline.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user, workspace } from "@/db/schema";
import { createTestDocument } from "../documents/helpers";
import { addMember, createTestUser, createTestWorkspace, mockSessionFor } from "../rbac/helpers";
import { ctx, exportRequest } from "./helpers";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

describe("GET /api/documents/[id]/export — verbatim .md download (EXP-01)", () => {
  let exportRoute: typeof import("@/app/api/documents/[id]/export/route").GET;
  const createdUsers: string[] = [];
  const createdWorkspaces: string[] = [];

  beforeAll(async () => {
    ({ GET: exportRoute } = await import("@/app/api/documents/[id]/export/route"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
    await Promise.all(createdUsers.splice(0).map((id) => db.delete(user).where(eq(user.id, id))));
  });

  it("returns document.content byte-for-byte, including leading/trailing whitespace and blank lines (NFR-5.2, no pipeline)", async () => {
    const ws = await createTestWorkspace("md-export-ws");
    createdWorkspaces.push(ws.id);
    const viewer = await createTestUser("md-export-viewer");
    createdUsers.push(viewer.id);
    await addMember(ws.id, viewer.id, "VIEWER");
    mockSessionFor(viewer.id);
    const content = "\n\n  # 제목\n\n본문 텍스트   \n\n*강조*\n";
    const doc = await createTestDocument(ws.id, null, { title: "내보내기문서", content });

    const res = await exportRoute(exportRequest(doc.id, "documents"), ctx(doc.id));
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toBe(content);
  });

  it("sets Content-Type text/markdown and both filename + filename* (RFC 5987) in Content-Disposition", async () => {
    const ws = await createTestWorkspace("md-export-headers-ws");
    createdWorkspaces.push(ws.id);
    const viewer = await createTestUser("md-export-headers-viewer");
    createdUsers.push(viewer.id);
    await addMember(ws.id, viewer.id, "VIEWER");
    mockSessionFor(viewer.id);
    const doc = await createTestDocument(ws.id, null, { title: "한글제목", content: "x" });

    const res = await exportRoute(exportRequest(doc.id, "documents"), ctx(doc.id));
    expect(res.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    const disposition = res.headers.get("content-disposition") ?? "";
    expect(disposition).toContain("filename=");
    expect(disposition).toContain("filename*=UTF-8''");
    expect(disposition).toContain(encodeURIComponent("한글제목.md"));
  });

  it("rejects a non-member with 403", async () => {
    const ws = await createTestWorkspace("md-export-403-ws");
    createdWorkspaces.push(ws.id);
    const outsider = await createTestUser("md-export-403-outsider");
    createdUsers.push(outsider.id);
    mockSessionFor(outsider.id);
    const doc = await createTestDocument(ws.id, null, { title: "비공개", content: "secret" });

    const res = await exportRoute(exportRequest(doc.id, "documents"), ctx(doc.id));
    expect(res.status).toBe(403);
  });

  it("rejects a cross-workspace document id with 403 (IDOR — never trust the id alone)", async () => {
    const w1 = await createTestWorkspace("md-export-idor-w1");
    const w2 = await createTestWorkspace("md-export-idor-w2");
    createdWorkspaces.push(w1.id, w2.id);
    const viewer = await createTestUser("md-export-idor-viewer");
    createdUsers.push(viewer.id);
    await addMember(w1.id, viewer.id, "VIEWER");
    mockSessionFor(viewer.id);
    const foreignDoc = await createTestDocument(w2.id, null, { title: "타워크스페이스", content: "x" });

    const res = await exportRoute(exportRequest(foreignDoc.id, "documents"), ctx(foreignDoc.id));
    expect(res.status).toBe(403);
  });

  it("returns 400 for a malformed (non-uuid) document id", async () => {
    mockSessionFor("00000000-0000-4000-8000-000000000000");
    const res = await exportRoute(exportRequest("not-a-uuid", "documents"), ctx("not-a-uuid"));
    expect(res.status).toBe(400);
  });
});
