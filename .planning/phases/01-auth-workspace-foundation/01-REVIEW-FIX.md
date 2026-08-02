---
phase: 01-auth-workspace-foundation
fixed_at: 2026-08-02T01:49:52Z
review_path: .planning/phases/01-auth-workspace-foundation/01-REVIEW.md
iteration: 1
findings_in_scope: 11
fixed: 9
skipped: 2
status: partial
---

# Phase 1: Code Review Fix Report

**Fixed at:** 2026-08-02T01:49:52Z
**Source review:** .planning/phases/01-auth-workspace-foundation/01-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope (critical_warning): 11
- Fixed: 9
- Skipped: 2

**Verification environment:** all fixes were made, linted, typechecked, tested, and built inside an isolated git worktree (`/tmp/sv-01-reviewfix-*`, branch `gsd-reviewfix/01-*`), fast-forwarded onto `gsd/phase-01-auth-workspace-foundation` on cleanup. `node_modules` and `.env.local` were symlinked into the worktree from the main checkout (both are gitignored) so `pnpm vitest run`, `pnpm exec tsc --noEmit`, `pnpm exec eslint`, and `pnpm build` could run against the real dev toolchain and the live Postgres test DB at `localhost:5433`. These numbers are reproducible by re-running the same commands against `gsd/phase-01-auth-workspace-foundation` in the main checkout after this commit lands there.

Note: the repo's `lint-verify.sh` PostToolUse hook reported a false-positive "File ignored because outside of base path" warning on every edit in this session — it invokes `pnpm exec eslint` from the main repo's cwd against the worktree's absolute `/tmp/...` path, which ESLint's flat-config base-path resolution then excludes. Each fix below was independently verified by running `pnpm exec eslint <file> --max-warnings 0` **from within the worktree**, which reported zero problems for every modified file.

## Fixed Issues

### CR-01: Rate limiter is keyed on a client-spoofable header, trivially bypassed

**Files modified:** `src/auth.ts`
**Commit:** `74b0d19`
**Applied fix:** Dropped the `x-forwarded-for`-derived `ip` component (and the now-unused `request` param) from the login rate-limit key entirely — this app has no trusted reverse proxy in front of it, so the header was attacker-controlled. The limiter now keys purely on `email`, matching the reviewer's stated preference given "don't hand-roll a new dependency."

### CR-02: Login timing side-channel discloses account existence

**Files modified:** `src/auth.ts`
**Commit:** `822d9b5`
**Applied fix:** Added a fixed `DUMMY_HASH` bcrypt constant and always call `verifyPassword(password, found?.passwordHash ?? DUMMY_HASH)` regardless of whether the user was found, collapsing the two previously-separate failure branches into one. A nonexistent email and a wrong password now cost the same bcrypt compare and return through the identical `null` path.

### WR-01: `requireRole` fails open on an unrecognized role value

**Files modified:** `src/lib/rbac.ts`
**Commit:** `a5f4e75`
**Applied fix:** Introduced `const rank = member ? (ROLE_RANK[member.role as Role] ?? -1) : -1;` so an off-enum role value now ranks below every `minRole` instead of failing the `<` comparison silently — fail-closed instead of fail-open.

### WR-04: `POST /api/workspaces` doesn't guard against malformed JSON

**Files modified:** `src/app/api/workspaces/route.ts`
**Commit:** `9d89e03`
**Applied fix:** Wrapped `await req.json()` in try/catch, returning `{ error: "잘못된 요청입니다." }` with a 400 on parse failure — mirrors the existing pattern already used in `signup/route.ts`.

### WR-05: `DELETE /api/workspaces/:id` doesn't validate `id` before it hits the DB

**Files modified:** `src/app/api/workspaces/[id]/route.ts`
**Commit:** `86190e5`
**Applied fix:** Added `if (!z.uuid().safeParse(id).success) return Response.json({ error: "잘못된 요청입니다." }, { status: 400 })` before `requireRole` is called, so a non-UUID path segment returns a controlled 400 instead of an unhandled Postgres "invalid input syntax" 500. Verified `z.uuid()` behaves as expected in the installed zod 4.4.3 (`node -e` smoke test) before applying; the existing "nonexistent workspace" test (a well-formed but non-existent UUID) still exercises the 403 path unchanged.

