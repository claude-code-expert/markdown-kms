---
phase: 04-documents-autosave-3-pane-workspace
plan: 03
subsystem: documents
tags: [nextjs, drizzle, zod, rbac, idor, tree, tdd]

# Dependency graph
requires:
  - phase: 04-documents-autosave-3-pane-workspace/04-02
    provides: document create/autosave routes, DocumentWorkspace/d/[docId] route, tree document leaves, resolveWorkspaceIdForDocument/softDeleteDocument (04-01)
provides:
  - "DELETE /api/documents/[id] soft-delete route (EDITOR+, IDOR-safe workspace_id re-derivation)"
  - "DocumentTreeLeaf 1-item context menu ('삭제', destructive) via right-click/hover-kebab"
  - "Document delete confirm dialog + navigate-away when the deleted document was open"
affects: [04-04, 04-05]

# Actuals (#2632)
actuals:
  tokens: 5700
  tasks: 2
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DocumentTreeLeaf row restructured from a bare <Link> to a <div> row wrapping a scoped <Link> (icon+name only) plus a sibling kebab <button> — avoids nesting an interactive button inside an anchor (invalid HTML), while keeping FolderTreeNode.module.css's .node/.kebab hover-reveal CSS working unchanged via descendant selectors"
    - "Delete-then-navigate ordering: router.push() before router.refresh() (not after) when the deleted document was the open one — the reverse order lets push win a race against the refresh's RSC re-fetch of the shared layout, leaving a stale tree node visible after landing on the empty state"

key-files:
  created: []
  modified:
    - src/app/api/documents/[id]/route.ts (DELETE handler, mirrors folders/[id]/route.ts DELETE)
    - src/components/tree/DocumentTreeLeaf.tsx (row restructure + onOpenMenu wiring)
    - src/components/tree/FolderTreeNode.tsx (onOpenDocMenu ctx field, passes through to nested DocumentTreeLeaf)
    - src/components/tree/FolderTreeNode.module.css (.docLink)
    - src/components/tree/FolderTree.tsx (docMenu/docDeleteTarget state, openDocMenu, confirmDeleteDocument, ConfirmDialog)
    - tests/documents/crud.test.ts (DELETE describe block, 5 cases)
    - e2e/document-workspace.spec.ts (delete-flow test)

key-decisions:
  - "Route-level re-delete of an already-trashed document returns 403, not 204 — resolveWorkspaceIdForDocument excludes trashed docs (same T-04-02-IDOR convention as PUT), so a re-delete, a nonexistent id, and a doc in another workspace all fall into the same 403 (03-04 IDOR precedent: never leak existence via status code). The plan's behavior note ('이미 삭제된 문서에 재-DELETE: idempotent... 204') describes softDeleteDocument's own DB-level idempotency guard (WR-01 analog, protects a concurrent double-click race), which is already covered at the lib level in tests/documents/autosave-seq-guard.test.ts — not a route-level sequential-redelete 204."
  - "confirmDeleteDocument calls router.push() before router.refresh() (opposite of submitCreateDocument's existing refresh-then-push order in the same file) — discovered via a failing e2e assertion that the just-deleted tree node stayed visible after navigating to the empty state. push-then-refresh is deterministic; refresh-then-push races the RSC re-fetch against the navigation and can drop the refresh. submitCreateDocument's existing refresh-then-push ordering was left untouched (out of this plan's file scope; its symptom — a newly-created document not appearing in the tree without a hard reload — is latent but unobserved by any existing test, and fixing it isn't part of DOC-01's delete scope)."
  - "Document context menu opens exclusively of the folder menu and vice versa (openMenu/openDocMenu each close the other's state) — prevents two FolderContextMenu instances rendering simultaneously if a user right-clicks a folder then a document in quick succession."

requirements-completed: [DOC-01]

