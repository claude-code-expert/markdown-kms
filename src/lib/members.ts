// WS-05 (멤버 페이지 RSC): db-membership.ts의 listMembershipsForUser와 동일한 innerJoin 관례를
// 반전(workspace_member ⨝ user)하고 workspace_join_request ⨝ user로 반복. RSC가 직접 await하므로
// route/fetch 계층 없음 -- 07-05 members/page.tsx가 소비.
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { user, workspaceJoinRequest, workspaceMember } from "@/db/schema";

type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function getWorkspaceMembers(workspaceId: string, client: DbClient = db) {
  return client
    .select({ userId: user.id, name: user.name, email: user.email, role: workspaceMember.role })
    .from(workspaceMember)
    .innerJoin(user, eq(workspaceMember.userId, user.id))
    .where(eq(workspaceMember.workspaceId, workspaceId));
}

export async function getPendingJoinRequests(workspaceId: string, client: DbClient = db) {
  return client
    .select({
      reqId: workspaceJoinRequest.id,
      userId: user.id,
      name: user.name,
      email: user.email,
      createdAt: workspaceJoinRequest.createdAt,
    })
    .from(workspaceJoinRequest)
    .innerJoin(user, eq(workspaceJoinRequest.userId, user.id))
    .where(and(eq(workspaceJoinRequest.workspaceId, workspaceId), eq(workspaceJoinRequest.status, "PENDING")));
}
