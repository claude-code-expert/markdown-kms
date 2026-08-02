---
phase: 02-markdown-rendering-editor-formatting
plan: 03
subsystem: editor
tags: [unified, remark, rehype, rehype-sanitize, commonmark, gfm, codemirror, react, tracer]

# Dependency graph
requires:
  - phase: 02-markdown-rendering-editor-formatting
    provides: "02-01 RED pipeline test suite (commonmark/gfm/sanitize) + pinned deps; 02-02 RED plugin/perf test suite + test-utils.ts"
provides:
  - "Single shared markdown pipeline (lib/markdown/pipeline.ts): markdownProcessorPreSanitize (CommonMark fixture comparison), markdownProcessor (HTML-string, GFM/sanitize suites), renderMarkdown() (React tree for PreviewPane) — all forked from one parse+GFM+rehype composition"
  - "Granular GFM-3-only composition (remark-gfm-subset.ts) proven against 652 CommonMark fixtures + GFM guard tests"
  - "EditorPlugin contract (types.ts) + bold plugin (bold.ts) + registry (index.ts) — the pattern 02-04's 13 remaining plugins follow"
  - "Uncontrolled CM6 EditorHost with a live-view handle for the Toolbar"
  - "Assemblable 2-pane host (EditorPreviewLayout) wired into app/(main)/w/[wsId]/page.tsx, end-to-end verified: type -> select -> Bold -> sanitized <strong> in preview"
affects: ["02-04 (remaining 13 plugins register into plugins/index.ts)", "02-05 (60ms perf proof against this real editor+preview)", "Phase 8 presentation (shares lib/markdown/pipeline.ts)"]

actuals:
  tokens: 7100
  tasks: 3
  commits: 3

tech-stack:
  added:
    - "rehype-stringify@10.0.1 (HTML-string compiler — missing from 02-01's install list, required by the pipeline's HTML-string exports)"
    - "@types/hast@3.0.5 (dev, hast AST type declarations for the pre-sanitize text-escaping transform)"
  patterns:
    - "One shared parse+GFM+rehype base (baseProcessor()), forked into 3 processors: pre-sanitize/HTML-string (CommonMark), full/HTML-string (GFM+sanitize suites), full/React-tree (renderMarkdown, production preview)"
    - "hast text->raw node conversion to pre-escape &/</>/\" exactly per the CommonMark reference renderer, scoped ONLY to the CommonMark-comparison fork (never markdownProcessor/renderMarkdown, whose consumers need real text nodes)"
    - "commonmark-spec fixture convention: literal tab characters are encoded as U+2192 \"→\" in both markdown and html fields — decoded to \\t before parsing, re-encoded after stringify"
    - "EditorHost exposes the live EditorView via useImperativeHandle (getView()), not React state, so Toolbar clicks read the current view without triggering re-renders"
    - "PreviewPane uses processSync() (all pipeline stages are synchronous) instead of async/useEffect — one render, no extra commit cycle, better fit for the 60ms budget"

key-files:
  created:
    - src/lib/markdown/pipeline.ts
    - src/lib/markdown/remark-gfm-subset.ts
    - src/lib/markdown/schema.ts
    - src/components/editor/plugins/types.ts
    - src/components/editor/plugins/bold.ts
    - src/components/editor/plugins/index.ts
    - src/components/editor/EditorHost.tsx
    - src/components/editor/EditorHost.module.css
    - src/components/editor/Toolbar.tsx
    - src/components/editor/Toolbar.module.css
    - src/components/preview/PreviewPane.tsx
    - src/components/preview/PreviewPane.module.css
    - src/components/layout/EditorPreviewLayout.tsx
    - src/components/layout/EditorPreviewLayout.module.css
  modified:
    - package.json
    - pnpm-lock.yaml
    - src/app/globals.css
    - src/app/(main)/w/[wsId]/page.tsx
    - src/app/(main)/w/[wsId]/page.module.css

