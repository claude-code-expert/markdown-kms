---
phase: 07-workspace-collaboration-join-invite
plan: 03
subsystem: api
tags: [drizzle, transaction, rbac, join-request]

# Dependency graph
requires:
  - phase: 07-workspace-collaboration-join-invite
    provides: "07-02: src/lib/rbac.ts requireRole/forbiddenResponse, tests/rbac/helpers.ts factories, guard-update-in-transaction admission idiom (invitations.ts acceptInvitation)"
provides:
  - "src/lib/join-requests.ts — createJoinRequest (single-INSERT, session-bound) + decideJoinRequest (guard-update transaction, AlreadyDecidedError)"
  - "POST /api/workspaces/[id]/join-requests — session-only gate (no requireRole), already-member/duplicate-PENDING 400"
  - "PATCH /api/workspaces/[id]/join-requests/[reqId] — requireRole ADMIN, decision enum, AlreadyDecidedError -> 409"
affects: [07-04-members-page, 07-05-invite-search-ui]

# Actuals (#2632)
actuals:
  tokens: 5189
  tasks: 3
  commits: 5

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Guard-update inside db.transaction (WHERE status='PENDING') as the double-decide/TOCTOU defense — direct reuse of 07-02's acceptInvitation idiom, no new pattern invented"
    - "AlreadyDecidedError folds both 'already decided' and 'nonexistent reqId' into a single 409 — same not-found-enumeration-avoidance convention as invitations.ts's invalid-signature fold"
    - "POST join-requests binds userId to the session, never a request-body field, and skips requireRole entirely (the only mutating route in this phase that doesn't call it) because the caller isn't yet a member"

key-files:
  created:
    - src/lib/join-requests.ts
    - src/app/api/workspaces/[id]/join-requests/route.ts
    - src/app/api/workspaces/[id]/join-requests/[reqId]/route.ts
    - tests/join-requests/decide.test.ts
    - tests/join-requests/create.test.ts
  modified: []

key-decisions:
  - "PATCH join-requests/:reqId's PATCH RBAC assertions live entirely in tests/join-requests/decide.test.ts (a second describe block), not a separate route-test file — matches the plan's explicit instruction to co-locate route-level PATCH coverage with the lib-level decide tests, and keeps tests/rbac/matrix.test.ts untouched per the feature-owns-its-RBAC convention (07-02 create.test.ts precedent)."
  - "PATCH success returns 200 with an empty body (not 204) — matches the plan's '200(또는 204)' discretion and the decide.test.ts assertions written against it; DELETE routes elsewhere in the codebase use 204, but this PATCH has no established analog forcing one over the other."

requirements-completed: [WS-03, WS-04]

coverage:
  - id: D1
    description: "A logged-in non-member can create a join request via POST /api/workspaces/:id/join-requests; the request is bound to the session user, never a client-supplied id"
    requirement: "WS-03"
    verification:
      - kind: integration
        ref: "tests/join-requests/create.test.ts#non-member success + non-uuid wsId (2 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Already-member and duplicate-PENDING applications are both rejected with 400 and create no row"
    requirement: "WS-03"
    verification:
      - kind: integration
        ref: "tests/join-requests/create.test.ts#rejects an already-member applicant + rejects a duplicate PENDING request (2 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "An ADMIN approving a PENDING request atomically sets status=APPROVED and inserts an EDITOR membership row in one transaction; rejecting sets status=REJECTED with no membership insert"
    requirement: "WS-04"
    verification:
      - kind: integration
        ref: "tests/join-requests/decide.test.ts#approve + reject (2 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Deciding an already-decided or nonexistent request throws AlreadyDecidedError / returns 409 (guard-update WHERE status='PENDING' catches both concurrent double-decide and stale reqId), and the decision is idempotent against a target who is already a member with a different role"
    requirement: "WS-04"
    verification:
      - kind: integration
        ref: "tests/join-requests/decide.test.ts#already-decided + idempotent admission + concurrent double approve + PATCH already-decided/nonexistent-reqId (5 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "PATCH is gated by requireRole ADMIN across the full 4-role matrix (OWNER/ADMIN succeed, EDITOR/VIEWER/non-member/unauthenticated get 403)"
    requirement: "WS-04"
    verification:
      - kind: integration
        ref: "tests/join-requests/decide.test.ts#4-role matrix + non-member + unauthenticated (6 tests via it.each + 2 discrete)"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-08-09
status: complete
---

# Phase 7 Plan 3: Join-Request Backend (createJoinRequest/decideJoinRequest + POST/PATCH routes) Summary

**Session-bound join-request creation with duplicate/already-member 400 guards, paired with an ADMIN-gated guard-update-transaction decision endpoint that atomically flips status and admits EDITOR membership, proven double-decide-safe by a 409 on any non-PENDING reqId (including nonexistent ones).**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-09T12:46:03+09:00 (first RED commit)
- **Completed:** 2026-08-09T12:52:xx+09:00
- **Tasks:** 3
- **Files modified:** 5 (all newly created)

