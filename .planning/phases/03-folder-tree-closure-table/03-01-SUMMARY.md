---
phase: 03-folder-tree-closure-table
plan: 01
subsystem: database
tags: [drizzle, postgresql, closure-table, migration]

requires:
  - phase: 01-auth-workspace-foundation
    provides: workspace pgTable (FK target for folder.workspace_id), Drizzle schema/migration conventions
provides:
  - "folder pgTable (id, workspace_id FK cascade, parent_id self-FK, name, is_deleted, is_trash_root, deleted_at, created_at, updated_at)"
  - "folderClosure pgTable (ancestor_id, descendant_id composite PK, depth, cascade FKs, descendant_id index)"
  - "folder_active_idx partial index on folder(workspace_id, parent_id) WHERE is_deleted = false"
  - "drizzle/0002_third_tattoo.sql migration, applied to dev DB (localhost:5433) and test DB (via global-setup)"
affects: [03-02, 03-03, 03-04, 03-05, phase-04-documents]

actuals:
  tokens: 4430
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Self-referencing FK typed via AnyPgColumn return type to avoid circular type inference (drizzle-orm/pg-core)"
    - "Partial index via pgTable's array-form third arg: index(...).on(...).where(sql\`...\`)"

key-files:
  created:
    - tests/folder/schema.test.ts
    - drizzle/0002_third_tattoo.sql
  modified:
    - src/db/schema.ts

key-decisions:
  - "Task 1 checkpoint:decision (one-way folder/folder_closure migration) pre-approved by user via orchestrator (2026-08-08) — recorded as apply-now, migration generated and applied without re-prompting."
  - "No sibling-name-uniqueness constraint added on folder(parent_id, name) — CONTEXT.md lock, confirmed absent via grep in acceptance criteria."
  - "folder.parent_id FK has no ON DELETE action (matches TRD §3 literally — only folder.workspace_id and folder_closure's ancestor_id/descendant_id specify ON DELETE CASCADE)."

patterns-established:
  - "Closure table schema: composite PK (ancestor_id, descendant_id) + separate descendant_id index for reverse lookups, cascade FKs to the owning table's PK so hard-deleting a folder row cleans up closure rows."

requirements-completed: [TREE-02, TREE-03]

coverage:
  - id: D1
    description: "folder table exists with workspace_id FK cascade, self-FK parent_id, name, is_deleted/is_trash_root/deleted_at, created_at/updated_at columns per TRD §3"
    requirement: "TREE-02"
    verification:
      - kind: unit
        ref: "tests/folder/schema.test.ts#folder table exists and is queryable"
        status: pass
    human_judgment: false
  - id: D2
    description: "folder_closure table exists with (ancestor_id, descendant_id) composite PK, depth column, and descendant_id index"
    requirement: "TREE-02"
    verification:
      - kind: unit
        ref: "tests/folder/schema.test.ts#folder_closure table exists and is queryable"
        status: pass
    human_judgment: false
  - id: D3
    description: "No sibling-name-uniqueness constraint exists on folder — CONTEXT.md lock preserved"
    requirement: "TREE-03"
    verification:
      - kind: other
        ref: "grep -iE 'unique.*(folder_name|parent_id)' drizzle/0002_third_tattoo.sql (no match)"
        status: pass
    human_judgment: false
  - id: D4
    description: "folder_active_idx partial index exists (workspace_id, parent_id) WHERE is_deleted = false"
    requirement: "TREE-02"
    verification:
      - kind: other
        ref: "drizzle/0002_third_tattoo.sql: CREATE INDEX \"folder_active_idx\" ... WHERE \"folder\".\"is_deleted\" = false"
        status: pass
    human_judgment: false
  - id: D5
    description: "Migration applied to dev DB (localhost:5433) — one-way schema change confirmed and executed"
    verification:
      - kind: other
        ref: "pnpm drizzle-kit migrate (dev DB) — exit 0, migrations applied successfully"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-08
status: complete
---