key-decisions:
  - "CLAUDE.md/TRD amendment (research conflict #2, recorded per plan's objective): lib/markdown/ composes the 3 granular micromark-extension-gfm-*/mdast-util-gfm-* packages via unified().data(), NOT the bundled remark-gfm plugin — proven by tests/spec/gfm.test.ts's footnote/autolink-literal literal-text guards"
  - "Success-Criteria-4 amendment (research conflict #1): schema.ts re-exports rehype-sanitize's defaultSchema completely unmodified — no merge was ever needed; tests/markdown/sanitize.test.ts proves del/task-checkbox/table/align already pass through"
  - "Pipeline export contract: markdownProcessorPreSanitize + markdownProcessor (both HTML-string, per 02-01's locked test contract) PLUS renderMarkdown() (React element, new — for the production PreviewPane, not test-covered directly since it's exercised through the live app)"
  - "bold.ts uses EditorSelection.cursor()/EditorSelection.range() for the changeByRange callback's `range` field, not plain {anchor, head} object literals — CM6 requires an actual SelectionRange instance (confirmed via direct API inspection); the RESEARCH Pattern 1 pseudocode's plain-object return silently produces a broken selection (from/to read back as undefined) rather than throwing, so this would have shipped as a subtle runtime bug if copied verbatim"
  - "PreviewPane's live EditorView access goes through a getView() imperative-handle method (not passing the EditorView instance as a prop), keeping EditorHost the single owner of the CM6 instance's lifecycle"

patterns-established:
  - "Toolbar/plugin dispatch: view.dispatch(plugin.run(view.state)) — identical whether triggered by a toolbar click or a keymap binding (index.ts registry)"
  - "Preview Pane Prose Contract as CSS Modules :global() selectors targeting rehype-react's plain HTML output (h1-h4/p/ul/ol/task-list/blockquote/code/pre/hr/table/a)"

requirements-completed: [EDIT-02, EDIT-06, EDIT-08]

coverage:
  - id: D1
    description: "Shared markdown pipeline: CommonMark 0.31.2 conformance (652 fixtures), GFM-3-only guard (footnote/autolink-literal excluded), and sanitize/XSS safety against the unmodified defaultSchema"
    requirement: "EDIT-08"
    verification:
      - kind: unit
        ref: "tests/spec/commonmark.test.ts (652 cases)"
        status: pass
      - kind: unit
        ref: "tests/spec/gfm.test.ts"
        status: pass
      - kind: unit
        ref: "tests/markdown/sanitize.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "bold plugin: toggle-style formatting (empty-insert, wrap, toggle-off), Korean code-unit boundary safety"
    requirement: "EDIT-02"
    verification:
      - kind: unit
        ref: "tests/editor/bold.test.ts (4 cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "End-to-end host route: type -> select -> click Bold -> sanitized <strong> in preview; empty-state copy shows/hides; Korean text survives the uncontrolled EditorHost mount without corruption"
    requirement: "EDIT-06"
    verification:
      - kind: e2e
        ref: "local Playwright script (not committed — this plan's end-of-phase human-check is deferred per config human_verify_mode=end-of-phase); confirmed PREVIEW_HAS_STRONG=true, EMPTY_STATE_VISIBLE=true/false correctly, KOREAN_TEXT round-trip clean"
        status: pass
    human_judgment: true
    rationale: "Real Korean IME composition (multi-keystroke jamo assembly) cannot be driven by CDP Input.insertText or Playwright's keyboard API — this plan's own verify block defers the authoritative human-check to end-of-phase /gsd-verify-work, per RESEARCH Assumptions Log A1/A2. The automated check above is a strong proxy (proves the uncontrolled mount doesn't corrupt already-composed text) but is not the same guarantee as a human typing with a real IME."

duration: 35min
completed: 2026-08-02
status: complete
---

# Phase 2 Plan 03: Markdown Pipeline + Bold Tracer + Editor Host Summary

**Single shared unified/remark/rehype pipeline (granular GFM-3 + unmodified rehype-sanitize defaultSchema) proven against 652 CommonMark fixtures, plus an uncontrolled CodeMirror 6 host wired end-to-end through a working bold toggle into a live sanitized preview at `/w/[wsId]`.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3
- **Files modified:** 19 (14 created, 5 modified)

