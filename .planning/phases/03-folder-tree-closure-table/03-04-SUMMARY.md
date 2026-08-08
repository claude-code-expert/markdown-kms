---
phase: 03-folder-tree-closure-table
plan: 04
subsystem: folder-tree
tags: [rbac, idor, next-app-router, closure-table]

requires:
  - phase: 03-folder-tree-closure-table
    provides: "src/lib/closure.ts: moveFolder/softDeleteFolder/CycleError/CrossWorkspaceError (03-03)"
provides:
  - "PATCH /api/folders/[id] — rename, EDITOR+, IDOR-safe (server re-derives workspace_id from the folder row)"
  - "DELETE /api/folders/[id] — soft-delete cascade via closure.ts's softDeleteFolder, EDITOR+, IDOR-safe"
  - "POST /api/folders/[id]/move — move via closure.ts's moveFolder, EDITOR+, IDOR-safe, CycleError->409, CrossWorkspaceError->400"
  - "tests/folder/rbac.test.ts, tests/folder/cross-workspace.test.ts — role matrix + cross-workspace IDOR regression coverage for all three routes"
affects: [03-05]

actuals:
  tokens: 6188
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "wsId-less mutation routes (folders/[id]*) re-derive workspace_id from a server-side SELECT on the target resource row before calling requireRole — never trust a client-supplied workspaceId. A missing row is treated as 403 (membership can't be established), not 404, matching the existing DELETE /api/workspaces/[id] convention."
    - "closure.ts error classes (CycleError, CrossWorkspaceError) map to distinct HTTP statuses (409, 400) at the route boundary via try/catch around the lib call — the lib stays HTTP-agnostic."

key-files:
  created:
    - src/app/api/folders/[id]/route.ts
    - src/app/api/folders/[id]/move/route.ts
    - tests/folder/rbac.test.ts
    - tests/folder/cross-workspace.test.ts
  modified: []

key-decisions:
  - "A folder id with no matching row returns 403, not 404 — mirrors the existing DELETE /api/workspaces/[id] pattern (forbiddenResponse() when the target lookup comes back empty) so a caller can't distinguish 'wrong workspace' from 'doesn't exist' via status code (information-leak-safe IDOR posture)."
  - "moveFolder's CycleError/CrossWorkspaceError are caught by name (instanceof) at the route boundary and mapped to 409/400 respectively; any other thrown error re-throws (uncaught -> 500), keeping the route handler from silently swallowing unexpected DB errors."

patterns-established: []

requirements-completed: [TREE-03]

coverage:
  - id: D1
    description: "PATCH /api/folders/[id] renames a folder for OWNER/ADMIN/EDITOR callers and rejects VIEWER/non-member/unauthenticated callers with 403"
    requirement: "TREE-03"
    verification:
      - kind: integration
        ref: "tests/folder/rbac.test.ts#RBAC matrix — PATCH /api/folders/[id] (rename, EDITOR+)"
        status: pass
    human_judgment: false
  - id: D2
    description: "DELETE /api/folders/[id] soft-deletes the subtree (cascade via closure.ts's softDeleteFolder) for OWNER/ADMIN/EDITOR callers and rejects VIEWER/non-member/unauthenticated callers with 403"
    requirement: "TREE-03"
    verification:
      - kind: integration
        ref: "tests/folder/rbac.test.ts#RBAC matrix — DELETE /api/folders/[id] (soft-delete cascade, EDITOR+)"
        status: pass
    human_judgment: false
  - id: D3
    description: "POST /api/folders/[id]/move moves a folder for OWNER/ADMIN/EDITOR callers and rejects VIEWER/non-member/unauthenticated callers with 403"
    requirement: "TREE-03"
    verification:
      - kind: integration
        ref: "tests/folder/rbac.test.ts#RBAC matrix — POST /api/folders/[id]/move (EDITOR+)"
        status: pass
    human_judgment: false
  - id: D4
    description: "PATCH/DELETE/move all re-derive workspace_id from the target folder row server-side and reject a caller who isn't a member of that workspace with 403, even though the caller is EDITOR elsewhere (IDOR)"
    requirement: "TREE-03"
    verification:
      - kind: integration
        ref: "tests/folder/cross-workspace.test.ts#cross-workspace IDOR — non-member of the target folder's workspace"
        status: pass
    human_judgment: false
  - id: D5
    description: "move rejects a newParentId belonging to a different workspace with 400"
    requirement: "TREE-03"
    verification:
      - kind: integration
        ref: "tests/folder/cross-workspace.test.ts#cross-workspace move target — newParentId in a different workspace"
        status: pass
    human_judgment: false
  - id: D6
    description: "move rejects moving a folder into its own descendant with 409 (cycle)"
    requirement: "TREE-03"
    verification:
      - kind: integration
        ref: "tests/folder/cross-workspace.test.ts#move cycle rejection — moving into own descendant"
        status: pass
    human_judgment: false
  - id: D7
    description: "A malformed (non-uuid) folder id or newParentId returns 400; a well-formed but nonexistent folder id returns 403"
    requirement: "TREE-03"
    verification:
      - kind: integration
        ref: "tests/folder/cross-workspace.test.ts#malformed / nonexistent ids"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-08
status: complete
---

# Phase 3 Plan 4: Folder Mutation API Routes Summary