coverage:
  - id: D1
    description: "DELETE /api/documents/:id soft-deletes for an EDITOR (204); the document drops out of getWorkspaceDocuments and is is_trash_root=true/deleted_at set, immediately eligible for trash surfacing"
    requirement: "DOC-01"
    verification:
      - kind: integration
        ref: "tests/documents/crud.test.ts#DELETE /api/documents/[id] (soft-delete, EDITOR+, IDOR) — soft-deletes for an EDITOR"
        status: pass
    human_judgment: false
  - id: D2
    description: "DELETE is RBAC/IDOR-safe: VIEWER 403, non-member 403 (workspace_id re-derived server-side, never client-trusted), already-trashed/nonexistent doc 403 (existence not leaked via status code), malformed uuid 400"
    requirement: "DOC-01"
    verification:
      - kind: integration
        ref: "tests/documents/crud.test.ts#DELETE /api/documents/[id] (soft-delete, EDITOR+, IDOR) — VIEWER/non-member/already-deleted/malformed-uuid cases"
        status: pass
    human_judgment: false
  - id: D3
    description: "Document tree node context menu is exactly 1 item ('삭제', Trash2, destructive) via right-click or hover kebab, no rename/move entries; confirming deletes the document and the node disappears from the tree"
    requirement: "DOC-01"
    verification:
      - kind: e2e
        ref: "e2e/document-workspace.spec.ts#deletes the open document via the tree menu, confirms, and navigates to the empty state"
        status: pass
    human_judgment: false
  - id: D4
    description: "Deleting the document that is currently open (its own d/[docId] route) navigates back to the workspace's empty index instead of leaving a dead editor mounted"
    requirement: "DOC-01"
    verification:
      - kind: e2e
        ref: "e2e/document-workspace.spec.ts#deletes the open document via the tree menu, confirms, and navigates to the empty state"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-08-08
status: complete
---

# Phase 4 Plan 3: Document Soft-Delete Route + Tree Delete Menu Summary

**DELETE /api/documents/:id (EDITOR+, server-derived workspace_id) mirrors the folders DELETE route exactly, wired to a new 1-item context menu on document tree nodes — confirming a delete removes the node from the tree and, if that document was open, navigates back to the empty workspace index.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-08T14:40:00+09:00
- **Completed:** 2026-08-08T15:10:00+09:00
- **Tasks:** 2 (1 TDD, 1 auto)
- **Files modified:** 7

## Accomplishments
- `DELETE /api/documents/[id]` — EDITOR+, re-derives `workspace_id` server-side via `resolveWorkspaceIdForDocument` before `requireRole`, then `softDeleteDocument` (is_deleted/is_trash_root/deleted_at). Mirrors `folders/[id]/route.ts` DELETE structurally; a trashed/nonexistent/foreign-workspace doc all 403 the same way (no existence leak)
- `DocumentTreeLeaf` restructured from a bare `<Link>` row to a `<div>` row with a scoped inner `<Link>` plus a sibling kebab `<button>` (avoids nesting a button inside an anchor), wired to a new 1-item context menu ("삭제", `Trash2`, destructive)
- `FolderTree` owns the document-delete flow: `docMenu`/`docDeleteTarget` state, `confirmDeleteDocument` (fetch DELETE → `ConfirmDialog` with UI-SPEC copy → navigate away if the deleted doc was open → `router.refresh()`)
- `e2e/document-workspace.spec.ts` proves the full flow: right-click → exactly 1 menuitem → confirm → tree node gone + empty-state landing

## Task Commits

Each task was committed atomically:

1. **Task 1: DELETE /api/documents/:id 소프트삭제 라우트 (TDD)**
   - RED: `1728d93` (test)
   - GREEN: `900cea6` (feat)
2. **Task 2: 트리 문서 노드 '삭제' 메뉴 + 확인 다이얼로그 + 열람중 삭제 이탈** - `e132886` (feat)

## Files Created/Modified
- `src/app/api/documents/[id]/route.ts` - added DELETE handler (PUT untouched)
- `src/components/tree/DocumentTreeLeaf.tsx` - row restructure, `onOpenMenu` prop
- `src/components/tree/FolderTreeNode.tsx` - `onOpenDocMenu` added to `FolderTreeNodeCtx`
- `src/components/tree/FolderTreeNode.module.css` - `.docLink`
- `src/components/tree/FolderTree.tsx` - doc-delete state/handlers/dialog, `usePathname` for open-document detection
- `tests/documents/crud.test.ts` - 5 new DELETE test cases
- `e2e/document-workspace.spec.ts` - 1 new delete-flow test

