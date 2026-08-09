---
phase: 07-workspace-collaboration-join-invite
plan: 01
subsystem: database
tags: [drizzle, postgres, hmac, crypto, node-crypto, invitations]

# Dependency graph
requires:
  - phase: 06-search-tags
    provides: workspace/workspaceMember/user pgTable conventions (FK cascade, CHECK constraint, timestamptz patterns) this plan replicates for invitation/workspaceJoinRequest
provides:
  - "invitation pgTable (id, workspaceId, inviteeId, createdBy, expiresAt, usedAt, createdAt) — no token column (NFR-3.3)"
  - "workspaceJoinRequest pgTable (id, workspaceId, userId, status CHECK, decidedBy, createdAt, decidedAt)"
  - "drizzle/0007_tricky_selene.sql migration applied to local PG16@5433"
  - "src/lib/invitation-token.ts: encodeInvitationToken/parseInvitationToken/verifyMac pure HMAC-SHA256 helper"
affects: [07-02-invitations-flow, 07-03-join-requests-flow, 07-04-members-page]

# Actuals (#2632)
actuals:
  tokens: 2618
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure crypto helper (no DB/DOM/process.env) — same isolation principle as editor plugin run(state) functions"
    - "epoch-ms (.getTime()) serialization for signed timestamps instead of ISO strings — avoids Date round-trip ambiguity"

key-files:
  created:
    - src/lib/invitation-token.ts
    - tests/invitations/token.test.ts
    - drizzle/0007_tricky_selene.sql
  modified:
    - src/db/schema.ts

key-decisions:
  - "FK cascade policy follows TRD §3 DDL literally: workspaceId/inviteeId/userId cascade, createdBy/decidedBy no cascade (no ON DELETE clause) — matches existing folder.parentId precedent of following literal DDL over uniform cascading"
  - "No partial unique index on workspaceJoinRequest.status='PENDING' — duplicate-PENDING prevention deferred to application-level WHERE guards in 07-03 (RESEARCH Alternatives, TRD DDL left unchanged)"
  - "AUTH_SECRET existence verified indirectly: Auth.js v5 login has been functional since Phase 1, which requires AUTH_SECRET to be set — no new env var introduced, precondition satisfied by prior-phase evidence rather than direct file read (protect-paths hook + sandbox policy block direct .env.local inspection)"

patterns-established:
  - "Pure crypto helper pattern (src/lib/invitation-token.ts): secret and all inputs passed as arguments, only node:crypto imports, testable with zero DB/network setup"

requirements-completed: [WS-03, WS-04, WS-05]

coverage:
  - id: D1
    description: "invitation table exists with cascade FKs on workspaceId/inviteeId, no-cascade FK on createdBy, nullable usedAt, and no token column"
    requirement: "WS-05"
    verification:
      - kind: integration
        ref: "psql \\d invitation (manual verification during migration checkpoint)"
        status: pass
      - kind: other
        ref: "pnpm exec tsc --noEmit"
        status: pass
    human_judgment: false
  - id: D2
    description: "workspace_join_request table exists with status CHECK constraint restricted to PENDING/APPROVED/REJECTED"
    requirement: "WS-03"
    verification:
      - kind: integration
        ref: "psql \\d workspace_join_request (manual verification during migration checkpoint)"
        status: pass
    human_judgment: false
  - id: D3
    description: "encodeInvitationToken/parseInvitationToken/verifyMac implement TRD §9 formula with constant-time comparison, rejecting tampered macs, wrong secrets, and mismatched expiresAt"
    requirement: "WS-05"
    verification:
      - kind: unit
        ref: "tests/invitations/token.test.ts#invitation-token (7 tests)"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-08-09
status: complete
---

# Phase 7 Plan 1: Foundation — Invitation Schema & Token Crypto Summary

**invitation + workspace_join_request Drizzle tables (TRD §3, migrated to local PG16) plus a pure HMAC-SHA256 invitation-token helper (encode/parse/verifyMac) proven by 7 RED→GREEN unit tests against forgery, wrong-secret, and expiry-mismatch attacks.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-09T12:25:20+09:00
- **Completed:** 2026-08-09T12:31:28+09:00
- **Tasks:** 3
- **Files modified:** 4 (schema.ts, invitation-token.ts, token.test.ts, migration SQL + generated meta)