**PATCH/DELETE/move routes for /api/folders/[id] wired to 03-03's closure operations, each re-deriving workspace_id from the target folder row server-side before requireRole('EDITOR') to close a cross-workspace IDOR gap that the URL alone can't prevent (no wsId in the path).**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-08-08T12:33:53Z
- **Tasks:** 3 (RED test commit + 2 GREEN implementation commits)
- **Files modified:** 4 (2 new route files, 2 new test files)

## Accomplishments

- `PATCH /api/folders/[id]` — renames a folder (zod `folderSchema` validation, `updatedAt` bump). `DELETE /api/folders/[id]` — soft-delete cascade delegated entirely to 03-03's `softDeleteFolder(id)`.
- `POST /api/folders/[id]/move` — body `{ newParentId }` (z.uuid().nullable()), delegated to 03-03's `moveFolder(id, newParentId)`. `CycleError` → 409, `CrossWorkspaceError` → 400 mapped at the route boundary; any other error re-throws.
- All three routes share the same IDOR defense: `SELECT workspace_id FROM folder WHERE id=:id` runs server-side before `requireRole(workspaceId, "EDITOR")` — a client can never supply or imply which workspace a mutation targets. A missing row returns 403 (matches the existing `DELETE /api/workspaces/[id]` convention — membership can't be established for a resource that doesn't exist, and 403 doesn't leak whether the id exists in some other workspace).
- TDD RED→GREEN gate confirmed in git log: `test(03-04)` commit (`de494ac`) precedes both `feat(03-04)` commits (`d410feb`, `21fbec3`).
- Full suite: 806 vitest tests green (up from 759 baseline for this branch — Phase 3 plans 1-3 already added closure/schema/query-count tests; this plan added 47 folder-route tests), `tsc --noEmit` clean. Verified no lint regressions introduced by this plan's own files (pre-existing unrelated lint findings in generated/legacy files are out of scope per the deviation-rules scope boundary).

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — RBAC matrix + cross-workspace IDOR regression tests** — `de494ac` (test)
   - Confirmed RED: `pnpm vitest run tests/folder/rbac.test.ts tests/folder/cross-workspace.test.ts` failed with `Cannot find package '@/app/api/folders/[id]/route'` / `'@/app/api/folders/[id]/move/route'` before either route existed.

2. **Task 2: PATCH (rename) + DELETE (soft-delete cascade) /api/folders/[id]** — `d410feb` (feat)
   - Verified green: PATCH/DELETE describe blocks in `rbac.test.ts` and `cross-workspace.test.ts` pass (move describe blocks still red, as expected — Task 3 not yet landed).

3. **Task 3: POST /api/folders/[id]/move (cycle 409 / cross-ws 400)** — `21fbec3` (feat)
   - Verified green: `pnpm vitest run tests/folder` (47/47), full suite `pnpm vitest run` (806/806), `pnpm exec tsc --noEmit` clean.

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/app/api/folders/[id]/route.ts` — `PATCH` (rename), `DELETE` (soft-delete cascade) (new)
- `src/app/api/folders/[id]/move/route.ts` — `POST` (move, cycle/cross-ws error mapping) (new)
- `tests/folder/rbac.test.ts` — role×route matrix for PATCH/DELETE/move (new)
- `tests/folder/cross-workspace.test.ts` — IDOR, cross-ws move target, cycle, malformed/nonexistent id regression tests (new)

## Decisions Made

- **Nonexistent folder id → 403, not 404** — see `key-decisions` in frontmatter. Consistent with the existing `DELETE /api/workspaces/[id]` handler's `forbiddenResponse()` on an empty lookup; keeps the IDOR defense from leaking existence information via a distinguishable 404 vs 403.
- **Error-class → HTTP-status mapping lives at the route boundary, not in `closure.ts`** — `moveFolder` stays HTTP-agnostic (throws typed errors), and each route's `try/catch` does the `instanceof` mapping. This matches the boundary the 03-03 SUMMARY already anticipated ("CrossWorkspaceError as a distinct class... lets a future route handler map cycle rejections and cross-workspace rejections to different HTTP status codes").

## Deviations from Plan

None - plan executed exactly as written. All three tasks matched the RESEARCH-provided code skeletons (Code Examples §"라우트 핸들러 골격 — 이름변경", 03-PATTERNS.md §"folders/[id]/move/route.ts") with no structural changes needed.

## Issues Encountered

None.

## User Setup Required

None. The dev DB (Homebrew PG16 @ 5433) was already running and `.env.local`'s `DATABASE_URL_TEST` was already wired by 03-01/03-02 — no manual setup needed for this plan's tests.

## Next Phase Readiness

- All three folder mutation routes (`POST /api/folders`, `PATCH/DELETE /api/folders/[id]`, `POST /api/folders/[id]/move`) are now live and IDOR-safe — 03-05 (UI: context menu, DnD, inline rename, hover actions) can wire these directly without any further backend changes.
- `tests/folder/rbac.test.ts` / `cross-workspace.test.ts` establish the dynamic-import + role-matrix pattern 03-05's e2e specs can lean on for any additional server-side assertions.
- No blockers identified for 03-05 onward.

---
*Phase: 03-folder-tree-closure-table*
*Completed: 2026-08-08*

## Self-Check: PASSED

All claimed files exist (`src/app/api/folders/[id]/route.ts`, `src/app/api/folders/[id]/move/route.ts`, `tests/folder/rbac.test.ts`, `tests/folder/cross-workspace.test.ts`, this SUMMARY.md) and all three task commits (`de494ac`, `d410feb`, `21fbec3`) are present in git log.
