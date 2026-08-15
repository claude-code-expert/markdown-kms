import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { document, folder, user, workspace, workspaceMember } from "@/db/schema";

/**
 * Every ACTIVE workspace a user belongs to, with their role — dashboard now, reused by
 * RBAC-adjacent screens later. Soft-deleted workspaces (is_deleted=true, D-15 개정) are excluded
 * so a deleted workspace disappears from active views without losing the underlying rows.
 *
 * Phase 9 D-08: 워크스페이스 카드용 실데이터 필드 확장 — createdAt, ownerName(OWNER 멤버가
 * 없는 워크스페이스, 예: 전원 EDITOR인 시드 기본 워크스페이스는 null), docCount/folderCount
 * (활성 항목만 카운트하는 상관 서브쿼리 — 멤버십 목록이 이미 워크스페이스 단위라 고정
 * 서브쿼리 수 유지, TRD Closure Table 고정 쿼리 수 불변식 위반 아님). 서브쿼리 조건은 전부
 * drizzle sql 템플릿 컬럼 참조/정적 불리언 — 호출자 제어값은 userId뿐이며 바깥 WHERE의
 * eq()로 이미 바인딩됨(T-09-02-SQLI).
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
