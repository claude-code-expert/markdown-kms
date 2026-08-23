// WS-03 개정 — 워크스페이스 ID를 몰라도 이름으로 찾아 가입 신청할 수 있게 한다.
// member-search.ts와 동일 ILIKE-escape + sql 템플릿 패턴(T-06-SQLI) — 검색 대상만
// workspace.name으로 바뀌고, isMember 대신 isMember/hasPendingRequest 두 플래그로 UI가
// "신청" 버튼을 disable할지 판단한다.
import { sql } from "drizzle-orm";
import { db } from "@/db";

type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface WorkspaceSearchResult {
  id: string;
  name: string;
  isMember: boolean;
  hasPendingRequest: boolean;
}

type WorkspaceSearchRow = Record<string, unknown> & {
  id: string;
  name: string;
  isMember: boolean;
  hasPendingRequest: boolean;
};

export async function searchWorkspacesByName(
  userId: string,
  q: string,
  client: DbClient = db,
): Promise<WorkspaceSearchResult[]> {
  if (!q) return [];
  // member-search.ts:31-32와 동일 — `%`/`_`를 리터럴로 이스케이프.
  const escaped = q.replace(/[\\%_]/g, "\\$&");
  const pattern = `%${escaped}%`;

  const rows = await client.execute<WorkspaceSearchRow>(sql`
    SELECT w.id AS id, w.name AS name,
      EXISTS(
        SELECT 1 FROM workspace_member wm WHERE wm.workspace_id = w.id AND wm.user_id = ${userId}
      ) AS "isMember",
      EXISTS(
        SELECT 1 FROM workspace_join_request jr
        WHERE jr.workspace_id = w.id AND jr.user_id = ${userId} AND jr.status = 'PENDING'
      ) AS "hasPendingRequest"
    FROM workspace w
    WHERE w.is_deleted = false AND w.name ILIKE ${pattern} ESCAPE '\\'
    ORDER BY w.name
    LIMIT 20
  `);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    isMember: row.isMember,
    hasPendingRequest: row.hasPendingRequest,
  }));
}
