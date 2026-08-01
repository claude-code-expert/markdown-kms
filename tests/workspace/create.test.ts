// WS-02: any logged-in member can create a workspace and becomes its OWNER. O2: name capped
// at 100 chars server-side. Committed before src/app/api/workspaces/route.ts exists (TDD).
import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user, workspace, workspaceMember } from "@/db/schema";
import { POST } from "@/app/api/workspaces/route";
import { createTestUser, mockSessionFor } from "../rbac/helpers";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

function createRequest(body: unknown) {
  return new Request("http://localhost/api/workspaces", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/workspaces", () => {
  const createdUsers: string[] = [];
  const createdWorkspaces: string[] = [];

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(createdWorkspaces.splice(0).map((id) => db.delete(workspace).where(eq(workspace.id, id))));
    await Promise.all(createdUsers.splice(0).map((id) => db.delete(user).where(eq(user.id, id))));
  });

  it("creates a workspace and makes the creator its OWNER (WS-02)", async () => {
    const creator = await createTestUser("create-owner");
    createdUsers.push(creator.id);
    mockSessionFor(creator.id);

    const res = await POST(createRequest({ name: "새 워크스페이스" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    createdWorkspaces.push(body.id);

    const [membership] = await db
      .select()
      .from(workspaceMember)
      .where(eq(workspaceMember.workspaceId, body.id));
    expect(membership.userId).toBe(creator.id);
    expect(membership.role).toBe("OWNER");
  });

  it("rejects a workspace name over 100 characters (O2)", async () => {
    const creator = await createTestUser("create-toolong");
    createdUsers.push(creator.id);
    mockSessionFor(creator.id);

    const tooLongName = "a".repeat(101);
    const res = await POST(createRequest({ name: tooLongName }));
    expect(res.status).toBe(400);

    const rows = await db.select().from(workspace).where(eq(workspace.name, tooLongName));
    expect(rows).toHaveLength(0);
  });

  it("rejects an unauthenticated request", async () => {
    mockSessionFor(null);
    const res = await POST(createRequest({ name: "no session" }));
    expect(res.status).toBe(403);
  });
});
