---
phase: 04-documents-autosave-3-pane-workspace
plan: 01
subsystem: database
tags: [drizzle, postgres, zod, tdd, autosave]

# Dependency graph
requires:
  - phase: 03-folder-tree-closure-table
    provides: folder table + closure table + DbClient injection pattern (src/lib/closure.ts) this plan mirrors
provides:
  - document table (TRD §3 DDL) migrated to PG16 (5433)
  - src/lib/documents.ts service (6 functions: getWorkspaceDocuments/getDocument/resolveWorkspaceIdForDocument/createDocument/softDeleteDocument/autosaveDocument)
  - documentSchema/autosaveBodySchema in src/lib/validation.ts
  - server-side autosave seq guard, proven by integration test
affects: [04-02, 04-03, 04-04, 04-05]

# Actuals (#2632)
actuals:
  tokens: 8200
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "lib/documents.ts mirrors closure.ts's DbClient injection pattern exactly (type DbClient = typeof db | tx-callback-param union)"
    - "autosaveDocument affected-rows judgment via .returning().length — WHERE clause is the concurrency judge, not application code"

key-files:
  created:
    - src/lib/documents.ts
    - tests/documents/helpers.ts
    - tests/documents/autosave-seq-guard.test.ts
    - drizzle/0003_petite_susan_delgado.sql
  modified:
    - src/db/schema.ts
    - src/lib/validation.ts

key-decisions:
  - "Task 1 checkpoint:decision (one-way document migration) pre-approved by user via orchestrator (2026-08-08) — recorded apply-now without re-prompting, same as Phase 3's folder migration gate"
  - "document.folder_id has no ON DELETE CASCADE (NO ACTION) per TRD §3 literal DDL — permanent-delete ordering (document before folder) deferred to 04-04"
  - "document_tag/document_draft/trigram(gin) indexes deliberately omitted — Phase 6/5 scope"
  - "tests/documents/autosave-seq-guard.test.ts mocks @/auth (vi.mock) because tests/rbac/helpers.ts pulls in next-auth transitively — same precedent as tests/folder/query-count.test.ts"

patterns-established:
  - "Service functions accept an optional DbClient param (default db) for test injection and future transaction composition, matching closure.ts"

requirements-completed: []  # DOC-01/EDIT-07 are schema+service substrate only here — functional completion spans 04-02/04-03/04-04 (API routes, client autosave hook, UI), matching the 01-01 AUTH-03/WS-01 precedent

coverage:
  - id: D1
    description: "document table migrated to PG16 (5433) with document_active_idx partial index, matching TRD §3 DDL exactly"
    requirement: "DOC-01"
    verification:
      - kind: other
        ref: "pnpm drizzle-kit generate && pnpm drizzle-kit migrate (applied to local dev DB); drizzle/0003_petite_susan_delgado.sql inspected for CREATE TABLE document + document_active_idx, no CASCADE on folder_id FK"
        status: pass
    human_judgment: false
  - id: D2
    description: "autosaveDocument enforces the server seq guard — stale/tied seq is ignored (0 rows affected), newer seq is applied"
    requirement: "EDIT-07"
    verification:
      - kind: integration
        ref: "tests/documents/autosave-seq-guard.test.ts#documents.autosaveDocument — server seq guard (stale/tie/newer seq cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "getDocument scopes lookups by workspaceId in addition to documentId, blocking cross-workspace IDOR"
    requirement: "DOC-01"
    verification:
      - kind: integration
        ref: "tests/documents/autosave-seq-guard.test.ts#documents.getDocument — workspace-scoped IDOR guard"
        status: pass
    human_judgment: false
  - id: D4
    description: "softDeleteDocument is idempotent and resolveWorkspaceIdForDocument/getWorkspaceDocuments/createDocument round-trip correctly"
    verification:
      - kind: integration
        ref: "tests/documents/autosave-seq-guard.test.ts#documents.softDeleteDocument / resolveWorkspaceIdForDocument / getWorkspaceDocuments"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-08
status: complete
---

# Phase 4 Plan 1: Document Schema, Migration & Autosave Seq Guard Summary

**`document` table migrated to PG16 per TRD §3 DDL, plus a 6-function `lib/documents.ts` service whose `autosaveDocument` proves the server-side seq guard (`WHERE saved_seq < seq`) discards stale writes without ever erroring.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-08T12:08:00+09:00 (context load)
- **Completed:** 2026-08-08T14:16:00+09:00
- **Tasks:** 3 (1 checkpoint:decision + 2 auto, one TDD)
- **Files modified:** 8

