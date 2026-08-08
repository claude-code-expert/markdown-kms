---
phase: 04-documents-autosave-3-pane-workspace
plan: 05
subsystem: ui
tags: [nextjs, react, css-modules, rbac, trash, playwright]

requires:
  - phase: 04-documents-autosave-3-pane-workspace
    provides: "getTrashItems/restoreFolder/restoreDocument/permanentlyDeleteFolder/permanentlyDeleteDocument + unified TRD §8 trash routes (04-04)"
provides:
  - "w/[wsId]/trash RSC + TrashList (mixed folder/document list, relative deleted-at time, role-gated restore/permanent-delete)"
  - "RestoreRootBanner — surfaces when a restore's relocatedToRoot flag is true"
  - "Sidebar '휴지통' link (FolderTree bottom row, accent-highlighted on /trash)"
  - "restoreDocument root-relocation parity with restoreFolder (Open Q #2) — a document independently trashed under a folder that's later deleted also relocates to workspace root on restore, instead of resurfacing under a still-deleted folderId"
affects: [phase-4-completion, uat]

actuals:
  tokens: 6700
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Client components never import @/lib/rbac at runtime — RSC computes role-rank booleans (canRestore/canPermanentDelete) and passes plain booleans down; importing ROLE_RANK/Role into a 'use client' file pulls the whole rbac.ts→@/auth→bcrypt module graph (native fs binding) into the browser bundle"
    - "Native Intl.RelativeTimeFormat for relative timestamps ('3일 전') instead of a date library — matches UI-SPEC example copy verbatim with zero new dependencies"
    - "e2e specs that use the seeded default workspace (not a freshly-created one) land the test user as EDITOR, not OWNER — useful for exercising role gating without a separate role-seeding helper, but every list-based assertion must scope to the test's own row since the workspace is shared across all e2e runs/users"

key-files:
  created:
    - src/app/(main)/w/[wsId]/trash/page.tsx
    - src/components/trash/TrashList.tsx
    - src/components/trash/TrashList.module.css
    - src/components/trash/RestoreRootBanner.tsx
    - src/components/trash/RestoreRootBanner.module.css
    - e2e/document-trash.spec.ts
  modified:
    - src/components/tree/FolderTree.tsx
    - src/components/tree/FolderTree.module.css
    - src/lib/documents.ts
    - src/app/api/trash/[type]/[id]/restore/route.ts
    - tests/trash/restore.test.ts

key-decisions:
  - "restoreDocument now returns { relocatedToRoot } and moves an orphaned document to the workspace root on restore, mirroring restoreFolder's Open Q #2 handling — this was a backend gap discovered while wiring RestoreRootBanner (Rule 2 fix), not something 04-04 had scoped for single documents"
  - "TrashList receives canRestore/canPermanentDelete as booleans, not role — importing @/lib/rbac into the client component broke the Next.js build (bcrypt's native 'fs' binding leaking into the browser bundle); the rank check stays server-side in trash/page.tsx (Rule 1 fix)"
  - "Trash empty-state text is rendered inline in TrashList with its own left-aligned CSS, not the shared EmptyState component — UI-SPEC explicitly calls for left alignment here (Trash Contract '빈 목록' row) vs. EmptyState's centered layout used by the document-workspace index"

patterns-established:
  - "Row-level pending state (spinner/disabled) and the shared '{동작}하지 못했어요' error copy pattern from FolderTree.tsx extended to a second mutation surface (TrashList) without any new abstraction — same fetch→inline-error→router.refresh() shape"

requirements-completed: [DOC-02]

