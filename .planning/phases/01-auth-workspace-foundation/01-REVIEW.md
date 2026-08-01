---
phase: 01-auth-workspace-foundation
reviewed: 2026-08-01T18:05:37Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - src/lib/rbac.ts
  - src/lib/rate-limit.ts
  - src/lib/password.ts
  - src/lib/validation.ts
  - src/lib/db-membership.ts
  - src/auth.ts
  - src/app/api/auth/signup/route.ts
  - src/app/api/auth/[...nextauth]/route.ts
  - src/app/api/workspaces/route.ts
  - src/app/api/workspaces/[id]/route.ts
  - src/db/schema.ts
  - src/db/seed.ts
  - src/app/(main)/dashboard/page.tsx
findings:
  critical: 2
  warning: 9
  info: 0
  total: 11
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-08-01T18:05:37Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

The core RBAC gate (`requireRole`), the signup transaction, and the workspace create/soft-delete flow are structurally sound: `requireRole` always re-reads the DB (never trusts a client-supplied role), signup and workspace creation are correctly wrapped in `db.transaction`, and soft-delete correctly blocks the default workspace. However, two findings undermine the brute-force protection this phase explicitly set out to build (O1): the rate-limit key trusts a client-controlled header, and the "indistinguishable failure path" the code's own comment promises (T-02-01) is not actually timing-indistinguishable. Both are classified Critical because they defeat a named security control, not just degrade one. A further set of warnings covers a fail-open edge case in the role comparison, a TOCTOU gap in "exactly one default workspace," a missing partial index the project's own invariants require, inconsistent error handling between the two workspace routes, and an email-normalization gap.

## Critical Issues

### CR-01: Rate limiter is keyed on a client-spoofable header, trivially bypassed

