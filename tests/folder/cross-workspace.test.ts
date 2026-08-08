// TDD RED (03-04 Task 1): cross-workspace IDOR regression tests for PATCH/DELETE/move — these
// routes have no wsId in the URL, so the server must re-derive workspace_id from the target
// folder row before calling requireRole (RESEARCH Pitfall 3, T-03-04-IDOR). Dynamic imports fail
// until Task 2/3 land (same pattern as rbac.test.ts / tests/rbac/matrix.test.ts).
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user, workspace } from "@/db/schema";
import { createFolder } from "@/lib/closure";
import { addMember, createTestUser, createTestWorkspace, mockSessionFor } from "../rbac/helpers";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function patchRequest(id: string, body: unknown) {
  return new Request(`http://localhost/api/folders/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function deleteRequest(id: string) {
  return new Request(`http://localhost/api/folders/${id}`, { method: "DELETE" });
}

function moveRequest(id: string, newParentId: string | null) {
  return new Request(`http://localhost/api/folders/${id}/move`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ newParentId }),
  });
}

describe("cross-workspace IDOR — non-member of the target folder's workspace", () => {
  let patchFolder: typeof import("@/app/api/folders/[id]/route").PATCH;
  let deleteFolder: typeof import("@/app/api/folders/[id]/route").DELETE;
  let moveFolderRoute: typeof import("@/app/api/folders/[id]/move/route").POST;
  const createdUsers: string[] = [];
  const createdWorkspaces: string[] = [];

  beforeAll(async () => {
    ({ PATCH: patchFolder, DELETE: deleteFolder } = await import("@/app/api/folders/[id]/route"));
    ({ POST: moveFolderRoute } = await import("@/app/api/folders/[id]/move/route"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
    await Promise.all(createdUsers.splice(0).map((id) => db.delete(user).where(eq(user.id, id))));
  });

  // Caller is EDITOR in W1 only. The target folder id belongs to W2, where the caller has
  // zero membership — server must re-derive workspace_id=W2 from the folder row and reject
  // as a non-member, never trusting a client-implied W1 context (IDOR / 다른 워크스페이스).
  async function setupCallerAndForeignFolder() {
    const w1 = await createTestWorkspace("idor-w1");
    const w2 = await createTestWorkspace("idor-w2");
    createdWorkspaces.push(w1.id, w2.id);
    const caller = await createTestUser("idor-caller");
    createdUsers.push(caller.id);
    await addMember(w1.id, caller.id, "EDITOR");
    mockSessionFor(caller.id);
    const foreign = await createFolder(w2.id, null, "Foreign");
    return { w2, foreign };
  }

  it("PATCH rejects a non-member's rename of a foreign-workspace folder id with 403", async () => {
    const { foreign } = await setupCallerAndForeignFolder();
    const res = await patchFolder(patchRequest(foreign.id, { name: "Hijacked" }), ctx(foreign.id));
    expect(res.status).toBe(403);
  });

  it("DELETE rejects a non-member's soft-delete of a foreign-workspace folder id with 403", async () => {
    const { foreign } = await setupCallerAndForeignFolder();
    const res = await deleteFolder(deleteRequest(foreign.id), ctx(foreign.id));
    expect(res.status).toBe(403);
  });

  it("move rejects a non-member's move of a foreign-workspace folder id with 403", async () => {
    const { w2, foreign } = await setupCallerAndForeignFolder();
    const otherInW2 = await createFolder(w2.id, null, "OtherInW2");
    const res = await moveFolderRoute(moveRequest(foreign.id, otherInW2.id), ctx(foreign.id));
    expect(res.status).toBe(403);
  });
});

describe("cross-workspace move target — newParentId in a different workspace", () => {
  let moveFolderRoute: typeof import("@/app/api/folders/[id]/move/route").POST;
  const createdUsers: string[] = [];
  const createdWorkspaces: string[] = [];

  beforeAll(async () => {
    ({ POST: moveFolderRoute } = await import("@/app/api/folders/[id]/move/route"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
    await Promise.all(createdUsers.splice(0).map((id) => db.delete(user).where(eq(user.id, id))));
  });

  it("rejects moving a folder under a newParentId belonging to a different workspace with 400", async () => {
    const w1 = await createTestWorkspace("xws-parent-w1");
    const w2 = await createTestWorkspace("xws-parent-w2");
    createdWorkspaces.push(w1.id, w2.id);
    const caller = await createTestUser("xws-parent-caller");
    createdUsers.push(caller.id);
    await addMember(w1.id, caller.id, "EDITOR");
    mockSessionFor(caller.id);

    const target = await createFolder(w1.id, null, "Target");
    const foreignParent = await createFolder(w2.id, null, "ForeignParent");

    const res = await moveFolderRoute(moveRequest(target.id, foreignParent.id), ctx(target.id));
    expect(res.status).toBe(400);
  });
});

describe("move cycle rejection — moving into own descendant", () => {
  let moveFolderRoute: typeof import("@/app/api/folders/[id]/move/route").POST;
  const createdWorkspaces: string[] = [];
  const createdUsers: string[] = [];

  beforeAll(async () => {
    ({ POST: moveFolderRoute } = await import("@/app/api/folders/[id]/move/route"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
    await Promise.all(createdUsers.splice(0).map((id) => db.delete(user).where(eq(user.id, id))));
  });

  it("returns 409 when moving a folder into its own descendant", async () => {
    const ws = await createTestWorkspace("cycle-ws");
    createdWorkspaces.push(ws.id);
    const caller = await createTestUser("cycle-caller");
    createdUsers.push(caller.id);
    await addMember(ws.id, caller.id, "EDITOR");
    mockSessionFor(caller.id);

    const a = await createFolder(ws.id, null, "A");
    const b = await createFolder(ws.id, a.id, "B");

    const res = await moveFolderRoute(moveRequest(a.id, b.id), ctx(a.id));
    expect(res.status).toBe(409);
  });
});

describe("malformed / nonexistent ids", () => {
  let patchFolder: typeof import("@/app/api/folders/[id]/route").PATCH;
  let moveFolderRoute: typeof import("@/app/api/folders/[id]/move/route").POST;
  const createdWorkspaces: string[] = [];
  const createdUsers: string[] = [];

  beforeAll(async () => {
    ({ PATCH: patchFolder } = await import("@/app/api/folders/[id]/route"));
    ({ POST: moveFolderRoute } = await import("@/app/api/folders/[id]/move/route"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
    await Promise.all(createdUsers.splice(0).map((id) => db.delete(user).where(eq(user.id, id))));
  });

  it("PATCH returns 400 for a malformed (non-uuid) id, before reaching the DB", async () => {
    mockSessionFor("00000000-0000-4000-8000-000000000000");
    const res = await patchFolder(patchRequest("not-a-uuid", { name: "X" }), ctx("not-a-uuid"));
    expect(res.status).toBe(400);
  });

  it("PATCH returns 403 for a well-formed but nonexistent folder id (membership can't be established)", async () => {
    mockSessionFor("00000000-0000-4000-8000-000000000000");
    const nonexistentId = "11111111-1111-4111-8111-111111111111";
    const res = await patchFolder(patchRequest(nonexistentId, { name: "X" }), ctx(nonexistentId));
    expect(res.status).toBe(403);
  });

  it("move returns 400 for a malformed newParentId in the body", async () => {
    const ws = await createTestWorkspace("badid-move-ws");
    createdWorkspaces.push(ws.id);
    const caller = await createTestUser("badid-move-caller");
    createdUsers.push(caller.id);
    await addMember(ws.id, caller.id, "EDITOR");
    mockSessionFor(caller.id);
    const target = await createFolder(ws.id, null, "Target");

    const res = await moveFolderRoute(moveRequest(target.id, "not-a-uuid"), ctx(target.id));
    expect(res.status).toBe(400);
  });
});
