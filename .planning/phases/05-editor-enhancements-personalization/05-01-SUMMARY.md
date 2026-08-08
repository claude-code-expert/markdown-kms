---
phase: 05-editor-enhancements-personalization
plan: 01
subsystem: editor
tags: [nextjs-route-handler, magic-bytes, file-upload, codemirror, forwardRef, rbac]

# Dependency graph
requires:
  - phase: 02-editor-core-formatting
    provides: EditorHost forwardRef+useImperativeHandle pattern, plugins/image.ts run(state) skeleton, editorKeymap registry
  - phase: 04-documents-autosave-workspace
    provides: DocumentWorkspace/EditorPreviewLayout composition, requireRole/ForbiddenError RBAC gate, autosave dispatch->updateListener pipeline
provides:
  - "src/lib/storage.ts saveUpload(file) — the ONLY storage entrypoint (magic-byte sniff + uuid filename + public/uploads write)"
  - "POST /api/uploads route (EDITOR+, runtime=nodejs)"
  - "EditorPreviewLayoutHandle.getView exposed via forwardRef — reusable dispatch spine for any future feature needing to push content into the live, uncontrolled EditorView"
  - "useImageUpload hook: placeholder-insert -> upload -> literal-search-replace pattern, with a concurrent-upload guard"
affects: [05-02-image-upload-ux-expansion, 05-05-draft-recovery]

# Actuals (#2632)
actuals:
  tokens: 6312
  tasks: 3
  commits: 5

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "storage isolation: a single module (src/lib/storage.ts) owns the filesystem path/naming scheme, one function export"
    - "server never trusts client File.type/File.name — extension is decided purely by sniffing bytes at offset 0"
    - "forwardRef + useImperativeHandle chain (EditorHost -> EditorPreviewLayout) to expose an imperative dispatch handle to ancestors without threading CodeMirror imports up the tree"
    - "async placeholder-then-literal-replace instead of coordinate/decoration tracking for async edits into an uncontrolled editor"

key-files:
  created:
    - src/lib/storage.ts
    - src/app/api/uploads/route.ts
    - src/components/editor/useImageUpload.ts
    - tests/upload/storage.test.ts
    - tests/upload/rbac.test.ts
    - e2e/image-upload.spec.ts
    - public/uploads/.gitkeep
  modified:
    - src/components/layout/EditorPreviewLayout.tsx
    - src/components/editor/Toolbar.tsx
    - .gitignore

key-decisions:
  - "POST /api/uploads handler signature uses plain Request + new URL(req.url).searchParams, not NextRequest.nextUrl — matches documents/[id]/route.ts's existing convention and is directly callable from vitest without a NextRequest shim (RESEARCH's code example used NextRequest; adjusted during Task 2 GREEN)"
  - "useImageUpload reads wsId via next/navigation's useParams() inside the hook itself, not threaded through DocumentWorkspace/EditorPreviewLayout props — keeps the tracer self-contained within this plan's file set (05-PATTERNS.md/05-RESEARCH.md discretion note)"
  - "Concurrent-upload guard (Pitfall 2) is a single uploadingRef boolean checked synchronously at the top of the file-change handler, not a queue — matches UI-SPEC's absence of any multi-upload UI"

patterns-established:
  - "Async-safe editor mutation via literal placeholder text search (RESEARCH Pattern 2) — reused by 05-05's draft recovery going forward"
  - "EditorPreviewLayoutHandle.getView as the standard way for a layout ancestor (DocumentWorkspace, dialogs) to dispatch into the live EditorView without owning CodeMirror imports itself"

requirements-completed: [EDIT-09]

coverage:
  - id: D1
    description: "Server rejects a spoofed image (non-image bytes labelled image/png with a .png filename) with BAD_TYPE, and validates png/jpeg/gif/webp purely by magic bytes"
    requirement: "EDIT-09"
    verification:
      - kind: unit
        ref: "tests/upload/storage.test.ts#saveUpload — magic-byte sniffing (EDIT-09)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Files over 5MB are rejected before their bytes are ever read (arrayBuffer() not called)"
    requirement: "EDIT-09"
    verification:
      - kind: unit
        ref: "tests/upload/storage.test.ts#rejects an oversized file (>5MB) BEFORE reading its bytes"
        status: pass
    human_judgment: false
  - id: D3
    description: "POST /api/uploads rejects VIEWER with 403 and accepts EDITOR/ADMIN/OWNER with 200, enforced server-side via requireRole"
    requirement: "EDIT-09"
    verification:
      - kind: integration
        ref: "tests/upload/rbac.test.ts#POST /api/uploads — RBAC gate (EDITOR+)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Toolbar image button opens a hidden file input; a real upload round-trip inserts the placeholder then replaces it with the actual image markdown at the caret, and a second concurrent file selection is ignored (only one image ends up in the document)"
    requirement: "EDIT-09"
    verification:
      - kind: e2e
        ref: "e2e/image-upload.spec.ts#uploads an image via the toolbar button and inserts the markdown at the caret"
        status: pass
      - kind: e2e
        ref: "e2e/image-upload.spec.ts#ignores a second file selection while an upload is already in flight (Pitfall 2 guard)"
        status: pass
    human_judgment: false

