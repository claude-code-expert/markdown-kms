---
phase: 05-editor-enhancements-personalization
plan: 04
subsystem: api
tags: [nextjs, drizzle, vitest, draft-recovery, tdd, fake-timers]

requires:
  - phase: 05-editor-enhancements-personalization
    provides: "document_draft table + upsertDraft/getDraft/deleteDraft services + draftBodySchema (05-03)"
provides:
  - "PUT/DELETE /api/documents/[id]/draft route (IDOR/RBAC 4-stage, mirrors documents/[id]/route.ts)"
  - "autosaveDocument-boolean-gated draft delete inside PUT /api/documents/[id] (Pitfall 5 fix)"
  - "createDraftController — pure 60s dirty-flag controller (React-less, fake-timer testable)"
  - "useDraft — thin hook wrapper, no status state"
affects: [05-05]

actuals:
  tokens: 3407
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "dirty-flag + setInterval controller (vs. autosave's debounce + setTimeout) for periodic-only-on-change network calls"
    - "gate a cascading side effect (draft delete) on a service function's boolean return value, never on the HTTP status of the route that called it"

key-files:
  created:
    - src/app/api/documents/[id]/draft/route.ts
    - src/components/document/draft-controller.ts
    - src/components/document/useDraft.ts
    - tests/draft/draft-controller.test.ts
    - tests/draft/draft-autodelete.test.ts
  modified:
    - src/app/api/documents/[id]/route.ts

key-decisions:
  - "DELETE /api/documents/[id]/draft returns 204 (no body), matching documents/[id]/route.ts's DELETE convention exactly rather than the plan's alternative '200' option"
  - "draft-autodelete.test.ts calls the documents/[id]/route.ts PUT handler directly (idor.test.ts's ctx()/putRequest() pattern) rather than adding a route-level test file under tests/draft/ that duplicates existing IDOR coverage — the correctness core here is the deleteDraft gate, not RBAC (already proven by idor.test.ts)"

patterns-established:
  - "Pure controller + thin hook split (draft-controller.ts / useDraft.ts) replicated verbatim from autosave-controller.ts / useAutosave.ts for any future periodic-network-effect feature"

requirements-completed: [EDIT-11]

coverage:
  - id: D1
    description: "PUT/DELETE /api/documents/:id/draft passes only IDOR/RBAC-cleared requests (uuid -> resolveWorkspaceIdForDocument -> requireRole EDITOR -> service call), GET intentionally absent"
    requirement: EDIT-11
    verification:
      - kind: unit
        ref: "pnpm exec tsc --noEmit + route grep gate (runtime nodejs, requireRole present, GET absent)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Draft deletion after autosave is gated on autosaveDocument's boolean return, not on the route's 200 status — stale seq (0 rows, still 200) leaves the draft intact"
    requirement: EDIT-11
    verification:
      - kind: integration
        ref: "tests/draft/draft-autodelete.test.ts#deletes the draft when autosaveDocument actually applies (newer seq -> true)"
        status: pass
      - kind: integration
        ref: "tests/draft/draft-autodelete.test.ts#does NOT delete the draft when autosaveDocument is a no-op (stale seq -> false, 0 rows, still 200)"
        status: pass
    human_judgment: false
  - id: D3
    description: "60s pure draft controller fires only when input occurred since the last tick (dirty flag), coalesces multiple changes into one send with the latest content, resets after firing, and stops on dispose()"
    requirement: EDIT-11
    verification:
      - kind: unit
        ref: "tests/draft/draft-controller.test.ts (5 cases: no-input-no-send, one-send-with-latest-content, dirty-reset-after-fire, coalesce-multiple-changes, dispose-stops-timer)"
        status: pass
    human_judgment: false

duration: ~20min
completed: 2026-08-08
status: complete
---

# Phase 5 Plan 4: Draft Network + Timing Layer Summary

**PUT/DELETE /api/documents/[id]/draft route plus a pure 60s dirty-flag draft controller, and a Pitfall-5 fix gating post-autosave draft deletion on `autosaveDocument`'s boolean return instead of the route's HTTP status.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-08T08:38:00Z (approx.)
- **Completed:** 2026-08-08T08:58:00Z (approx.)
- **Tasks:** 3/3 (1 plain auto, 2 TDD)
- **Files modified:** 6

