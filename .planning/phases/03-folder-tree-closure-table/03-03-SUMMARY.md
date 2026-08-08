---
phase: 03-folder-tree-closure-table
plan: 03
subsystem: database
tags: [closure-table, drizzle, postgres, transactions, tdd]

requires:
  - phase: 03-folder-tree-closure-table
    provides: "src/lib/closure.ts createFolder/getWorkspaceFolders + injectable db/tx client pattern (03-02)"
provides:
  - "src/lib/closure.ts: getSubtree(folderId, dbOrTx?) — ancestor-based single closure-join query, depth-independent (TREE-02)"
  - "src/lib/closure.ts: moveFolder(folderId, newParentId, dbOrTx?) — same-transaction cycle check (TOCTOU-safe) + cross-workspace rejection + DELETE/INSERT rewiring"
  - "src/lib/closure.ts: softDeleteFolder(folderId, dbOrTx?) — cascade soft-delete with closure preservation, tx-scoped subtree read (read-skew safe)"
  - "src/lib/closure.ts: CycleError, CrossWorkspaceError error classes"
affects: [03-04, 03-05]

actuals:
  tokens: 4457
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "DbClient type widened to `typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]` — the tx callback param lacks db's `$client` property so it isn't structurally assignable to `typeof db`; needed so a function can accept either the shared db or an in-flight tx and pass that same client through to a helper it calls (getSubtree(id, tx) from inside softDeleteFolder's transaction)."
    - "Cascade functions (moveFolder, softDeleteFolder) always route their internal reads through the same `tx` they open, never the module-level `db` — this is what makes the TOCTOU cycle check and the read-skew-safe subtree read possible."

key-files:
  created: []
  modified:
    - src/lib/closure.ts
    - tests/folder/closure.test.ts
    - tests/folder/query-count.test.ts

key-decisions:
  - "moveFolder's rewiring test moves B under an unrelated root E, not under D (a child of A) — moving into D would legitimately keep A as a transitive ancestor of B via D (since D's own ancestor chain includes A), which the CROSS JOIN INSERT correctly reproduces. That isn't a bug; it's exactly what the plan's behavior spec describes as \"(루트조상,...) 재작성\" (root ancestors get rewritten too). Using an unrelated root E isolates the assertion to a genuine external-link drop."
  - "Cross-workspace rejection throws a distinct CrossWorkspaceError (not CycleError) so a route handler can map it to 400 vs. 409 differently if needed later, per RESEARCH's suggestion."

patterns-established:
  - "getSubtree/moveFolder/softDeleteFolder all default their client param to `db` but accept an injected `tx` — cascade operations always pass their own transaction's `tx` to any closure helper they call internally, preventing read-skew (RESEARCH Pitfall 4) and TOCTOU races (RESEARCH Pitfall 1)."

requirements-completed: [TREE-02, TREE-03]

coverage:
  - id: D1
    description: "getSubtree(folderId) returns the folder itself plus all descendants via a single closure-join query, excluding soft-deleted folders"
    requirement: "TREE-02"
    verification:
      - kind: unit
        ref: "tests/folder/closure.test.ts#closure.getSubtree — ancestor-based single-query subtree (TREE-02)"
        status: pass
    human_judgment: false
  - id: D2
    description: "getSubtree issues a fixed SQL statement count independent of subtree depth"
    requirement: "TREE-02"
    verification:
      - kind: unit
        ref: "tests/folder/query-count.test.ts#getSubtree — fixed SQL statement count regardless of subtree depth (TREE-02)"
        status: pass
    human_judgment: false
  - id: D3
    description: "moveFolder rewires closure rows correctly: drops external ancestor links, preserves internal subtree links, rewrites new-parent-ancestors x subtree, updates folder.parentId; supports moving to workspace root (newParentId=null)"
    requirement: "TREE-03"
    verification:
      - kind: unit
        ref: "tests/folder/closure.test.ts#closure.moveFolder — TOCTOU-safe cycle check + rewiring + cross-workspace rejection"
        status: pass
    human_judgment: false
  - id: D4
    description: "moveFolder rejects moving a folder into its own descendant or into itself (cycle), before any rewiring — closure snapshot unchanged after rejection; same-transaction check prevents TOCTOU races"
    requirement: "TREE-03"
    verification:
      - kind: unit
        ref: "tests/folder/closure.test.ts#rejects moving a folder into its own descendant (cycle) before any rewiring / rejects moving a folder onto itself (self row triggers the cycle check)"
        status: pass
    human_judgment: false
  - id: D5
    description: "moveFolder rejects moving into a folder belonging to a different workspace, without changing any closure rows"
    requirement: "TREE-03"
    verification:
      - kind: unit
        ref: "tests/folder/closure.test.ts#rejects moving into a folder from a different workspace, without changing any closure rows"
        status: pass
    human_judgment: false
  - id: D6
    description: "softDeleteFolder cascades is_deleted=true/deleted_at to the whole subtree, sets is_trash_root=true only on the direct delete target, and leaves folder_closure rows untouched (restore is the inverse)"
    requirement: "TREE-03"
    verification:
      - kind: unit
        ref: "tests/folder/closure.test.ts#closure.softDeleteFolder — cascade soft-delete, closure preserved"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-08-08
