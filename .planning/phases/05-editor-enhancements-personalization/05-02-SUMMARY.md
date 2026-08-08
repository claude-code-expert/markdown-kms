---
phase: 05-editor-enhancements-personalization
plan: 02
subsystem: editor
tags: [image-upload, drag-drop, react, css-modules, lucide]

# Dependency graph
requires:
  - phase: 05-editor-enhancements-personalization (05-01)
    provides: "useImageUpload hook (placeholder-insert -> upload -> literal-search-replace), POST /api/uploads server validation, EditorPreviewLayoutHandle.getView forwardRef"
provides:
  - "ImageDropzone: conditionally-rendered drag-over overlay on .editorPane, second upload entry point alongside the toolbar button"
  - "UploadErrorBanner: dismissible, non-auto-dismissing error surface for the 3 upload failure kinds (size/type/network)"
  - "useImageUpload errorMessage/dismissError state, reusing the server's exact 400 body.error copy"
affects: [05-05-draft-recovery]

# Actuals (#2632)
actuals:
  tokens: 3561
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Drag-drop feeds the existing hidden <input> via a synthetic DataTransfer + dispatched change event, instead of duplicating useImageUpload's fetch/placeholder logic for a second entry point"
    - "Client never re-derives error copy — server 400 body.error is the literal UI-SPEC string (route.ts), client only supplies the generic network-failure fallback"

key-files:
  created:
    - src/components/editor/ImageDropzone.tsx
    - src/components/editor/ImageDropzone.module.css
    - src/components/editor/UploadErrorBanner.tsx
    - src/components/editor/UploadErrorBanner.module.css
  modified:
    - src/components/editor/useImageUpload.ts
    - src/components/layout/EditorPreviewLayout.tsx
    - src/components/layout/EditorPreviewLayout.module.css

key-decisions:
  - "Dropped files are routed through the existing hidden <input> (DataTransfer + dispatchEvent('change')) rather than exporting a new uploadFile(file) function from useImageUpload — keeps Task 1 inside its declared file list (useImageUpload.ts wasn't listed until Task 2) and guarantees zero drift between the toolbar and drag-drop paths"
  - "ImageDropzone overlay uses pointer-events:none — the overlay has no interactive content, and removing it from the hit-test path avoids the classic dragenter/dragleave flicker between a covering child and its parent"
  - "No client-side pre-validation of size/type before the network round-trip — the plan's Task 2 action explicitly says reuse the server's 400 body.error verbatim, and duplicating TOO_LARGE/BAD_TYPE thresholds client-side would be a second source of truth for a check the server already does before reading any bytes (storage.ts)"

patterns-established:
  - "UploadErrorBanner reuses Phase 4's RestoreRootBanner left-border/surface-2/no-auto-dismiss convention verbatim — the same shape now covers both an informational (Info icon) and a destructive (AlertCircle icon) banner"

requirements-completed: [EDIT-09]

coverage:
  - id: D1
    description: "Dragging a file over the editor pane shows the dashed-accent drop overlay (conditionally rendered, not display:none), and dropping it starts the same upload flow as the toolbar button"
    requirement: "EDIT-09"
    verification:
      - kind: other
        ref: "grep gate: ImageDropzone.tsx contains the UI-SPEC copy '여기에 이미지를 놓아 업로드'; tsc --noEmit clean"
        status: pass
    human_judgment: true
    rationale: "Drag-and-drop is a real browser interaction (DataTransfer, dragenter/dragleave sequencing) that jsdom cannot faithfully simulate — the plan's own verification is Manual-Only per its <verification> block; needs a human dragging a real file in a real browser"
  - id: D2
    description: "Upload failures (size >5MB, wrong format, network) each show the exact UI-SPEC banner copy, remove the in-flight placeholder, and stay until dismissed (no auto-timer)"
    requirement: "EDIT-09"
    verification:
      - kind: other
        ref: "grep gate: UploadErrorBanner.tsx renders lucide AlertCircle; tsc --noEmit clean; pnpm vitest run — 904/904 pass (no regressions in useImageUpload's existing call sites)"
        status: pass
    human_judgment: true
    rationale: "Triggering a real 5MB+/wrong-format/offline failure through the actual POST /api/uploads round-trip is Manual-Only per the plan's <verification> block — no unit test file was in this plan's declared scope"

duration: 17min
completed: 2026-08-08
status: complete
---

# Phase 5 Plan 2: Image Upload UX — Drag-Drop + Error Banner Summary

**ImageDropzone drag-drop overlay and UploadErrorBanner (3 dismissible error kinds) layered on top of 05-01's upload orchestration — no new fetch/placeholder logic, both entry points converge on the same hidden `<input>` and the same server-authoritative error copy.**

## Performance