## Accomplishments
- `src/lib/join-requests.ts` — `createJoinRequest` (single INSERT, status defaults to `PENDING` at the schema level) and `decideJoinRequest` (guard-update `UPDATE ... WHERE id=:reqId AND status='PENDING'` inside `db.transaction`; 0 rows → `AlreadyDecidedError`, thrown inside the transaction so it rolls back cleanly; `APPROVED` inserts a `workspace_member` row with `role='EDITOR'` via `.onConflictDoNothing()` in the same transaction — directly reusing 07-02's `acceptInvitation` admission idiom with zero new architecture). Proven by 6 real-DB integration tests: approve, reject, already-decided (state unchanged), idempotent admission against an existing VIEWER, and concurrent double-approve.
- `POST /api/workspaces/[id]/join-requests` — the only mutating route in this phase that does **not** call `requireRole`: the applicant is not yet a workspace member, so `requireRole` would always 403. Binds `userId` to `session.user.id` only (never a request body field — anti-spoofing, T-07-03-SPOOF). Rejects an already-member or duplicate-PENDING applicant with 400 before ever calling `createJoinRequest`. Proven by 5 integration tests (success, already-member, duplicate-PENDING, unauthenticated, non-uuid wsId).
- `PATCH /api/workspaces/[id]/join-requests/[reqId]` — `requireRole(wsId, "ADMIN")` gate, both `wsId` and `reqId` validated as uuid before any DB call, zod `{ decision: "APPROVED"|"REJECTED" }` body, `AlreadyDecidedError` caught and mapped to 409 (this single mapping covers both "already decided" and "nonexistent reqId" — the guard-update can't tell them apart, and folding them avoids an existence-enumeration oracle, same convention as `invitations.ts`'s `invalid-signature` fold). Proven by 12 integration tests: full 4-role matrix (OWNER/ADMIN 200, EDITOR/VIEWER 403) + non-member 403 + unauthenticated 403 + invalid decision enum 400 + nonexistent reqId 409 + already-decided reqId 409 + non-uuid reqId 400.

## Task Commits

Each task was committed atomically (TDD RED->GREEN pairs):

1. **Task 1 RED: failing createJoinRequest/decideJoinRequest tests** - `7ce74bb` (test)
2. **Task 1 GREEN: join-requests.ts (createJoinRequest + decideJoinRequest)** - `dd0f24c` (feat)
3. **Task 2 RED: failing POST create.test.ts + PATCH tests in decide.test.ts** - `5b55a43` (test)
4. **Task 2 GREEN: POST/PATCH join-requests routes** - `cb6e6c8` (feat)
5. **Task 3: full 4-role RBAC matrix for PATCH added to decide.test.ts** - `55d1af8` (test)

**Plan metadata:** committed separately after this summary (docs: complete plan)

## Files Created/Modified
- `src/lib/join-requests.ts` - `createJoinRequest`, `decideJoinRequest`, `AlreadyDecidedError`, `DbClient` injection type (copied from documents.ts)
- `tests/join-requests/decide.test.ts` - 12 lib-level tests + 12 PATCH-route-level tests (2 describe blocks)
- `tests/join-requests/create.test.ts` - 5 integration tests for the POST route
- `src/app/api/workspaces/[id]/join-requests/route.ts` - `POST` handler
- `src/app/api/workspaces/[id]/join-requests/[reqId]/route.ts` - `PATCH` handler

## Decisions Made
- PATCH's full 4-role RBAC matrix (Task 3) lives in `tests/join-requests/decide.test.ts` as a second `describe` block, not in the shared `tests/rbac/matrix.test.ts` — matching the 07-02 `create.test.ts` precedent of each feature test file owning its own RBAC assertions. Verified `matrix.test.ts` is absent from the git diff for this plan.
- PATCH success returns `200` with an empty body — the plan explicitly left this to discretion ("200 또는 204"); the codebase's existing 204 precedent (`DELETE /api/workspaces/[id]`) is for a no-content response with a fully idempotent no-op semantics, whereas this PATCH's decision test suite was written expecting 200 first.
- No new architectural decisions — this plan is a direct, literal reapplication of 07-02's guard-update-transaction admission idiom to a second entity (`workspace_join_request` instead of `invitation`), with zero deviation from RESEARCH/PATTERNS.

## Deviations from Plan

None - plan executed exactly as written. Both `tdd="true"` tasks followed RED (confirmed failing — import errors for not-yet-created modules) → GREEN (all tests passing) → commit exactly as specified. Task 3 (no `tdd` gate — pure test-matrix expansion, no new production code) added the 4-role matrix and ran the full regression suite.

## Issues Encountered
None.

## User Setup Required
None — this plan introduces no new external dependencies or environment variables. Builds entirely on 07-01's schema (`workspace_join_request`) and 07-02's `rbac.ts`/`tests/rbac/helpers.ts`.

## Next Phase Readiness
- `src/lib/join-requests.ts` (`createJoinRequest`, `decideJoinRequest`, `AlreadyDecidedError`) and both routes are ready for 07-04 (members page — `getPendingJoinRequests` will read `workspace_join_request` rows this plan's `createJoinRequest` populates) and 07-05 (`PendingRequestRow` UI will call the PATCH route this plan built).
- No blockers identified. Full regression suite (`pnpm vitest run`) is 1032/1032 green; `pnpm exec tsc --noEmit` is clean.
- Manual browser verification (join → PENDING appears → ADMIN approves → EDITOR membership visible) is deferred to phase-end batched verification per the project's established convention (STATE.md Deferred Verification section, same as Phases 3-6 and 07-02's D6).

---
*Phase: 07-workspace-collaboration-join-invite*
*Completed: 2026-08-09*
