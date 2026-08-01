// Factories for RBAC/workspace tests: real DB rows (user, workspace, workspace_member) plus a
// mocked session so route handlers see a real caller without going through cookies/HTTP.
//
// Requires the test file importing this to declare, at its top:
//   vi.mock("@/auth", () => ({ auth: vi.fn() }));
// (vi.mock is hoisted per-file by vitest, so it must live in the test file itself — this
// module just drives the resulting mock.)
import { vi } from "vitest";
import type { Session } from "next-auth";
import { db } from "@/db";
import { user, workspace, workspaceMember } from "@/db/schema";
import { auth } from "@/auth";

export type Role = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";

let seq = 0;
function uniqueEmail(prefix: string) {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}@example.com`;
}

export async function createTestUser(prefix: string) {
  const [created] = await db
    .insert(user)
    .values({ email: uniqueEmail(prefix), name: prefix })
    .returning();
  return created;
}

export async function createTestWorkspace(name: string, isDefault = false) {
  const [created] = await db.insert(workspace).values({ name, isDefault }).returning();
  return created;
}

export async function addMember(workspaceId: string, userId: string, role: Role) {
  await db.insert(workspaceMember).values({ workspaceId, userId, role });
}

// `auth` is overloaded (plain session lookup vs. the middleware-wrapping call signature);
// pin the overload we actually use so vi.mocked resolves mockResolvedValue's param type
// correctly instead of picking the unrelated NextMiddleware overload.
type SessionLookup = () => Promise<Session | null>;

export function mockSessionFor(userId: string | null) {
  vi.mocked(auth as SessionLookup).mockResolvedValue(
    userId ? ({ user: { id: userId }, expires: "" } as Session) : null,
  );
}
