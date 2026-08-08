---
phase: 03-folder-tree-closure-table
plan: 02
subsystem: folder-tree
tags: [closure-table, drizzle, tracer, idor, next-app-router]

requires:
  - phase: 03-folder-tree-closure-table
    provides: "folder/folderClosure Drizzle schema + migration 0002 (03-01)"
provides:
  - "src/lib/closure.ts: createFolder(workspaceId, parentId, name, dbOrTx?) — ancestor-row copy at depth+1 + self row inside db.transaction"
  - "src/lib/closure.ts: getWorkspaceFolders(workspaceId, dbOrTx?) — flat single-query load, depth-independent (TREE-02)"
  - "src/lib/validation.ts: folderSchema/FolderInput (trim/non-empty/max 255, no sibling-uniqueness)"
  - "POST /api/folders — server-derived workspaceId from parentId's folder row (IDOR-safe), EDITOR+ gate, 400 on cross-workspace parentId"
  - "src/app/(main)/w/[wsId]/page.tsx: 260px sidebar grid + server-rendered initial folder tree"
  - "src/components/tree/{FolderTree,tree-utils}.tsx: minimal tree render + header create-root input"
affects: [03-03, 03-04, 03-05]

actuals:
  tokens: 7100
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "closure.ts functions accept an optional db/tx client param (default `db`) for transaction-scoped reuse and test-client injection (query-count isolation)"
    - "Server-side workspaceId derivation from a URL-less resource id (folder row's own workspace_id via SELECT), never trusting a client-supplied workspaceId for authorization"

key-files:
  created:
    - src/lib/closure.ts
    - src/app/api/folders/route.ts
    - src/components/tree/FolderTree.tsx
    - src/components/tree/FolderTree.module.css
    - src/components/tree/tree-utils.ts
    - tests/folder/closure.test.ts
    - tests/folder/query-count.test.ts
    - e2e/folder-tree.spec.ts
  modified:
    - src/lib/validation.ts
    - src/app/(main)/w/[wsId]/page.tsx
    - src/app/(main)/w/[wsId]/page.module.css

key-decisions:
  - "POST /api/folders workspaceId resolution: when parentId is present, the authoritative workspaceId is always the parent folder row's own workspace_id (server SELECT); an optional client-supplied body.workspaceId is compared against it only as an early 400 (mismatch = cross-workspace attempt), never used for requireRole. When parentId is null, body.workspaceId is required and z.uuid-validated. This makes the IDOR/cross-workspace defenses independent of DB membership lookups — the 400 fires before requireRole runs."
  - "FolderTree renders top-level folders (parentId=null) starting at depth 0 (8px indent) rather than adding a literal workspace-root tree row — the locked prop signature is (folders, workspaceId) only, no workspace name prop, and root-level context-menu actions ('새 폴더') already live in the sidebar header. A literal bold-label root row is deferred to 03-05 alongside context menu/DnD, when the full Tree Node Contract states land."
  - "tests/folder/query-count.test.ts mocks @/auth (vi.mock) even though it never calls mockSessionFor — importing tests/rbac/helpers.ts pulls in the real @/auth -> next-auth import chain, which fails to resolve 'next/server' from that pnpm module layout when not mocked. Mocking sidesteps it without touching production code (Rule 3 blocking-issue fix, scoped to this test file only)."

patterns-established:
  - "Injectable db/tx client as the last optional parameter on lib/*.ts data-access functions, defaulting to the shared `db` export — used here for getWorkspaceFolders/createFolder, to be reused by moveFolder/softDeleteFolder in later 03-xx plans for cascade-transaction consistency (RESEARCH Pitfall 4)."

requirements-completed: [TREE-01, TREE-02, TREE-03]