## Accomplishments
- `document` table added to `src/db/schema.ts` and migrated to local PG16 (5433) — exact TRD §3 columns/defaults/partial index, `folder_id` FK correctly has no `ON DELETE CASCADE`
- `documentSchema`/`autosaveBodySchema` added to `src/lib/validation.ts` (title trimmed+capped 255 with `.catch("")`, content untouched for markdown fidelity)
- `src/lib/documents.ts` service (6 functions) mirroring `closure.ts`'s `DbClient` injection pattern
- Server-side autosave seq guard (TRD §7 / EDIT-07) proven with a stale/tie/newer integration test — stale writes affect 0 rows and never clobber newer content
- `getDocument` IDOR-guarded by `workspace_id` scope (RESEARCH Pitfall 6)

## Task Commits

Each task was committed atomically:

1. **Task 1: document 마이그레이션 one-way 게이트** — pre-approved decision, no separate commit (folded into Task 2's commit as the recorded rationale)
2. **Task 2: document 테이블 스키마 + 마이그레이션 + zod 스키마** — `6db7b1a` (feat)
3. **Task 3: lib/documents.ts 서비스 + 서버 seq-가드 통합 테스트 (TDD)**
   - RED: `5340f7d` (test)
   - GREEN: `8b43a5c` (feat)

_Note: TDD task has two commits (test → feat); no refactor commit needed._

## Files Created/Modified
- `src/db/schema.ts` - added `document` pgTable (TRD §3 DDL) + `document_active_idx` partial index; added `bigint` import
- `src/lib/validation.ts` - added `documentSchema`/`autosaveBodySchema`
- `drizzle/0003_petite_susan_delgado.sql` - generated migration, applied to local PG16 (5433)
- `drizzle/meta/0003_snapshot.json`, `drizzle/meta/_journal.json` - drizzle-kit migration metadata
- `src/lib/documents.ts` - new service: getWorkspaceDocuments/getDocument/resolveWorkspaceIdForDocument/createDocument/softDeleteDocument/autosaveDocument
- `tests/documents/helpers.ts` - `createTestDocument` factory
- `tests/documents/autosave-seq-guard.test.ts` - 11 tests covering seq guard, IDOR, idempotency, active-only scope, CRUD round-trip

## Decisions Made
- Task 1's `checkpoint:decision` (one-way document migration) was pre-approved by the user via the orchestrator (2026-08-08), matching Phase 3's folder migration precedent — recorded `apply-now` and proceeded without re-prompting.
- `restoreDocument`/`permanentlyDeleteDocument` intentionally not built in this plan — out of scope, deferred to 04-04 per the plan's explicit exclusion.
- Test file required `vi.mock("@/auth")` even though it never calls `mockSessionFor` — `tests/rbac/helpers.ts`'s `createTestWorkspace` pulls in `next-auth` transitively, which fails to resolve `next/server` outside a Next.js runtime. Followed the existing `tests/folder/query-count.test.ts` precedent for this exact issue.

## Deviations from Plan

None — plan executed exactly as written. The `vi.mock("@/auth")` addition to the test file is not a deviation; it follows an established codebase precedent (Rule 3, blocking issue) rather than introducing new scope.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. Migration applied directly to the local dev DB per the pre-approved checkpoint decision.

## Next Phase Readiness
- `document` table and `lib/documents.ts` service are ready for 04-02 (tracer: 3-pane workspace route + document open/create/autosave wiring) to import directly.
- Seq guard is proven at the service layer — 04-02's `PUT /api/documents/[id]` route can call `autosaveDocument` directly per RESEARCH Pattern 2 without re-deriving the WHERE clause logic.
- No blockers.

---
*Phase: 04-documents-autosave-3-pane-workspace*
*Completed: 2026-08-08*

## Self-Check: PASSED

All created files found on disk (`src/lib/documents.ts`, `tests/documents/helpers.ts`, `tests/documents/autosave-seq-guard.test.ts`, `drizzle/0003_petite_susan_delgado.sql`, plus modified `src/db/schema.ts`/`src/lib/validation.ts`). All 3 task commits (`6db7b1a`, `5340f7d`, `8b43a5c`) confirmed present in git log.
