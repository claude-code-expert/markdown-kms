---
phase: 01-auth-workspace-foundation
plan: 02
subsystem: auth
tags: [nextjs, auth.js, next-auth, jwt, bcrypt, zod, drizzle, postgres, vitest, playwright]

requires:
  - phase: 01-auth-workspace-foundation (plan 01)
    provides: "Drizzle schema (user/workspace/workspace_member), db client, idempotent default-workspace seed, Vitest globalSetup targeting DATABASE_URL_TEST"
provides:
  - "Auth.js v5 Credentials + JWT session config (src/auth.ts), handlers mounted at /api/auth/[...nextauth]"
  - "POST /api/auth/signup — zod-validated, bcrypt-hashed, atomic user + EDITOR-membership transaction"
  - "listMembershipsForUser(userId) join helper for any screen that needs a caller's workspace list"
  - "Minimal signup form and dashboard RSC proving the full AUTH-01/02/03 vertical end-to-end"
affects: [01-03, 01-04, 01-05]

actuals:
  tokens: 5710
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Route handlers under test are called directly (POST(new Request(...))) rather than through an HTTP server — vitest.config.ts sets test.env.DATABASE_URL = DATABASE_URL_TEST so the route's own @/db singleton resolves to the test DB during the test run"
    - "fileParallelism:false in vitest.config.ts — an atomicity test that temporarily flips a shared seeded row's flag needs the whole suite to run sequentially, not per-file isolation"
    - "Postgres unique-violation detection unwraps DrizzleQueryError.cause to read the underlying postgres.js PostgresError.code (23505), since Drizzle wraps the driver error rather than re-exposing .code directly"
    - "JWT.id is read with a `typeof token.id === \"string\"` guard rather than a module augmentation on @auth/core/jwt (that package isn't hoisted to root node_modules under pnpm, so the augmentation can't resolve/merge)"

key-files:
  created:
    - src/auth.ts
    - src/app/api/auth/[...nextauth]/route.ts
    - src/app/api/auth/signup/route.ts
    - src/lib/password.ts
    - src/lib/validation.ts
    - src/lib/db-membership.ts
    - src/app/(auth)/signup/page.tsx
    - src/app/(auth)/signup/page.module.css
    - src/app/(main)/dashboard/page.tsx
    - src/app/(main)/dashboard/page.module.css
    - src/types/next-auth.d.ts
    - tests/auth/signup.test.ts
    - tests/auth/signup-atomicity.test.ts
    - e2e/signup.spec.ts
    - e2e/session-persistence.spec.ts
  modified:
    - vitest.config.ts
    - playwright.config.ts

key-decisions:
  - "Dashboard redirects unauthenticated visits to /signup, not /login — the plan explicitly allowed either target ('/login (or /signup)'), and /login isn't built until Plan 03"
  - "Signup atomicity test forces the failure by flipping the seeded workspace's is_default flag off/on around the call, per the plan's own suggested technique ('point at a nonexistent default workspace') rather than mocking db.transaction internals"

patterns-established:
  - "Integration tests call Next.js Route Handlers directly as plain async functions (POST(req)) instead of spinning up a server — works because the handlers only touch Request/Response and @/db, no next/headers or next/cookies"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03]