### WR-06: Login rate limiter has a TOCTOU window under concurrent requests

**Files modified:** `src/auth.ts`, `src/lib/rate-limit.ts`
**Commit:** `14074ff`
**Applied fix:** Added `undoLoginFailure(key)` to `rate-limit.ts` (decrements a previously-recorded failure, floor 0). `authorize()` now calls `recordLoginFailure(rateLimitKey)` immediately after the rate-limit check — before the bcrypt gap — and calls `undoLoginFailure(rateLimitKey)` only on a successful login, closing the window where concurrent requests could all observe "still under threshold" during the same bcrypt compare. Kept the existing exported `checkLoginRateLimit`/`recordLoginFailure` signatures unchanged so `tests/auth/rate-limit.test.ts` (which exercises those two functions directly) required no changes and still passes.

### WR-07: Signup/login accept email as case- and whitespace-sensitive

**Files modified:** `src/lib/validation.ts`, `src/auth.ts`
**Commit:** `f9ccf2e`
**Applied fix:** Added a shared `normalizeEmail(email) = email.trim().toLowerCase()` helper in `validation.ts`. `signupSchema.email` now pipes `z.string().trim().toLowerCase()` into `z.email(...)` — trim/lowercase run *before* the email-format check because that check operates on the raw string and would otherwise reject a value with leading/trailing whitespace (verified with a `node -e` smoke test against the installed zod 4.4.3 before applying: chaining `.trim()` *after* `z.email()` fails on whitespace, piping *before* it succeeds). `auth.ts`'s `authorize()` now normalizes the raw credential the same way before both the rate-limit key and the DB lookup, so login matches signup regardless of case/whitespace. Existing un-normalized dev rows are unaffected (acceptable per the fix guidance — dev data only).

### WR-08: No password max-length guard before bcrypt

**Files modified:** `src/lib/validation.ts`
**Commit:** `82e8b12`
**Applied fix:** Added `.max(72, "비밀번호는 72자를 넘을 수 없습니다.")` to `signupSchema.password`, preventing silent bcrypt truncation past its documented 72-byte limit.

### WR-09: Dashboard redirects unauthenticated visitors to `/signup` instead of `/login`

**Files modified:** `src/app/(main)/dashboard/page.tsx`
**Commit:** `7329f8a`
**Applied fix:** Changed `redirect("/signup")` to `redirect("/login")`. Verified `src/app/(auth)/login` exists in the tree before applying.

## Skipped Issues

### WR-02: "Exactly one default workspace" is a race condition, not a real invariant

**File:** `src/db/seed.ts:8-16`, `src/db/schema.ts:12-18`
**Reason:** requires TRD §3 amendment (schema-single-source invariant) — deferred to orchestrator/planning. Per CLAUDE.md's schema invariant ("스키마 변경은 TRD §3 갱신 후 마이그레이션"), adding the `workspace_single_default` partial unique index is a schema/migration change that must go through a TRD §3 amendment first, not an inline code fix. Explicitly excluded from this run's scope per orchestrator instruction.
**Original issue:** `seedDefaultWorkspace` is a check-then-insert with no transaction and no DB-level guard; two concurrent invocations could both pass the `SELECT` before either `INSERT` commits, producing two `is_default = true` rows.

### WR-03: No partial index on `workspace.is_deleted` despite the invariant requiring one

**File:** `src/db/schema.ts:12-18`, `drizzle/0001_sudden_tarot.sql`
**Reason:** requires TRD §3 amendment (schema-single-source invariant) — deferred to orchestrator/planning. Same schema-change constraint as WR-02: adding `workspace_active_idx` is a migration, not a code fix, and must go through TRD §3 first. Explicitly excluded from this run's scope per orchestrator instruction.
**Original issue:** CLAUDE.md's invariant requires active-workspace queries to hit an `is_deleted = false` partial index, but neither migration nor `schema.ts` currently defines one.

---

_Fixed: 2026-08-02T01:49:52Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