## Accomplishments
- `invitation` and `workspaceJoinRequest` pgTable declarations added to `src/db/schema.ts`, matching TRD §3 DDL exactly (columns, FK cascade policy, status CHECK)
- Migration `drizzle/0007_tricky_selene.sql` generated and applied to local dev DB (PG16@5433) — verified via `psql \d` that both tables and constraints exist as-designed, no destructive changes to existing tables
- `src/lib/invitation-token.ts` implements the TRD §9 token formula (`base64url(id + "." + HMAC-SHA256(secret, id + expiresAt-epoch-ms))`) as three pure functions, proven by 7 unit tests covering round-trip, valid verify, tampered mac, wrong secret, wrong expiresAt, epoch-ms consistency, and malformed-input parsing

## Task Commits

Each task was committed atomically:

1. **Task 1: schema.ts invitation + workspaceJoinRequest tables** - `2323471` (feat)
2. **Task 2: one-way migration generate + apply** - `4695204` (chore) — checkpoint pre-approved (2026-08-09, user via orchestrator, same precedent as 03-01/04-01/06-01)
3. **Task 3 RED: failing invitation-token test** - `e524a88` (test)
4. **Task 3 GREEN: invitation-token.ts implementation** - `d9e4ca5` (feat)

**Plan metadata:** committed separately after this summary (docs: complete plan)

## Files Created/Modified
- `src/db/schema.ts` - Added `invitation` and `workspaceJoinRequest` pgTable exports
- `drizzle/0007_tricky_selene.sql` - Migration: CREATE TABLE invitation, CREATE TABLE workspace_join_request, FK constraints
- `drizzle/meta/0007_snapshot.json`, `drizzle/meta/_journal.json` - drizzle-kit generated metadata
- `src/lib/invitation-token.ts` - Pure HMAC-SHA256 encode/parse/verifyMac helper (node:crypto only)
- `tests/invitations/token.test.ts` - 7 unit tests for the token helper

## Decisions Made
- FK cascade policy on `createdBy`/`decidedBy` intentionally has no `ON DELETE CASCADE` — followed TRD §3 DDL literally rather than defaulting to cascade-everywhere, consistent with the existing `folder.parentId` precedent in this codebase.
- No DB-level partial unique index for duplicate-PENDING prevention on `workspaceJoinRequest` — deferred to application-level `WHERE status='PENDING'` guards that 07-03 will implement (RESEARCH Alternatives already ruled this a deliberate TRD-unchanged decision, not a gap).
- AUTH_SECRET precondition (user_setup) treated as satisfied by indirect evidence: Auth.js v5 login has been operating since Phase 1 and mandates `AUTH_SECRET` at runtime, so a fresh direct read of `.env.local` was unnecessary — and was in any case blocked by the `protect-paths.sh` hook / sandbox policy for `.env*` paths, which this plan's read-only precondition check honored rather than attempting to bypass.

## Deviations from Plan

None - plan executed exactly as written. Task 3's TDD gate sequence (RED commit `e524a88` → GREEN commit `d9e4ca5`) matches the plan's `tdd="true"` requirement; no REFACTOR commit was needed (implementation was already minimal on first GREEN pass).

## Issues Encountered
- Direct Bash reads of `.env.local` (to confirm `AUTH_SECRET` presence per the plan's `user_setup` precondition) were denied by the sandbox permission system before the `protect-paths.sh` hook even ran. Resolved by relying on the documented fact that Auth.js v5 login is already functional in this project (Phase 1+), which requires `AUTH_SECRET` to be set — no blocking checkpoint was needed since this is existence-confirmation-only per the plan, and the fact was independently confirmable from prior-phase behavior rather than file contents.

## User Setup Required

None - no external service configuration required. `AUTH_SECRET` is an existing Auth.js requirement, not new to this plan (see Decisions Made).

## Next Phase Readiness
- `invitation` and `workspaceJoinRequest` tables are live in the local dev DB and ready for 07-02 (invitations.ts, invitations route) and 07-03 (join-requests.ts, join-requests routes) to build against.
- `src/lib/invitation-token.ts` is ready to be consumed by `src/lib/invitations.ts`'s `acceptInvitation()` in 07-02 — the pure helper contract (secret passed as an argument) means 07-02's route/lib code is the only place that will read `process.env.AUTH_SECRET`.
- No blockers identified.

---
*Phase: 07-workspace-collaboration-join-invite*
*Completed: 2026-08-09*

## Self-Check: PASSED

All created files verified to exist on disk; all 4 task commits (`2323471`, `4695204`, `e524a88`, `d9e4ca5`) verified present in git log.
