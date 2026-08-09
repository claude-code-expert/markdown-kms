---
phase: 07-workspace-collaboration-join-invite
plan: 02
subsystem: api
tags: [hmac, invitations, drizzle, transaction, rbac, nextjs-rsc]

# Dependency graph
requires:
  - phase: 07-workspace-collaboration-join-invite
    provides: "07-01: invitation pgTable + src/lib/invitation-token.ts (encode/parse/verifyMac HMAC-SHA256 helper)"
provides:
  - "src/lib/mailer.ts — sendInvitationEmail, single console-log export, storage.ts-style isolation, no new dep"
  - "src/lib/invitations.ts — createInvitation + acceptInvitation (5-state result, single-transaction EDITOR admission)"
  - "POST /api/workspaces/[id]/invitations — ADMIN-gated invite issuance"
  - "src/app/(auth)/invitations/accept/page.tsx — RSC 5-state result page, no GET API route file"
affects: [07-03-join-requests-flow, 07-04-members-page, 07-05-invite-search-ui]

# Actuals (#2632)
actuals:
  tokens: 6392
  tasks: 3
  commits: 6

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Guard-update inside db.transaction as the TOCTOU defense (WHERE used_at IS NULL re-checked at UPDATE time, not from a pre-transaction read) — documents.ts autosaveDocument/replaceTags precedent applied to one-time token admission"
    - "onConflictDoNothing membership insert paired with a guard-update in the same transaction — idempotent admission even if the invitee is already a member"
    - "not-found folded into the same rejection state as signature-mismatch (invalid-signature) to avoid an existence-enumeration oracle"

key-files:
  created:
    - src/lib/mailer.ts
    - src/lib/invitations.ts
    - src/app/api/workspaces/[id]/invitations/route.ts
    - src/app/(auth)/invitations/accept/page.tsx
    - src/app/(auth)/invitations/accept/page.module.css
    - tests/invitations/helpers.ts
    - tests/invitations/accept.test.ts
    - tests/invitations/create.test.ts
  modified: []

key-decisions:
  - "tests/invitations/accept.test.ts and create.test.ts both need `vi.mock(\"@/auth\", () => ({ auth: vi.fn() }))` even though accept.test.ts never calls auth() itself — tests/rbac/helpers.ts imports @/auth transitively, and next-auth fails to resolve next/server under Vitest's non-Next runtime without the mock (tests/folder/query-count.test.ts precedent, applied here for the first time in tests/invitations/)"

patterns-established:
  - "acceptInvitation's execution order (parse -> row lookup -> HMAC recompute -> expired -> used -> wrong-user) is fixed by data dependency (signature recompute needs the DB's expires_at), while the *observable* rejection-priority order still matches CONTEXT.md's conceptual sequencing — RESEARCH Pitfall 1's resolution, now proven in code"

requirements-completed: [WS-05]

coverage:
  - id: D1
    description: "ADMIN issues an invitation via POST /api/workspaces/:id/invitations; invitation row is created and the accept link is handed to mailer; non-ADMIN gets 403"
    requirement: "WS-05"
    verification:
      - kind: integration
        ref: "tests/invitations/create.test.ts#POST /api/workspaces/:id/invitations (9 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Inviting an existing workspace member is rejected with 400 (no row/mail created)"
    requirement: "WS-05"
    verification:
      - kind: integration
        ref: "tests/invitations/create.test.ts#rejects inviting an existing member (400, no row/mail)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A valid accept-link token admits the invited user as EDITOR and marks used_at, making the token single-use"
    requirement: "WS-05"
    verification:
      - kind: integration
        ref: "tests/invitations/accept.test.ts#success + atomicity/idempotency (2 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "acceptInvitation correctly discriminates all 5 states (success/expired/already-used/invalid-signature/wrong-user), with wrong-user blocking third-party IDOR and the used_at guard-update atomic inside a single transaction"
    requirement: "WS-05"
    verification:
      - kind: integration
        ref: "tests/invitations/accept.test.ts (7 tests total covering all 5 states + tamper + not-found)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The raw token appears only in the mailer-emitted link, never persisted to the DB (invitation table has no token/mac column)"
    requirement: "WS-05"
    verification:
      - kind: integration
        ref: "tests/invitations/create.test.ts#ADMIN success (asserts sendInvitationEmail link contains the token, parseInvitationToken round-trips to invitation.id)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The full console-link -> browser click -> EDITOR admission round trip works in a real running app (manual, deferred to phase-end per 07-VALIDATION Manual-Only)"
    verification: []
    human_judgment: true
    rationale: "Requires pnpm dev + a real browser session to copy the [mailer] console link and click through as a second logged-in user — batched with the rest of Phase 7's manual verification per the project's deferred-verification convention (STATE.md)."

duration: 7min
completed: 2026-08-09
status: complete
---

# Phase 7 Plan 2: Invitation Security Spine (mailer + invitations.ts + POST route + accept RSC) Summary

**HMAC-verified, one-time, IDOR-defended invitation accept flow — createInvitation/acceptInvitation with a 5-state discriminated result, admission gated by a single `db.transaction` guard-update, threaded end-to-end from an ADMIN-only POST route through an isolated `mailer.ts` console-log module to a 5-branch RSC result page.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-08-09T12:39:10+09:00 (first RED commit)
- **Completed:** 2026-08-09T12:42:01+09:00
- **Tasks:** 3
- **Files modified:** 8 (all newly created — no existing files touched)

