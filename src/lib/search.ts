// DOC-04 / 06-RESEARCH Pattern 2 + Architecture Diagram [검색]: pg_trgm ILIKE over
// title/content/tag, workspace-scoped, is_deleted=false only. Callers (the search route) are
// responsible for NFC-normalizing `q` before calling this (normalizeNFC, src/lib/validation.ts)
// -- this function never re-normalizes, mirroring documents.ts's convention that write/query-time
// normalization happens at the boundary (schema/route), not deep inside a service function.
//
// T-06-SQLI: workspaceId and the ILIKE pattern are always drizzle `sql` template placeholders,
// never string-concatenated into the query text -- tests/search/nfc-normalize.test.ts's
// metacharacter case proves a value like `%' OR '1'='1` is bound as a literal, not SQL syntax.
import { sql } from "drizzle-orm";
import { db } from "@/db";

type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  tags: string[];
}

type SearchRow = Record<string, unknown> & {
  id: string;
  title: string;
  snippet: string;
  tags: string[] | null;
};

// RESEARCH Open Question 2: snippet is a plain LEFT(content, 200) truncation, not a
// match-position-aware excerpt (deferred, out of this phase's scope). Tags are aggregated via a
// correlated subquery rather than the WHERE-filtered LEFT JOIN row, so a document that matched on
// title/content still returns ALL of its tags, not only a tag that happened to match the query
// (matches UI-SPEC "결과에 태그 노출" -- full tag list, not a filtered subset).
export async function searchWorkspace(
  workspaceId: string,
  q: string,
  client: DbClient = db,
): Promise<SearchResult[]> {
  if (!q) return [];
  const pattern = `%${q}%`;

  const rows = await client.execute<SearchRow>(sql`
    SELECT d.id AS id, d.title AS title, LEFT(d.content, 200) AS snippet,
      COALESCE(
        (SELECT array_agg(dt2.tag ORDER BY dt2.tag) FROM document_tag dt2 WHERE dt2.document_id = d.id),
        ARRAY[]::text[]
      ) AS tags
    FROM document d
    WHERE d.workspace_id = ${workspaceId}
      AND d.is_deleted = false
      AND (
        d.title ILIKE ${pattern}
        OR d.content ILIKE ${pattern}
        OR EXISTS (SELECT 1 FROM document_tag dt WHERE dt.document_id = d.id AND dt.tag ILIKE ${pattern})
      )
    ORDER BY d.title
  `);

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    snippet: row.snippet,
    tags: row.tags ?? [],
  }));
}
