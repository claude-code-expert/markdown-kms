---
phase: 02-markdown-rendering-editor-formatting
plan: 04
subsystem: editor
tags: [codemirror, react, lucide, plugins, toolbar]

# Dependency graph
requires:
  - phase: 02-markdown-rendering-editor-formatting
    provides: "02-03 tracer: EditorPlugin contract (types.ts), bold.ts pattern (EditorSelection.cursor()/range() shape), registry (index.ts), Toolbar.tsx skeleton, live EditorView via EditorHost"
provides:
  - "13 remaining pure run(state) formatting plugins: heading (level factory), italic/strikethrough/inline-code (toggle-wrap), bullet-list/ordered-list/task-list (line-prefix), blockquote/code-block/hr (block insert), link/image/table (skeleton insert)"
  - "Full 14-plugin registry (plugins/index.ts): 13 flat toolbar buttons in UI-SPEC order + heading exported separately as a level factory for the dropdown"
  - "HeadingDropdown.tsx/.module.css: ui-kit dropdown pattern ported to React state, 5 heading levels"
  - "Expanded Toolbar.tsx/.module.css: heading dropdown + 4 flat groups (inline/list/block/insert) with 1px dividers"
affects: ["02-05 (end-of-phase 60ms perf proof + human-check exercises the full toolbar)", "Phase 4 (3-pane host reuses this Toolbar/EditorHost pair unchanged)"]

actuals:
  tokens: 8852
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Line-prefix plugins (heading/bullet-list/ordered-list/task-list/blockquote) share one shape: collect the selected EditorState.Line[] via state.doc.lineAt(range.from/to), decide allOwn/allSameLevel by testing each line's own-marker regex, then map lines to per-line changes; toggle off when every line already carries the plugin's own marker, else strip any recognized list/heading prefix and apply the new one (replace, never nest)"
    - "Toggle-wrap plugins (italic/strikethrough/inline-code) mirror bold.ts exactly: changeByRange with EditorSelection.cursor()/range() instances for empty-insert / wrap / toggle-off, per the 02-03 SelectionRange-instance fix"
    - "Insert (skeleton, no-dialog) plugins (link/image/table) always changeByRange-replace the current selection with literal markdown text and re-select the next editable placeholder — never open a dialog (D-P2-09)"
    - "heading is a level factory (heading(level): EditorPlugin), not a flat plugin object — plugins/index.ts exports it separately from the plugins array; HeadingDropdown imports it directly to render its 5 levels"

key-files:
  created:
    - src/components/editor/plugins/heading.ts
    - src/components/editor/plugins/italic.ts
    - src/components/editor/plugins/strikethrough.ts
    - src/components/editor/plugins/inline-code.ts
    - src/components/editor/plugins/bullet-list.ts
    - src/components/editor/plugins/ordered-list.ts
    - src/components/editor/plugins/task-list.ts
    - src/components/editor/plugins/blockquote.ts
    - src/components/editor/plugins/code-block.ts
    - src/components/editor/plugins/hr.ts
    - src/components/editor/plugins/link.ts
    - src/components/editor/plugins/image.ts
    - src/components/editor/plugins/table.ts
    - src/components/editor/HeadingDropdown.tsx
    - src/components/editor/HeadingDropdown.module.css
  modified:
    - src/components/editor/plugins/index.ts
    - src/components/editor/Toolbar.tsx
    - src/components/editor/Toolbar.module.css

key-decisions:
  - "heading(level) exported separately from the flat `plugins` array in index.ts (not folded into it) — it's a level factory with 5 possible instances (1-4 + paragraph), not a single toolbar button; HeadingDropdown.tsx imports the factory directly and instantiates all 5 levels itself"
  - "italic's toggle-off guard: a lone '*' immediately outside the selection toggles off; a '*' that is itself the second star of a '**' pair does NOT toggle off — it wraps instead, nesting italic inside bold ('**x**' selecting x -> '***x***'). Detected by checking one character further out on each side."
  - "Line-prefix plugins (bullet/ordered/task/blockquote) share a small combined 'any recognized list prefix' regex so applying one list type to a line already carrying a different type's prefix REPLACES it rather than nesting two prefixes — matches the plan's action text even though no fixture exercises the cross-type case directly"
  - "code-block fence-length escalation: computed from the longest run of consecutive backticks already present in the wrapped selection (max(3, longestRun + 1)), so an inner ``` run can never prematurely close the block"
  - "table.ts inserts a leading blank-line separator only when the cursor is not at document position 0 — this is what keeps a second insertion from being read by GFM as extra rows of a preceding table, per the pinned two-insertions fixture"
  - "Toolbar group boundaries are hardcoded as GROUP_SIZES = [4, 3, 3, 3] slicing the already-UI-SPEC-ordered `plugins` array, rather than adding a `group` field to the EditorPlugin interface — types.ts isn't in this plan's files_modified list, and a fixed slice is the smallest correct implementation for a group order that is itself fixed"

