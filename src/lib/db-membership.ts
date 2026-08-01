import { eq } from "drizzle-orm";
import { db } from "@/db";
import { workspace, workspaceMember } from "@/db/schema";

/** Every workspace a user belongs to, with their role — dashboard now, reused by RBAC-adjacent screens later. */
export async function listMembershipsForUser(userId: string) {
  return db
    .select({
      id: workspace.id,
      name: workspace.name,
      role: workspaceMember.role,
    })
    .from(workspaceMember)
    .innerJoin(workspace, eq(workspaceMember.workspaceId, workspace.id))
    .where(eq(workspaceMember.userId, userId));
}