- **Duration:** 17 min (first commit 17:35 → last commit 17:37, KST, plus prior reading/design time)
- **Started:** 2026-08-08T08:20:00Z (approx.)
- **Completed:** 2026-08-08T08:37:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- `ImageDropzone`: conditionally-rendered overlay covering `.editorPane` (2px dashed `var(--accent)`, opaque `var(--surface)`, centered lucide `Upload` 24px + "여기에 이미지를 놓아 업로드"), `pointer-events:none` so the overlay never participates in drag-event hit-testing.
- `EditorPreviewLayout`: `dragenter`/`dragover`/`dragleave`/`drop` handlers on `.editorPane` drive `isDraggingFile` local state (only for file drags — checked via `dataTransfer.types.includes("Files")`). A drop constructs a `DataTransfer`, assigns it to the existing hidden `<input>`'s `.files`, and dispatches a `change` event — `handleFileChange` (05-01) runs completely unmodified for the drag-drop path, guaranteeing identical behavior to the toolbar button with zero duplicated upload logic.
- `useImageUpload`: now exposes `errorMessage`/`dismissError`. On a non-ok response it surfaces the server's `body.error` directly (already the exact TOO_LARGE/BAD_TYPE copy from `route.ts`); a thrown `fetch` (network down, no response at all) falls back to the generic "이미지를 업로드하지 못했어요. 다시 시도해 주세요." copy. Every new upload attempt clears the prior error first (matches the "no auto-timer, next attempt replaces it" contract).
- `UploadErrorBanner`: same left-border (`var(--border-strong)`) / `var(--surface-2)` shape as Phase 4's `RestoreRootBanner`, but destructive-colored (`AlertCircle` + text in `var(--destructive)`), with an `X` dismiss button and no auto-dismiss timer. Positioned `absolute`, `top: 44px` (below the toolbar), so it overlays the editor pane instead of pushing document height.
- `.editorPane` gained `position: relative` as the shared anchor for both overlays.

## Task Commits

Each task was committed atomically:

1. **Task 1: ImageDropzone overlay + drop → upload flow** - `0dbbd28` (feat)
2. **Task 2: UploadErrorBanner + useImageUpload error state (3 kinds)** - `fa12f3c` (feat)

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP update)

_Note: Neither task carried `tdd="true"` in the plan — both verified via `tsc --noEmit` + grep gates per the plan's own `<verify>` blocks, plus a full `pnpm vitest run` regression check (904/904 green) after Task 2._

## Files Created/Modified
- `src/components/editor/ImageDropzone.tsx` - drag-over overlay (Task 1)
- `src/components/editor/ImageDropzone.module.css` - overlay styling
- `src/components/editor/UploadErrorBanner.tsx` - dismissible error banner (Task 2)
- `src/components/editor/UploadErrorBanner.module.css` - banner styling
- `src/components/editor/useImageUpload.ts` - `errorMessage`/`dismissError` state added to the 05-01 hook
- `src/components/layout/EditorPreviewLayout.tsx` - drag handlers, dropzone/banner mount points
- `src/components/layout/EditorPreviewLayout.module.css` - `.editorPane { position: relative }`

## Decisions Made
- Drag-drop reuses the hidden `<input>` via synthetic `DataTransfer` + `change` event dispatch instead of extracting a new `uploadFile(file)` export from `useImageUpload` — kept Task 1 inside its own declared file scope (Task 2 was the one that touched `useImageUpload.ts`) and eliminated any chance of the two entry points drifting apart.
- No client-side size/type pre-check ahead of the network round-trip: the plan's Task 2 action explicitly directs reusing the server's 400 `body.error` text as-is, and the server (`storage.ts`) already rejects oversized files before reading any bytes — a client-side duplicate threshold would be a second source of truth for the same rule.
- `ImageDropzone` is `pointer-events:none` — it has no interactive content, so removing it from the hit-test path sidesteps the dragenter/dragleave flicker that a covering child would otherwise cause.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- EDIT-09's full UX surface (happy path from 05-01 + drag-drop entry + 3-kind error banner from this plan) is complete.
- `useImageUpload`'s `errorMessage`/`dismissError` pair is a small, reusable "surface the server's own error text, dismissible, no timer" shape — the same shape Phase 4's `SaveStatusBar`/`RestoreRootBanner` already established, now proven a third time.
- Manual/browser verification (drag a real file, trigger a real >5MB/wrong-format/offline failure) is deferred to the phase's bulk verification pass per the 2026-08-08 user instruction (STATE.md "Deferred Verification").
- No blockers for 05-03 through 05-08.

---
*Phase: 05-editor-enhancements-personalization*
*Completed: 2026-08-08*

## Self-Check: PASSED

All 7 created/modified files verified present on disk; both task commits (`0dbbd28`, `fa12f3c`) verified present in `git log --oneline --all`.
