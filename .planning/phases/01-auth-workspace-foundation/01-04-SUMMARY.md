---
phase: 01-auth-workspace-foundation
plan: 04
subsystem: auth
tags: [rbac, drizzle, nextauth, zod, rate-limit, soft-delete]

requires:
  - phase: 01-auth-workspace-foundation (01-01, 01-02)
    provides: "workspace/workspaceMember schema, db client, auth() session, workspace seed"
provides:
  - "src/lib/rbac.ts — requireRole(workspaceId, minRole) server-only authorization gate, ForbiddenError, ROLE_RANK"
  - "POST /api/workspaces — any logged-in member creates a workspace and becomes its OWNER"
  - "DELETE /api/workspaces/:id — OWNER-only SOFT delete (workspace.is_deleted=true), default workspace non-deletable"
  - "src/lib/rate-limit.ts — in-memory 5-attempts/10-min login limiter keyed by email+IP (O1)"
  - "workspaceSchema (name ≤100 chars, O2) in src/lib/validation.ts"
  - "listMembershipsForUser filters is_deleted=false so soft-deleted workspaces vanish from active views"
affects: [phase-04-documents-trash, phase-05-workspace-ui, phase-07-invites]

actuals:
  tokens: 7043
  tasks: 4
  commits: 4

tech-stack:
  added: []
  patterns:
    - "requireRole(workspaceId, minRole) is the single server-side authorization gate — every future mutating route calls it before doing any work, never trusts a client-supplied role"
    - "Soft-delete via boolean is_deleted flag + query-time filter, not a physical DELETE — pattern to be reused by folder/document trash in Phase 4"

key-files:
  created:
    - src/lib/rbac.ts
    - src/lib/rate-limit.ts
    - src/app/api/workspaces/route.ts
    - src/app/api/workspaces/[id]/route.ts
    - drizzle/0001_sudden_tarot.sql
    - tests/rbac/helpers.ts
    - tests/rbac/matrix.test.ts
    - tests/workspace/create.test.ts
    - tests/workspace/delete.test.ts
    - tests/auth/rate-limit.test.ts
  modified:
    - src/lib/validation.ts
    - src/auth.ts
    - src/db/schema.ts
    - src/lib/db-membership.ts

key-decisions:
  - "D-15 override (product owner, 2026-08-02): workspace delete changed from hard cascade to SOFT delete mid-plan, after Task 3's checkpoint. Orchestrator amended TRD §3/PRD §3/CONTEXT.md/changelog before this task; this task implements the amended contract."
  - "workspace.is_deleted gets no partial index yet (TRD §3 note) — workspace cardinality is tiny; add WHERE is_deleted=false index if it grows."

patterns-established:
  - "Pattern: requireRole first, business logic second — every gated route handler's first executable statement is the requireRole/ForbiddenError try block (grep-verifiable)."
  - "Pattern: soft-delete = boolean flag + filtered active-listing query, row and dependent rows preserved for future restore UI."

requirements-completed: [WS-01, WS-02]

coverage:
  - id: D1
    description: "requireRole(workspaceId, minRole) throws ForbiddenError → 403 for no-session/non-member/under-rank callers"
    requirement: "WS-01"
    verification:
      - kind: unit
        ref: "tests/rbac/matrix.test.ts — RBAC matrix (create + delete describe blocks)"
        status: pass
    human_judgment: false
  - id: D2
    description: "POST /api/workspaces — any logged-in member creates a workspace and becomes its OWNER"
    requirement: "WS-02"
    verification:
      - kind: unit
        ref: "tests/workspace/create.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "DELETE /api/workspaces/:id — OWNER-only SOFT delete; row and workspace_member rows preserved; default workspace non-deletable; excluded from active listings"
    requirement: "WS-02"
    verification:
      - kind: unit
        ref: "tests/workspace/delete.test.ts"
        status: pass
      - kind: unit
        ref: "tests/rbac/matrix.test.ts — RBAC matrix (delete describe block)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Login brute-force limiter: 5 failed attempts/10min per email+IP rejected with the generic failure, no lockout disclosure (O1)"
    requirement: "AUTH-03"
    verification:
      - kind: unit
        ref: "tests/auth/rate-limit.test.ts"
        status: pass
    human_judgment: false

duration: 23min
completed: 2026-08-02
status: complete
---

# Phase 1 Plan 4: RBAC Gate + Workspace Create/Delete + Login Rate Limit Summary

**Server-only requireRole authorization gate; POST creates a workspace with creator as OWNER; DELETE soft-deletes (D-15 override mid-plan changed it from hard cascade), OWNER-only; 5-attempt/10-min login limiter with no lockout disclosure.**

## Performance

- **Duration:** 23 min (02:17–02:40 KST)
- **Started:** 2026-08-02T02:17:00+09:00
- **Completed:** 2026-08-02T02:39:55+09:00
- **Tasks:** 4
- **Files modified:** 13 (+ 1 generated migration)