coverage:
  - id: D1
    description: "w/[wsId]/trash lists is_trash_root folders+documents (mixed, type icons) reached via a sidebar '휴지통' link, accent-highlighted on the current route"
    requirement: "DOC-02"
    verification:
      - kind: e2e
        ref: "e2e/document-trash.spec.ts#deletes a document, restores it from the trash, and it reappears in the tree"
        status: pass
    human_judgment: false
  - id: D2
    description: "Restore (EDITOR+) fetches immediately with no confirmation dialog, and the item leaves the trash list / reappears in the tree"
    requirement: "DOC-02"
    verification:
      - kind: e2e
        ref: "e2e/document-trash.spec.ts#deletes a document, restores it from the trash, and it reappears in the tree"
        status: pass
    human_judgment: false
  - id: D3
    description: "RestoreRootBanner shows the UI-SPEC copy when a restore relocates an item to the workspace root because its original parent folder is deleted"
    requirement: "DOC-02"
    verification:
      - kind: unit
        ref: "tests/trash/restore.test.ts#documents.restoreDocument — relocates to workspace root when the original folder is deleted (Open Q #2 parity)"
        status: pass
    human_judgment: true
    rationale: "Only the underlying relocatedToRoot flag is exercised (unit-level, both restoreFolder and restoreDocument). No automated test drives a restore where the original parent is actually deleted through the UI and asserts the banner text/placement — needs a human click-through or a follow-up e2e case."
  - id: D4
    description: "Permanent delete (ADMIN+) is gated disabled+hint for under-privileged roles (visible, not hidden) and goes through ConfirmDialog(destructive) before DELETE"
    requirement: "DOC-02"
    verification:
      - kind: e2e
        ref: "e2e/document-trash.spec.ts#shows the permanent-delete button gated (disabled + hint) for an EDITOR, restore stays enabled"
        status: pass
      - kind: integration
        ref: "tests/trash/permanent-delete.test.ts, tests/trash/rbac.test.ts"
        status: pass
    human_judgment: true
    rationale: "The EDITOR-gated state and the route/lib-level ADMIN authorization + FK-safe physical delete are both automated, but no test clicks through ConfirmDialog as an ADMIN and confirms the row disappears from the UI (default seeded e2e user is EDITOR, not ADMIN) — needs a human click-through or a follow-up role-seeded e2e case."

duration: 70min
completed: 2026-08-08
status: complete
---

# Phase 4 Plan 5: Trash UI (Restore/Permanent-Delete/Root Banner/Sidebar Link) Summary

**w/[wsId]/trash RSC + TrashList consuming 04-04's trash backend — mixed folder/document list, permission-transparent restore/permanent-delete gating, RestoreRootBanner, sidebar link, and a proven delete→trash→restore→tree round trip e2e; plus a backend parity fix so document restore relocates to workspace root exactly like folder restore already did.**

## Performance

- **Duration:** 70 min
- **Started:** 2026-08-08T15:25:00+09:00
- **Completed:** 2026-08-08T16:35:00+09:00
- **Tasks:** 3 (plus one prerequisite backend fix)
- **Files modified:** 12 (6 created, 6 modified)