status: complete
---

# Phase 3 Plan 3: Folder Tree Closure Operations Summary

**getSubtree/moveFolder/softDeleteFolder added to src/lib/closure.ts — same-transaction TOCTOU-safe cycle check, cross-workspace rejection, and cascade soft-delete that preserves closure rows for restore, proven by 780 green vitest tests.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-08T12:27Z
- **Tasks:** 3 (RED test commit + 2 GREEN implementation commits)
- **Files modified:** 3 (`src/lib/closure.ts`, `tests/folder/closure.test.ts`, `tests/folder/query-count.test.ts`)

## Accomplishments

- `getSubtree(folderId, dbOrTx?)` — TRD §4's ancestor-based subtree query (`folder_closure JOIN folder WHERE ancestor_id=:id AND is_deleted=false`), single statement regardless of subtree depth (query-count test proves depth-2 vs depth-6 issue the same statement count).
- `moveFolder(folderId, newParentId, dbOrTx?)` — cycle check (`SELECT` for a `(folderId → newParentId)` closure row) runs as the transaction's first statement, before any DELETE/INSERT rewiring, closing the TOCTOU window RESEARCH Pitfall 1 warned about. A self-move (`newParentId === folderId`) is caught by the same check via the self closure row. Cross-workspace moves are rejected via a `CrossWorkspaceError` after comparing the target's and new-parent's `workspace_id` inside the same transaction. Rewiring itself is the TRD §4 literal SQL: DELETE the subtree's external ancestor links only (internal links between subtree members untouched), then CROSS JOIN INSERT `new-parent-ancestors × subtree` when `newParentId` is non-null.
- `softDeleteFolder(folderId, dbOrTx?)` — reads the subtree id list via `getSubtree(folderId, tx)` **inside the same transaction** as the subsequent UPDATEs (RESEARCH Pitfall 4, avoids a read-skew window between the subtree snapshot and the cascade write), sets `is_deleted=true`/`deleted_at=now()` on the whole subtree, `is_trash_root=true` only on the direct delete target, and leaves `folder_closure` rows untouched (restore is the documented inverse of this operation, TRD §4).
- `CycleError`/`CrossWorkspaceError extends Error` follow the existing `ForbiddenError` convention in `rbac.ts`.
- TDD RED→GREEN gate confirmed in git log: `test(03-03)` commit (`0a57f68`) precedes both `feat(03-03)` commits (`c056210`, `41a0522`).
- Full suite: 780 vitest tests green (up from 761 baseline for this branch — 03-02 added 9, this plan added 10 more: 3 getSubtree + 5 moveFolder + 1 softDeleteFolder + 1 query-count), `tsc --noEmit` clean.

## Task Commits

1. **Task 1: RED — getSubtree/moveFolder(cycle/cross-ws)/softDeleteFolder integration tests**
   - `0a57f68` — `test(03-03): add failing test for getSubtree/moveFolder/softDeleteFolder`
   - Confirmed RED: `tsc`/import failures for `getSubtree`, `moveFolder`, `softDeleteFolder`, `CycleError` before any implementation existed.

2. **Task 2: getSubtree + moveFolder (same-transaction cycle check + rewiring)**
   - `c056210` — `feat(03-03): getSubtree + moveFolder (same-transaction cycle check + rewiring)`
   - Verified green: `pnpm vitest run tests/folder/closure.test.ts -t "moveFolder"` (5/5), `-t "cycle"` (5/5 — cycle tests are a subset of the moveFolder describe block), `-t "getSubtree"` (3/3).