## Accomplishments

- Built `lib/markdown/pipeline.ts` as the single shared markdown pipeline, exporting three processors from one `baseProcessor()` composition (parse -> granular-GFM -> remark-rehype): `markdownProcessorPreSanitize` (CommonMark fixture comparison), `markdownProcessor` (HTML-string, full pipeline for the GFM/sanitize test suites), and `renderMarkdown()` (React element tree, for the production `PreviewPane`)
- `lib/markdown/remark-gfm-subset.ts` composes only the 3 granular strikethrough/table/task-list micromark+mdast extensions — verified NOT to import the bundled `remark-gfm` plugin (which would silently re-enable footnote/autolink-literal)
- `lib/markdown/schema.ts` re-exports `rehype-sanitize`'s `defaultSchema` completely unmodified
- Turned GREEN all three RED pipeline suites from 02-01: `tests/spec/commonmark.test.ts` (652/652), `tests/spec/gfm.test.ts`, `tests/markdown/sanitize.test.ts`
- Built the `EditorPlugin` contract (`types.ts`), the `bold` plugin (`bold.ts`, pure `run(state)`), and the registry (`index.ts`) — turned `tests/editor/bold.test.ts` GREEN (4/4); the other 13 plugin test files remain RED, scoped to 02-04
- Built the uncontrolled CM6 `EditorHost` (mount-once `useEffect`, content read out via `updateListener`, live view exposed via an imperative handle)
- Built `PreviewPane`, the assemblable `EditorPreviewLayout` (2-pane CSS Grid), and `Toolbar` (bold-only for this tracer), and wired all three into `app/(main)/w/[wsId]/page.tsx` in place of the Phase 1 placeholder — `requireRole`/workspace-fetch guard left byte-identical
- End-to-end verified locally (Playwright, not committed): typing "hello", selecting it, clicking Bold produces `**hello**` in the editor and a sanitized `<strong>hello</strong>` in the preview; clearing the editor restores the empty-state copy; a Korean string round-trips through the uncontrolled mount without corruption

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the shared markdown pipeline (granular GFM + unmodified sanitize)** - `ed37776` (feat)
2. **Task 2: EditorPlugin contract + bold plugin + registry + uncontrolled EditorHost** - `0d83a1a` (feat)
3. **Task 3: PreviewPane + assemblable Layout + Toolbar(bold) + host route wire** - `f835afc` (feat)

**Plan metadata:** commit for this SUMMARY (below)

## Files Created/Modified

- `src/lib/markdown/pipeline.ts` - single shared pipeline, 3 processor exports
- `src/lib/markdown/remark-gfm-subset.ts` - granular GFM-3-only unified plugin
- `src/lib/markdown/schema.ts` - unmodified `defaultSchema` re-export
- `src/components/editor/plugins/types.ts` - `EditorPlugin` interface
- `src/components/editor/plugins/bold.ts` - toggle/wrap/empty-insert bold plugin
- `src/components/editor/plugins/index.ts` - plugin registry + keymap
- `src/components/editor/EditorHost.tsx` / `.module.css` - uncontrolled CM6 mount
- `src/components/editor/Toolbar.tsx` / `.module.css` - lucide toolbar (bold only)
- `src/components/preview/PreviewPane.tsx` / `.module.css` - sanitized preview render
- `src/components/layout/EditorPreviewLayout.tsx` / `.module.css` - assemblable 2-pane grid
- `src/app/(main)/w/[wsId]/page.tsx` - wired `EditorPreviewLayout` in place of the placeholder (guard/fetch unchanged)
- `src/app/(main)/w/[wsId]/page.module.css` - `100vh` moved here (route-level only)
- `src/app/globals.css` - added `--code-bg` token
- `package.json` / `pnpm-lock.yaml` - added `rehype-stringify`, `@types/hast`

## Decisions Made

