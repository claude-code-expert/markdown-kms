---
phase: 01-auth-workspace-foundation
verified: 2026-08-02T02:12:00Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 1: Auth & Workspace Foundation Verification Report

**Phase Goal:** Users can sign up, stay signed in, and land in a role-enforced default workspace
**Verified:** 2026-08-02T02:12:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can sign up with email+password and is immediately logged in | ✓ VERIFIED | `src/app/api/auth/signup/route.ts` (zod validate → bcrypt hash → one `db.transaction` inserting user + EDITOR membership) → `signIn("credentials")` in `src/app/(auth)/signup/signup-form.tsx`. Integration tests `tests/auth/signup.test.ts` (hash, EDITOR membership, min-8 rejection, duplicate-email 409) and E2E `e2e/signup.spec.ts` — both re-run independently during this verification: `pnpm vitest run` 29/29 pass, `pnpm exec playwright test` 7/7 pass. |
| 2 | Login session persists across a browser refresh | ✓ VERIFIED | `src/auth.ts` JWT strategy, `maxAge: 60*60*24`, `updateAge: 60*60`. `e2e/session-persistence.spec.ts` reloads `/dashboard` after signup and asserts still authenticated — independently re-run, passing. |
| 3 | New user is auto-joined to a default workspace as EDITOR and sees it in the sidebar | ✓ VERIFIED (with a documented scope note) | `src/app/api/auth/signup/route.ts` inserts `workspaceMember` with `role: "EDITOR"` into the seeded `is_default` workspace in the same transaction as the user insert (`tests/auth/signup.test.ts`, `tests/auth/signup-atomicity.test.ts`). "Sees it" is delivered via the E3 dashboard card grid (`src/app/(main)/dashboard/page.tsx` + `WorkspaceCard`), not a persistent sidebar — this is an explicit, documented interpretation call recorded in `01-03-PLAN.md` frontmatter (`assumptions`: "AUTH-03's acceptance phrase 사이드바에 표시된다 is satisfied in Phase 1 by the default workspace appearing on the card dashboard (D-12) — the persistent sidebar is Phase 4"), and it was walked and approved by the human at the 01-05 Task 3 checkpoint covering all 5 ROADMAP criteria. ROADMAP Phase 4 is titled "Documents, Autosave & 3-Pane Workspace" and is where the persistent folder sidebar is introduced — consistent with this being a legitimate phase-sequencing decision, not a silent gap. |
| 4 | Any member can create a workspace and becomes its OWNER; only the OWNER can delete it | ✓ VERIFIED | `POST /api/workspaces` (`src/app/api/workspaces/route.ts`) — any session inserts workspace + OWNER membership in one transaction. `DELETE /api/workspaces/[id]/route.ts` calls `requireRole(id, "OWNER")` first. `tests/workspace/create.test.ts`, `tests/workspace/delete.test.ts`, `tests/rbac/matrix.test.ts`, `e2e/workspace-create.spec.ts`, `e2e/workspace-delete.spec.ts` all independently re-run and green. |
| 5 | Server rejects an action outside the caller's role with 403, per the Owner/Admin/Editor/Viewer matrix | ✓ VERIFIED | `src/lib/rbac.ts` `requireRole(workspaceId, minRole)` — re-reads `workspace_member` from the DB every call (never trusts client input), throws `ForbiddenError` → 403 with the reserved copy "이 작업을 수행할 권한이 없습니다.". `tests/rbac/matrix.test.ts` enumerates OWNER/ADMIN/EDITOR/VIEWER/non-member/unauthenticated against both Phase-1-actionable routes — independently re-run and green. |

**Score:** 5/5 truths verified

### Plan-Level Must-Haves (all 5 plans)

All plan-frontmatter `must_haves.truths` across 01-01 through 01-05 were cross-checked directly against source, not SUMMARY claims:

