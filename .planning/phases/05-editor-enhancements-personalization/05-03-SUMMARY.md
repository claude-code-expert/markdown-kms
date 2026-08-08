---
phase: 05-editor-enhancements-personalization
plan: 03
subsystem: database
tags: [drizzle, postgresql, zod, draft-recovery, tdd]

requires:
  - phase: 04-document-lifecycle
    provides: document table (id PK), DbClient injection pattern in src/lib/documents.ts
provides:
  - document_draft table (document_id PK, ON DELETE CASCADE from document)
  - upsertDraft/getDraft/deleteDraft services enforcing 1-row-per-document at the DB level
  - draftBodySchema (content-only, no seq)
affects: [05-04, 05-05]

actuals:
  tokens: 2218
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "document_id itself as PK (no surrogate id) for a 1-row-per-parent dependent entity"
    - "onConflictDoUpdate(target: <pk column>) as the DB-level enforcement of an upsert-only invariant"

key-files:
  created:
    - drizzle/0004_high_roulette.sql
    - tests/draft/services.test.ts
    - tests/draft/helpers.ts
  modified:
    - src/db/schema.ts
    - src/lib/validation.ts
    - src/lib/documents.ts

key-decisions:
  - "document_draft.document_id is the PK directly (no surrogate id) — matches TRD §3 and keeps the 1-row invariant enforceable by onConflictDoUpdate without an app-level uniqueness check"
  - "tests/draft/helpers.ts does its own db.insert(workspace)/db.insert(document) instead of reusing tests/rbac/helpers.ts's createTestWorkspace — that module transitively imports @/auth (next-auth), which requires every importing test file to vi.mock(\"@/auth\", ...); draft service tests touch no auth, so a local 2-line insert avoids an unrelated coupling"

patterns-established:
  - "PK-as-document_id + onConflictDoUpdate is the template for any future document-dependent 1-row table"

requirements-completed: [EDIT-11]

coverage:
  - id: D1
    description: "document_draft table exists in PG16 (5433), document_id is PK, ON DELETE CASCADE from document"
    requirement: EDIT-11
    verification:
      - kind: integration
        ref: "tests/draft/services.test.ts#deleting the document cascades to its draft row (TRD §3 ON DELETE CASCADE)"
        status: pass
    human_judgment: false
  - id: D2
    description: "upsertDraft maintains exactly 1 row per document (onConflictDoUpdate), content updates on re-upsert"
    requirement: EDIT-11
    verification:
      - kind: integration
        ref: "tests/draft/services.test.ts#re-upserting the same document keeps exactly 1 row and updates content (onConflictDoUpdate)"
        status: pass
    human_judgment: false
  - id: D3
    description: "getDraft returns the row when present, null when absent; deleteDraft removes the row"
    requirement: EDIT-11
    verification:
      - kind: integration
        ref: "tests/draft/services.test.ts#upsertDraft then getDraft returns the saved content"
        status: pass
      - kind: integration
        ref: "tests/draft/services.test.ts#deleteDraft removes the row; getDraft then returns null"
        status: pass
      - kind: integration
        ref: "tests/draft/services.test.ts#getDraft returns null for a document with no draft"
        status: pass
    human_judgment: false
  - id: D4
    description: "draftBodySchema validates { content: string } only, no seq field"
    requirement: EDIT-11
    verification:
      - kind: unit
        ref: "pnpm exec tsc --noEmit (DraftBodyInput type has no seq member — enforced structurally)"
        status: pass
    human_judgment: false

duration: ~15min
completed: 2026-08-08
status: complete
---

# Phase 5 Plan 3: Draft Backend (Schema + Services) Summary

**document_draft table (document_id PK, CASCADE) plus upsertDraft/getDraft/deleteDraft with onConflictDoUpdate enforcing 1 row per document, verified against real PG16.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-08T08:20:00Z (approx.)
- **Completed:** 2026-08-08T08:23:00Z (approx.)
- **Tasks:** 3/3 (checkpoint:decision pre-approved + 2 auto tasks, one TDD)
- **Files modified:** 6

## Accomplishments