3. **Task 3: softDeleteFolder (cascade + closure preservation, tx-scoped subtree read)**
   - `41a0522` — `feat(03-03): softDeleteFolder cascade with closure preservation`
   - Verified green: `pnpm vitest run tests/folder/closure.test.ts -t "softDelete"` (1/1), full `pnpm vitest run tests/folder` (21/21), full suite `pnpm vitest run` (780/780), `tsc --noEmit` clean.

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/lib/closure.ts` — added `CycleError`, `CrossWorkspaceError`, `getSubtree`, `moveFolder`, `softDeleteFolder`; widened `DbClient` type to a union covering both `db` and the `tx` callback param
- `tests/folder/closure.test.ts` — added `closure.getSubtree`, `closure.moveFolder`, `closure.softDeleteFolder` describe blocks (10 new tests)
- `tests/folder/query-count.test.ts` — added `getSubtree — fixed SQL statement count` describe block (1 new test)

## Decisions Made

- **moveFolder rewiring test target** — see `key-decisions` in frontmatter. Moving B under D (a child of A) legitimately keeps A as a transitive ancestor of B via D; that's correct closure-table semantics and matches the plan's "(루트조상,...) 재작성" language, not a bug. The test now moves B under an unrelated root E to isolate a genuine external-link-drop assertion.
- **CrossWorkspaceError as a distinct class from CycleError** — lets a future route handler (03-04) map cycle rejections and cross-workspace rejections to different HTTP status codes if the API design calls for it, without string-matching error messages.
- **DbClient type widened to a union** — `tx` (the callback parameter of `db.transaction`) is structurally missing `$client` compared to `typeof db`, so a plain `type DbClient = typeof db` (03-02's original alias) doesn't accept `tx` as an argument. Widened to `typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]` so `softDeleteFolder`'s `tx` can be passed straight into `getSubtree(folderId, tx)`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a test-design bug in the moveFolder rewiring test (own test file, not production code)**
- **Found during:** Task 2 verification (`pnpm vitest run tests/folder/closure.test.ts -t "moveFolder"`)
- **Issue:** The RED test committed in Task 1 asserted that moving B (child of A) under D (also a child of A) would drop A as B's ancestor entirely. That assumption is wrong: since D's own ancestor chain includes A, the CROSS JOIN INSERT correctly re-adds `(A,B)`/`(A,C)` at a new depth via D — A remains a legitimate transitive ancestor. This matches the plan's own behavior spec ("새 부모 D의 조상 × B서브트리로 (D,B),(D,C),(루트조상,...) 재작성").
- **Fix:** Added an unrelated root folder E (sibling of A, sharing no ancestry) to the test's tree builder, and changed the rewiring test to move B under E instead of D — isolating the assertion to a genuine external-link drop while D remains available for future tests if needed.
- **Files modified:** `tests/folder/closure.test.ts`
- **Verification:** `pnpm vitest run tests/folder/closure.test.ts -t "moveFolder"` — 5/5 pass.
- **Committed in:** `c056210` (folded into Task 2's GREEN commit, since the bug only manifested once `moveFolder` existed and the test actually ran).

**2. [Rule 3 - Blocking issue] Widened DbClient type alias so tx is assignable**
- **Found during:** Task 3 implementation (`softDeleteFolder` calling `getSubtree(folderId, tx)`)
- **Issue:** `tsc --noEmit` failed with `Argument of type 'PgTransaction<...>' is not assignable to parameter of type 'PostgresJsDatabase<...> & { $client: Sql<{}>; }'` — the 03-02-established `type DbClient = typeof db` alias doesn't structurally match the `tx` parameter type from inside a `db.transaction` callback, which lacks `$client`.
- **Fix:** Widened the alias to `type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]`, a union covering both the module-level `db` and any in-flight transaction client. RESEARCH's Pitfall 4 explicitly anticipated this need (A3: "getSubtree/getWorkspaceFolders 등 lib/closure.ts 함수가 두 번째 인자로 db/tx를 선택적으로 받도록 설계") but left the exact signature to the executor.
- **Files modified:** `src/lib/closure.ts`
- **Verification:** `pnpm exec tsc --noEmit` — clean.
- **Committed in:** `41a0522` (Task 3 GREEN commit).

---

**Total deviations:** 2 auto-fixed (1 test-design bug fix, 1 blocking type-compatibility fix)
**Impact on plan:** Both fixes are internal to test/type correctness, not scope changes. No production behavior changed beyond what the plan specified. No scope creep.

## Issues Encountered

None beyond the two auto-fixed issues above.

## User Setup Required

None. The dev DB was already running (Homebrew PG16 @ 5433, confirmed via `pg_isready` before starting), and `.env.local`'s `DATABASE_URL_TEST` was already wired by 03-01/03-02 — this plan's tests ran against it without any manual setup.

## Next Phase Readiness

- `src/lib/closure.ts` now exposes the full TRD §4 operation set (`createFolder`, `getWorkspaceFolders`, `getSubtree`, `moveFolder`, `softDeleteFolder`) plus `CycleError`/`CrossWorkspaceError` — 03-04 (API routes: rename/move/delete) can wire these directly behind `requireRole(workspaceId, "EDITOR")` gates, deriving `workspaceId` server-side from the target folder row (never trusting client-supplied values), per RESEARCH Pitfall 3.
- The `moveFolder`/`softDeleteFolder` transaction boundaries are already correct for 03-04's route handlers to catch `CycleError` → 409 and `CrossWorkspaceError` → 400 (or whatever status mapping 03-04 chooses) without any further transaction-level changes.
- No blockers identified for 03-04 onward.

---
*Phase: 03-folder-tree-closure-table*
*Completed: 2026-08-08*

## Self-Check: PASSED

All claimed files exist (`src/lib/closure.ts`, `tests/folder/closure.test.ts`, `tests/folder/query-count.test.ts`, this SUMMARY.md) and all three task commits (`0a57f68`, `c056210`, `41a0522`) are present in git log.
