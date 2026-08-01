# Walking Skeleton — markdown-kms

**Phase:** 1
**Generated:** 2026-08-01

## Capability Proven End-to-End

A new visitor signs up with email + password + name, is immediately logged in (no email verification), and lands on a card dashboard showing the system-seeded "기본 워크스페이스" they were auto-joined to as EDITOR — served by the deployed Next.js app reading its own PostgreSQL rows.

This single path exercises every architectural layer the whole project inherits: scaffold → Drizzle/Postgres → Auth.js Credentials/JWT session → atomic signup transaction → RBAC-shaped membership → server-rendered screen.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 15.5.x App Router + TypeScript (`src/` dir, `@/*` alias) | TRD §1 locked; one repo/one deploy for front + API. Pin 15.5.x — registry `latest` has moved to Next 16 (`middleware.ts` renamed `proxy.ts` there); do NOT let the scaffold pull 16.x. |
| Data layer | PostgreSQL 16 + Drizzle ORM 0.45.2 + postgres.js 3.4.9 driver | TRD §1/§3 locked. `src/db/schema.ts` is the 1:1 TS expression of TRD §3 DDL; migrations via `drizzle-kit generate` → `migrate` (NOT `push` — CLAUDE.md invariant). |
| Auth | Auth.js v5 (`next-auth@5.0.0-beta.32`) Credentials provider, JWT session strategy, bcrypt 6.0.0 hashing | TRD §1 (D-04/D-07). Credentials providers are JWT-only by design; no `@auth/drizzle-adapter` needed (Auth.js never touches the DB this phase). bcrypt is a native module → every route calling it sets `export const runtime = "nodejs"` (cannot run in Edge middleware). |
| Session policy | `maxAge` 24h, `updateAge` 1h sliding, always-persist (no remember-me) | D-05/D-06/D-07. `updateAge` set explicitly below `maxAge` so rolling renewal actually extends on activity (Auth.js default `updateAge` is tuned for 30d and would collide with a 24h `maxAge`). |
| Default workspace | Single system-seeded shared row (`is_default=true`, name "기본 워크스페이스"), every signup auto-joins as EDITOR | D-08/D-09/D-10. NOT a per-user personal workspace. Seed is idempotent (check-then-insert on `is_default=true`). Costly to reverse post-production (data migration). |
| Landing screen | Card dashboard (no persistent sidebar) — RSC server-fetches memberships | D-11/D-12. The persistent folder sidebar is Phase 4's 3-pane screen; a missing sidebar is NOT a Phase-1 failure. |
| Active workspace | URL param `/w/[wsId]` | D-14, TRD §11. |
| RBAC | `lib/rbac.ts requireRole(workspaceId, minRole)` server gate on every mutating route → 403 on violation | NFR-3.2 + CLAUDE.md invariant: UI button-hiding is never a security boundary. Role rank VIEWER<EDITOR<ADMIN<OWNER; DB CHECK constraint is defense-in-depth. |
| Styling | CSS Modules porting `docs/ui-kit.html` tokens (IBM Plex Sans/Mono, accent `#2563eb`, lucide-react icons) | TRD §1 + UI-SPEC. No Tailwind, no shadcn — scaffold with `--no-tailwind`. |
| Input validation | zod 4.4.3 schemas in `lib/validation.ts`, imported by BOTH client forms and Route Handlers | TRD architecture diagram mandates zod at the Route Handler boundary; single source of truth for "password ≥ 8" and "workspace name ≤ 100". |
| Test runner | Vitest 4.1.10 (unit/integration) + Playwright 1.62.1 (E2E) | TRD §1/§10. RBAC matrix test + signup test are committed BEFORE their implementation (TDD mandate). |
| Directory layout | `src/app/(auth)`, `src/app/(main)`, `src/app/api`, `src/auth.ts`, `src/db/`, `src/lib/`, `src/components/` | TRD §11 + RESEARCH recommended structure. |

## Stack Touched in Phase 1

- [x] Project scaffold (Next.js 15, TypeScript, ESLint, Vitest, Playwright, Drizzle) — Plan 01
- [x] Routing — `/signup`, `/login`, `/dashboard`, `/w/[wsId]`, `/api/auth/*`, `/api/workspaces*` — Plans 02-05
- [x] Database — real read (dashboard membership join) AND real write (signup transaction, seed, workspace create/delete) — Plans 01-05
- [x] UI — interactive signup form wired to `POST /api/auth/signup` + Auth.js `signIn` — Plans 02-03
- [x] Deployment — documented local full-stack run: `pnpm drizzle-kit migrate && pnpm tsx src/db/seed.ts && pnpm dev` against a local (`brew install postgresql@16`) or hosted Postgres 16 pointed to by `DATABASE_URL`

## Out of Scope (Deferred to Later Slices)

Explicit so future phases do not re-litigate Phase 1's minimalism:

- Editor, markdown pipeline, sanitize schema — Phase 2
- Folder tree / Closure Table — Phase 3
- Documents, autosave seq-guard, soft-delete/trash, 3-pane screen, persistent sidebar — Phase 4
- Tags, search (pg_trgm), export — Phase 6
- Join requests, invitation emails (nodemailer) — Phase 7
- Google OAuth (`AUTH-04`), presentation mode — Phase 8
- Logout / password-reset UX — no requirement ID yet; Auth.js `signOut()` is available for free but not a Phase-1 deliverable
- Distributed rate-limit store (Redis/Upstash) — Phase 1 uses an in-memory single-instance counter; upgrade when multi-instance

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- Phase 2: markdown rendering + editor formatting plugins (60ms live preview)
- Phase 3: folder tree backed by Closure Table
- Phase 4: documents + autosave + 3-pane workspace (first end-to-end authoring)
- Phase 5: editor enhancements + personalization
- Phase 6: tags, search, export
- Phase 7: workspace collaboration (join/invite)
- Phase 8: presentation mode + Google sign-in (proves the Auth.js structure extends by adding a provider only)