- `document_draft` table added to `src/db/schema.ts` exactly per TRD §3 (document_id PK referencing document.id ON DELETE CASCADE, content NOT NULL, updated_at) and migrated to the local PG16 dev DB (5433) via `drizzle/0004_high_roulette.sql`
- `upsertDraft`/`getDraft`/`deleteDraft` added to `src/lib/documents.ts`, reusing the existing `DbClient` union type unchanged; `upsertDraft` uses `onConflictDoUpdate(target: documentDraft.documentId)` so a document can never accumulate more than one draft row
- `draftBodySchema` added to `src/lib/validation.ts` — content-only, no seq (draft has no ordering guard, TRD §7)
- Real-DB integration test suite (`tests/draft/services.test.ts`, 5 cases) proves the 1-row invariant, get/delete semantics, and the CASCADE delete, written RED-first per TDD

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration decision gate** — pre-approved by user via orchestrator (no commit; recorded below)
2. **Task 2: documentDraft schema + migration + draftBodySchema** - `240f3db` (feat)
3. **Task 3a: RED — failing draft services test** - `85dbf6d` (test)
4. **Task 3b: GREEN — upsertDraft/getDraft/deleteDraft** - `487ee84` (feat)

**Plan metadata:** (this commit, immediately following)

## Files Created/Modified

- `src/db/schema.ts` - added `documentDraft` pgTable (document_id PK, content, updated_at)
- `drizzle/0004_high_roulette.sql` - migration, applied to PG16 @ 5433
- `drizzle/meta/0004_snapshot.json`, `drizzle/meta/_journal.json` - drizzle-kit bookkeeping
- `src/lib/validation.ts` - added `draftBodySchema` + `DraftBodyInput`
- `src/lib/documents.ts` - added `upsertDraft`/`getDraft`/`deleteDraft`
- `tests/draft/services.test.ts` - 5-case real-DB integration suite
- `tests/draft/helpers.ts` - local `createTestWorkspace`/`createTestDocument` (no auth coupling)

## Decisions Made

- **document_id as PK, no surrogate id:** matches TRD §3 and 05-PATTERNS.md guidance exactly — draft is a dependent entity of document, and the 1-row-per-document invariant is enforced by the PK itself rather than an app-level check.
- **tests/draft/helpers.ts does its own inserts instead of importing tests/rbac/helpers.ts:** `createTestWorkspace` in rbac/helpers.ts lives in a module that transitively imports `@/auth` (next-auth), which requires the importing test file to `vi.mock("@/auth", ...)` at the top (per that module's own doc comment). Draft service tests exercise no auth at all, so pulling in that dependency chain would be unrelated coupling for zero benefit — a local 2-function helper (mirrors `tests/documents/helpers.ts`'s `createTestDocument` pattern) avoids it. First attempt (re-exporting from rbac/helpers.ts) surfaced this as a `next/server` module-resolution RED failure unrelated to the missing functions, which was the signal to switch approach — see Issues Encountered.

## Deviations from Plan

None — plan executed exactly as written. The helpers.ts approach above is an implementation-detail choice within the plan's stated latitude ("기존 tests/documents 헬퍼 재사용 가능하면 재사용" — re-use *when reusable*; rbac's helper indirectly required an unrelated auth mock, so a local insert was used instead, following the same pattern as the existing tests/documents/helpers.ts).

## Issues Encountered

First RED attempt (re-exporting `createTestWorkspace` from `tests/rbac/helpers.ts`) failed with a `next/server` module-resolution error instead of the expected "function not found" error — a RED-for-the-wrong-reason. Root cause: `tests/rbac/helpers.ts` imports `@/auth` (next-auth), which requires the importing test file to declare `vi.mock("@/auth", ...)`; `tests/draft/services.test.ts` doesn't touch auth so no mock was declared. Fixed by writing `tests/draft/helpers.ts` with local `db.insert(workspace)`/`db.insert(document)` calls (mirrors `tests/documents/helpers.ts`), which has no auth dependency. Re-ran: RED confirmed for the correct reason (5 failures, all "X is not a function").

## User Setup Required

None — local PG16 (5433) was already running and `.env.local` already pointed at it (precondition met, no setup needed).

## Next Phase Readiness

`upsertDraft`/`getDraft`/`deleteDraft` and `draftBodySchema` are ready for 05-04 (draft route: PUT/DELETE `/api/documents/[id]/draft`) and 05-05 (draft recovery UI) to build on directly — no further backend work needed for those plans to start. `resolveWorkspaceIdForDocument` (already in `src/lib/documents.ts` from Phase 4) is the IDOR guard 05-04's route will reuse per 05-PATTERNS.md.

---
*Phase: 05-editor-enhancements-personalization*
*Completed: 2026-08-08*

## Self-Check: PASSED

All created files and commit hashes verified present on disk / in git log.