## Accomplishments

- `PUT/DELETE /api/documents/[id]/draft` — replicates the exact 4-stage IDOR/RBAC shape of `documents/[id]/route.ts` (uuid zod check -> `resolveWorkspaceIdForDocument` server-side workspace re-derivation -> `requireRole(EDITOR)` -> service call); no GET handler (recovery comparison is done RSC-side via `getDraft` directly, per Pitfall 7)
- `documents/[id]/route.ts` PUT handler now deletes the draft only when `autosaveDocument` returns `true` — a stale/tied seq still returns HTTP 200 (per TRD §7's "no cancellation" contract) but affects 0 rows, and the draft is correctly left intact in that case (Pitfall 5, RED-first regression test proves both branches)
- `createDraftController` — pure, React-less 60-second dirty-flag controller (`src/components/document/draft-controller.ts`), architecturally parallel to (not merged with) `autosave-controller.ts`; `useDraft.ts` is the equivalent thin `"use client"` wrapper to `useAutosave.ts`, with no status state (draft saves have no visible UI feedback per UI-SPEC)
- 5 fake-timer test cases (`tests/draft/draft-controller.test.ts`) prove: no input -> no send; input -> exactly one send with the latest content; the dirty flag resets after firing; multiple changes before a tick coalesce into a single send; `dispose()` stops the timer permanently

## Task Commits

Each task was committed atomically:

1. **Task 1: PUT/DELETE draft route** - `423723d` (feat)
2. **Task 2a: RED — draft-autodelete regression test** - `605915f` (test)
3. **Task 2b: GREEN — gate deleteDraft on autosaveDocument's boolean** - `8dade6e` (feat)
4. **Task 3a: RED — draft-controller fake-timer test** - `b4a2dcf` (test)
5. **Task 3b: GREEN — createDraftController + useDraft** - `cb91bf5` (feat)

**Plan metadata:** (this commit, immediately following)

## Files Created/Modified

- `src/app/api/documents/[id]/draft/route.ts` - new PUT (upsert) / DELETE (discard) route, IDOR/RBAC
- `src/app/api/documents/[id]/route.ts` - PUT handler now gates `deleteDraft(id)` on `autosaveDocument`'s boolean return
- `src/components/document/draft-controller.ts` - new pure 60s dirty-flag controller
- `src/components/document/useDraft.ts` - new thin hook wrapper (no status state)
- `tests/draft/draft-controller.test.ts` - 5-case fake-timer suite
- `tests/draft/draft-autodelete.test.ts` - 2-case real-DB integration suite (Pitfall 5 regression)

## Decisions Made

- **DELETE draft route returns 204 (no body):** matches `documents/[id]/route.ts`'s existing DELETE convention exactly; the plan allowed either 200 or 204 and this keeps the two sibling routes byte-identical in response shape.
- **`draft-autodelete.test.ts` calls the route handler directly** (same `ctx()`/`putRequest()` pattern as `tests/documents/idor.test.ts`) instead of adding a new tests/draft-scoped IDOR suite — RBAC/IDOR for this exact code path is already proven by the existing `documents/[id]/route.ts` test files; this plan's test only needed to add the one thing that changed: the deleteDraft gate.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - local PG16 (5433) was already running and no new external services were introduced.

## Next Phase Readiness

The draft route (PUT/DELETE) and `useDraft` hook are ready for 05-05 (draft recovery UI) to consume directly — `useDraft(docId).onContentChange` can be wired into the editor's content-change path exactly like `useAutosave`, and the route already exists for it to call. `getDraft` (from 05-03) plus the RSC comparison contract (Pitfall 7 — `hasNewerDraft`/`draftContent` computed server-side) remain the only pieces 05-05 needs to add.

---
*Phase: 05-editor-enhancements-personalization*
*Completed: 2026-08-08*

## Self-Check: PASSED

All created files and commit hashes verified present on disk / in git log.
