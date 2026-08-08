---
phase: 05-editor-enhancements-personalization
plan: 08
subsystem: ui
tags: [css-grid, next-headers, rsc, cookies, lucide, native-drag-resize, vitest]

requires:
  - phase: 05-editor-enhancements-personalization
    provides: "05-02's EditorPreviewLayout (forwardRef getView handle, .grid/.editorPane/.previewPane structure) as the base this plan adds layout-mode/resize variants onto"
  - phase: 05-editor-enhancements-personalization
    provides: "05-07's RSC-cookies()-read / client-document.cookie-write persistence pattern (theme), reused verbatim for layoutMode/splitRatio"
provides:
  - "EditorPreviewLayout layoutMode prop (split/editor-only/preview-only) driving inline grid-template-columns/-areas override per mode"
  - "clampRatio(pct) pure 20-80% clamp, exported standalone and applied both to drag mousemove and the RSC-sourced initial ratio"
  - "Native mousedown(handle)/mousemove+mouseup(window) resize drag (RESEARCH Pattern 7), splitRatio cookie written once on mouseup"
  - "LayoutModeToggle 3-button segment (Columns2/PanelRightClose/PanelLeftClose) in DocumentWorkspace's title row, writes layoutMode cookie on click"
  - "d/[docId]/page.tsx (RSC) reads layoutMode/splitRatio cookies -> DocumentWorkspace initialLayoutMode/initialSplitRatio props (no-FOUC)"
affects: [05-editor-enhancements-personalization]

actuals:
  tokens: 5033
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Grid-variant-by-inline-style: .module.css keeps fixed class names (.grid/.editorPane/.previewPane), only grid-template-columns/-areas are overridden inline per layoutMode — no new CSS classes for the 3 grid shapes"
    - ":active pseudo-class (not a JS isDragging state) drives the resize handle's drag-visible accent bar — :active naturally spans mousedown-to-mouseup regardless of pointer position, which is exactly the drag gesture's lifetime"

key-files:
  created:
    - src/components/layout/LayoutModeToggle.tsx
    - src/components/layout/LayoutModeToggle.module.css
    - tests/layout/resize-clamp.test.ts
  modified:
    - src/components/layout/EditorPreviewLayout.tsx
    - src/components/layout/EditorPreviewLayout.module.css
    - src/components/document/DocumentWorkspace.tsx
    - src/components/document/DocumentWorkspace.module.css
    - src/app/(main)/w/[wsId]/d/[docId]/page.tsx

key-decisions:
  - "EditorHost's initialContent now sourced from EditorPreviewLayout's live `content` state, not the outer initialContent prop — preview-only mode unmounts EditorHost (uncontrolled/mount-once), so remounting it from the stale original prop would silently discard everything typed since first mount"
  - "gridTemplateAreas is also overridden inline alongside gridTemplateColumns for editor-only/preview-only — the .module.css's fixed 'editor preview' 2-area template would otherwise mismatch a single rendered pane and leave an empty implicit column"
  - "Resize-handle drag-visible bar uses CSS :active, not React state — avoids a dedicated isDragging useState/setState pair for a purely presentational concern"

patterns-established:
  - "layoutMode/splitRatio cookie persistence completes the 05-07-established RSC-read/client-write pattern for all 3 of this phase's personalization settings (theme, layout mode, resize ratio)"

requirements-completed: [EDIT-12]

