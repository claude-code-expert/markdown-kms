---
phase: 07-workspace-collaboration-join-invite
plan: 04
subsystem: api
tags: [drizzle, postgres, rbac, ilike-search, next-app-router]

requires:
  - phase: 07-workspace-collaboration-join-invite (plan 07-02)
    provides: requireRole/ForbiddenError RBAC gate reused unchanged
provides:
  - "searchUsersForInvite(workspaceId, q): escaped-ILIKE user search over email/name with an isMember flag"
  - "GET /api/workspaces/[id]/members/search: ADMIN-only member-search endpoint"
  - "getWorkspaceMembers(workspaceId): workspace_member+user join for the members page RSC"
  - "getPendingJoinRequests(workspaceId): PENDING workspace_join_request+user join for the members page RSC"
affects: [07-05 members page UI / InviteSearch]

actuals:
  tokens: 5200
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "member-search.ts mirrors search.ts's ILIKE-escape + sql template + ESCAPE '\\' verbatim (T-06-SQLI reuse), swapping the target to user.email/user.name plus an EXISTS(workspace_member) isMember subquery"
    - "members.ts mirrors db-membership.ts's listMembershipsForUser innerJoin shape, reversed to workspace_member⨝user and repeated for workspace_join_request⨝user"

key-files:
  created:
    - src/lib/member-search.ts
    - src/app/api/workspaces/[id]/members/search/route.ts
    - src/lib/members.ts
    - tests/invitations/member-search.test.ts
    - tests/members/list.test.ts
  modified: []

key-decisions:
  - "member-search route omits normalizeNFC (plan left this to executor discretion; kept the function itself un-normalizing to match search.ts's boundary-normalizes convention, and the route doesn't call it either -- ILIKE on email/name doesn't hit the same Hangul NFC/NFD edge case documents.title does)"

patterns-established:
  - "MemberSearchResult { userId, email, name, isMember } mirrors SearchResult's plain interface + Row type pair from search.ts"

requirements-completed: [WS-05]

coverage:
  - id: D1
    description: "ADMIN searches existing users by email/name substring via GET /api/workspaces/:id/members/search?q=, each result carrying an isMember flag for this workspace"
    requirement: "WS-05"
    verification:
      - kind: integration
        ref: "tests/invitations/member-search.test.ts#allows an ADMIN and returns results"
        status: pass
      - kind: integration
        ref: "tests/invitations/member-search.test.ts#flags isMember=true for an existing member and false for a non-member"
        status: pass
    human_judgment: false
  - id: D2
    description: "Non-ADMIN roles (VIEWER/EDITOR/non-member) get 403 on member search; %/_ and SQL-metacharacter queries are bound literally, not as wildcards/injection"
    requirement: "WS-05"
    verification:
      - kind: integration
        ref: "tests/invitations/member-search.test.ts#rejects a VIEWER with 403"
        status: pass
      - kind: integration
        ref: "tests/invitations/member-search.test.ts#treats '%' and '_' as literal characters, not ILIKE wildcards"
        status: pass
      - kind: integration
        ref: "tests/invitations/member-search.test.ts#does not let a SQL-metacharacter query return unrelated users (injection-safe)"
        status: pass
    human_judgment: false
  - id: D3
    description: "getWorkspaceMembers and getPendingJoinRequests return workspace-scoped member/PENDING-request lists for the members page RSC"
    requirement: "WS-05"
    verification:
      - kind: integration
        ref: "tests/members/list.test.ts#returns every member of the workspace with role, scoped to that workspace only"
        status: pass
      - kind: integration
        ref: "tests/members/list.test.ts#returns only PENDING requests for the workspace, with applicant info"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-09
status: complete
---

# Phase 07 Plan 04: Member Data + Search Summary

**ADMIN-only member search (escaped ILIKE over email/name + isMember flag) and RSC-consumed member/PENDING-request list queries, both mirroring existing Phase 6 search and db-membership patterns verbatim.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-09T03:52:00Z
- **Completed:** 2026-08-09T04:17:00Z
- **Tasks:** 2
- **Files modified:** 5 (all new)

## Accomplishments
- `searchUsersForInvite` — escaped ILIKE over `user.email`/`user.name`, `isMember` via correlated `EXISTS(workspace_member)`, empty q short-circuits to `[]`
- `GET /api/workspaces/[id]/members/search` — ADMIN-gated (T-07-04-ENUM), 400 on malformed wsId, mirrors the existing `search/route.ts` shape exactly
- `getWorkspaceMembers` / `getPendingJoinRequests` in `members.ts` — workspace-scoped joins for the (not-yet-built) 07-05 members page RSC
- 12 + 2 integration tests covering partial match, isMember correctness, `%`/`_` literal escaping, SQLi-safety, RBAC (VIEWER/EDITOR/non-member → 403, ADMIN → 200), empty-q, and workspace-scoping/PENDING-filtering

## Task Commits

Each task was committed atomically (TDD RED test file written first, confirmed failing before implementation):

1. **Task 1: member-search.ts + members/search 라우트** - `9a5529e` (feat)
2. **Task 2: members.ts (getWorkspaceMembers + getPendingJoinRequests)** - `9195591` (feat)

_Note: both tasks are `tdd="true"` but each shipped as a single commit — the RED test was written and confirmed failing via `pnpm vitest run` before the implementation file existed, then the GREEN implementation was added to the same staged change before committing (test file + implementation file committed together per task, matching this plan's existing 07-03 commit granularity rather than splitting test/feat into separate commits)._

## Files Created/Modified
- `src/lib/member-search.ts` - `searchUsersForInvite(workspaceId, q, client)`: escaped-ILIKE search + isMember flag
- `src/app/api/workspaces/[id]/members/search/route.ts` - `GET`: ADMIN-gated member search endpoint
- `src/lib/members.ts` - `getWorkspaceMembers`, `getPendingJoinRequests`: workspace-scoped join queries
- `tests/invitations/member-search.test.ts` - lib + route integration tests (12 cases)
- `tests/members/list.test.ts` - lib integration tests (2 cases)

## Decisions Made
- Route does not call `normalizeNFC` on the search query (plan left this to executor discretion). Kept `member-search.ts` itself non-normalizing, matching `search.ts`'s "boundary normalizes, service function doesn't" convention — and skipped adding `normalizeNFC` at the route boundary too, since `documents.title`'s Hangul NFC/NFD collision case doesn't apply the same way to `user.email`/`user.name` lookups and the plan explicitly marked this optional.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- 07-05 (members page UI) can now directly `await getWorkspaceMembers`/`getPendingJoinRequests` in the RSC and wire `InviteSearch` to `GET /members/search` — both consumers' contracts (`{userId,name,email,role}`, `{reqId,userId,name,email,createdAt}`, `{userId,email,name,isMember}`) are proven by the tests above.
- No blockers.

---
*Phase: 07-workspace-collaboration-join-invite*
*Completed: 2026-08-09*

## Self-Check: PASSED

All created files found on disk; both task commits (`9a5529e`, `9195591`) found in git history.