patterns-established:
  - "Combined list-prefix regex `/^(?:- \\[ \\] |- |\\d+\\. |> )/` (longest/most-specific alternative first) used across bullet-list/ordered-list/task-list/blockquote to strip any list-family prefix before applying the plugin's own"

requirements-completed: [EDIT-01, EDIT-02, EDIT-03, EDIT-04, EDIT-05]

coverage:
  - id: D1
    description: "heading + italic/strikethrough/inline-code: heading level-replace/toggle/multi-line contract, and the three inline toggle-wrap plugins including italic's bold-pair nesting guard"
    requirement: "EDIT-01, EDIT-02"
    verification:
      - kind: unit
        ref: "tests/editor/heading.test.ts (5 cases)"
        status: pass
      - kind: unit
        ref: "tests/editor/italic.test.ts (4 cases)"
        status: pass
      - kind: unit
        ref: "tests/editor/strikethrough.test.ts (3 cases)"
        status: pass
      - kind: unit
        ref: "tests/editor/inline-code.test.ts (3 cases)"
        status: pass
    human_judgment: false
  - id: D2
    description: "bullet/ordered/task lists + blockquote + code-block + hr: line-prefix per-line toggle/replace, ordered-list 1..N numbering, empty-language fence with escalation, thematic break insert"
    requirement: "EDIT-03, EDIT-04"
    verification:
      - kind: unit
        ref: "tests/editor/bullet-list.test.ts (4 cases)"
        status: pass
      - kind: unit
        ref: "tests/editor/ordered-list.test.ts (3 cases)"
        status: pass
      - kind: unit
        ref: "tests/editor/task-list.test.ts (2 cases)"
        status: pass
      - kind: unit
        ref: "tests/editor/blockquote.test.ts (3 cases)"
        status: pass
      - kind: unit
        ref: "tests/editor/code-block.test.ts (3 cases)"
        status: pass
      - kind: unit
        ref: "tests/editor/hr.test.ts (1 case)"
        status: pass
    human_judgment: false
  - id: D3
    description: "link/image/table skeleton inserts (D-P2-09, no dialog) + full 14-plugin registry + expanded Toolbar with heading dropdown"
    requirement: "EDIT-05"
    verification:
      - kind: unit
        ref: "tests/editor/link.test.ts (2 cases)"
        status: pass
      - kind: unit
        ref: "tests/editor/image.test.ts (2 cases)"
        status: pass
      - kind: unit
        ref: "tests/editor/table.test.ts (2 cases)"
        status: pass
      - kind: other
        ref: "pnpm build && pnpm exec tsc --noEmit"
        status: pass
    human_judgment: false
  - id: D4
    description: "Toolbar visually renders all 5 groups + heading dropdown, wired to the live EditorView — manual click-through walkthrough"
    verification: []
    human_judgment: true
    rationale: "Visual toolbar layout (group dividers, heading dropdown open/close, hover tooltips) and click-to-format-in-preview wiring are folded into the end-of-phase human-check per 02-05's human_verify_mode=end-of-phase — this plan's own scope is the 41/41 unit-test-proven plugin logic plus the build/typecheck proof that the Toolbar compiles and renders the expected structure."

duration: 55min
completed: 2026-08-02
status: complete
---

# Phase 2 Plan 04: Full Formatting Surface (13 Plugins + Registry + Toolbar) Summary

