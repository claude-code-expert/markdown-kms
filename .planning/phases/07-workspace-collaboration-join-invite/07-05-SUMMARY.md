---
phase: 07-workspace-collaboration-join-invite
plan: 05

subsystem: ui

tags: [nextjs, react, css-modules, rbac, collaboration]

requires:
  - phase: 07-02
    provides: POST /api/workspaces/[id]/invitations (createInvitation, encodeInvitationToken, sendInvitationEmail console stub)
  - phase: 07-03
    provides: POST /api/workspaces/[id]/join-requests, PATCH .../join-requests/[reqId] (createJoinRequest, decideJoinRequest)
  - phase: 07-04
    provides: getWorkspaceMembers/getPendingJoinRequests (src/lib/members.ts), searchUsersForInvite + GET members/search route
provides:
  - "w/[wsId]/members RSC page (member list + ADMIN-only pending-approval + invite-search sections)"
  - "Dashboard workspace-join-by-id input"
  - "FolderTree sidebar entry point to the members page"
affects: [phase-08]

actuals:
  tokens: 6757
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "RSC computes a canManage boolean server-side (requireRole + ROLE_RANK) and only that boolean crosses into 'use client' components — never @/lib/rbac itself (TrashList precedent, verified by production bundle size: /w/[wsId]/members ships 4.27kB, no bcrypt/auth leakage)"
    - "ADMIN-only page sections are omitted entirely for non-ADMIN, not disabled+hint (UI-SPEC deliberately diverges from TrashList's gate-hint convention here)"
    - "Debounce/race-guard search state machine (SearchBox.tsx's useSearchResults) is duplicated per consumer rather than extracted to a shared hook — two call sites, different endpoints/result shapes, no abstraction forced yet"

key-files:
  created:
    - "src/app/(main)/w/[wsId]/members/page.tsx"
    - "src/components/members/MembersView.tsx"
    - "src/components/members/MembersView.module.css"
    - "src/components/members/MemberRow.tsx"
    - "src/components/members/PendingRequestRow.tsx"
    - "src/components/members/InviteSearch.tsx"
    - "src/components/workspace/JoinWorkspaceInput.tsx"
    - "src/components/workspace/JoinWorkspaceInput.module.css"
  modified:
    - "src/app/(main)/dashboard/page.tsx"
    - "src/app/(main)/dashboard/page.module.css"
    - "src/components/tree/FolderTree.tsx"
    - "src/components/tree/FolderTree.module.css"

key-decisions:
  - "InviteSearch stub committed in Task 1 (MembersView needs the import to typecheck), fully implemented in Task 2 — plan's own task split created this dependency, resolved without collapsing the two commits"
  - "Task 2 extended MembersView.module.css (searchRow/spinner/searchError/retryButton) instead of adding a new InviteSearch.module.css — Task 2's file list only listed InviteSearch.tsx, and the search-result rows reuse Task 1's .row/.identity/.name/.email/.badge verbatim"
  - "MemberRowData.role typed as plain string (not a Role union imported from rbac.ts) — workspaceMember.role is a `text` column at the Drizzle type level (DB CHECK enforces the enum), and importing rbac.ts's Role type — even type-only — was avoided to keep this client component fully decoupled from @/lib/rbac"

patterns-established:
  - "Members page 3-section RSC→client boolean handoff is now the second instance of the TrashList canRestore/canPermanentDelete pattern (canManage) — established as the standard shape for role-gated page sections"

requirements-completed: [WS-03, WS-04, WS-05]

coverage:
  - id: D1
    description: "Members page renders member list (VIEWER+) and omits pending-approval/invite-search sections entirely for non-ADMIN"
    requirement: WS-04
    verification:
      - kind: unit
        ref: "pnpm exec tsc --noEmit (canManage boolean plumbing, no @/lib/rbac in client bundle)"
        status: pass
      - kind: other
        ref: "pnpm build — /w/[wsId]/members ships 4.27kB First Load JS (no bcrypt/auth leakage, cf. TrashList Rule-1 precedent)"
        status: pass
    human_judgment: true
    rationale: "Section visibility by role and ConfirmDialog approve/reject flow need a real browser + two accounts (ADMIN and VIEWER) to observe — no RTL/component-test harness installed in this repo (deferred to phase-end batch verification per user's 2026-08-08 instruction, same as Phases 3-6)."
  - id: D2
    description: "ADMIN can search existing accounts (debounced, race-guarded) and send invitations; already-member rows show a badge instead of a button"
    requirement: WS-05
    verification: []
    human_judgment: true
    rationale: "Requires live DB + a second real account to search for; the search/invite round-trip is a UI interaction sequence, not a unit-testable pure function. Deferred to phase-end batch verification."
  - id: D3
    description: "Dashboard workspace-id join-request input: success clears the field with a neutral pending message, failure shows destructive copy, next keystroke clears feedback"
    requirement: WS-03
    verification: []
    human_judgment: true
    rationale: "Full round-trip (submit → appears in the target workspace's pending list) needs two accounts and two workspaces open at once. Deferred to phase-end batch verification."
  - id: D4
    description: "FolderTree sidebar 멤버 link routes to /w/{wsId}/members with active-state highlighting"
    requirement: null
    verification:
      - kind: unit
        ref: "pnpm exec tsc --noEmit + pnpm build (Link href, active-class computation compile-checked)"
        status: pass
    human_judgment: true
    rationale: "Active-class visual highlighting needs a browser to observe pixel state; logic itself is compile-checked."

duration: 45min
completed: 2026-08-09
status: complete
---

# Phase 7 Plan 5: Workspace Collaboration UI Integration Summary

