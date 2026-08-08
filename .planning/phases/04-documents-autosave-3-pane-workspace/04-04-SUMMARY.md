---
phase: 04-documents-autosave-3-pane-workspace
plan: 04
subsystem: database
tags: [drizzle, postgres, closure-table, rbac, trash]

requires:
  - phase: 04-documents-autosave-3-pane-workspace
    provides: "document table + lib/documents.ts CRUD/autosave (04-01, 04-03), softDeleteFolder/moveFolder/getSubtree closure primitives (Phase 3)"
provides:
  - "softDeleteFolder document cascade (WR-01 symmetric — preserves independently-trashed docs)"
  - "restoreFolder: cascade restore excluding independently-trashed descendants (Open Q #2), root relocation via moveFolder reuse"
  - "restoreDocument, permanentlyDeleteFolder (FK-safe order), permanentlyDeleteDocument"
  - "resolveWorkspaceIdForTrashItem, getTrashItems — is_deleted-agnostic trash helpers"
  - "unified TRD §8 trash routes: POST /api/trash/:type/:id/restore (EDITOR+), DELETE /api/trash/:type/:id (ADMIN+)"
affects: [04-05, trash-ui]

actuals:
  tokens: 9600
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "Trash-scoped helpers are is_deleted-agnostic siblings of active-only helpers (resolveWorkspaceIdForTrashItem vs resolveActiveWorkspaceId, restoreFolder's direct closure join vs getSubtree) — never retrofit the active-only ones with a flag"
    - "Cascade soft-delete/restore always gates on `AND is_deleted={false,true}` matching the operation's direction, so an item independently trashed before its ancestor's cascade is never silently swept along"
    - "Permanent delete transaction always DELETEs the FK-dependent table (document) before the FK-referenced table (folder) — folder_closure needs no manual cleanup, both its columns already ON DELETE CASCADE"

key-files:
  created:
    - src/app/api/trash/[type]/[id]/restore/route.ts
    - src/app/api/trash/[type]/[id]/route.ts
    - tests/trash/restore.test.ts
    - tests/trash/permanent-delete.test.ts
    - tests/trash/rbac.test.ts
  modified:
    - src/lib/closure.ts
    - src/lib/documents.ts
    - tests/folder/closure.test.ts

key-decisions:
  - "getTrashItems merges two separate SELECTs (folder, document) in application code rather than a SQL UNION — different column shapes across two Drizzle tables, app-level merge stays type-safe"
  - "restoreDocument/restoreFolder only act on is_trash_root=true rows (WHERE guard, not just a precondition check) — mirrors softDeleteDocument's WR-01 idempotency-by-WHERE-clause convention already in the codebase"

patterns-established:
  - "Trash routes re-derive workspaceId from the URL's (type,id) via resolveWorkspaceIdForTrashItem before requireRole — same IDOR shape as folders/[id]/move/route.ts, generalized to a type-branching resource"

requirements-completed: [DOC-01, DOC-02]

coverage:
  - id: D1
    description: "softDeleteFolder cascades is_deleted to active documents in its subtree, without disturbing documents already independently trashed"
    requirement: "DOC-01"
    verification:
      - kind: unit
        ref: "tests/folder/closure.test.ts#closure.softDeleteFolder — document cascade"
        status: pass
    human_judgment: false
  - id: D2
    description: "restoreFolder restores a trashed subtree (folders + cascaded documents), excludes independently-trashed descendants (Open Q #2), and relocates to workspace root via moveFolder when the original parent is deleted"
    requirement: "DOC-02"
    verification:
      - kind: unit
        ref: "tests/trash/restore.test.ts#closure.restoreFolder — cascade restore, independent-trash preserved (Open Q #2)"
        status: pass
    human_judgment: false
  - id: D3
    description: "restoreDocument restores a single directly-trashed document"
    requirement: "DOC-02"
    verification:
      - kind: unit
        ref: "tests/trash/restore.test.ts#documents.restoreDocument — single-document restore"
        status: pass
    human_judgment: false
  - id: D4
    description: "permanentlyDeleteFolder deletes documents before folders in one transaction (FK-safe), removing folder/document/folder_closure rows for the whole subtree"
    requirement: "DOC-02"
    verification:
      - kind: unit
        ref: "tests/trash/permanent-delete.test.ts#closure.permanentlyDeleteFolder — FK order (document before folder)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Unified trash routes enforce EDITOR+ for restore and ADMIN+ for permanent delete, reject unknown type/malformed uuid with 400, and re-derive workspaceId server-side (IDOR-safe)"
    requirement: "DOC-02"
    verification:
      - kind: unit
        ref: "tests/trash/rbac.test.ts"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-08-08
status: complete
---

# Phase 4 Plan 4: Trash Backend (Cascade Restore + Permanent Delete) Summary

**Extended softDeleteFolder to cascade into documents, added closure-join-based restore that excludes independently-trashed descendants and reuses moveFolder for root relocation, FK-ordered permanent delete, and unified TRD §8 trash routes (EDITOR+ restore / ADMIN+ permanent delete).**

## Performance

