// TDD RED (06-04 Task 2): @/lib/export (buildZipEntries) and the folders/[id]/export route don't
// exist yet. buildZipEntries is deliberately archiver-free (06-PATTERNS "No Analog") — it only
// computes {zipPath, content} pairs, so folder-hierarchy/collision/zip-slip behavior is
// unit-testable without spinning up real zip I/O. The route-level describe block below drives
// the actual archiver stream to prove Readable.toWeb() produces a real, non-empty zip (RESEARCH
// Pitfall 3 — a 0-byte/corrupt zip from a finalize-timing bug wouldn't show up in a pure unit
// test of buildZipEntries alone).
import { readFileSync } from "node:fs";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { document, user, workspace } from "@/db/schema";
import { createFolder } from "@/lib/closure";
import { buildZipEntries } from "@/lib/export";
import { createTestDocument } from "../documents/helpers";
import { addMember, createTestUser, createTestWorkspace, mockSessionFor } from "../rbac/helpers";
import { ctx, exportRequest } from "./helpers";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

describe("buildZipEntries — folder hierarchy preserved as zip paths (EXP-02, pure/no archiver)", () => {
  const createdWorkspaces: string[] = [];

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
  });

  it("builds nested zipPaths matching the folder tree, with the root folder name as the top directory", async () => {
    const ws = await createTestWorkspace("zip-export-ws");
    createdWorkspaces.push(ws.id);
    const root = await createFolder(ws.id, null, "프로젝트문서");
    const child = await createFolder(ws.id, root.id, "하위폴더");
    await createTestDocument(ws.id, root.id, { title: "루트문서", content: "root content" });
    await createTestDocument(ws.id, child.id, { title: "하위문서", content: "child content" });

    const entries = await buildZipEntries(root.id);
    const byPath = new Map(entries.map((e) => [e.zipPath, e.content]));

    expect(byPath.get("프로젝트문서/루트문서.md")).toBe("root content");
    expect(byPath.get("프로젝트문서/하위폴더/하위문서.md")).toBe("child content");
  });

  it("suffixes -1/-2 when sanitized titles collide within the same directory", async () => {
    const ws = await createTestWorkspace("zip-export-collision-ws");
    createdWorkspaces.push(ws.id);
    const root = await createFolder(ws.id, null, "폴더");
    await createTestDocument(ws.id, root.id, { title: "문서", content: "first" });
    await createTestDocument(ws.id, root.id, { title: "문서", content: "second" });
    await createTestDocument(ws.id, root.id, { title: "문서", content: "third" });

    const entries = await buildZipEntries(root.id);
    const paths = entries.map((e) => e.zipPath).sort();
    expect(paths).toEqual(["폴더/문서-1.md", "폴더/문서-2.md", "폴더/문서.md"]);
  });

  it("excludes soft-deleted documents from the zip", async () => {
    const ws = await createTestWorkspace("zip-export-softdel-ws");
    createdWorkspaces.push(ws.id);
    const root = await createFolder(ws.id, null, "폴더");
    const doc = await createTestDocument(ws.id, root.id, { title: "삭제될문서" });
    await db.update(document).set({ isDeleted: true }).where(eq(document.id, doc.id));

    const entries = await buildZipEntries(root.id);
    expect(entries).toHaveLength(0);
  });

  it("never produces a zipPath that escapes the subtree, even with a path-traversal folder/document title", async () => {
    const ws = await createTestWorkspace("zip-export-slip-ws");
    createdWorkspaces.push(ws.id);
    const root = await createFolder(ws.id, null, "../../etc");
    await createTestDocument(ws.id, root.id, { title: "../../passwd" });

    const entries = await buildZipEntries(root.id);
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.zipPath.split("/")).not.toContain("..");
      expect(entry.zipPath.startsWith("../")).toBe(false);
      expect(entry.zipPath).not.toMatch(/\.\./);
    }
  });

  it("does not import archiver — stays a pure, DB-only helper unit-testable without real zip I/O", () => {
    const source = readFileSync(new URL("../../src/lib/export.ts", import.meta.url), "utf-8");
    expect(source).not.toMatch(/from ["']archiver["']/);
    expect(source).not.toMatch(/require\(["']archiver["']\)/);
  });
});

describe("GET /api/folders/[id]/export — VIEWER RBAC + streams a real zip (EXP-02)", () => {
  let exportRoute: typeof import("@/app/api/folders/[id]/export/route").GET;
  const createdUsers: string[] = [];
  const createdWorkspaces: string[] = [];

  beforeAll(async () => {
    ({ GET: exportRoute } = await import("@/app/api/folders/[id]/export/route"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
    await Promise.all(createdUsers.splice(0).map((id) => db.delete(user).where(eq(user.id, id))));
  });

  it("returns a non-empty zip (PK magic bytes) with application/zip content-type for a VIEWER member", async () => {
    const ws = await createTestWorkspace("zip-route-ws");
    createdWorkspaces.push(ws.id);
    const viewer = await createTestUser("zip-route-viewer");
    createdUsers.push(viewer.id);
    await addMember(ws.id, viewer.id, "VIEWER");
    mockSessionFor(viewer.id);
    const root = await createFolder(ws.id, null, "내보낼폴더");
    await createTestDocument(ws.id, root.id, { title: "문서", content: "내용" });

    const res = await exportRoute(exportRequest(root.id, "folders"), ctx(root.id));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/zip");
    const disposition = res.headers.get("content-disposition") ?? "";
    expect(disposition).toContain("filename*=UTF-8''");

    const buf = new Uint8Array(await res.arrayBuffer());
    expect(buf.length).toBeGreaterThan(0);
    expect(Array.from(buf.slice(0, 2))).toEqual([0x50, 0x4b]); // "PK" zip magic — proves Readable.toWeb() didn't hand back a 0-byte/corrupt stream (Pitfall 3)
  });

  it("escapes embedded quotes/backslashes and strips CR/LF from the folder name in Content-Disposition (WR-01)", async () => {
    const ws = await createTestWorkspace("zip-route-header-injection-ws");
    createdWorkspaces.push(ws.id);
    const viewer = await createTestUser("zip-route-header-injection-viewer");
    createdUsers.push(viewer.id);
    await addMember(ws.id, viewer.id, "VIEWER");
    mockSessionFor(viewer.id);
    const root = await createFolder(ws.id, null, 'Report "Q3"\\evil\r\nInjected: header-break');

    const res = await exportRoute(exportRequest(root.id, "folders"), ctx(root.id));
    const disposition = res.headers.get("content-disposition") ?? "";
    expect(disposition).not.toMatch(/[\r\n]/);
    const quotedMatch = disposition.match(/filename="([^]*?)"; filename\*=/);
    expect(quotedMatch).not.toBeNull();
    expect(quotedMatch![1]).not.toMatch(/["\\]/);
  });

  it("rejects a non-member with 403", async () => {
    const ws = await createTestWorkspace("zip-route-403-ws");
    createdWorkspaces.push(ws.id);
    const outsider = await createTestUser("zip-route-403-outsider");
    createdUsers.push(outsider.id);
    mockSessionFor(outsider.id);
    const root = await createFolder(ws.id, null, "비공개폴더");

    const res = await exportRoute(exportRequest(root.id, "folders"), ctx(root.id));
    expect(res.status).toBe(403);
  });

  it("returns 400 for a malformed (non-uuid) folder id", async () => {
    mockSessionFor("00000000-0000-4000-8000-000000000000");
    const res = await exportRoute(exportRequest("not-a-uuid", "folders"), ctx("not-a-uuid"));
    expect(res.status).toBe(400);
  });
});