## Decisions Made
- Sequential re-delete of an already-trashed document 403s at the route (not 204) — matches the established folder IDOR convention (03-04) of never distinguishing "doesn't exist" from "already deleted" via status code. The plan's idempotency note describes the DB-level guard (concurrent race protection), already covered by existing lib-level tests.
- `confirmDeleteDocument` pushes the navigate-away before calling `router.refresh()` — the opposite order raced the refresh against the navigation and left the deleted node visible in the tree (caught by the new e2e test, not assumed from reading the code).
- Folder and document context menus mutually close each other on open, preventing two menus rendering at once.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] confirmDeleteDocument's refresh/push ordering left a stale tree node visible after delete**
- **Found during:** Task 2, first e2e run of the new delete test
- **Issue:** Calling `router.refresh()` then `router.push()` (matching the file's existing `submitCreateDocument` pattern) let the push win a race against the refresh's RSC re-fetch of the shared layout — the deleted document's tree node remained visible after landing on the empty state, even though the DELETE request and navigation both succeeded.
- **Fix:** Reordered to `router.push()` then `router.refresh()` for the navigate-away path, with a comment explaining why. The existing `submitCreateDocument` (04-02, unmodified in this plan's file scope) uses the original refresh-then-push order and was left as-is — no existing test exercises its tree-visibility timing, so "fixing" it here would be an unrequested, unverified change outside DOC-01's delete scope.
- **Files modified:** `src/components/tree/FolderTree.tsx`
- **Commit:** `e132886`

## Issues Encountered
- **Environment, not code:** mid-session, the local Postgres (`localhost:5433`) hit `max_connections` from accumulated idle connections left by many `vitest`/`playwright` runs across the session (`pg_stat_activity` showed 105+ idle `postgres.js` connections). Terminated the idle backends (`pg_terminate_backend`) to recover; not a code defect, no schema/pool changes made.
- **Pre-existing, out-of-scope e2e flakiness discovered while re-verifying the full suite:**
  - `e2e/preview-perf.spec.ts`'s 60ms-budget test still targets `/w/[wsId]` as the 2-pane editor host per its original Phase 2 comment ("`/w/[wsId]`'s 2-pane editor+preview host (02-03) does not exist yet") — but since 04-02's route split, `/w/[wsId]` is the empty-state index and the editor now lives at `/w/[wsId]/d/[docId]`. This spec was not updated during 04-02 and is unrelated to any file this plan touches.
  - `e2e/workspace-delete.spec.ts` asserts a workspace-name `heading` on `/w/[wsId]` (Phase 1 D-14 placeholder behavior) — also superseded by 04-02's `page.tsx` rewrite to `<EmptyState>`.
  - `e2e/document-workspace.spec.ts`'s pre-existing tracer test ("creates a document, autosaves...") intermittently misses the transient "저장 중…" status text under load — unrelated to any file this plan touches (`useAutosave`/`autosave-controller`/`SaveStatusBar` are all 04-02 code, unmodified here).
  - None of these are in this plan's `files_modified` list; fixing them would be out of scope for DOC-01's delete-route work. Logged to `.planning/WINDOWS.md` for visibility.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DOC-01 (문서 생성·수정·삭제 + 소프트삭제 즉시 휴지통 반영) is now fully delivered across 04-01 (schema/service) + 04-02 (create/autosave) + 04-03 (delete) — marked complete in REQUIREMENTS.md.
- `is_trash_root=true` is set correctly on delete; 04-05's trash view can query `getWorkspaceDocuments`-style trash listings without further schema/service work.
- 04-04 (folder cascade soft-delete) can reuse this plan's `DocumentTreeLeaf`/`FolderContextMenu` menu-exclusivity pattern (`onOpenMenu`/`onOpenDocMenu` closing each other) if it needs its own trigger.
- Pre-existing stale e2e specs (`preview-perf.spec.ts`, `workspace-delete.spec.ts`) need a follow-up pass to point at the post-04-02 route structure — flagged in `.planning/WINDOWS.md`, not blocking this plan.
- No blockers.

---
*Phase: 04-documents-autosave-3-pane-workspace*
*Completed: 2026-08-08*

## Self-Check: PASSED

All modified files found on disk (verified below). All 3 task commits (`1728d93`, `900cea6`, `e132886`) confirmed present in git log.