coverage:
  - id: D1
    description: "Signing up with email + password + name creates the user (bcrypt-hashed password) and atomically joins the default workspace as EDITOR in one transaction"
    requirement: AUTH-01
    verification:
      - kind: integration
        ref: "tests/auth/signup.test.ts#creates a user with a bcrypt-hashed password and an EDITOR membership in the default workspace"
        status: pass
      - kind: e2e
        ref: "e2e/signup.spec.ts#signing up logs the user in and lands on the dashboard showing the default workspace"
        status: pass
    human_judgment: false
  - id: D2
    description: "Signup transaction is atomic — a mid-transaction failure (no default workspace found) leaves no orphaned user row"
    requirement: AUTH-03
    verification:
      - kind: integration
        ref: "tests/auth/signup-atomicity.test.ts#rolls back and leaves no orphaned user when the default-workspace membership insert cannot complete"
        status: pass
    human_judgment: false
  - id: D3
    description: "Signup rejects passwords shorter than 8 characters (400) and duplicate emails (409, not 500)"
    requirement: AUTH-01
    verification:
      - kind: integration
        ref: "tests/auth/signup.test.ts#rejects a password shorter than 8 characters with a 400"
        status: pass
      - kind: integration
        ref: "tests/auth/signup.test.ts#rejects a duplicate email with a handled 409, not a 500"
        status: pass
    human_judgment: false
  - id: D4
    description: "authorize() returns null identically for a nonexistent email and a wrong password — no information-disclosing throw"
    verification:
      - kind: other
        ref: "src/auth.ts authorize(): both `!found?.passwordHash` and `!valid` return null via the same code path (code read, no test-runnable network call — Credentials provider authorize() isn't independently unit-testable without a running Auth.js request cycle)"
        status: pass
    human_judgment: true
    rationale: "The two failure branches were verified by code inspection (identical `return null`, no distinguishing throw) rather than a dedicated unit test, since authorize() only runs inside Auth.js's own request-handling pipeline; a human should confirm the reasoning holds."
  - id: D5
    description: "The session survives a browser reload after signup (AUTH-02) — JWT maxAge 24h with an explicit updateAge 1h below it"
    requirement: AUTH-02
    verification:
      - kind: e2e
        ref: "e2e/session-persistence.spec.ts#the session survives a browser reload after signup (AUTH-02)"
        status: pass
    human_judgment: false

duration: ~55min
completed: 2026-08-02
status: complete
---

# Phase 01 Plan 02: End-to-End Signup → Session → Dashboard Tracer Summary

**Auth.js v5 Credentials + JWT session wired to an atomic signup transaction — a new user's password is bcrypt-hashed, the user row and their EDITOR membership in the single seeded default workspace are inserted in one `db.transaction`, and the resulting session lands them on a dashboard RSC that reads the membership back — proven green by two integration tests and two Playwright E2E specs.**

## Performance

- **Duration:** ~55 min active execution
- **Tasks:** 2/2 (1 TDD-red test commit, 1 tracer implementation commit)
- **Files modified:** 17 (2 in Task 1, 15 in Task 2)

## Accomplishments
- Built the full AUTH-01/AUTH-02/AUTH-03 vertical slice in one pass: signup form → `POST /api/auth/signup` (zod validate, bcrypt hash, atomic user+membership transaction) → `signIn("credentials")` → JWT session → dashboard RSC reading `listMembershipsForUser`
- `authorize()` returns `null` through one indistinguishable path for both "no such user" and "wrong password" (T-02-01 information-disclosure mitigation)
- Signup atomicity proven by forcing the default-workspace lookup to fail mid-transaction (flipping `is_default` off/on around the call) and asserting the user count is unchanged and no orphan row exists
- Duplicate-email signup mapped to a handled 409 (not a 500) by unwrapping `DrizzleQueryError.cause` to read the underlying postgres.js `23505` unique-violation code
- Two Playwright specs drive the real browser flow: signup lands on `/dashboard` showing "기본 워크스페이스", and a reload after signup keeps the session (AUTH-02)

## Task Commits

Each task was committed atomically:

1. **Task 1: Write failing signup tests before the route (TDD, TRD §10)** - `6d0ec4e` (test)
2. **Task 2: End-to-end signup → session → dashboard (tracer)** - `9f8d787` (feat)

**Plan metadata:** committed separately as part of this SUMMARY.

_TDD gate sequence confirmed in git log: `test(01-02)` (`6d0ec4e`, RED — verified failing via `pnpm vitest run` before any implementation existed) then `feat(01-02)` (`9f8d787`, GREEN — same two test files pass). No REFACTOR commit was needed._