**File:** `src/auth.ts:25-27`
**Issue:** The brute-force limiter's key is `${email}:${ip}` where `ip` comes straight from the request's `x-forwarded-for` header:
```ts
const ip = request.headers.get("x-forwarded-for") ?? "unknown";
const rateLimitKey = `${email}:${ip}`;
```
`x-forwarded-for` is an ordinary HTTP header the client sends directly — there is no reverse proxy or `middleware.ts` in this repo that normalizes or overwrites it before it reaches `authorize()`. An attacker brute-forcing a single victim's password can send a different (even random) `X-Forwarded-For` value on every request, generating a fresh rate-limit key each time and never accumulating the 5-attempt threshold on any one key. This makes the "5 failed attempts / 10 minutes" control (O1, called out explicitly in this phase's plan) a no-op against any attacker who sets one header.
**Fix:** Do not derive the rate-limit key from a client-suppliable header without a trusted proxy in front of the app. Simplest fix that preserves the "don't hand-roll a new dependency" intent: key by email only (still bounds damage per-account; a global secondary limiter can be added later if needed), or, if IP is truly required, obtain it from a platform-provided trusted source (e.g. Vercel's `request.ip`, or a `middleware.ts` that overwrites `x-forwarded-for` with the socket-level peer address before it reaches route handlers) rather than reading the header as-is:
```ts
// ponytail: key by email only — x-forwarded-for is client-controlled here and there's
// no reverse proxy in this repo that overwrites it, so IP is not a trustworthy input.
const rateLimitKey = email;
```

### CR-02: Login timing side-channel discloses account existence (violates the code's own T-02-01 comment)

**File:** `src/auth.ts:29-40`
**Issue:** The comment above this block explicitly claims "One indistinguishable failure path for both 'no such user' and 'wrong password' (T-02-01)". The implementation does not deliver that:
```ts
const [found] = await db.select().from(user).where(eq(user.email, email));
if (!found?.passwordHash) {
  recordLoginFailure(rateLimitKey);
  return null;                      // fast path — no bcrypt call
}
const valid = await verifyPassword(password, found.passwordHash); // ~50-100ms bcrypt
```
When the email doesn't exist (or has no password hash), the function returns immediately after a cheap indexed lookup. When the email does exist, it additionally runs `bcrypt.compare`, which costs tens of milliseconds by design. This is the textbook timing side-channel used for user enumeration: an attacker can measure response latency to determine which emails are registered, independent of the generic error message both paths return.
**Fix:** Always pay the bcrypt cost, even for a non-existent user, by comparing against a fixed dummy hash:
```ts
// ponytail: fixed dummy hash so both branches pay the same bcrypt cost — the DB lookup
// hitting 0 vs 1 rows must not be observable via response timing (T-02-01).
const DUMMY_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8G7VpTNK6H7oXBCa/6dKQvV5cD5cGO";

const [found] = await db.select().from(user).where(eq(user.email, email));
const valid = await verifyPassword(password, found?.passwordHash ?? DUMMY_HASH);
if (!found?.passwordHash || !valid) {
  recordLoginFailure(rateLimitKey);
  return null;
}
```

## Warnings

### WR-01: `requireRole` fails open instead of fail-closed on an unrecognized role value

**File:** `src/lib/rbac.ts:40`
**Issue:**
```ts
if (!member || ROLE_RANK[member.role as Role] < ROLE_RANK[minRole]) {
  throw new ForbiddenError();
}
```
If `member.role` is ever a string outside `ROLE_RANK`'s keys, `ROLE_RANK[member.role as Role]` is `undefined`, and `undefined < ROLE_RANK[minRole]` evaluates to `false` (not `true`) — so the function does **not** throw, and the caller is treated as authorized. This is currently masked by the `workspace_member_role_check` CHECK constraint in `schema.ts`, but the comparison itself fails open rather than fail-closed, which is the wrong default for a server-side authorization gate — any future migration, seed script, or manual data fix that produces an off-enum role value silently grants access instead of denying it.
**Fix:**
```ts
const rank = ROLE_RANK[member.role as Role] ?? -1;
if (!member || rank < ROLE_RANK[minRole]) throw new ForbiddenError();
```

### WR-02: "Exactly one default workspace" is a race condition, not a real invariant

**File:** `src/db/seed.ts:8-16`, `src/db/schema.ts:12-18`
**Issue:** `seedDefaultWorkspace` is a check-then-insert with no transaction and no DB-level guard:
```ts
const [existing] = await db.select().from(workspace).where(eq(workspace.isDefault, true));
if (existing) return existing;
const [created] = await db.insert(workspace).values({ name: "기본 워크스페이스", isDefault: true }).returning();
```
`workspace.isDefault` has no unique index (confirmed absent from both migrations). Two concurrent invocations (e.g. two deploy replicas running seed on startup, or a re-run during CI) can both pass the `SELECT` before either `INSERT` commits, producing two rows with `is_default = true`. Nothing downstream defends against this: `signup/route.ts:44-47` selects `where(eq(workspace.isDefault, true))` with no `ORDER BY`/`LIMIT 1` and destructures the first row arbitrarily, so which "default" workspace new users join becomes non-deterministic. This directly contradicts the stated invariant "seed is idempotent (exactly one is_default workspace)" — the current implementation is idempotent only under non-concurrent execution.
**Fix:** Enforce the invariant at the DB layer with a partial unique index, and let the seed rely on `ON CONFLICT DO NOTHING` instead of check-then-insert:
```sql
CREATE UNIQUE INDEX workspace_single_default ON workspace (is_default) WHERE is_default = true;
```

### WR-03: No partial index on `workspace.is_deleted` despite the invariant requiring one

**File:** `src/db/schema.ts:12-18`, `drizzle/0001_sudden_tarot.sql`
**Issue:** CLAUDE.md's invariant states active-workspace queries "must hit an `is_deleted = false` partial index." `listMembershipsForUser` (`db-membership.ts:19`) filters on `workspace.isDeleted, false`, but neither migration (`0000_nosy_kree.sql`, `0001_sudden_tarot.sql`) nor `schema.ts` defines any index — partial or otherwise — on `is_deleted`. This isn't a speculative performance concern to defer; it's a stated schema-level requirement for this phase that is currently unmet.
**Fix:** Add a partial index in the schema and generate the corresponding migration:
```ts
import { index } from "drizzle-orm/pg-core";
// ...
(table) => [
  index("workspace_active_idx").on(table.id).where(sql`${table.isDeleted} = false`),
]
```

### WR-04: `POST /api/workspaces` doesn't guard against malformed JSON

**File:** `src/app/api/workspaces/route.ts:17`
**Issue:**
```ts
const parsed = workspaceSchema.safeParse(await req.json());
```
Unlike `signup/route.ts:26-30`, which wraps `req.json()` in try/catch and returns a clean 400 on parse failure, this route lets a malformed body throw uncaught. The exception propagates out of the handler as an unhandled rejection, producing a generic framework 500 instead of the same graceful `{ error: ... }` JSON response the rest of the API uses.
**Fix:**
```ts
let body: unknown;
try {
  body = await req.json();
} catch {
  return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
}
const parsed = workspaceSchema.safeParse(body);
```

### WR-05: `DELETE /api/workspaces/:id` doesn't validate `id` before it hits the DB

**File:** `src/app/api/workspaces/[id]/route.ts:12-16`, `src/lib/rbac.ts:35-38`
**Issue:** `id` is taken straight from the route param and passed to `requireRole(id, "OWNER")`, which runs `eq(workspaceMember.workspaceId, workspaceId)` against a `uuid` column. A non-UUID `id` (e.g. `/api/workspaces/not-a-uuid`) causes Postgres to throw an "invalid input syntax for type uuid" error. That error is not `ForbiddenError`, so the handler's catch block re-throws it (`throw err;`), producing an unhandled 500 instead of a controlled 400/404.
**Fix:** Validate the param shape before querying:
```ts
if (!z.uuid().safeParse(id).success) {
  return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
}
```

### WR-06: Login rate limiter has a TOCTOU window under concurrent requests

**File:** `src/lib/rate-limit.ts:25-42`, `src/auth.ts:27-39`
**Issue:** `checkLoginRateLimit` (read) and `recordLoginFailure` (write) are separate calls straddling an `await bcrypt.compare(...)` that costs tens of milliseconds. If an attacker fires many concurrent login requests for the same key within that window, all of them pass `checkLoginRateLimit` before any of the earlier ones has called `recordLoginFailure` — the 5-attempt cap only limits sequential attempts, not concurrent bursts. Combined with CR-01 this is lower-impact (CR-01 alone already defeats the limiter), but it's a real gap in the limiter's own logic independent of the header issue.
**Fix:** Increment the counter optimistically before the expensive check, and roll it back (or simply accept the slightly-stricter effective limit) on success — e.g. call `recordLoginFailure`-style bookkeeping synchronously before `verifyPassword`, or track "in-flight" attempts separately from "failed" attempts.

### WR-07: Signup/login accept email as case- and whitespace-sensitive, enabling duplicate accounts

**File:** `src/lib/validation.ts:5-9`, `src/auth.ts:19`, `src/app/api/auth/signup/route.ts:38`
**Issue:** `signupSchema.email` has no `.toLowerCase()`/`.trim()` transform, and `user.email` has a plain (case-sensitive) unique constraint. `User@Example.com` and `user@example.com` register as two distinct accounts, and a user who signs up with mixed case will get "invalid credentials" if they later type their email in a different case at login (`auth.ts:29` does an exact `eq(user.email, email)` match). This is both a UX bug and a data-integrity gap in the uniqueness guarantee the unique constraint is meant to provide.
**Fix:** Normalize once, in the shared schema, so signup and login both benefit:
```ts
email: z.email("올바른 이메일 형식이 아닙니다.").trim().toLowerCase(),
```

### WR-08: No password max-length guard before bcrypt — silent truncation at 72 bytes

**File:** `src/lib/validation.ts:7`, `src/lib/password.ts:6-8`
**Issue:** `signupSchema.password` enforces `min(8)` only. bcrypt silently truncates any input beyond 72 bytes — this is a well-documented bcrypt property, not a validation error, so two different passwords sharing the same first-72-byte prefix will hash identically and both work as credentials. There's no upper bound in the schema to prevent users from unknowingly relying on characters past byte 72 for their password's strength.
**Fix:**
```ts
password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다.").max(72, "비밀번호는 72자를 넘을 수 없습니다."),
```

### WR-09: Dashboard redirects unauthenticated visitors to `/signup` instead of `/login`

**File:** `src/app/(main)/dashboard/page.tsx:13-15`
**Issue:**
```ts
if (!session?.user?.id) {
  redirect("/signup");
}
```
The repo has a dedicated `src/app/(auth)/login` route. A user whose session has simply expired (the common case for a protected-page redirect) is sent to the signup form instead of the login form — confusing at best, and functionally wrong for anyone who already has an account.
**Fix:**
```ts
if (!session?.user?.id) {
  redirect("/login");
}
```

---

_Reviewed: 2026-08-01T18:05:37Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