## Accomplishments
- `src/app/(main)/w/[wsId]/trash/page.tsx` — RSC gated by `requireRole(wsId, "VIEWER")` (redundant-but-consistent with `d/[docId]/page.tsx`'s own re-check on top of `layout.tsx`), calls `getTrashItems(wsId)` directly (no self-fetch), computes `canRestore`/`canPermanentDelete` server-side and passes only those booleans to the client component.
- `TrashList` — mixed folder/document rows (type icon, ellipsis name, relative deleted-at via native `Intl.RelativeTimeFormat`), restore (no confirmation, immediate fetch) and permanent-delete (`ConfirmDialog` destructive) wiring, inline mutation-failure errors, and role-gated buttons that stay visible-but-disabled with an explanatory hint for under-privileged roles (CLAUDE.md "UI 버튼 숨김은 보안이 아니다").
- `RestoreRootBanner` — shows the UI-SPEC root-relocation copy when a restore's `relocatedToRoot` flag is true; no auto-dismiss timer, closes manually or is replaced by the next relocating restore.
- Sidebar `FolderTree` gets a fixed 40px "휴지통" link below the tree, accent-highlighted on the `/trash` route.
- **Backend parity fix (prerequisite, Rule 2):** `restoreDocument` (src/lib/documents.ts) now mirrors `restoreFolder`'s Open Q #2 root-relocation — a document independently trashed while its folder was still active, then left behind (not revived) when that folder was later deleted, is relocated to the workspace root on restore instead of resurfacing under a still-deleted `folderId`. The restore route now returns `200` JSON with `{ relocatedToRoot }` for documents too (was `204`), matching `restoreFolder`'s response shape.
- `e2e/document-trash.spec.ts` — proves the full delete→trash→restore→tree round trip and the EDITOR permanent-delete gate (disabled+hint, restore stays enabled), using the seeded default workspace (EDITOR role) rather than a freshly-created one (which would make the test user OWNER).

## Task Commits

Each task was committed atomically:

1. **Prerequisite fix: restoreDocument root-relocation parity** - `a877eda` (fix)
2. **Task 1: 휴지통 RSC + TrashList + 권한 게이팅** - `a38f255` (feat)
3. **Task 2: 복원/완전삭제 액션 wiring + 루트 배너 + 사이드바 링크** - `77c4f37` (feat)
4. **Task 3: 휴지통 왕복 e2e** - `107e561` (test — includes a Rule 1 bug fix found while running it)

**Plan metadata:** committed alongside this SUMMARY (see final commit below).

## Files Created/Modified
- `src/app/(main)/w/[wsId]/trash/page.tsx` - RSC: requireRole(VIEWER) + getTrashItems + server-side role-rank booleans
- `src/components/trash/TrashList.tsx` - mixed list, restore/permanent-delete wiring, gating
- `src/components/trash/TrashList.module.css` - row/list/empty/gate-hint styles (ported tokens only)
- `src/components/trash/RestoreRootBanner.tsx` / `.module.css` - root-relocation notice
- `src/components/tree/FolderTree.tsx` / `.module.css` - sidebar "휴지통" link
- `src/lib/documents.ts` - restoreDocument root-relocation parity fix
- `src/app/api/trash/[type]/[id]/restore/route.ts` - document restore now returns 200 JSON `{ relocatedToRoot }`
- `tests/trash/restore.test.ts` - new restoreDocument root-relocation test cases (RED→GREEN)
- `e2e/document-trash.spec.ts` - round trip + EDITOR permanent-delete gating

## Decisions Made
- `restoreDocument` extended to relocate to workspace root (Open Q #2 parity with `restoreFolder`) — discovered as a real gap while wiring `RestoreRootBanner`: without it, restoring an independently-trashed document whose folder was later deleted would resurrect it under a still-deleted `folderId`, making it vanish from the tree entirely.
- `TrashList` takes `canRestore`/`canPermanentDelete` booleans instead of `role` + `ROLE_RANK` — importing `@/lib/rbac` into a `"use client"` file pulled the whole module graph (including `@/auth`'s bcrypt native `fs` binding) into the browser bundle and broke the dev server build. The rank check now happens once, server-side, in `trash/page.tsx`.
- Trash's empty-state copy is rendered inline with its own left-aligned CSS, not the shared centered `EmptyState` component — UI-SPEC explicitly requires left alignment here (Trash Contract "빈 목록"), differing from the document-workspace index's centered empty state.
- e2e round trip and gating tests both scope their assertions to their own row (`[class*="TrashList_row"]` filtered by the test's unique seeded title) — the seeded default workspace used for the EDITOR-role scenario is shared across all e2e runs, so other tests' trash items can already be present.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] restoreDocument didn't relocate to workspace root when its original folder was deleted**
- **Found during:** Task 2 (wiring `RestoreRootBanner`)
- **Issue:** `restoreFolder` (04-04) already handled Open Q #2's root-relocation, but its single-document analog `restoreDocument` did not — a document independently trashed while its folder was active, then left behind when that folder was later deleted (cascade skips already-deleted rows), would resurface under a still-deleted `folderId` on restore and vanish from the tree (no active parent node to render under). CONTEXT.md's lock ("복원=EDITOR+·cascade(원위치 삭제 시 루트+안내)") and the plan's `must_haves.truths` don't scope root-relocation to folders only.
- **Fix:** `restoreDocument` now mirrors `restoreFolder`'s shape — checks whether the original parent folder is missing/deleted and, if so, sets `folderId=null` and returns `{ relocatedToRoot: true }`. The restore route returns `200` JSON for documents too (was `204`), so the client can read the flag uniformly for both item types.
- **Files modified:** `src/lib/documents.ts`, `src/app/api/trash/[type]/[id]/restore/route.ts`, `tests/trash/restore.test.ts`
- **Verification:** New RED test failed as expected (`expected '<uuid>' to be null`), then passed after the fix; full `tests/trash/` suite (31 tests) green.
- **Committed in:** `a877eda`

**2. [Rule 1 - Bug] TrashList's rbac import broke the Next.js browser bundle**
- **Found during:** Task 3 (running the new e2e spec)
- **Issue:** `TrashList.tsx` (a `"use client"` component) imported `ROLE_RANK`/`Role` from `@/lib/rbac`. `rbac.ts` imports `@/auth` at module scope, which pulls in `bcrypt` → `node-gyp-build` → `require('fs')`. Next.js tried to bundle this whole chain for the browser, failing with `Module not found: Can't resolve 'fs'` and breaking every page that rendered the sidebar (the dev server returned `500` app-wide, not just on `/trash`).
- **Fix:** Moved the rank comparison to `trash/page.tsx` (server component, where `@/lib/rbac` already runs safely) and pass only the resulting `canRestore`/`canPermanentDelete` booleans to `TrashList`, which no longer imports `@/lib/rbac` at all.
- **Files modified:** `src/app/(main)/w/[wsId]/trash/page.tsx`, `src/components/trash/TrashList.tsx`
- **Verification:** `pnpm tsc --noEmit` clean; full `pnpm exec playwright test` run succeeds (17 passed, 3 pre-existing/unrelated failures — see below); `curl localhost:3000/` returns `200` again.
- **Committed in:** `107e561` (bundled with the e2e spec commit, since the e2e run is what surfaced it)

---

**Total deviations:** 2 auto-fixed (1 missing critical functionality, 1 bug)
**Impact on plan:** Both fixes were necessary for correctness — the first closes a real data-integrity gap in the trash contract (a document could otherwise permanently disappear from the tree), the second was a build-breaking regression that would have failed CI/the dev server entirely. No scope creep beyond what UI-SPEC/CONTEXT.md already required.

## Issues Encountered
- A stale `next dev` process from an earlier session was listening on port 3000 and returning `500` for all routes; Playwright's `reuseExistingServer` attached to it instead of starting fresh. Killed the stale process (`kill <pid>`) and re-ran — not a code issue, environment-only.
- One `document-workspace.spec.ts` test (`저장 중…` debounce timing) failed once during a full-suite run but passed cleanly in isolation — a timing flake under the single-worker full-suite load (`Fast Refresh had to perform a full reload` noise in the webserver log around that point), not a regression from this plan's changes.

## Known Pre-Existing / Out-of-Scope Failures (not fixed here, per this plan's explicit instructions)

Two e2e specs fail on `main`/this branch independent of 04-05's changes — both reference the pre-Phase-4-refactor `/w/[wsId]` editor route (workspace name `<h1>` / inline editor) that moved to `layout.tsx` + `d/[docId]/page.tsx` in 04-02:
- `e2e/preview-perf.spec.ts` — `keystroke-to-preview-mutation p95` — waits for `.cm-content` directly under `/w/[wsId]`, which no longer hosts an editor (needs `d/[docId]`).
- `e2e/workspace-delete.spec.ts` — asserts an `<h1>` workspace-name heading on `/w/[wsId]` that `layout.tsx` no longer renders.

Per this plan's prompt, these are flagged for the orchestrator to address at phase end, not fixed in this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 4's full document/autosave/3-pane/trash surface is now implemented end to end: create → autosave (seq-guarded) → soft-delete → trash list → restore/permanent-delete, with RBAC transparent at every mutation boundary.
- `pnpm vitest run` — 880/880 green. `pnpm exec tsc --noEmit` — clean. `pnpm exec playwright test` — 17/20 green (3 pre-existing/unrelated failures documented above).
- DOC-02 was already checked off in REQUIREMENTS.md by 04-04 (backend-only completion) — this plan completes its user-facing half; `requirements mark-complete DOC-02` is idempotent here.
- Open follow-up (not blocking): D3/D4 in this SUMMARY's `coverage` block flag two UI paths (root-relocation banner rendering, ADMIN permanent-delete click-through) that are only unit/integration-tested, not e2e-proven end to end — candidates for `/gsd-verify-work` human UAT or a follow-up role-seeded e2e case.

---
*Phase: 04-documents-autosave-3-pane-workspace*
*Completed: 2026-08-08*

## Self-Check: PASSED

All created/modified files (11) and all 4 task commits (a877eda, a38f255, 77c4f37, 107e561) verified present on disk / in git log.