| Must-have | Status | Evidence |
|---|---|---|
| Schema is 1:1 TRD §3 port (`user`, `workspace`, `workspace_member`) + role CHECK constraint | ✓ VERIFIED | `src/db/schema.ts` — 3 `pgTable` calls, `workspace_member_role_check` CHECK on `role IN ('OWNER','ADMIN','EDITOR','VIEWER')`, composite PK, ON DELETE CASCADE FKs |
| Idempotent default-workspace seed | ✓ VERIFIED | `src/db/seed.ts` `seedDefaultWorkspace` — check-then-insert on `isDefault=true`; `tests/db/seed.test.ts` passes |
| Test DB auto-migrated + seeded via Vitest globalSetup | ✓ VERIFIED | `tests/global-setup.ts`; confirmed by independently re-running `pnpm vitest run` (29/29 pass against `DATABASE_URL_TEST`) |
| Signup + EDITOR membership atomic (no orphan on failure) | ✓ VERIFIED | `tests/auth/signup-atomicity.test.ts` forces the default-workspace lookup to fail mid-transaction and asserts unchanged user count + no orphan row — genuine behavioral test, re-run and passing |
| `authorize()` indistinguishable for missing-user vs wrong-password (no differentiating throw) | ✓ VERIFIED (code path); see Known Findings below for a *timing*-side-channel caveat | `src/auth.ts` — both branches `return null` |
| Signup schema rejects password < 8 chars | ✓ VERIFIED | `src/lib/validation.ts` `signupSchema.password.min(8, ...)`; asserted in `tests/auth/signup.test.ts` |
| `requireRole` server gate, 403 on under-rank/no-session/non-member | ✓ VERIFIED | `src/lib/rbac.ts`; `tests/rbac/matrix.test.ts` |
| Workspace name capped at 100 chars, client+server via shared schema | ✓ VERIFIED | `src/lib/validation.ts` `workspaceSchema.name.max(100, ...)`; `CreateWorkspaceModal.tsx` imports the same schema (`maxLength={100}` + `workspaceSchema.safeParse`) |
| Login rate-limit: 5/10min, no lockout disclosure | ✓ VERIFIED (logic); see CR-01 below for a bypass caveat | `src/lib/rate-limit.ts`; `tests/auth/rate-limit.test.ts` covers threshold, window-expiry, and per-key isolation with fake timers — genuine state-transition test |
| DELETE soft-deletes (`is_deleted=true`), row+memberships preserved, excluded from active listings, default workspace non-deletable | ✓ VERIFIED against the AMENDED (soft) contract | `src/app/api/workspaces/[id]/route.ts`, `src/lib/db-membership.ts` (`eq(workspace.isDeleted, false)` filter), `tests/workspace/delete.test.ts` — asserts row persists with `isDeleted:true`, `workspace_member` rows persist, excluded from `listMembershipsForUser`, default-workspace delete rejected with 400. Matches `docs/TRD.md` §3's 2026-08-02 D-15 amendment note verbatim — code correctly implements the CURRENT (soft) spec, not the superseded hard-cascade text. |
| E4 create modal — single field, shared-schema validation, states, navigate to `/w/[newId]` | ✓ VERIFIED | `src/components/workspace/CreateWorkspaceModal.tsx` — imports `workspaceSchema`, "만들기"→"만드는 중…" disabled while pending, `router.push` on success; `e2e/workspace-create.spec.ts` passes |
| E5 delete dialog — re-type-exact-name gate, OWNER-only affordance, inline failure keeps dialog open | ✓ VERIFIED | `src/components/workspace/DeleteWorkspaceDialog.tsx` — `confirmDisabled={submitting \|\| typed !== workspaceName}`; `WorkspaceCard.tsx` renders the affordance only when `role === "OWNER"`; `e2e/workspace-delete.spec.ts` passes |
| `/w/[wsId]` placeholder, membership-gated, no sidebar | ✓ VERIFIED | `src/app/(main)/w/[wsId]/page.tsx` — `requireRole(wsId, "VIEWER")` → `notFound()` on `ForbiddenError` |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/schema.ts` | 3 tables, role CHECK, `is_deleted` (D-15) | ✓ VERIFIED | All columns/constraints present and correct |
| `src/db/seed.ts` | idempotent seed | ✓ VERIFIED | check-then-insert, exported `seedDefaultWorkspace(db)` |
| `src/auth.ts` | Credentials + JWT, rate-limit wired | ✓ VERIFIED | maxAge/updateAge, rate-limit check at top of `authorize()` |
| `src/app/api/auth/signup/route.ts` | atomic signup | ✓ VERIFIED | `runtime="nodejs"`, one `db.transaction`, 409/400/500 mapped |
| `src/lib/rbac.ts` | `requireRole`, `ForbiddenError`, `ROLE_RANK` | ✓ VERIFIED | exported, re-reads DB every call |
| `src/app/api/workspaces/route.ts` | POST create → OWNER | ✓ VERIFIED | transaction, 201 |
| `src/app/api/workspaces/[id]/route.ts` | DELETE OWNER-only soft delete | ✓ VERIFIED | `requireRole` first, `is_deleted=true`, default-workspace guard |
| `src/lib/rate-limit.ts` | in-memory 5/10min limiter | ✓ VERIFIED | pruning, threshold, exported functions |
| `src/lib/validation.ts` | `signupSchema`, `workspaceSchema` | ✓ VERIFIED | shared client+server, correct caps |
| `src/lib/db-membership.ts` | active-only membership listing | ✓ VERIFIED | filters `isDeleted=false` |
| `src/components/workspace/CreateWorkspaceModal.tsx`, `DeleteWorkspaceDialog.tsx` | E4/E5 UI | ✓ VERIFIED | wired to routes, shared schema, correct states |
| `src/app/(main)/w/[wsId]/page.tsx` | D-14 placeholder | ✓ VERIFIED | `requireRole(wsId,"VIEWER")` gated |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| `src/app/api/auth/signup/route.ts` | `src/db/schema.ts` | `db.transaction` user + EDITOR membership | ✓ WIRED |
| `src/auth.ts` | `src/lib/password.ts` | `verifyPassword` in `authorize()` | ✓ WIRED |
| `src/auth.ts` | `src/lib/rate-limit.ts` | `checkLoginRateLimit`/`recordLoginFailure` | ✓ WIRED |
| `src/app/(main)/dashboard/page.tsx` | `src/lib/db-membership.ts` | `listMembershipsForUser(session.user.id)` | ✓ WIRED |
| `src/app/api/workspaces/[id]/route.ts` | `src/lib/rbac.ts` | `requireRole(id, "OWNER")` before any work | ✓ WIRED |
| `src/components/workspace/CreateWorkspaceModal.tsx` | `src/app/api/workspaces/route.ts` | `fetch("/api/workspaces", {method:"POST"})` → `router.push` | ✓ WIRED |
| `src/components/workspace/DeleteWorkspaceDialog.tsx` | `src/app/api/workspaces/[id]/route.ts` | `fetch(...,{method:"DELETE"})` after name match | ✓ WIRED |
| `src/components/workspace/WorkspaceCard.tsx` | `src/components/workspace/DeleteWorkspaceDialog.tsx` | role==="OWNER" gated render | ✓ WIRED |

### Behavioral Spot-Checks (independently re-run, not taken from SUMMARY claims)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full unit/integration suite | `pnpm vitest run` | 7 files, 29 tests, all pass, 3.70s | ✓ PASS |
| Production build | `pnpm build` | Compiled successfully, all routes generated, 0 errors | ✓ PASS |
| Full E2E suite | `pnpm exec playwright test` | 7/7 passed (34.0s): dashboard, login (success+failure), session-persistence, signup, workspace-create, workspace-delete | ✓ PASS |

All three commands were executed fresh in this verification session against the live dev/test Postgres databases — these are not SUMMARY.md claims taken on faith.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| AUTH-01 | 01-02, 01-03 | Sign up with email+password, immediately logged in | ✓ SATISFIED | signup route + tests + E2E |
| AUTH-02 | 01-02, 01-03 | Session persists across refresh | ✓ SATISFIED | JWT config + session-persistence E2E |
| AUTH-03 | 01-01 (substrate), 01-02, 01-03 | Auto-join default workspace as EDITOR, visible | ✓ SATISFIED | atomic transaction + dashboard card (documented sidebar→card scope note, see Truth #3) |
| WS-01 | 01-01 (substrate), 01-04 | 403 per role matrix | ✓ SATISFIED | `requireRole` + matrix test |
| WS-02 | 01-04, 01-05 | Create → OWNER; delete → OWNER-only | ✓ SATISFIED | create/delete routes + UI + tests |

No orphaned requirements: REQUIREMENTS.md's Phase 1 row lists exactly these 5 IDs, and every plan's `requirements:` frontmatter field sums to the same set (01-01: `[AUTH-03, WS-01]` substrate; 01-02/01-03: `[AUTH-01, AUTH-02, AUTH-03]`; 01-04: `[WS-01, WS-02]`; 01-05: `[WS-02]`).

### Anti-Patterns Found

No `TBD`/`FIXME`/`XXX` debt markers, no `TODO`/`HACK`/`PLACEHOLDER` comments, no stub returns (`return null`/`{}`/`[]` used as a body), and no hardcoded-empty props found in any `src/` file modified by this phase (`grep -rniE` scan across `src/`).

### Known Findings — Tracked, Not Blocking (per explicit product-owner deferral)

A code review (`01-REVIEW.md`, 2026-08-01) found 2 Critical + 9 Warning findings, explicitly deferred to a follow-up `/gsd-code-review 01 --fix` per product-owner decision. These are code-quality/security-hardening gaps, not phase-goal failures — the mechanisms they weaken (rate-limit, timing-indistinguishability) are present and functionally exercised by passing tests; the findings describe how an adversary could defeat them, not that they're absent:

- **CR-01** (Critical): rate-limit key derived from client-spoofable `x-forwarded-for` header — bypassable without a reverse proxy.
- **CR-02** (Critical): `authorize()`'s "indistinguishable failure" is not timing-indistinguishable (bcrypt only runs on the found-user path) — a timing side-channel for user enumeration.
- **WR-01–WR-09**: fail-open role comparison on an off-enum value (currently masked by the DB CHECK constraint), a seed check-then-insert race (no unique index on `is_default`), malformed-JSON 500 on the workspace create route, no UUID-shape validation on the delete route, a rate-limiter TOCTOU window, case/whitespace-sensitive email (duplicate-account risk), no bcrypt 72-byte password cap, and dashboard redirecting to `/signup` instead of `/login`.

One review item is actually already resolved at the spec level: WR-03 ("no partial index on `workspace.is_deleted`") — `docs/TRD.md` §3's D-15 amendment note explicitly records this as a deliberate decision ("workspace는 카디널리티가 극소라 활성 조회 부분 인덱스는 두지 않는다") rather than an oversight; CLAUDE.md's general partial-index invariant is documented as intentionally not applied to the tiny-cardinality `workspace` table.

These items are noted here as tracked debt per the phase orchestrator's explicit instruction and do not affect the `passed` verdict.

### Human Verification Required

None. All ROADMAP success criteria and plan must-haves were either automatable (and independently re-verified in this session) or already walked and approved by a human at the in-execution checkpoints (01-03 Task 3: E1/E2/E3 visual+functional walkthrough; 01-05 Task 3: full Phase-1 flow against all 5 ROADMAP criteria, including the sidebar→card scope note and the 403 server-enforcement check via devtools).

### Gaps Summary

No gaps found. All 5 ROADMAP Phase-1 success criteria are demonstrable in the actual codebase (not just claimed in SUMMARY.md): signup/session/auto-join is one atomic, tested transaction; workspace create/delete is fully RBAC-gated and matches the current (amended, soft-delete) spec; the 403 matrix is enumerated and green. `pnpm build`, `pnpm vitest run` (29/29), and `pnpm exec playwright test` (7/7) were all independently re-executed during this verification, not taken from SUMMARY claims, and all passed.

The one interpretation call worth a human's continued awareness (not a gap): AUTH-03's "sees it in the sidebar" is satisfied by the Phase-1 dashboard card grid, with the actual persistent folder sidebar arriving in Phase 4 per the ROADMAP's own phase sequencing — this was an explicit, documented planning decision, not a silent scope reduction, and was human-approved at the Phase-1 completion checkpoint.

---

*Verified: 2026-08-02T02:12:00Z*
*Verifier: Claude (gsd-verifier)*