coverage:
  - id: D1
    description: "3-button segment (split/editor-only/preview-only) in the title row switches EditorPreviewLayout's grid variant instantly and writes the layoutMode cookie"
    requirement: EDIT-12
    verification:
      - kind: other
        ref: "node -e grep gate: Columns2/PanelRightClose/PanelLeftClose + layoutMode= cookie write both present in LayoutModeToggle.tsx"
        status: pass
    human_judgment: true
    rationale: "Grep gate proves the icons and cookie-write path exist; the actual 3-way click-through (segment highlight, panel swap, toolbar disappearing in preview-only) needs a human in the running app."
  - id: D2
    description: "clampRatio(pct) pure function clamps to 20-80%, boundary + over/under cases covered by a dedicated unit test (TDD RED->GREEN)"
    requirement: EDIT-12
    verification:
      - kind: unit
        ref: "tests/layout/resize-clamp.test.ts#clampRatio (4 cases: inside range, below 20, above 80, exact boundaries)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Split-mode drag resize (native mousedown/window-mousemove/window-mouseup) updates the grid ratio live and writes the splitRatio cookie exactly once on mouseup; handle is absent from the DOM in editor-only/preview-only"
    requirement: EDIT-12
    verification:
      - kind: other
        ref: "node -e grep/tsc gate: resizeHandle only rendered when layoutMode==='split'; document.cookie write inside onUp, not onMove"
        status: pass
    human_judgment: true
    rationale: "Static checks prove the handle's conditional render and the once-per-drag cookie write are wired correctly, but the felt drag experience (cursor change, live ratio tracking, accent bar) is a human-observable interaction only verifiable in a real browser."
  - id: D4
    description: "d/[docId]/page.tsx (RSC) reads layoutMode/splitRatio cookies and passes initialLayoutMode/initialSplitRatio to DocumentWorkspace so the first server render already matches the saved state (no-FOUC); invalid/missing cookies fall back to split/50"
    requirement: EDIT-12
    verification:
      - kind: other
        ref: "node -e grep gate: cookies() call and initialLayoutMode prop both present in page.tsx"
        status: pass
    human_judgment: true
    rationale: "Grep gate proves the RSC read/fallback logic is wired; no-FOUC (no flash of the wrong layout on real reload) is a timing/visual property only observable in an actual browser reload, same category as 05-07's theme no-FOUC check."

duration: 12min
completed: 2026-08-08
status: complete
---

# Phase 5 Plan 08: Layout Modes + Split-Pane Resize Summary

**Split/editor-only/preview-only layout toggle in the title row, native mousedown/mousemove/mouseup drag resize clamped to 20-80% (no library), and RSC `cookies()` read for no-FOUC first paint — completing EDIT-12's layout axis alongside 05-07's theme axis.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-08T17:44:00+09:00
- **Completed:** 2026-08-08T17:56:00+09:00
- **Tasks:** 3
- **Files modified:** 8 (3 created, 5 modified)

## Accomplishments

- `EditorPreviewLayout` gained a `layoutMode` prop that overrides `grid-template-columns`/`grid-template-areas` inline per mode (`split` = `${ratio}% minmax(0,1fr)`, `editor-only`/`preview-only` = `1fr` with a single-area override) — the `.module.css` class names (`.grid`/`.editorPane`/`.previewPane`) never changed, only the values.
- A 6px resize handle, rendered only in split mode, drags the ratio between 20-80% via `clampRatio` (RESEARCH Pattern 7: `mousedown` on the handle starts `window` `mousemove`/`mouseup` listeners so a fast drag outrunning the 6px hit area still tracks). The `splitRatio` cookie is written exactly once, on `mouseup`. The drag-visible 2px accent bar is pure CSS `:active`/`:hover`, no extra React state.
- New `LayoutModeToggle` client component (3x 24px lucide `Columns2`/`PanelRightClose`/`PanelLeftClose` buttons) sits in `DocumentWorkspace`'s title row, right of the title `<input>` — the row was split into a flex container (`titleRow`) instead of adding a new row, matching UI-SPEC's "toggle must never disappear across modes" constraint. Click writes the `layoutMode` cookie directly (mirrors `ThemeToggle`'s pattern, no API route).
- `d/[docId]/page.tsx` now `await cookies()`s `layoutMode`/`splitRatio` and passes them as `initialLayoutMode`/`initialSplitRatio` to `DocumentWorkspace` — first HTML response already matches the saved layout (no-FOUC). An allow-list (`LAYOUT_MODES`) and a `Number.isFinite` check fall back to `split`/`50` for missing or tampered cookie values; `EditorPreviewLayout`'s own `clampRatio` re-clamps the ratio regardless (defense in depth per the plan's `T-05-08-COOKIE` threat entry).

## Task Commits

Each task was committed atomically:

1. **Task 1: EditorPreviewLayout grid variants + native resize + clampRatio** - `04af05a` (test, RED) + `13007b5` (feat, GREEN)
2. **Task 2: LayoutModeToggle + DocumentWorkspace title row** - `ae02e69` (feat)
3. **Task 3: RSC cookies() -> initialLayoutMode/initialSplitRatio** - `3defcce` (feat)

_Note: Task 1 is TDD (`tdd="true"`) — `clampRatio` test committed first and confirmed failing (`clampRatio is not a function`) before the implementation commit._

## Files Created/Modified