coverage:
  - id: D1
    description: "createFolder(ws, null, name) creates exactly one folder row + one self folder_closure row (ancestorId=descendantId=newId, depth=0), no ancestor rows copied"
    requirement: "TREE-03"
    verification:
      - kind: unit
        ref: "tests/folder/closure.test.ts#creates a root folder (parentId=null) with only a self closure row"
        status: pass
    human_judgment: false
  - id: D2
    description: "createFolder(ws, parentId, name) copies the parent's ancestor closure rows at depth+1 and adds a self row"
    requirement: "TREE-03"
    verification:
      - kind: unit
        ref: "tests/folder/closure.test.ts#copies the parent's ancestor rows at depth+1 plus a self row when creating a child"
        status: pass
      - kind: unit
        ref: "tests/folder/closure.test.ts#accumulates depth through the grandparent for a third-level folder"
        status: pass
    human_judgment: false
  - id: D3
    description: "getWorkspaceFolders returns only non-soft-deleted folders for the workspace"
    requirement: "TREE-03"
    verification:
      - kind: unit
        ref: "tests/folder/closure.test.ts#returns only active (non-soft-deleted) folders"
        status: pass
    human_judgment: false
  - id: D4
    description: "getWorkspaceFolders issues a fixed SQL statement count independent of tree depth"
    requirement: "TREE-02"
    verification:
      - kind: unit
        ref: "tests/folder/query-count.test.ts#issues the same statement count for a depth-2 and a depth-6 tree"
        status: pass
    human_judgment: false
  - id: D5
    description: "POST /api/folders requires EDITOR+ (403 for VIEWER and non-member) and rejects a parentId from a different workspace (400), without trusting client-supplied workspaceId"
    requirement: "TREE-03"
    verification:
      - kind: unit
        ref: "tests/folder/closure.test.ts#creates a root folder for an EDITOR member and returns 201 / rejects a VIEWER with 403 / rejects a non-member caller with 403 / rejects a parentId belonging to a different workspace with 400 (IDOR)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Sidebar shows workspace folders hierarchically; creating a folder via the header input makes it appear in the tree after server confirmation"
    requirement: "TREE-01"
    verification:
      - kind: e2e
        ref: "e2e/folder-tree.spec.ts#creates a folder from the sidebar and it appears in the tree"
        status: pass
    human_judgment: false
  - id: D7
    description: "Sidebar is a 260px fixed column per UI-SPEC"
    requirement: "TREE-01"
    verification:
      - kind: other
        ref: "grep -q '260px' src/app/(main)/w/[wsId]/page.module.css"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-08-08
status: complete
---

# Phase 3 Plan 2: Folder Tree Tracer Slice Summary

**createFolder/getWorkspaceFolders closure operations + IDOR-safe POST /api/folders + 260px sidebar with server-rendered folder tree and header create-input, proven end-to-end with 770 vitest + 10 Playwright green.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-08-08T03:20:09Z
- **Tasks:** 2 (RED test commit + TRACER implementation commit)
- **Files modified:** 11 (3 new lib/route files, 3 new tree component files, 3 new test files, 2 modified page files, 1 modified validation file)

## Accomplishments

- `src/lib/closure.ts` implements `createFolder` (TRD §4 SQL: ancestor-row copy at depth+1 via a parametrized `sql` template inside `db.transaction`, plus an unconditional self row) and `getWorkspaceFolders` (flat single-query `workspace_id` filter — no closure join, since no `folder` row represents the workspace itself). Both take an optional db/tx client for transaction-scoped reuse and test-client injection.
- `POST /api/folders` derives the authoritative `workspaceId` from the parentId folder row's own `workspace_id` (server SELECT), never trusting the client's claimed `workspaceId` for authorization — a mismatch between a client-supplied `workspaceId` and the parent's actual workspace is rejected with 400 before `requireRole` ever runs (IDOR/cross-workspace defense, T-03-02-IDOR/XWS).
- `w/[wsId]/page.tsx` now renders a 260px sidebar grid (`FolderTree`) beside the existing title + `EditorPreviewLayout`, loading the initial folder list via `getWorkspaceFolders(wsId)` server-side (no client loading spinner).
- `FolderTree` (minimal tracer scope): renders the folder hierarchy via `buildTree`, and a header "새 폴더" button that opens an inline create input — on Enter, POSTs to `/api/folders`, and only refreshes the tree (`router.refresh()`) after the server confirms (no optimistic UI, per CONTEXT.md).
- TDD RED→GREEN gate confirmed in git log: `test(03-02)` commit (`f876f71`) precedes `feat(03-02)` commit (`9815b3a`).
- Full suite: 770 vitest tests green (up from 761), 10 Playwright e2e specs green (including the new `folder-tree.spec.ts`), `tsc --noEmit` clean.

## Task Commits

1. **Task 1: RED — createFolder/getWorkspaceFolders integration tests + query-count assertion + e2e create spec**
   - `f876f71` — `test(03-02): add failing test for createFolder/getWorkspaceFolders + folder tree e2e`
   - Confirmed RED: both vitest files failed at import (`Cannot find package '@/lib/closure'`) before implementation existed.

