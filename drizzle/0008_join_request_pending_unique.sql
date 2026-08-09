-- WR-03: the duplicate-PENDING check in the join-requests POST route was SELECT-then-INSERT
-- (racy) with no DB constraint backing it — two concurrent submissions could both pass the
-- SELECT and create two PENDING rows for the same (workspace, user). A plain unique index can't
-- express "unique only while PENDING" (APPROVED/REJECTED history for the same pair is legitimate
-- and must stay insertable), so this is a partial index, same custom-SQL-migration pattern as
-- 0006_pg_trgm_search_index.sql (drizzle-kit's schema DSL doesn't emit gin_trgm_ops/partial
-- predicates the way we need here either).
CREATE UNIQUE INDEX "workspace_join_request_pending_unique_idx" ON "workspace_join_request" ("workspace_id","user_id") WHERE "status" = 'PENDING';