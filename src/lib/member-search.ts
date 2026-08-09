// WS-05 / 07-RESEARCH Flow A: reuses search.ts's ILIKE-escape + sql template pattern
// (T-06-SQLI) against user.email/user.name, with an EXISTS(workspace_member) correlated
// subquery flagging whether a matched user already belongs to this workspace. isMember is a
// UI hint (badge/disable in 07-05 InviteSearch) -- the route stays ADMIN-only regardless of a
// given row's isMember value (T-07-04-ENUM).
import { sql } from "drizzle-orm";
import { db } from "@/db";

type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface MemberSearchResult {
  userId: string;
  email: string;
  name: string;
  isMember: boolean;
}

type MemberSearchRow = Record<string, unknown> & {
  userId: string;
  email: string;
  name: string;
  isMember: boolean;
};

export async function searchUsersForInvite(
  workspaceId: string,
  q: string,
  client: DbClient = db,
): Promise<MemberSearchResult[]> {
  if (!q) return [];
  // IN-02 (search.ts:43-44 그대로): `%`/`_`를 리터럴로 이스케이프.
  const escaped = q.replace(/[\\%_]/g, "\\$&");
  const pattern = `%${escaped}%`;

  const rows = await client.execute<MemberSearchRow>(sql`
    SELECT u.id AS "userId", u.email AS email, u.name AS name,
      EXISTS(
        SELECT 1 FROM workspace_member wm WHERE wm.workspace_id = ${workspaceId} AND wm.user_id = u.id
      ) AS "isMember"
    FROM "user" u
    WHERE u.email ILIKE ${pattern} ESCAPE '\\' OR u.name ILIKE ${pattern} ESCAPE '\\'
    ORDER BY u.name
  `);

  return rows.map((row) => ({
    userId: row.userId,
    email: row.email,
    name: row.name,
    isMember: row.isMember,
  }));
}