## Files Created/Modified
- `src/lib/password.ts` — `hashPassword`/`verifyPassword`, bcrypt cost 10 (D-04)
- `src/lib/validation.ts` — `signupSchema` (zod `z.email()`, password min 8 with D-01's exact copy, name required), shared client+server
- `src/lib/db-membership.ts` — `listMembershipsForUser(userId)`, `workspace_member ⋈ workspace` join
- `src/auth.ts` — Auth.js v5 `NextAuth({...})`: Credentials `authorize()`, JWT session (`maxAge` 24h / `updateAge` 1h, D-05/06/07), `jwt`/`session` callbacks carrying `user.id`
- `src/app/api/auth/[...nextauth]/route.ts` — `export const { GET, POST } = handlers`
- `src/app/api/auth/signup/route.ts` — `runtime = "nodejs"`, zod validate, bcrypt hash, one `db.transaction` (select default workspace → insert user → insert EDITOR membership), 409 on duplicate email, 400 on validation failure
- `src/app/(auth)/signup/page.tsx` + `page.module.css` — minimal client signup form (name/email/password) → POST signup → `signIn("credentials")` → redirect `/dashboard`
- `src/app/(main)/dashboard/page.tsx` + `page.module.css` — RSC: `auth()` → redirect `/signup` if unauthenticated, else render each `listMembershipsForUser` row
- `src/types/next-auth.d.ts` — `session.user.id: string` module augmentation
- `tests/auth/signup.test.ts` — AUTH-01/AUTH-03 integration test (hash, EDITOR membership, min-8 rejection, duplicate-email 409)
- `tests/auth/signup-atomicity.test.ts` — Pitfall 3 rollback/no-orphan test
- `e2e/signup.spec.ts` — signup → `/dashboard` showing "기본 워크스페이스"
- `e2e/session-persistence.spec.ts` — reload after signup keeps the session
- `vitest.config.ts` — `test.env.DATABASE_URL = DATABASE_URL_TEST`, `fileParallelism: false`
- `playwright.config.ts` — `webServer` (`pnpm dev`), `workers: 1`, `expect.timeout: 15_000`

## Decisions Made
- **Dashboard redirects to `/signup`, not `/login`:** the plan explicitly permitted either target ("/login (or /signup)"); `/login` isn't built until Plan 03, so `/signup` is the only real destination that exists this plan.
- **Atomicity test technique:** implemented via temporarily flipping the seeded workspace's `is_default` flag off (and restoring it in a `finally`), matching the plan's own suggested approach ("point at a nonexistent default workspace") rather than mocking `db.transaction` internals — a genuine black-box integration test, no mocking of the code under test.
- **Route handlers tested by direct invocation:** `POST(new Request(...))` calls the exported handler function directly rather than going through an HTTP server, since the handler only touches the Web `Request`/`Response` API and `@/db` — no `next/headers`/`next/cookies` dependency to fake.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Integration tests couldn't reach the test database through the route's own `@/db` import**
- **Found during:** Task 2 (making `tests/auth/signup.test.ts` green)
- **Issue:** The signup route imports `db` from `@/db`, whose module-level client is built from `process.env.DATABASE_URL` (the dev DB) — not `DATABASE_URL_TEST`. Calling `POST()` directly in a test would write to the dev database instead of the seeded, disposable test DB.
- **Fix:** Added `test.env.DATABASE_URL = process.env.DATABASE_URL_TEST` to `vitest.config.ts` — Vitest's official per-test-run env injection, applied before any test file (and therefore `@/db`) is imported.
- **Files modified:** `vitest.config.ts`
- **Verification:** `pnpm vitest run tests/auth/signup.test.ts tests/auth/signup-atomicity.test.ts` — both files pass, writes land in `markdown_kms_test`.
- **Committed in:** `9f8d787`

**2. [Rule 1 - Bug] Duplicate-email signup returned 500 instead of 409**
- **Found during:** Task 2, first `pnpm vitest run` of `signup.test.ts`
- **Issue:** `isUniqueViolation()` checked `err.code`, but Drizzle wraps the driver's `PostgresError` (which carries `.code === "23505"`) inside a `DrizzleQueryError`, exposing it only on `.cause`.
- **Fix:** `isUniqueViolation()` now recurses through `.cause` to find the Postgres error code.
- **Files modified:** `src/app/api/auth/signup/route.ts`
- **Verification:** `tests/auth/signup.test.ts#rejects a duplicate email with a handled 409, not a 500` passes.
- **Committed in:** `9f8d787`

**3. [Rule 3 - Blocking] `pnpm build` failed typechecking `src/auth.ts`'s session callback**
- **Found during:** Task 2, first `pnpm build`
- **Issue:** `if (token.id) session.user.id = token.id` failed to typecheck ("Type '{}' is not assignable to type 'string'") — TypeScript narrows a truthiness-checked `unknown` (which is what `token.id` resolves to, since `JWT extends Record<string, unknown>`) to `{}`, not a usable type. The natural fix — augmenting `JWT.id` via `declare module "next-auth/jwt"` / `"@auth/core/jwt"` — doesn't merge under this project's pnpm layout: `@auth/core` is only nested inside `next-auth`'s own `node_modules`, not hoisted to the project root, so the ambient module can't resolve to the same module Auth.js's own callback types reference.
- **Fix:** Switched to `typeof token.id === "string"`, which narrows `unknown` correctly without needing the augmentation.
- **Files modified:** `src/auth.ts`, `src/types/next-auth.d.ts` (removed the non-functional JWT augmentation, left an explanatory comment)
- **Verification:** `pnpm build` compiles and typechecks clean.
- **Committed in:** `9f8d787`

**4. [Rule 3 - Blocking] Playwright had no server to test against, and no browser binary installed**
- **Found during:** Task 2, first `pnpm exec playwright test`
- **Issue:** `playwright.config.ts` from Plan 01 had no `webServer` entry, so E2E specs had nothing running at `http://localhost:3000`; separately, the pinned Chromium build (v1234) wasn't yet downloaded in this environment.
- **Fix:** Added a `webServer: { command: "pnpm dev", url: ..., reuseExistingServer: !CI }` block; ran `pnpm exec playwright install chromium` once.
- **Files modified:** `playwright.config.ts`
- **Verification:** `pnpm exec playwright test e2e/signup.spec.ts` passes.
- **Committed in:** `9f8d787`

**5. [Rule 1 - Bug] E2E specs flaked when run together under Playwright's default parallelism**
- **Found during:** Task 2, running both E2E specs together for the first time
- **Issue:** With `workers: 2` (Playwright's default given `fullyParallel: true`), two specs hit the shared `next dev` server concurrently; Next's on-demand route compilation for first-time hits on two different specs at once pushed both signups past the default 5s assertion timeout, and both specs failed on `toHaveURL(/\/dashboard$/)`.
- **Fix:** Set `workers: 1` (this plan has only 2 spec files — sequential execution is cheap and removes the dev-server compile contention) and raised `expect.timeout` to 15s as defense-in-depth.
- **Files modified:** `playwright.config.ts`
- **Verification:** `pnpm exec playwright test e2e/signup.spec.ts e2e/session-persistence.spec.ts` — both pass together.
- **Committed in:** `9f8d787`

---

**Total deviations:** 5 auto-fixed (2 blocking test/E2E-infra gaps, 1 blocking typecheck workaround, 1 bug in the duplicate-email error path, 1 bug in E2E parallelism causing flakes)
**Impact on plan:** All five were necessary for the plan's own stated acceptance criteria (green signup tests, green E2E, `pnpm build` clean) to hold. No scope creep — no files or behavior beyond what Task 2's action list already specified.

## Issues Encountered
None beyond the deviations above — no unresolved problems.

## User Setup Required
None — `.env.local` already had `DATABASE_URL`, `DATABASE_URL_TEST`, and `AUTH_SECRET` from Plan 01; both databases were already migrated and seeded.

## Next Phase Readiness
- Plan 03 (polished auth UI) can build the real `/login` page, ui-kit token portage, and copy polish on top of the working `signIn("credentials")` call and `signupSchema` already established here — the signup form built in this plan is explicitly a placeholder per the plan's own scope note.
- Plan 04 (RBAC + workspace CRUD) can rely on `session.user.id` being typed and populated, and on `workspace_member` rows existing with real `EDITOR` roles to build `requireRole` against.
- `listMembershipsForUser` is ready to be reused by any future screen (workspace switcher, member list) that needs a caller's workspace roles.
- No blockers. E2E specs write real rows into the dev database (`markdown_kms`) on every run — acceptable for local iteration, but worth noting if the phase later adds a dedicated E2E-only database or cleanup step.

---
*Phase: 01-auth-workspace-foundation*
*Completed: 2026-08-02*

## Self-Check: PASSED

All 17 claimed files (auth config, signup route, lib helpers, signup/dashboard pages + CSS Modules, next-auth types, both integration test files, both E2E specs, vitest/playwright config, this SUMMARY) and both commit hashes (`6d0ec4e`, `9f8d787`) verified present on disk / in `git log`.