- **CLAUDE.md/TRD deviation recorded (conflict #2):** `lib/markdown/` composes the 3 granular `micromark-extension-gfm-*`/`mdast-util-gfm-*` packages directly, never the bundled `remark-gfm` — proven by the GFM guard tests (footnote/autolink-literal render as literal text).
- **Success-Criteria-4 amendment recorded (conflict #1):** `schema.ts` re-exports `defaultSchema` completely unmodified; no schema merge exists anywhere in this plan's code.
- **Pipeline export contract:** `markdownProcessorPreSanitize` + `markdownProcessor` (both HTML-string, satisfying 02-01's locked test imports) plus a new `renderMarkdown()` (React element, for `PreviewPane`) — three exports from one shared `baseProcessor()` composition, not three independent pipelines.
- **bold.ts's `range` field must be a real `EditorSelection.cursor()`/`EditorSelection.range()` instance**, not a plain `{anchor, head}` object literal. RESEARCH Pattern 1's pseudocode returns plain objects; CM6's `changeByRange` silently accepts them without throwing but produces a broken selection (`.from`/`.to` read back as `undefined`). This was caught by the plan's own bold.test.ts (3 of 4 cases failed with `undefined` selections) before being traced to the API contract and fixed — see Deviations.
- **`PreviewPane` uses `renderMarkdown()`'s `processSync()`** rather than an async/`useEffect` pattern — every stage in this pipeline composition is synchronous, so a plain synchronous render call avoids an extra commit cycle, which is a better fit for the EDIT-06 60ms budget than the async alternative.
- **EditorHost exposes the live `EditorView` via a `getView()` imperative handle**, not by lifting the view into React state or passing it as a prop — the Toolbar reads the current view only at click-time, avoiding unnecessary re-renders on every keystroke.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `rehype-stringify` missing from the pinned dependency set**
- **Found during:** Task 1 (writing `pipeline.ts`'s HTML-string exports)
- **Issue:** 02-01's installed dependency set (RESEARCH §Standard Stack) omitted `rehype-stringify`, but `markdownProcessorPreSanitize`/`markdownProcessor` both require an HTML-string compiler to satisfy `tests/spec/commonmark.test.ts`'s `String(await processor.process(...))` contract.
- **Fix:** `pnpm add rehype-stringify` — same trusted `rehypejs` org as the already-approved `rehype-raw`/`rehype-sanitize`/`rehype-react`, no legitimacy concern.
- **Files modified:** `package.json`, `pnpm-lock.yaml`
- **Verification:** pipeline compiles; all three pipeline test files run.
- **Committed in:** `ed37776` (Task 1 commit)

**2. [Rule 1 - Bug] `hast-util-to-html`'s default text escaping doesn't match the CommonMark reference renderer**
- **Found during:** Task 1 (running `tests/spec/commonmark.test.ts` against the initial pipeline — 68/652 failures)
- **Issue:** `hast-util-to-html`'s text-node handler hardcodes escaping to only `<` and `&` (no override hook exists in this version), but the CommonMark 0.31.2 reference renderer — which `commonmark-spec`'s fixture HTML was generated against — escapes all of `&`, `<`, `>`, `"` in ordinary text. This caused byte-exact mismatches across Autolinks/Raw HTML/Emphasis/Entity-reference fixtures wherever literal `>`/`"` appeared in text content.
- **Fix:** Added a small hast transform (`commonmarkTextEscape`, scoped ONLY to `markdownProcessorPreSanitize`'s fork) that converts `text` nodes to `raw` nodes with the 4 characters pre-escaped, exploiting `hast-util-to-html`'s existing `allowDangerousHtml` verbatim-passthrough for `raw` nodes. Also fixed two adjacent formatting gaps in the same fork: `closeSelfClosing: true` (`<hr />` not `<hr>`) and `characterReferences: { useNamedReferences: true }` (`&quot;`/`&amp;` not `&#x22;`/`&#x26;` in attributes) — both matching the CommonMark reference renderer's output format. This fix is scoped exclusively to the pre-sanitize/CommonMark-comparison fork; `markdownProcessor` and `renderMarkdown` (production preview/sanitize consumers) are untouched, since pre-escaping their real text nodes would render literal `&gt;`-style strings on screen.
- **Files modified:** `src/lib/markdown/pipeline.ts`
- **Verification:** `tests/spec/commonmark.test.ts` 652/652 GREEN.
- **Committed in:** `ed37776` (Task 1 commit)

**3. [Rule 1 - Bug] `hast-util-to-html` omits the trailing newline after the last root-level block**
- **Found during:** Task 1 (same initial test run)
- **Issue:** `hast-util-to-html` inserts `\n` BETWEEN sibling block elements but not after the final one, while 651/652 non-empty `commonmark-spec` fixtures end with `\n` (the one exception has empty expected HTML).
- **Fix:** `markdownProcessorPreSanitize` is a thin wrapper appending a trailing `\n` to the compiled string when non-empty and not already newline-terminated. Scoped to this fork only.
- **Files modified:** `src/lib/markdown/pipeline.ts`
- **Verification:** part of the same 652/652 GREEN run.
- **Committed in:** `ed37776` (Task 1 commit)

**4. [Rule 1 - Bug] `commonmark-spec`'s own fixture format encodes literal tabs as "→" (U+2192), not `\t`**
- **Found during:** Task 1 (same initial test run — 12 residual failures, all in "Tabs"/tab-adjacent sections)
- **Issue:** Both the `markdown` and `html` fields of `commonmark-spec@0.31.2`'s fixtures represent every literal tab character with the Unicode arrow glyph U+2192 rather than a real U+0009 tab (verified via `codePointAt`). Feeding "→" directly into the parser as a literal non-whitespace character breaks CommonMark's tab-stop/indentation rules (e.g. an indented code block wouldn't be recognized at all).
- **Fix:** `markdownProcessorPreSanitize` decodes "→" -> `\t` on the input before parsing (restoring correct indentation semantics), then re-encodes any literal `\t` surviving into the rendered output back to "→" (matching the fixture's own display convention) before the trailing-newline normalization.
- **Files modified:** `src/lib/markdown/pipeline.ts`
- **Verification:** `tests/spec/commonmark.test.ts` 652/652 GREEN (final state).
- **Committed in:** `ed37776` (Task 1 commit)

**5. [Rule 1 - Bug] `bold.ts`'s `changeByRange` callback returned plain `{anchor, head}` objects instead of real `SelectionRange` instances**
- **Found during:** Task 2 (running `tests/editor/bold.test.ts` — 3/4 cases failed with `selection: {from: undefined, to: undefined}`)
- **Issue:** RESEARCH Pattern 1's example code returns plain object literals (`{anchor: from + MARK.length}`) for the `range` field of a `changeByRange` callback result. CM6's `EditorState.changeByRange` does not coerce these into real `SelectionRange` instances — it silently stores the plain object as-is, so `tr.state.selection.main.from`/`.to` read back as `undefined` instead of throwing.
- **Fix:** Constructed real `EditorSelection.cursor(pos)` (empty-selection case) and `EditorSelection.range(anchor, head)` (wrap case) instances instead of plain objects. The toggle-off branch already used `range.map(state.changes(changes))`, which returns a real `SelectionRange` and needed no change.
- **Files modified:** `src/components/editor/plugins/bold.ts`
- **Verification:** `tests/editor/bold.test.ts` 4/4 GREEN.
- **Committed in:** `0d83a1a` (Task 2 commit)

**6. [Rule 3 - Blocking] This worktree had no `node_modules` at all**
- **Found during:** Task 1 setup (before writing any pipeline code)
- **Issue:** The worktree checkout has no installed dependencies (only committed files transfer to a fresh worktree).
- **Fix:** Ran `pnpm install`.
- **Files modified:** None (install only; no lockfile changes from this step alone).
- **Verification:** `node_modules/` populated; subsequent `pnpm exec tsc`/`vitest` commands resolved packages correctly.
- **Committed in:** N/A (no file change)

**7. [Rule 3 - Blocking] `hast` npm package is a deprecated stub, not the type declarations**
- **Found during:** Task 1 (typecheck after adding `import type {Root, Nodes} from "hast"`)
- **Issue:** Initially installed the `hast` package for types, but it is a deprecated 1.0.0 stub ("Renamed to rehype") with no type exports. The actual hast AST types ship as `@types/hast`.
- **Fix:** Removed `hast`, installed `@types/hast` instead.
- **Files modified:** `package.json`, `pnpm-lock.yaml`
- **Verification:** `pnpm exec tsc --noEmit` clean (apart from the expected RED 02-04 plugin test imports).
- **Committed in:** `ed37776` (Task 1 commit)

**8. [Rule 3 - Blocking] `AUTH_SECRET` missing when starting the dev server for end-to-end verification**
- **Found during:** Task 3 verification (local `pnpm dev` run)
- **Issue:** No `.env.local` exists in this worktree (same gap 02-01/02-02 flagged for `DATABASE_URL_TEST`); the dev server needs `DATABASE_URL` and Auth.js needs `AUTH_SECRET`, neither of which could be read/written directly (`.env*` paths are permission-denied).
- **Fix:** Supplied both inline as env vars to the `pnpm dev` invocation used only for this plan's own local verification; no `.env*` file was read or written.
- **Files modified:** None
- **Verification:** Dev server started, signup/login/dashboard/workspace-creation flows all worked against `localhost:5433/markdown_kms`.
- **Committed in:** N/A (verification-only, no file change)

---

**Total deviations:** 8 auto-fixed (1 blocking dependency install, 4 pipeline-format bugs, 1 plugin API bug, 1 tooling/types correction, 1 local dev-server env gap)
**Impact on plan:** All auto-fixes were necessary to make the plan's own locked test contracts (02-01/02-02) pass byte-exact/functionally, or to unblock local execution in an otherwise-empty worktree. No scope creep — no production logic outside the plan's declared files was touched. Deviation #5 (bold.ts SelectionRange) is the one correction to RESEARCH's own example code; it's called out explicitly since 02-04's 13 remaining plugins should use `EditorSelection.cursor()`/`EditorSelection.range()` from the start rather than repeating the same silent-`undefined`-selection bug.

## Issues Encountered

- WorkspaceCard on the dashboard has no click/navigation affordance to `/w/[id]` (pre-existing Phase 1 gap, confirmed while building the local end-to-end verification script). Out of this plan's scope — the create-workspace flow (which does redirect to `/w/[id]`) was used instead for verification. Flagged here for awareness, not fixed (not a file this plan touches).

## Next Phase Readiness

- 02-04 can register its 13 remaining plugins into `components/editor/plugins/index.ts`'s `plugins` array using the exact same contract `bold.ts` establishes — and MUST use `EditorSelection.cursor()`/`EditorSelection.range()` for the `range` field, not plain object literals (see Deviation #5).
- 02-05 runs `e2e/preview-perf.spec.ts` against this real `EditorHost`/`PreviewPane` pair to prove the EDIT-06 60ms p95 budget; `PreviewPane` already uses a synchronous `processSync()` render path with no memoization, matching the "measure first" constraint.
- The end-to-end human-check (type + Bold -> `<strong>`; empty-state copy; Korean IME) is deferred to end-of-phase `/gsd-verify-work` per `human_verify_mode: end-of-phase`. This plan's own local Playwright verification (not committed) passed all four checks as a strong automated proxy, but real multi-keystroke IME composition still needs a human with an actual Korean input method.
- This worktree still has no `.env.local`/`.env` — any future `pnpm dev`/`pnpm vitest` invocation needs `DATABASE_URL`/`DATABASE_URL_TEST`/`AUTH_SECRET` supplied inline (or the file restored) until a shared fix lands.

---
*Phase: 02-markdown-rendering-editor-formatting*
*Completed: 2026-08-02*

## Self-Check: PASSED

All 14 created source files + this SUMMARY verified present on disk; all 3 task commit hashes (`ed37776`, `0d83a1a`, `f835afc`) verified present in git log.