**All 13 remaining CodeMirror formatting plugins (heading through table) implemented and registered alongside the 02-03 tracer's bold, with the Toolbar expanded to 5 groups plus a ported heading dropdown — every EDIT-01..05 format is now reachable via toolbar click or by typing markdown.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3
- **Files modified:** 20 (15 created, 3 modified — plus 2 more created in Task 1/2 batches already counted)

## Accomplishments

- Implemented `heading.ts` as a level-factory line-prefix REPLACE plugin: same-level re-application toggles to paragraph, a different level replaces the prefix (no nesting), multi-line selections re-prefix each line
- Implemented `italic.ts`, `strikethrough.ts`, `inline-code.ts` mirroring the 02-03 tracer's `bold.ts` toggle-wrap shape exactly (including the `EditorSelection.cursor()`/`range()` instance fix); `italic.ts` adds a guard so selecting text inside a `**bold**` pair nests emphasis (`***x***`) instead of misfiring a toggle-off
- Implemented `bullet-list.ts`, `ordered-list.ts`, `task-list.ts`, `blockquote.ts` as line-prefix plugins sharing a combined "any list-family prefix" regex, so applying one list type to a line already wearing a different type's prefix replaces rather than nests it; `ordered-list.ts` renumbers 1..N across contiguous selected lines
- Implemented `code-block.ts` per D-P2-10: empty-language fence with the caret placed on the language line, and fence-length escalation (`max(3, longestBacktickRun + 1)`) so a selection containing its own triple-backtick run can't prematurely close the fence — no highlighting library added
- Implemented `hr.ts` (thematic-break line insert), `link.ts`/`image.ts` (skeleton insert, label-then-url selection handoff, no dialog), `table.ts` (2-column GFM skeleton with a blank-line separator on non-zero-offset inserts so two tables never merge)
- Expanded `plugins/index.ts` into the full 14-plugin registry: 13 flat buttons in UI-SPEC toolbar order (bold/italic/strikethrough/inline-code → bullet/ordered/task → blockquote/code-block/hr → link/image/table), plus `heading` re-exported as its own level factory
- Built `HeadingDropdown.tsx`/`.module.css` porting the `docs/ui-kit.html` dropdown-trigger/menu pattern to React state (5 items: 제목1-4 + 본문)
- Expanded `Toolbar.tsx`/`.module.css` to render the heading dropdown plus all 4 remaining groups with 1px dividers, still exactly default/hover button states (no pressed animation, no 300ms tooltip delay — Phase 5)
- Turned GREEN all 10 remaining plugin test files from 02-02 (37 new test cases across heading/italic/strikethrough/inline-code/bullet-list/ordered-list/task-list/blockquote/code-block/hr/link/image/table); full `tests/editor` suite is now 14 files / 41 tests, all passing
- `pnpm build` and `pnpm exec tsc --noEmit` both clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Heading + inline plugins (heading, italic, strikethrough, inline-code)** - `bd02aa4` (feat)
2. **Task 2: List + block plugins (bullet, ordered, task, blockquote, code-block, hr)** - `18be88c` (feat)
3. **Task 3: Insert plugins (link, image, table) + full registry + expanded Toolbar** - `b1bf3fc` (feat)

**Plan metadata:** commit for this SUMMARY (below)

## Files Created/Modified