- `src/components/layout/EditorPreviewLayout.tsx` - `layoutMode`/`initialSplitRatio` props, `clampRatio` export, resize-drag handlers, conditional pane rendering, `EditorHost` now remounts from live `content`
- `src/components/layout/EditorPreviewLayout.module.css` - `.resizeHandle` (6px hit area, `:hover`/`:active` accent bar)
- `src/components/layout/LayoutModeToggle.tsx` - 3-button segment, `layoutMode` cookie write
- `src/components/layout/LayoutModeToggle.module.css` - 24px buttons, active/hover states, 300ms tooltip (Toolbar pattern)
- `src/components/document/DocumentWorkspace.tsx` - `titleRow` split (title input + toggle), `layoutMode`/`initialSplitRatio` state and prop wiring
- `src/components/document/DocumentWorkspace.module.css` - `.titleRow` (border/focus-within moved off `.titleInput`)
- `src/app/(main)/w/[wsId]/d/[docId]/page.tsx` - `cookies()` read + fallback, `initialLayoutMode`/`initialSplitRatio` props
- `tests/layout/resize-clamp.test.ts` - `clampRatio` 4-case boundary test

## Decisions Made

- `EditorHost`'s `initialContent` prop now reads from `EditorPreviewLayout`'s live `content` state instead of the original `initialContent` prop — necessary the moment `editorPane` (and therefore `EditorHost`) became conditionally rendered, since `EditorHost` is uncontrolled/mount-once (RESEARCH Pitfall 3) and would otherwise reset to stale content every time a user leaves and returns to `preview-only`.
- `gridTemplateAreas` is overridden inline alongside `gridTemplateColumns` for the two single-pane modes, not left to the CSS module's fixed 2-area `"editor preview"` template — a single rendered pane against a 2-area template would create an unwanted implicit empty column.
- Resize-handle's drag-visible accent bar uses CSS `:active` rather than a JS `isDragging` state — one fewer state variable, and `:active`'s native mousedown-to-mouseup lifetime matches the drag gesture exactly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] EditorHost content-loss on layout-mode round-trip through preview-only**
- **Found during:** Task 1 (while wiring conditional `editorPane` rendering for `layoutMode`)
- **Issue:** `EditorHost` mounts CodeMirror exactly once (`useEffect` with an empty dependency array, IME-safety per RESEARCH Pitfall 3) and freezes `initialContent` into a ref on that first mount. Once `editorPane` became conditionally rendered (absent in `preview-only`), leaving/re-entering `preview-only` would unmount then remount `EditorHost`, and the old code passed the plan's original `initialContent` prop (the document's value at page load) — any edits made since would be silently discarded on the remount.
- **Fix:** `EditorHost`'s `initialContent` now reads `content` (the `useState` that `handleChange`'s update listener keeps current on every keystroke) instead of the stale outer `initialContent` prop. First-mount behavior is unaffected (`content`'s initial value already equals `initialContent`).
- **Files modified:** `src/components/layout/EditorPreviewLayout.tsx`
- **Verification:** `pnpm exec tsc --noEmit` clean; full `pnpm vitest run` (915 tests) green, confirming no regression to existing `EditorHost`/`EditorPreviewLayout` coverage.
- **Committed in:** `13007b5` (Task 1 GREEN commit — this fix was required by the conditional-render change itself, not separable from it)

---

**Total deviations:** 1 auto-fixed (Rule 1 — a correctness bug introduced by this plan's own conditional-rendering requirement, caught and fixed before commit, not a pre-existing issue).
**Impact on plan:** Necessary for the plan's own acceptance criteria ("editor-only/preview-only에서는... 미렌더") to not silently corrupt user edits on mode toggling. No scope creep — fully contained within Task 1's declared file.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- EDIT-12 is now fully implemented across both axes: theme (05-07) and layout mode/resize (this plan). Both reuse the same RSC-`cookies()`-read / client-`document.cookie`-write pattern with no new API routes.
- `LayoutMode` type is exported from `EditorPreviewLayout.tsx` and consumed by `DocumentWorkspace.tsx`, `LayoutModeToggle.tsx`, and `d/[docId]/page.tsx` — any future plan needing layout-mode awareness should import this single source of truth rather than re-declaring the union.
- Manual visual/interaction verification (drag feel, cursor change, mode-toggle click-through, no-FOUC on real reload) is deferred to this project's bulk end-of-phase `/gsd-verify-work 5` pass per the 2026-08-08 user instruction already governing Phases 3/4/05-07.
- Remaining phase-5 plan: `05-05` (draft/crash-recovery `ConfirmDialog` extension) is still unexecuted — not touched by this plan.

---
*Phase: 05-editor-enhancements-personalization*
*Completed: 2026-08-08*

## Self-Check: PASSED