**Members page (role-gated approve/reject + debounced invite search) + dashboard join-by-id input + FolderTree entry point, wiring 07-02/03/04's collaboration backends into the UI**

## Performance

- **Duration:** 45 min
- **Started:** 2026-08-09T12:55:00Z
- **Completed:** 2026-08-09T13:40:00Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments
- `w/[wsId]/members` RSC page: `requireRole(VIEWER)` computes a `canManage` boolean server-side; only that boolean (never `@/lib/rbac`) crosses into the client component tree
- Members page renders 3 sections in UI-SPEC order — 승인 대기 중 (ADMIN-only) → 멤버 목록 (VIEWER+) → 회원 초대 (ADMIN-only) — with ADMIN-only sections omitted entirely (not disabled) for non-ADMIN viewers
- `PendingRequestRow`: ConfirmDialog-gated approve/reject → `PATCH /api/workspaces/{wsId}/join-requests/{reqId}`, inline error inside the dialog on failure, `router.refresh()` on success
- `InviteSearch`: 300ms debounce + seqRef race guard (SearchBox.tsx pattern) against `GET members/search`, per-row invite send (`POST invitations`) with sending/sent/failed per-row states, already-member rows show a badge instead of a button
- `JoinWorkspaceInput`: dashboard workspace-id input → `POST join-requests`, success clears the field with a neutral pending message, failure shows destructive copy, feedback clears on next keystroke (no timer)
- FolderTree gained a `멤버` sidebar entry point below `휴지통`, CSS is a verbatim clone of `trashLink`/`trashLinkActive`

## Task Commits

Each task was committed atomically:

1. **Task 1: Members page RSC + MembersView/MemberRow/PendingRequestRow** - `86206a2` (feat)
2. **Task 2: InviteSearch — debounced search + per-row invite send** - `7f11a25` (feat)
3. **Task 3: Dashboard join-request input + FolderTree members link** - `d36a3a5` (feat)

**Plan metadata:** (this commit) — docs: complete plan

## Files Created/Modified
- `src/app/(main)/w/[wsId]/members/page.tsx` - RSC: requireRole(VIEWER) → canManage boolean, direct getWorkspaceMembers/getPendingJoinRequests calls
- `src/components/members/MembersView.tsx` - 3-section client shell, ADMIN-only sections conditionally rendered
- `src/components/members/MembersView.module.css` - row/badge/search shared styles (extended in Task 2 for InviteSearch)
- `src/components/members/MemberRow.tsx` - read-only member row with role badge (OWNER→소유자 etc.)
- `src/components/members/PendingRequestRow.tsx` - approve/reject via ConfirmDialog + PATCH
- `src/components/members/InviteSearch.tsx` - debounced member search + per-row invite send
- `src/components/workspace/JoinWorkspaceInput.tsx` - dashboard inline join-request input
- `src/components/workspace/JoinWorkspaceInput.module.css` - input row + feedback line styles
- `src/app/(main)/dashboard/page.tsx` - added join-request section below `.grid`, memberships loading unchanged
- `src/app/(main)/dashboard/page.module.css` - `.joinSection`/`.joinLabel`
- `src/components/tree/FolderTree.tsx` - added `Users` icon import + membersLink block
- `src/components/tree/FolderTree.module.css` - `.membersLink`/`.membersLinkActive`

## Decisions Made
- InviteSearch shipped as a typecheck-only stub in Task 1's commit (returns `null`) since MembersView needs the import to compile before Task 2 implements the real component — the plan's own task split (`InviteSearch.tsx` listed only under Task 2's `<files>`) created this ordering dependency; resolved it without merging the two commits into one.
- Task 2 added new CSS classes to the already-committed `MembersView.module.css` (searchRow/spinner/searchError/retryButton) rather than introducing a new `InviteSearch.module.css` — Task 2's declared file list was `InviteSearch.tsx` only, and the result rows reuse Task 1's `.row`/`.identity`/`.name`/`.email`/`.badge` verbatim (no duplicate row styling).
- `MemberRowData.role` is typed `string`, not a `Role` union imported from `@/lib/rbac` — `workspaceMember.role` is a plain `text` Drizzle column (the enum is DB-CHECK-enforced, not type-level), and keeping this client component's role type fully local avoids any import — even type-only — from `@/lib/rbac`.

## Deviations from Plan

None beyond the InviteSearch stub/CSS-extension decisions above, which are file-scope resolutions within the plan's intent, not scope changes — no new architectural surface, no new dependency, no requirement gap.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- WS-03/WS-04/WS-05's full user-facing surface is now wired: `pnpm exec tsc --noEmit`, `pnpm vitest run` (1046/1046 passing across 67 files), `pnpm exec eslint`, and `pnpm build` all pass cleanly. Production bundle for `/w/[wsId]/members` is 4.27kB First Load JS — confirms `@/lib/rbac` (and its bcrypt-native transitive graph) never entered the client bundle.
- Manual/e2e verification (ADMIN vs VIEWER section visibility, full search→invite→accept→EDITOR round trip, dashboard join→approval round trip) is deferred to phase-end batch verification per the user's 2026-08-08 instruction (same pattern as Phases 3-6's `Deferred Verification` table in STATE.md) — no Playwright spec was added by this plan (none was in its file list; the plan's own `<verification>` section explicitly names this "수동(phase 말 배치)").
- Phase 7 is now fully executed (07-01 through 07-05, all 5 plans). Ready for `/gsd-verify-work 7`.

---
*Phase: 07-workspace-collaboration-join-invite*
*Completed: 2026-08-09*

## Self-Check: PASSED

All 12 created/modified files verified present on disk; all 3 task commits (86206a2, 7f11a25, d36a3a5) verified present in git log.