duration: 13min
completed: 2026-08-08
status: complete
---

# Phase 5 Plan 1: Image Upload Tracer Summary

**End-to-end image upload wired through every layer — server-side magic-byte validation (png/jpeg/gif/webp, 5MB cap, uuid filenames) behind an EDITOR+ RBAC gate, and a `forwardRef`-exposed `getView` on `EditorPreviewLayout` that lets a hook dispatch a placeholder-then-URL swap straight into the live, uncontrolled CodeMirror `EditorView`.**

## Performance

- **Duration:** 13 min (first commit 17:08:58 → last commit 17:15:40, KST)
- **Started:** 2026-08-08T08:08:58Z
- **Completed:** 2026-08-08T08:15:40Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments
- `src/lib/storage.ts`: single `saveUpload(file)` export — size cap checked before any byte read, magic-byte sniff (png/jpeg/gif/webp) decides the stored extension (never `file.type`/`file.name`), `crypto.randomUUID()` filename so no client string ever reaches the filesystem path.
- `POST /api/uploads`: `requireRole(wsId, "EDITOR")` server gate, `runtime = "nodejs"` for fs access, storage error union mapped to the UI-SPEC Copywriting Contract's exact Korean 400 messages.
- `EditorPreviewLayout` promoted to `forwardRef<EditorPreviewLayoutHandle>`, exposing `getView()` upward — the architecture spine that 05-05's draft recovery will reuse verbatim.
- `useImageUpload` hook: reads `wsId` via `useParams()`, dispatches the `![업로드 중...]()` placeholder synchronously at the caret, `POST`s the file, then finds the placeholder by literal string search and replaces it with `![filename](url)` (or removes it on failure) — a single `uploadingRef` flag blocks a second file selection while one is in flight.
- `Toolbar` intercepts only `plugin.id === "image"` to open a hidden file input instead of running the plugin's `run(state)` skeleton insert; the other 13 buttons and `plugins/image.ts` itself are untouched (verified by `git diff --exit-code`).
- Real end-to-end Playwright proof: toolbar click → file select → server-validated save → markdown appears at the caret, plus a race test proving the concurrent-upload guard actually blocks a second placeholder (not just two sequential uploads that happen to look single).

## Task Commits

Each task was committed atomically (TDD RED→GREEN per task):

1. **Task 1: storage.ts magic-byte sniffing + saveUpload**
   - `4fdca51` test(05-01): add failing test for saveUpload magic-byte sniffing
   - `ebc92ee` feat(05-01): implement saveUpload — magic-byte sniff + uuid filename + public/uploads write
2. **Task 2: POST /api/uploads route + RBAC gate**
   - `fc335d1` test(05-01): add failing test for POST /api/uploads RBAC gate
   - `8d965d8` feat(05-01): add POST /api/uploads route with EDITOR+ RBAC gate
3. **Task 3: TRACER wiring — getView forwardRef + useImageUpload + Toolbar intercept**
   - `92c4b3e` feat(05-01): wire tracer — getView forwardRef + useImageUpload + Toolbar image intercept
     (single commit: unit-testable RED/GREEN split doesn't apply cleanly to this task's e2e-only verification surface — see Deviations)

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP update)

_Note: TDD tasks 1–2 have their expected test→feat commit pairs. Task 3's tdd="true" tag only ties to an e2e spec (no unit test file listed in the plan), so its RED/GREEN split is documented as a deviation below rather than as separate commits._

## Files Created/Modified
- `src/lib/storage.ts` - `saveUpload(file)`, the sole storage entrypoint (TRD §8 isolation)
- `src/app/api/uploads/route.ts` - `POST`, `runtime=nodejs`, `requireRole(wsId, "EDITOR")`
- `src/components/editor/useImageUpload.ts` - upload orchestration hook (placeholder insert/replace, concurrency guard)
- `src/components/layout/EditorPreviewLayout.tsx` - `forwardRef<EditorPreviewLayoutHandle>`, hidden file input, mounts `useImageUpload`
- `src/components/editor/Toolbar.tsx` - `onImageButtonClick` prop, intercepts only the `image` plugin id
- `.gitignore` - `public/uploads/*` ignored except `.gitkeep`
- `public/uploads/.gitkeep` - keeps the upload directory present on checkout
- `tests/upload/storage.test.ts` - 7 cases: 4 format acceptance + spoofed-type rejection + oversize-before-read
- `tests/upload/rbac.test.ts` - VIEWER 403, EDITOR/ADMIN/OWNER 200, missing wsId 400
- `e2e/image-upload.spec.ts` - tracer proof + concurrent-selection guard proof