- `src/components/editor/plugins/heading.ts` - level-factory line-prefix REPLACE plugin (1-4 + paragraph)
- `src/components/editor/plugins/italic.ts` - single `*` toggle-wrap with bold-pair nesting guard
- `src/components/editor/plugins/strikethrough.ts` - `~~` toggle-wrap
- `src/components/editor/plugins/inline-code.ts` - `` ` `` toggle-wrap
- `src/components/editor/plugins/bullet-list.ts` - `- ` line-prefix toggle/replace
- `src/components/editor/plugins/ordered-list.ts` - `N. ` line-prefix, 1..N numbering
- `src/components/editor/plugins/task-list.ts` - `- [ ] ` line-prefix toggle/replace
- `src/components/editor/plugins/blockquote.ts` - `> ` line-prefix toggle/replace
- `src/components/editor/plugins/code-block.ts` - empty-language fence with escalation, no highlighting
- `src/components/editor/plugins/hr.ts` - `---` thematic-break insert
- `src/components/editor/plugins/link.ts` - `[텍스트](url)` skeleton insert
- `src/components/editor/plugins/image.ts` - `![alt](url)` skeleton insert
- `src/components/editor/plugins/table.ts` - 2-col GFM skeleton, non-merging re-insert
- `src/components/editor/plugins/index.ts` - full 14-plugin registry (13 flat + heading factory)
- `src/components/editor/HeadingDropdown.tsx` / `.module.css` - ported ui-kit dropdown, 5 heading levels
- `src/components/editor/Toolbar.tsx` / `.module.css` - all 5 groups + dividers + heading dropdown

## Decisions Made

- **heading is a factory, not a flat registry entry:** `plugins/index.ts` exports `heading` separately from the flat `plugins` array since it needs a level parameter; `HeadingDropdown.tsx` imports the factory directly to build its 5 menu items.
- **italic's nesting guard:** toggle-off only fires when the neighboring `*` is a lone marker (not the second star of a `**` pair) on BOTH sides — otherwise the plugin wraps, nesting italic inside bold rather than misinterpreting a bold pair as an italic pair.
- **List-family prefix replacement:** bullet/ordered/task/blockquote share one combined regex (`/^(?:- \[ \] |- |\d+\. |> )/`, most-specific alternative first) so switching list types on an already-prefixed line replaces the prefix instead of nesting two.
- **code-block fence escalation:** fence length is `max(3, longestBacktickRunInSelection + 1)`, computed fresh per invocation — guarantees inner backticks can never close the block early.
- **table.ts separator rule:** a leading `\n\n` is inserted only when the cursor is not at document position 0 (i.e., there is existing content before it) — this is what the pinned two-insertions fixture requires to keep tables independent.
- **Toolbar grouping via a fixed size array** (`GROUP_SIZES = [4, 3, 3, 3]`) slicing the already-ordered `plugins` array, rather than adding a `group` field to `EditorPlugin` — `types.ts` is outside this plan's declared file list, and the group order itself is fixed by the UI-SPEC, so a hardcoded slice is the smallest correct implementation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] This worktree had no `node_modules` at all**
- **Found during:** Task 1 setup (before running any test)
- **Issue:** Fresh worktree checkout has no installed dependencies (matches the same gap 02-03 hit and fixed).
- **Fix:** Ran `pnpm install`. No `package.json`/`pnpm-lock.yaml` diff resulted (dependency set was already fully pinned from 02-03).
- **Files modified:** None (install only).
- **Verification:** `pnpm vitest run tests/editor` resolved and ran correctly afterward.
- **Committed in:** N/A (no file change)

---

**Total deviations:** 1 auto-fixed (blocking dependency install, no lockfile change)
**Impact on plan:** No scope creep — no production logic outside the plan's declared files was touched.

## Issues Encountered

None beyond the dependency-install gap above, which is a known per-worktree condition (not a code issue).

## Known Limitations (not stubs — tested contract is complete)

- `heading.ts` does not detect whether a selected line sits inside an open code fence (RESEARCH Common Pitfalls #5 flagged this as an open question). None of the pinned `heading.test.ts` fixtures exercise a fenced-code scenario, so this plan implements the tested contract only; applying a heading format to a line inside an open ``` fence could incorrectly ATX-prefix it. Flagged for the end-of-phase human-check / a future phase if it proves to matter in practice — not a blocker for EDIT-01 as specified.

## Next Phase Readiness

- All 14 formatting plugins (bold + this plan's 13) pass their unit contracts; every EDIT-01..05 capability is reachable via the toolbar or by typing raw markdown syntax directly in the editor.
- 02-05 can run its 60ms perf proof and the deferred end-of-phase human-check (visual toolbar walkthrough: heading dropdown open/close, all 14 tooltips, click-to-format round-tripping into the sanitized preview) against this now-complete surface.
- The heading/code-fence interaction noted above is the one open item worth a human glance during 02-05's manual pass, though it does not block any EDIT-01..05 requirement as tested.

---
*Phase: 02-markdown-rendering-editor-formatting*
*Completed: 2026-08-02*

## Self-Check: PASSED

All 18 created/modified source files + this SUMMARY verified present on disk; all 3 task commit hashes (`bd02aa4`, `18be88c`, `b1bf3fc`) verified present in git log.
