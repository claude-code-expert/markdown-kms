---
phase: 05-editor-enhancements-personalization
plan: 05
subsystem: editor
tags: [rsc, cookies-analog, draft-recovery, tdd, forwardref]

requires:
  - phase: 05-editor-enhancements-personalization
    provides: "05-01's EditorPreviewLayout forwardRef getView handle (dispatch spine into the live uncontrolled EditorView)"
  - phase: 05-editor-enhancements-personalization
    provides: "05-04's PUT/DELETE /api/documents/[id]/draft route, useDraft hook, and autosaveDocument-boolean-gated draft delete"
  - phase: 05-editor-enhancements-personalization
    provides: "05-08's DocumentWorkspace/d-page composition (layoutMode/splitRatio prop pattern this plan extends)"
provides:
  - "isDraftNewer(draft, doc) — pure server-timestamp comparison, no client clock exposure (src/lib/documents.ts)"
  - "d/[docId]/page.tsx: Promise.all([getDocument, getDraft]) in one request context -> hasNewerDraft/draftContent props"
  - "DraftRecoveryDialog — ConfirmDialog extended with a 폐기 (discard) button via the children slot"
  - "DocumentWorkspace: useDraft mounted, EditorPreviewLayout ref, restore/discard/dismiss wiring — EDIT-11 complete"
affects: []

actuals:
  tokens: 2891
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Server-side-only recency comparison: two timestamps read in the same RSC request via Promise.all, compared once, only the boolean+content crosses the server/client boundary — never raw timestamps (avoids client-clock-skew bugs entirely, not just mitigates them)"
    - "Recovery = one imperative dispatch into the existing autosave pipeline, not a parallel force-save path — reuses the already-tested seq-guarded write and its already-tested boolean-gated draft delete"

key-files:
  created:
    - src/components/document/DraftRecoveryDialog.tsx
    - src/components/document/DraftRecoveryDialog.module.css
    - tests/draft/draft-comparison.test.ts
  modified:
    - src/lib/documents.ts
    - src/app/(main)/w/[wsId]/d/[docId]/page.tsx
    - src/components/document/DocumentWorkspace.tsx

key-decisions:
  - "DocumentWorkspaceProps gained hasNewerDraft/draftContent (optional) as part of Task 1's own commit, not Task 3's as the plan's file-scope table implied — TypeScript's JSX excess-property check rejects page.tsx passing props DocumentWorkspace doesn't declare, so the type had to land in the same commit as the RSC prop pass-down for Task 1's own tsc --noEmit gate to pass. Task 3 only added the props' actual runtime use (dialog state, restore/discard/dismiss handlers) — no interface change needed there."
  - "showRecovery is local useState seeded from the hasNewerDraft prop (not the prop read directly in JSX) — matches 05-PATTERNS.md's sketch (setHasNewerDraft(false) on cancel) and lets dismiss/discard close the dialog without needing a second boolean."

requirements-completed: [EDIT-11]

coverage:
  - id: D1
    description: "isDraftNewer(draft, doc) correctly judges 4 cases: no draft, newer draft, tied timestamps (not newer), older draft"
    requirement: EDIT-11
    verification:
      - kind: unit
        ref: "tests/draft/draft-comparison.test.ts (RED->GREEN, 4 cases)"
        status: pass
    human_judgment: false
  - id: D2
    description: "RSC computes hasNewerDraft/draftContent server-side from a same-request Promise.all([getDocument, getDraft]) comparison; no raw timestamp ever reaches the client component"
    requirement: EDIT-11
    verification:
      - kind: other
        ref: "pnpm exec tsc --noEmit clean + manual read of d/[docId]/page.tsx confirms only hasNewerDraft(boolean)/draftContent(string|null) cross into DocumentWorkspace props, never doc.updatedAt/draft.updatedAt"
        status: pass
    human_judgment: false
  - id: D3
    description: "DraftRecoveryDialog reuses ConfirmDialog (no new dialog shell) with a 폐기 button in the children slot; copy matches UI-SPEC exactly; 복원 is the primary/accent action"
    requirement: EDIT-11
    verification:
      - kind: other
        ref: "node -e grep gate: ConfirmDialog usage + exact title copy present"
        status: pass
    human_judgment: false
  - id: D4
    description: "Restore dispatches draftContent into the live EditorView via EditorPreviewLayout's getView() handle in one call, with no separate force-save/delete — the dispatch re-triggers the existing autosave pipeline which (on success) deletes the draft server-side per 05-04's gate. DocumentWorkspace never imports @codemirror/view or @codemirror/state."
    requirement: EDIT-11
    verification:
      - kind: other
        ref: "node -e grep gate: no @codemirror/(view|state) import in DocumentWorkspace.tsx + DraftRecoveryDialog wired; pnpm vitest run (919 tests) + tsc --noEmit both clean"
        status: pass
      - kind: unit
        human_judgment: true
        rationale: "The full crash-recovery loop (edit -> wait 60s -> draft upserted -> reload -> dialog appears -> restore loads content and autosave fires -> draft deleted) is only observable end-to-end in a real browser session with real timers; static/grep checks prove the wiring exists but not the felt behavior."
---

# Phase 5 Plan 5: Draft Crash-Recovery Dialog Summary

**RSC-side (Pitfall-7-safe) newer-draft detection plus a ConfirmDialog-extended recovery dialog whose "복원" action is a single `getView().dispatch()` into the live, uncontrolled EditorView — completing EDIT-11 by chaining into the already-tested autosave/draft-delete pipeline instead of adding a parallel force-save path.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 3/3 (1 TDD, 2 plain auto)
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments

- `isDraftNewer(draft, doc)` — pure function, strict `>` comparison (a tie is not "newer"), added to `src/lib/documents.ts` alongside the other draft service functions from 05-03/05-04.
- `d/[docId]/page.tsx` now fetches `getDocument` and `getDraft` via `Promise.all` in the same request, computes `hasNewerDraft` server-side, and passes only `hasNewerDraft`/`draftContent` down — the two raw `updatedAt` timestamps never leave the server (Pitfall 7).
- `DraftRecoveryDialog` extends `ConfirmDialog` via its `children` slot (no new dialog shell): title/body copy matches UI-SPEC's Copywriting Contract verbatim, a 폐기 (discard) button styled after `SaveStatusBar`'s 재시도 button sits below the body text, and `confirmLabel="복원"` stays the plain accent button (no `destructive` prop — restoring isn't destructive).
- `DocumentWorkspace` mounts `useDraft(docId)` and now calls it from `handleContentChange` alongside the existing `scheduleSave`, holds a ref to `EditorPreviewLayout`'s `getView` handle, and wires all three dialog outcomes: restore (one `view.dispatch({changes:{from:0,to:len,insert:draftContent}})`, which re-triggers the existing update-listener → autosave → server-side gated draft delete chain), discard (`DELETE /api/documents/:id/draft`), dismiss (close only, draft untouched).

## Task Commits

Each task was committed atomically:

1. **Task 1a: RED — isDraftNewer failing test** - `338928c` (test)
2. **Task 1b: GREEN — isDraftNewer + RSC Promise.all comparison** - `b0981b8` (feat)
3. **Task 2: DraftRecoveryDialog (ConfirmDialog + discard slot)** - `ed4190b` (feat)
4. **Task 3: DocumentWorkspace recovery wiring** - `b215f60` (feat)

## Files Created/Modified

- `src/lib/documents.ts` - `isDraftNewer(draft, doc)` pure comparison
- `src/app/(main)/w/[wsId]/d/[docId]/page.tsx` - `Promise.all([getDocument, getDraft])`, `hasNewerDraft`/`draftContent` props
- `src/components/document/DraftRecoveryDialog.tsx` + `.module.css` - new, ConfirmDialog extension
- `src/components/document/DocumentWorkspace.tsx` - `hasNewerDraft`/`draftContent` props (Task 1), `useDraft` mount + `EditorPreviewLayout` ref + restore/discard/dismiss handlers (Task 3)
- `tests/draft/draft-comparison.test.ts` - 4-case `isDraftNewer` suite

## Decisions Made

- `DocumentWorkspaceProps` gained the two new optional props (`hasNewerDraft`, `draftContent`) in Task 1's own commit rather than Task 3's, per the file-scope table in the plan. TypeScript's JSX excess-property check would otherwise reject `page.tsx` passing props the component doesn't declare, breaking Task 1's own `tsc --noEmit` gate. The props were declared-but-unused after Task 1 (no lint violation — interface fields aren't variables) and only gained real runtime behavior in Task 3.
- `showRecovery` is a local `useState` seeded from the `hasNewerDraft` prop, matching 05-PATTERNS.md's sketch, rather than deriving dialog visibility from the prop directly — lets discard/dismiss close the dialog with one state variable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `DocumentWorkspaceProps` didn't yet declare `hasNewerDraft`/`draftContent` when Task 1 needed to pass them from `page.tsx`**
- **Found during:** Task 1, `pnpm exec tsc --noEmit` after wiring the RSC prop pass-down
- **Issue:** The plan's file-scope table lists `DocumentWorkspace.tsx` only under Task 3, but Task 1's own action text explicitly directs `page.tsx` to pass `hasNewerDraft`/`draftContent` to `DocumentWorkspace` — and Task 1's `<verify>` requires `tsc --noEmit` clean on its own. TypeScript's JSX excess-property check fails on an object literal (JSX props) containing keys the target interface doesn't declare.
- **Fix:** Added the two props to `DocumentWorkspaceProps` (optional, unused at that point) in Task 1's commit; Task 3 added the actual behavior (dialog state + handlers) using the already-declared props, with zero interface changes of its own.
- **Files modified:** `src/components/document/DocumentWorkspace.tsx` (type-only in Task 1's commit)
- **Verification:** `pnpm exec tsc --noEmit` clean at both Task 1 and Task 3 boundaries
- **Committed in:** `b0981b8` (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking type error from a plan file-scope/task-boundary mismatch, not a design flaw; fully contained to a type declaration, no behavior added early).

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None - local PG16 (5433) already running, no new external services.

## Next Phase Readiness

EDIT-11 is now fully implemented: the 60s draft controller (05-04) is connected to real user input, the RSC computes recovery eligibility server-side with no clock-skew exposure (05-05), and restore chains cleanly into the already-tested autosave/draft-delete pipeline with no new save/delete code path. This was the final plan of Phase 5 (wave 4) — `05-01` through `05-08` are all executed. Manual/browser verification of the full crash-recovery loop (edit → wait 60s → reload → dialog → restore/discard/dismiss) is deferred to this project's end-of-phase `/gsd-verify-work 5` pass, consistent with how 05-07/05-08's visual/timing-only checks were handled.

---
*Phase: 05-editor-enhancements-personalization*
*Completed: 2026-08-08*

## Self-Check: PASSED

All 7 created/modified files verified present on disk; all 4 task commits (`338928c`, `b0981b8`, `ed4190b`, `b215f60`) verified present in `git log --oneline --all`.