## Decisions Made
- Route handler uses plain `Request` + `new URL(req.url).searchParams` instead of RESEARCH's `NextRequest.nextUrl` — matches `documents/[id]/route.ts`'s existing signature convention in this codebase and is directly invocable from vitest (a plain `Request` has no `.nextUrl`, which the RBAC test's initial run surfaced as a `TypeError`).
- `wsId` is read inside `useImageUpload` via `useParams()` rather than threaded as a prop from `DocumentWorkspace`/the `d/[docId]` page — keeps this tracer plan self-contained to its own file list, per the plan's explicit discretion note (other waves own those files).
- Concurrent-upload protection is a single `uploadingRef` boolean, not a queue — the UI-SPEC defines no multi-upload UI, so "ignore the second attempt" is the correct (and simplest) contract.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `POST /api/uploads` used `NextRequest.nextUrl` which throws when the handler is invoked directly (not through Next's router)**
- **Found during:** Task 2, first `pnpm vitest run tests/upload/` after implementing the route
- **Issue:** RESEARCH's code example typed the handler as `(req: NextRequest)` and read `req.nextUrl.searchParams`. The RBAC test (and `documents/[id]/route.ts`'s own established convention) calls route handlers directly with a plain `Request`, which has no `.nextUrl` — every test hit `TypeError: Cannot read properties of undefined (reading 'searchParams')`.
- **Fix:** Changed the handler to `(req: Request)` and `new URL(req.url).searchParams.get("wsId")`, matching `documents/[id]/route.ts`'s pattern exactly. Works identically under real Next.js routing (a `NextRequest` still has `.url`) and under direct-invocation tests.
- **Files modified:** `src/app/api/uploads/route.ts`
- **Verification:** `pnpm vitest run tests/upload/` — all 12 tests pass
- **Committed in:** `8d965d8` (Task 2 commit — fixed before the first GREEN commit, not a separate follow-up)

**2. [Rule 1 - Bug] Initial e2e concurrency test didn't actually race the guard**
- **Found during:** Task 3, first `pnpm exec playwright test e2e/image-upload.spec.ts` run
- **Issue:** The first version of the "ignores a second upload while one is in flight" test used two separate `page.locator(...).setInputFiles(...)` Playwright actions. Each Playwright action is a full CDP round-trip, slower than the local `fetch` to the dev server — so the first upload fully completed before the second file selection fired, producing two legitimate sequential uploads (2 images) instead of exercising the guard. The assertion correctly failed (`Expected: 1, Received: 2`), catching the flawed test design.
- **Fix:** Rewrote the test to use `page.evaluate()` to construct two `File`/`DataTransfer` objects and dispatch two `change` events on the hidden input synchronously within the same browser-context tick, with no round-trip between them — this actually races `useImageUpload`'s `uploadingRef` guard.
- **Files modified:** `e2e/image-upload.spec.ts`
- **Verification:** `pnpm exec playwright test e2e/image-upload.spec.ts` — both tests pass, final doc content matches exactly one `![`
- **Committed in:** `92c4b3e` (Task 3 commit — fixed before the GREEN commit, not a separate follow-up)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs caught and fixed before their task's commit landed)
**Impact on plan:** Both fixes were needed for the plan's own verification commands to pass as specified; neither expanded scope beyond the plan's file list.

## Issues Encountered
None beyond the two auto-fixed items above.

## User Setup Required
None - no external service configuration required. Uploads write to the local `public/uploads/` directory (CONTEXT-locked dev scope, no S3/cloud storage in this phase).

## Next Phase Readiness
- `EditorPreviewLayoutHandle.getView` is now the established way for an ancestor to dispatch into the live `EditorView` — 05-05 (draft recovery) reuses this handle directly rather than inventing a second exposure mechanism.
- The placeholder-then-literal-replace pattern (Pattern 2) is proven end-to-end and ready for 05-02 to extend with drag-drop and the error banner (both explicitly deferred from this tracer).
- `plugins/image.ts` is unmodified and its existing unit test (`tests/editor/image.test.ts`) still passes — the 1-feature-1-file plugin invariant (TRD §6) holds.
- No blockers for 05-02 or 05-05.

---
*Phase: 05-editor-enhancements-personalization*
*Completed: 2026-08-08*

## Self-Check: PASSED

All 10 created/modified files verified present on disk; all 5 task commits (`4fdca51`, `ebc92ee`, `fc335d1`, `8d965d8`, `92c4b3e`) verified present in `git log --oneline --all`.