# Phase 3 Plan 1: Folder Tree Schema Foundation Summary

**TRD §3 folder/folder_closure Drizzle schema + migration 0002, applied to dev DB, with schema smoke tests (761 total tests green, tsc clean).**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-08-08T03:08:45Z
- **Tasks:** 2 (checkpoint:decision + auto/tdd)
- **Files modified:** 5 (src/db/schema.ts, tests/folder/schema.test.ts, drizzle/0002_third_tattoo.sql, drizzle/meta/0002_snapshot.json, drizzle/meta/_journal.json)

## Accomplishments
- `folder` and `folderClosure` Drizzle pgTable definitions added to `src/db/schema.ts`, translating TRD §3 DDL 1:1 (no redesign — a locked contract).
- `drizzle/0002_third_tattoo.sql` generated and applied to the dev Postgres DB (Homebrew PG16 @ localhost:5433).
- `tests/folder/schema.test.ts` smoke-verifies both tables exist and are queryable via Drizzle (TDD RED→GREEN).
- Full suite (761 tests, up from 759) green; `tsc --noEmit` clean.

## Task Commits

1. **Task 1: folder/folder_closure 마이그레이션 적용 게이트 (one-way)** — checkpoint:decision, no code change. Decision recorded: **apply-now**, pre-approved by user via orchestrator instructions (2026-08-08). No separate commit (decision-only task).
2. **Task 2: folder/folder_closure 스키마 + 마이그레이션 + 정합성 smoke 테스트** — TDD:
   - RED: `c50553b` — `test(03-01): add failing test for folder/folder_closure schema`
   - GREEN: `04e8c8f` — `feat(03-01): add folder/folder_closure schema + migration`

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/db/schema.ts` — added `folder` and `folderClosure` pgTable exports (imports: `AnyPgColumn`, `index`, `integer` added to existing `drizzle-orm/pg-core` import)
- `tests/folder/schema.test.ts` — schema smoke test (2 cases)
- `drizzle/0002_third_tattoo.sql` — generated migration (CREATE TABLE folder, CREATE TABLE folder_closure, 4 FK constraints, 2 indexes)
- `drizzle/meta/0002_snapshot.json`, `drizzle/meta/_journal.json` — drizzle-kit bookkeeping

## Decisions Made
- Task 1's `checkpoint:decision gate="blocking"` was pre-approved by the user via the orchestrator prompt (2026-08-08) — recorded as **apply-now** without re-prompting, per explicit instruction in this executor's task context.
- Followed TRD §3 DDL literally: `folder.parent_id` self-FK has no `ON DELETE` action (only `workspace_id` and `folder_closure`'s two FKs specify `ON DELETE CASCADE`, matching the TRD source exactly).
- No sibling-name-uniqueness constraint added — CONTEXT.md lock, confirmed absent by acceptance-criteria grep.

## Deviations from Plan

None — plan executed exactly as written. TDD RED/GREEN gate sequence confirmed present in git log (`test(03-01)` commit before `feat(03-01)` commit).

## Issues Encountered
None.

## User Setup Required

None beyond what the plan's `user_setup` block already specified (DATABASE_URL via `.env.local`, already present and used by `drizzle.config.ts`/`vitest.config.ts`). Migration was applied to the dev DB (5433) as part of Task 2; the test DB (`DATABASE_URL_TEST`) is auto-migrated by `tests/global-setup.ts`.

## Next Phase Readiness
- `folder`/`folderClosure` tables exist in both dev and test databases — Wave 2+ plans (closure operations in `src/lib/closure.ts`, API routes, tree UI) can now build on this schema.
- No blockers identified for 03-02 onward.

---
*Phase: 03-folder-tree-closure-table*
*Completed: 2026-08-08*

## Self-Check: PASSED

All claimed files exist (`src/db/schema.ts`, `tests/folder/schema.test.ts`, `drizzle/0002_third_tattoo.sql`, this SUMMARY.md) and both commits (`c50553b`, `04e8c8f`) are present in git log.
