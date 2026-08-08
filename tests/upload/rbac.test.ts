// 05-01 Task 2 (TDD RED first): POST /api/uploads is gated by requireRole(wsId, "EDITOR") —
// the single server-side authorization boundary (CLAUDE.md invariant). VIEWER is rejected,
// EDITOR/ADMIN/OWNER pass through to saveUpload. Follows tests/rbac/matrix.test.ts's real-DB +
// mocked-session pattern (tests/rbac/helpers.ts) rather than mocking requireRole itself, so the
// UUID_RE fail-closed guard and the actual DB membership lookup are exercised too.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user, workspace } from "@/db/schema";
import { addMember, createTestUser, createTestWorkspace, mockSessionFor, type Role } from "../rbac/helpers";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

// A minimal valid 1x1 png so saveUpload's magic-byte sniff passes for the 2xx cases — the
// route's own behavior (403 vs 200), not saveUpload's sniffing logic, is what this file asserts.
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

function uploadRequest(wsId: string | null) {
  const form = new FormData();
  form.set("file", new File([PNG_BYTES], "photo.png", { type: "image/png" }));
  const qs = wsId ? `?wsId=${wsId}` : "";
  return new Request(`http://localhost/api/uploads${qs}`, { method: "POST", body: form });
}

describe("POST /api/uploads — RBAC gate (EDITOR+)", () => {
  let POST: typeof import("@/app/api/uploads/route").POST;
  const createdUsers: string[] = [];
  const createdWorkspaces: string[] = [];

  beforeAll(async () => {
    ({ POST } = await import("@/app/api/uploads/route"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
    await Promise.all(createdUsers.splice(0).map((id) => db.delete(user).where(eq(user.id, id))));
  });

  it("rejects a VIEWER with 403", async () => {
    const caller = await createTestUser("upload-rbac-viewer");
    createdUsers.push(caller.id);
    const ws = await createTestWorkspace("upload-rbac-viewer-ws");
    createdWorkspaces.push(ws.id);
    await addMember(ws.id, caller.id, "VIEWER");
    mockSessionFor(caller.id);

    const res = await POST(uploadRequest(ws.id));

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("이 작업을 수행할 권한이 없습니다.");
  });

  it.each<Role>(["EDITOR", "ADMIN", "OWNER"])("accepts a %s with 200 and a saved url", async (role) => {
    const caller = await createTestUser(`upload-rbac-${role}`);
    createdUsers.push(caller.id);
    const ws = await createTestWorkspace(`upload-rbac-${role}-ws`);
    createdWorkspaces.push(ws.id);
    await addMember(ws.id, caller.id, role);
    mockSessionFor(caller.id);

    const res = await POST(uploadRequest(ws.id));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toMatch(/^\/uploads\/[0-9a-f-]{36}\.png$/);
  });

  it("rejects a request missing wsId with 400", async () => {
    mockSessionFor(null);
    const res = await POST(uploadRequest(null));
    expect(res.status).toBe(400);
  });
});

// CR-02 (05-REVIEW): req.formData() buffers the ENTIRE multipart body into memory before
// saveUpload's file.size check ever runs — a Content-Length pre-check must reject an
// obviously oversized body before formData() is called at all, or the size cap does nothing
// to stop a memory-exhaustion DoS.
describe("POST /api/uploads — Content-Length size guard (CR-02)", () => {
  let POST: typeof import("@/app/api/uploads/route").POST;
  const createdUsers: string[] = [];
  const createdWorkspaces: string[] = [];

  beforeAll(async () => {
    ({ POST } = await import("@/app/api/uploads/route"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
    await Promise.all(createdUsers.splice(0).map((id) => db.delete(user).where(eq(user.id, id))));
  });

  it("rejects an oversized Content-Length with 413 BEFORE req.formData() is called", async () => {
    const caller = await createTestUser("upload-size-editor");
    createdUsers.push(caller.id);
    const ws = await createTestWorkspace("upload-size-editor-ws");
    createdWorkspaces.push(ws.id);
    await addMember(ws.id, caller.id, "EDITOR");
    mockSessionFor(caller.id);

    const form = new FormData();
    form.set("file", new File([PNG_BYTES], "photo.png", { type: "image/png" }));
    const req = new Request(`http://localhost/api/uploads?wsId=${ws.id}`, {
      method: "POST",
      body: form,
      // The real body is tiny — only the header is oversized, proving the route trusts
      // (and pre-checks) Content-Length rather than actually reading the body first.
      headers: { "content-length": String(6 * 1024 * 1024) },
    });
    const formDataSpy = vi.spyOn(req, "formData");

    const res = await POST(req);

    expect(res.status).toBe(413);
    expect(formDataSpy).not.toHaveBeenCalled();
  });

  it("still accepts a normal-size upload (Content-Length under the cap)", async () => {
    const caller = await createTestUser("upload-size-ok");
    createdUsers.push(caller.id);
    const ws = await createTestWorkspace("upload-size-ok-ws");
    createdWorkspaces.push(ws.id);
    await addMember(ws.id, caller.id, "EDITOR");
    mockSessionFor(caller.id);

    const res = await POST(uploadRequest(ws.id));

    expect(res.status).toBe(200);
  });
});
