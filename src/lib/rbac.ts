import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { workspaceMember } from "@/db/schema";

// WS-01 / NFR-3.2: the single server-side authorization gate every mutating route calls (or,
// for role-independent actions like workspace creation, a plain session check) before doing
// any work. UI button-hiding is never a substitute (CLAUDE.md invariant) — never trust a
// client-supplied role.
export const ROLE_RANK = { VIEWER: 0, EDITOR: 1, ADMIN: 2, OWNER: 3 } as const;
export type Role = keyof typeof ROLE_RANK;

const FORBIDDEN_MESSAGE = "이 작업을 수행할 권한이 없습니다.";

export class ForbiddenError extends Error {
  constructor(message = FORBIDDEN_MESSAGE) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function forbiddenResponse() {
  return Response.json({ error: FORBIDDEN_MESSAGE }, { status: 403 });
}

/**
 * Looks up the caller's role in workspace_member for workspaceId and throws ForbiddenError
 * (route handlers map this to 403) when there is no session, the caller isn't a member, or
 * their role ranks below minRole. Always re-reads the DB — never trusts a client-supplied role.
 */
export async function requireRole(workspaceId: string, minRole: Role) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError();

  const [member] = await db
    .select({ role: workspaceMember.role })
    .from(workspaceMember)
    .where(and(eq(workspaceMember.workspaceId, workspaceId), eq(workspaceMember.userId, session.user.id)));

  if (!member || ROLE_RANK[member.role as Role] < ROLE_RANK[minRole]) {
    throw new ForbiddenError();
  }

  return { userId: session.user.id, role: member.role as Role };
}
