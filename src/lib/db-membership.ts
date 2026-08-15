import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { document, folder, user, workspace, workspaceMember } from "@/db/schema";

/**
 * Every ACTIVE workspace a user belongs to, with their role — dashboard now, reused by
 * RBAC-adjacent screens later. Soft-deleted workspaces (is_deleted=true, D-15 개정) are excluded
 * so a deleted workspace disappears from active views without losing the underlying rows.
 *
 * Phase 9 D-08: extended with real-data card fields — createdAt, ownerName (null when the
 * workspace has no OWNER member, e.g. the seeded default workspace where everyone is EDITOR),
 * docCount/folderCount (active-only counts, correlated subqueries — the membership list is
 * already workspace-scoped so this stays a fixed number of subqueries, not N+1 per TRD Closure
 * Table's fixed-query-count invariant). All subquery predicates are drizzle sql-template column
 * refs / static booleans — userId is the only caller-controlled value and it's already bound via
 * eq() in the outer WHERE (T-09-02-SQLI).
 */
export async function listMembershipsForUser(userId: string) {
  return db
    .select({
      id: workspace.id,
      name: workspace.name,
      role: workspaceMember.role,
      createdAt: workspace.createdAt,
      ownerName: sql<string | null>`(
        select ${user.name} from ${workspaceMember}
        inner join ${user} on ${user.id} = ${workspaceMember.userId}
        where ${workspaceMember.workspaceId} = ${workspace.id} and ${workspaceMember.role} = 'OWNER'
        limit 1
      )`,
      docCount: sql<number>`(
        select count(*)::int from ${document}
        where ${document.workspaceId} = ${workspace.id} and ${document.isDeleted} = false
      )`,
      folderCount: sql<number>`(
        select count(*)::int from ${folder}
        where ${folder.workspaceId} = ${workspace.id} and ${folder.isDeleted} = false and ${folder.isTrashRoot} = false
      )`,
    })
    .from(workspaceMember)
    .innerJoin(workspace, eq(workspaceMember.workspaceId, workspace.id))
    .where(and(eq(workspaceMember.userId, userId), eq(workspace.isDeleted, false)));
}
