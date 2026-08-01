import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { workspace, workspaceMember } from "@/db/schema";

/**
 * Every ACTIVE workspace a user belongs to, with their role — dashboard now, reused by
 * RBAC-adjacent screens later. Soft-deleted workspaces (is_deleted=true, D-15 개정) are excluded
 * so a deleted workspace disappears from active views without losing the underlying rows.
 */
export async function listMembershipsForUser(userId: string) {
  return db
    .select({
      id: workspace.id,
      name: workspace.name,
      role: workspaceMember.role,
    })
    .from(workspaceMember)
    .innerJoin(workspace, eq(workspaceMember.workspaceId, workspace.id))
    .where(and(eq(workspaceMember.userId, userId), eq(workspace.isDeleted, false)));
}
