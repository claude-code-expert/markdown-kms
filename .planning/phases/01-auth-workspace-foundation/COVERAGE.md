# Phase 1 — API Coverage Declaration

**Generated:** 2026-08-01 (gsd-planner)

## Declaration

**No external API integration:** Phase 1 uses local libraries (Auth.js Credentials, Drizzle, bcrypt, zod) only; third-party OAuth (Google, `AUTH-04`) is explicitly deferred to Phase 8.

## Reasoning

- **Auth.js v5 (`next-auth`)** — a library configured in-process (`src/auth.ts`). The Credentials provider verifies passwords against the app's own `user` table via bcrypt; it makes no outbound calls to any auth-as-a-service. No adapter (`@auth/drizzle-adapter`) is installed — Auth.js never touches the database this phase (Credentials + JWT sessions).
- **Drizzle ORM + postgres.js** — a local database driver talking to a developer-provisioned PostgreSQL 16 instance (local Homebrew or a hosted dev DB via `DATABASE_URL`). The database is infrastructure the developer runs, not a third-party product API with an SDK contract to cover.
- **bcrypt / zod** — pure local computation (native hashing module; schema validation). No network surface.
- **Google OAuth (`AUTH-04`, P2)** — the only genuine third-party integration in the whole product, and it is scoped to Phase 8. Phase 1's acceptance bar for it is structural only ("the Credentials structure must extend by adding a provider"), which requires no API work now.

## Consequence

The api-coverage seal-time gate should pass on this declaration: there is no external API/SDK/service whose request/response contract, error taxonomy, auth flow, or rate limits need documenting for Phase 1.