- **Duration:** 15 min
- **Started:** 2026-08-08T15:14:00+09:00
- **Completed:** 2026-08-08T15:18:13+09:00
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- `softDeleteFolder` (src/lib/closure.ts) now cascades `is_deleted`/`deleted_at` into active documents in the deleted subtree in the same transaction, while leaving documents that were already independently trashed untouched (WR-01 symmetric guard).
- `restoreFolder` restores a trash-root folder's subtree via a direct closure join (not `getSubtree`, which hardcodes `is_deleted=false`), excludes descendants that carry their own `is_trash_root=true` (Open Question #2's explicit scenario — a document or folder trashed independently before the parent's cascade stays trashed), and reuses `moveFolder(id, null, tx)` to relocate to the workspace root when the original parent is itself deleted.
- `permanentlyDeleteFolder` collects the full subtree (filter-free closure join) and deletes `document` rows before `folder` rows in one transaction — `document.folder_id` has no `ON DELETE CASCADE`, so the reverse order would raise a Postgres FK violation. `folder_closure` needs no manual cleanup since both its FK columns are `ON DELETE CASCADE`.
- `resolveWorkspaceIdForTrashItem(type, id)` and `getTrashItems(wsId)` — is_deleted-agnostic siblings of the active-only helpers, purpose-built for trash routes/UI.
- `restoreDocument`/`permanentlyDeleteDocument` (src/lib/documents.ts) — single-row analogs of the folder operations.
- `POST /api/trash/[type]/[id]/restore` (EDITOR+) and `DELETE /api/trash/[type]/[id]` (ADMIN+) — unified TRD §8 routes, type-validated (`folder|document`), IDOR-safe (workspaceId re-derived server-side, never trusted from the client).

## Task Commits

Each task was committed atomically (TDD: test → feat per task):

1. **Task 1: softDeleteFolder document cascade + restore backend (Open Q #2)**
   - `e015fdd` test(04-04): add failing tests for document cascade + restore (Open Q #2)
   - `7071214` feat(04-04): extend softDeleteFolder document cascade + restore backend
2. **Task 2: permanent delete — FK order (document before folder)**
   - `7768c22` test(04-04): add failing tests for permanent delete FK ordering
   - `0bcd534` feat(04-04): add permanent delete with FK-safe ordering
3. **Task 3: unified trash routes (restore EDITOR / permanent ADMIN) + RBAC matrix**
   - `363be98` test(04-04): add failing RBAC matrix tests for trash restore/permanent-delete routes
   - `d5449ab` feat(04-04): add unified trash routes (restore EDITOR+, permanent delete ADMIN+)

**Plan metadata:** committed alongside this SUMMARY (see final commit below).

## Files Created/Modified
- `src/lib/closure.ts` - softDeleteFolder document cascade; new resolveWorkspaceIdForTrashItem, restoreFolder, permanentlyDeleteFolder, getTrashItems
- `src/lib/documents.ts` - new restoreDocument, permanentlyDeleteDocument
- `src/app/api/trash/[type]/[id]/restore/route.ts` - POST restore, EDITOR+
- `src/app/api/trash/[type]/[id]/route.ts` - DELETE permanent delete, ADMIN+
- `tests/folder/closure.test.ts` - softDeleteFolder document-cascade cases
- `tests/trash/restore.test.ts` - restoreFolder/restoreDocument, Open Q #2, root relocation, resolveWorkspaceIdForTrashItem, getTrashItems
- `tests/trash/permanent-delete.test.ts` - FK order + full subtree removal
- `tests/trash/rbac.test.ts` - restore/permanent-delete RBAC matrix + type/uuid validation

## Decisions Made
- `getTrashItems` merges two typed SELECTs (folder, document) at the application level instead of a SQL `UNION` — the two tables have different column shapes (`name` vs `title`), and a UNION would need casting that loses type safety for no real query-count benefit (trash lists are small).
- `restoreDocument`/`restoreFolder` encode "only a trash root is restorable" as a `WHERE is_trash_root=true` guard on the UPDATE itself (not a separate read-then-branch check for the document case) — matches the existing `softDeleteDocument`/`softDeleteFolder` WR-01 convention of making illegal states a no-op via the WHERE clause rather than a thrown error.

## Deviations from Plan

None — plan executed exactly as written. The plan's Task 1 action item 4 (`getTrashItems`) had no dedicated acceptance-criteria bullet in the plan text, but was explicitly named in `must_haves.artifacts` and the Task 1 `<action>` prose, so it was implemented and given its own RED/GREEN test coverage rather than left unbuilt.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Trash backend (cascade soft-delete extension, restore with Open Q #2 semantics, FK-safe permanent delete, unified IDOR-safe routes) is fully proven by integration tests and ready for 04-05's Trash UI (`TrashList`, `RestoreRootBanner`, `trash/page.tsx` via `getTrashItems`) to consume directly.
- No blockers. `pnpm vitest run` — 878/878 green. `pnpm exec tsc --noEmit` — clean.

---
*Phase: 04-documents-autosave-3-pane-workspace*
*Completed: 2026-08-08*

## Self-Check: PASSED

All created/modified files and all 6 task commits (e015fdd, 7071214, 7768c22, 0bcd534, 363be98, d5449ab) verified present on disk / in git log.