## Accomplishments
- `src/lib/mailer.ts` — `sendInvitationEmail` is the sole export, console-logs the accept link. The only place the raw invitation token appears (NFR-3.3); a future SMTP swap is a rewrite of this one file, matching `storage.ts`'s isolation precedent.
- `src/lib/invitations.ts` — `createInvitation` (ADMIN-issued row insert) and `acceptInvitation` (parse -> row lookup -> HMAC verify -> expired -> used -> wrong-user -> single-transaction EDITOR admission + `used_at` guard-update). Proven by 7 real-DB integration tests covering all 5 result states, a tampered-mac case, a not-found-folds-into-invalid-signature case, and an atomicity/idempotency double-accept case.
- `POST /api/workspaces/[id]/invitations` — `requireRole(wsId, "ADMIN")` gate, zod `{ inviteeId }` body (no `role` field — membership role is server-hardcoded, never client-suppliable), invitee-exists and already-member guards, then `createInvitation` -> `encodeInvitationToken` -> `sendInvitationEmail` -> 201. Proven by 9 integration tests (ADMIN success, VIEWER/EDITOR/non-member/unauthenticated all 403, already-member 400, nonexistent invitee 400, non-uuid wsId 400, malformed body/JSON 400).
- `src/app/(auth)/invitations/accept/page.tsx` — async RSC that calls `acceptInvitation()` directly (no `src/app/api/invitations/accept/route.ts` file exists — confirmed absent). Unauthenticated visitors redirect to `/login?callbackUrl=`. Renders all 5 UI-SPEC result branches inside the login page's centered `Card` shell; success offers a click-through to the workspace (no auto-redirect).

## Task Commits

Each task was committed atomically (TDD RED->GREEN pairs):

1. **Task 1 RED: failing acceptInvitation tests** - `4969ddc` (test)
2. **Task 1 GREEN: mailer.ts + invitations.ts** - `6305714` (feat)
3. **Task 2 RED: failing invitations route tests** - `a896407` (test)
4. **Task 2 GREEN: POST /api/workspaces/:id/invitations route** - `adb2aa4` (feat)
5. **Task 3: /invitations/accept RSC page (no tdd gate — pure rendering)** - `b69bdc2` (feat)

**Plan metadata:** committed separately after this summary (docs: complete plan)

## Files Created/Modified
- `src/lib/mailer.ts` - `sendInvitationEmail(to, acceptLink)`, dev console log
- `src/lib/invitations.ts` - `createInvitation`, `acceptInvitation`, `AcceptResult` union, `DbClient` injection type (copied from documents.ts)
- `tests/invitations/helpers.ts` - `createTestInvitation()` seeding factory (fresh/expired/already-used states)
- `tests/invitations/accept.test.ts` - 7 integration tests for `acceptInvitation`
- `src/app/api/workspaces/[id]/invitations/route.ts` - `POST` handler
- `tests/invitations/create.test.ts` - 9 integration tests for the POST route
- `src/app/(auth)/invitations/accept/page.tsx` - RSC 5-state result page
- `src/app/(auth)/invitations/accept/page.module.css` - shell + icon/title/body rhythm, all `var(--token)`, no new hex values

## Decisions Made
- Both new test files require `vi.mock("@/auth", () => ({ auth: vi.fn() }))` at the top even in `accept.test.ts`, which never calls `auth()` directly — importing `tests/rbac/helpers.ts` pulls in `@/auth` transitively, and `next-auth` fails to resolve `next/server` under Vitest's non-Next runtime without the mock. This is the `tests/folder/query-count.test.ts` precedent (documented in STATE.md), now applied for the first time under `tests/invitations/`.
- No new architectural decisions — this plan is a direct, literal implementation of RESEARCH's pre-verified code (mailer.ts, acceptInvitation, the POST route) and UI-SPEC's Invitation-Accept Result Contract, with zero deviation from either.

## Deviations from Plan

None - plan executed exactly as written. Both `tdd="true"` tasks followed the RED (confirmed failing by temporarily moving the not-yet-written implementation file aside and re-running the test) -> GREEN (restored, re-ran, confirmed passing) -> commit sequence exactly as specified.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required. `AUTH_SECRET` (the HMAC signing secret) is the existing Auth.js requirement carried over from 07-01/Phase 1 — confirmed live in this session because `tests/invitations/accept.test.ts`'s `beforeEach` throws if it's unset, and all 7 tests passed.

## Next Phase Readiness
- `src/lib/invitations.ts` (`createInvitation`, `acceptInvitation`, `AcceptResult`) is ready for 07-03 (join-requests, which mirrors the same guard-update + transaction pattern for its own APPROVED/REJECTED decision) and 07-04/07-05 (members page, invite-search UI) to build against.
- `src/lib/mailer.ts` is stable — no further changes expected from remaining Phase 7 plans.
- The manual browser round-trip (console link click -> EDITOR admission, D6 above) is deferred to phase-end batched verification per the project's established convention (STATE.md Deferred Verification section already tracks Phases 3-6 the same way).
- No blockers identified. Full regression suite (`pnpm vitest run`) is 1009/1009 green; `pnpm exec tsc --noEmit` is clean.

---
*Phase: 07-workspace-collaboration-join-invite*
*Completed: 2026-08-09*

## Self-Check: PASSED

All 8 created files verified to exist on disk; all 5 task commits (`4969ddc`, `6305714`, `a896407`, `adb2aa4`, `b69bdc2`) verified present in git log.