## Accomplishments
- `src/lib/rbac.ts`: `requireRole(workspaceId, minRole)` — the single server-side authorization gate every future mutating route will reuse; `ForbiddenError` + `forbiddenResponse()` map to the reserved 403 copy.
- `POST /api/workspaces`: any logged-in member creates a workspace, transactionally becomes its OWNER (WS-02).
- `DELETE /api/workspaces/:id`: OWNER-only, requireRole-gated first, rejects the default workspace, **soft**-deletes via `workspace.is_deleted=true` (D-15 override) — row and `workspace_member` rows preserved for a future Phase-4 restore UI.
- `src/lib/db-membership.ts`: `listMembershipsForUser` now filters `is_deleted=false` so a soft-deleted workspace disappears from the dashboard without touching its rows.
- `src/lib/rate-limit.ts`: in-memory 5-attempts/10-min login limiter keyed by email+IP (O1), wired into `authorize()`.
- `workspaceSchema` in `src/lib/validation.ts`: name capped at 100 chars, client+server shared (O2).
- Full RBAC matrix (4 roles × create/delete) + workspace create/delete + rate-limit tests, committed RED before implementation (TRD §10 TDD), now green.

## Task Commits

Each task was committed atomically:

1. **Task 1: RBAC matrix + workspace + rate-limit tests (RED)** - `440a1b8` (test)
2. **Task 2: requireRole gate + workspace create route + login rate limiter (GREEN)** - `26aaab4` (feat)
3. **Task 3: D-15 checkpoint — hard cascade vs soft delete** - resolved by product owner override, spec amended by orchestrator - `2095135` (docs)
4. **Task 4: DELETE /api/workspaces/:id — OWNER-only SOFT delete (D-15 개정)** - `ce5ed3b` (feat)

**Plan metadata:** (this commit, below)

## Files Created/Modified
- `src/lib/rbac.ts` - `requireRole`, `ForbiddenError`, `ROLE_RANK`, `forbiddenResponse`
- `src/lib/rate-limit.ts` - in-memory login attempt counter (O1)
- `src/lib/validation.ts` - adds `workspaceSchema` (name ≤100, O2)
- `src/auth.ts` - rate-limit check at top of `authorize()`
- `src/app/api/workspaces/route.ts` - POST create (creator = OWNER)
- `src/app/api/workspaces/[id]/route.ts` - DELETE, OWNER-only, soft delete
- `src/db/schema.ts` - `workspace.is_deleted` boolean column (D-15 개정)
- `drizzle/0001_sudden_tarot.sql` - additive migration for `is_deleted`, applied to dev DB
- `src/lib/db-membership.ts` - `listMembershipsForUser` filters `is_deleted=false`
- `tests/rbac/helpers.ts`, `tests/rbac/matrix.test.ts` - factories + WS-01 matrix
- `tests/workspace/create.test.ts`, `tests/workspace/delete.test.ts` - WS-02 create/soft-delete
- `tests/auth/rate-limit.test.ts` - O1 verification

## Decisions Made
- **D-15 override (hard → soft delete):** After Task 3's checkpoint originally confirmed hard-cascade, the product owner overrode it mid-plan to soft delete. The orchestrator amended `docs/TRD.md` §3, `docs/PRD.md` §3, `01-CONTEXT.md`, and `changelog/changelog.md` at commit `2095135`, and rewrote this plan's Task 4 before this task executed it. This task implemented the amended (soft) contract only — no further spec edits were needed.
- `workspace.is_deleted` gets no partial index yet — workspace cardinality is tiny (per TRD §3 amendment note); revisit if scale changes.

## Deviations from Plan

None — Task 4 executed exactly as the amended 01-04-PLAN.md specifies. The D-15 hard→soft override itself was already resolved and recorded by the orchestrator before this task began (see Decisions Made above); this task is a faithful implementation of that resolution, not an unplanned deviation.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. The new migration (`drizzle/0001_sudden_tarot.sql`) was generated and applied to the dev DB (`markdown_kms` @ localhost:5433) as part of this task; the test DB picks it up automatically via `tests/global-setup.ts` on the next `pnpm vitest run`.

## Next Phase Readiness
- `requireRole` is now the established pattern every future mutating route (folders, documents, tags, invitations) will call first — Phase 4+ inherits this shape directly.
- The soft-delete pattern (`is_deleted` flag + filtered active query) established here for workspaces is the same shape Phase 4's folder/document trash will extend.
- Plan 01-05 (workspace UI: create/delete dialogs, re-type-name confirm) can now wire directly against these two routes.
- No blockers. `pnpm vitest run` (29/29 tests) and `pnpm build` both green.

---
*Phase: 01-auth-workspace-foundation*
*Completed: 2026-08-02*

## Self-Check: PASSED

All 15 created/modified files and all 4 commit hashes (440a1b8, 26aaab4, 2095135, ce5ed3b) verified present on disk / in git log.