2. **Task 2 (tracer): closure ops + POST /api/folders + sidebar wiring, end-to-end**
   - `9815b3a` — `feat(03-02): tracer slice — folder creation through closure rows to sidebar tree`
   - Verified green: `pnpm vitest run tests/folder/closure.test.ts tests/folder/query-count.test.ts` (9/9), `pnpm exec playwright test e2e/folder-tree.spec.ts` (1/1), full suite (770 vitest + 10 Playwright), `tsc --noEmit` clean.

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/lib/closure.ts` — `createFolder`, `getWorkspaceFolders` (new)
- `src/lib/validation.ts` — added `folderSchema`/`FolderInput`
- `src/app/api/folders/route.ts` — `POST` handler (new)
- `src/app/(main)/w/[wsId]/page.tsx` — sidebar grid wiring, `getWorkspaceFolders(wsId)` call
- `src/app/(main)/w/[wsId]/page.module.css` — `grid-template-columns: 260px minmax(0,1fr)`
- `src/components/tree/FolderTree.tsx`, `FolderTree.module.css` — minimal tree render + create input (new)
- `src/components/tree/tree-utils.ts` — `buildTree` (new)
- `tests/folder/closure.test.ts`, `tests/folder/query-count.test.ts` (new)
- `e2e/folder-tree.spec.ts` (new)

## Decisions Made

- **POST /api/folders workspaceId resolution** — see `key-decisions` in frontmatter. The 400 cross-workspace check runs before `requireRole`, so it doesn't depend on the caller's membership in the foreign workspace to prove the defense (test uses a caller who is EDITOR in workspace A only, has zero access to workspace B, and is still correctly rejected with 400 rather than leaking a 403 that would imply the parentId lookup itself succeeded past authorization).
- **No literal workspace-root tree row** — deferred to 03-05 (context menu/DnD/rename land together with the full Tree Node Contract states); this task's locked `<FolderTree folders workspaceId>` prop signature has no workspace-name prop to label such a row meaningfully yet.
- **query-count test mocks `@/auth`** even without calling `mockSessionFor` — Rule 3 (blocking issue) fix: importing `tests/rbac/helpers.ts` unmocked pulled in the real `next-auth` package, which failed to resolve `next/server` in this pnpm layout. Mocking `@/auth` in the test file sidesteps the real import chain entirely; no production code was touched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] `tests/folder/query-count.test.ts` failed to resolve `next-auth`'s `next/server` import**
- **Found during:** Task 2 verification (`pnpm vitest run tests/folder/query-count.test.ts`)
- **Issue:** The file imports `createTestWorkspace` from `tests/rbac/helpers.ts`, which imports `@/auth` at module scope. Without `vi.mock("@/auth", ...)`, Vitest attempted to actually load `next-auth`, which failed with `Cannot find module '.../next-auth@.../node_modules/next/server' — Did you mean "next/server.js"?` — an environment/module-resolution issue unrelated to this plan's logic.
- **Fix:** Added `vi.mock("@/auth", () => ({ auth: vi.fn() }))` to `tests/folder/query-count.test.ts`, mirroring the pattern already used in `tests/folder/closure.test.ts` and `tests/rbac/matrix.test.ts`, even though this file never calls `mockSessionFor` (the mock just needs to exist so the real module is never loaded).
- **Files modified:** `tests/folder/query-count.test.ts`
- **Commit:** `9815b3a` (folded into the Task 2 GREEN commit, since the RED commit's version of this file already had the resolution issue latent — it only surfaced once `@/lib/closure` existed and the test actually ran to completion)

No other deviations — plan executed as written otherwise.

## Issues Encountered

None beyond the auto-fixed issue above.

## User Setup Required

None. The dev DB migration prerequisite (03-01's `pnpm drizzle-kit migrate`) was already applied; this plan's `<precondition>` was met without any action.

## Next Phase Readiness

- `src/lib/closure.ts`'s `createFolder`/`getWorkspaceFolders` and the db/tx-injection pattern are ready for 03-03/03-04 (rename/move/soft-delete) to extend — `moveFolder`/`softDeleteFolder` should follow the same optional-client-param convention for transaction-scoped subtree reads.
- `FolderTree`/`tree-utils.ts` are a verified minimal skeleton; 03-05 adds context menu, hover actions, inline rename, DnD move, and the literal workspace-root row on top of this.
- No blockers identified for 03-03 onward.

---
*Phase: 03-folder-tree-closure-table*
*Completed: 2026-08-08*

## Self-Check: PASSED

All claimed files exist (`src/lib/closure.ts`, `src/app/api/folders/route.ts`, `src/components/tree/FolderTree.tsx`, `src/components/tree/tree-utils.ts`, `tests/folder/closure.test.ts`, `tests/folder/query-count.test.ts`, `e2e/folder-tree.spec.ts`, this SUMMARY.md) and both commits (`f876f71`, `9815b3a`) are present in git log.
