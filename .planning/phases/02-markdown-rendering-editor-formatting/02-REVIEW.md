---
phase: 02-markdown-rendering-editor-formatting
reviewed: 2026-08-02T00:00:00Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - src/lib/markdown/pipeline.ts
  - src/lib/markdown/remark-gfm-subset.ts
  - src/lib/markdown/schema.ts
  - src/components/preview/PreviewPane.tsx
  - src/components/preview/PreviewPane.module.css
  - src/components/editor/EditorHost.tsx
  - src/components/editor/EditorHost.module.css
  - src/components/editor/Toolbar.tsx
  - src/components/editor/Toolbar.module.css
  - src/components/editor/HeadingDropdown.tsx
  - src/components/editor/HeadingDropdown.module.css
  - src/components/editor/plugins/types.ts
  - src/components/editor/plugins/index.ts
  - src/components/editor/plugins/bold.ts
  - src/components/editor/plugins/italic.ts
  - src/components/editor/plugins/strikethrough.ts
  - src/components/editor/plugins/inline-code.ts
  - src/components/editor/plugins/heading.ts
  - src/components/editor/plugins/bullet-list.ts
  - src/components/editor/plugins/ordered-list.ts
  - src/components/editor/plugins/task-list.ts
  - src/components/editor/plugins/blockquote.ts
  - src/components/editor/plugins/code-block.ts
  - src/components/editor/plugins/hr.ts
  - src/components/editor/plugins/link.ts
  - src/components/editor/plugins/image.ts
  - src/components/editor/plugins/table.ts
  - src/components/layout/EditorPreviewLayout.tsx
  - src/components/layout/EditorPreviewLayout.module.css
  - src/app/(main)/w/[wsId]/page.tsx
  - src/app/(main)/w/[wsId]/page.module.css
  - e2e/preview-perf.spec.ts
  - e2e/playwright.perf.config.ts
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-08-02T00:00:00Z
**Depth:** standard
**Files Reviewed:** 27 (+ 2 e2e files read for context)
**Status:** issues_found

## Summary

The markdown pipeline and sanitize schema are sound: I ran the pipeline directly against
`javascript:` links, `onerror=` attributes, `<script>`, footnote syntax, and autolink-literal
input, and confirmed the top-priority invariants hold — `rehype-sanitize`'s **unmodified**
`defaultSchema` strips all of it, `remark-gfm` (the bundled 5-feature plugin) is never
imported, and only strikethrough/table/task-list parse. Plugin isolation also holds: no
plugin file imports another plugin file (only the non-plugin `index.ts` registry does), and
none touch `EditorView`/DOM.

The defects are concentrated in the three "block-insert" toolbar plugins (`hr`, `code-block`,
`table`) that splice fence/divider/table markup mid-document without accounting for content
after the cursor on the same line. Two of these are reproducible, verified data-loss/data-
corruption bugs, confirmed by actually running the shared pipeline against the exact strings
those plugins produce (not just static reading) — see the Critical section for the commands
and outputs. A third (`heading`) has an untested asymmetry versus its sibling line-prefix
plugins. None of these are covered by the existing plugin test suite, which only exercises
end-of-document / single-line insertion positions.

## Critical Issues

### CR-01: Table plugin silently deletes trailing document content

**File:** `src/components/editor/plugins/table.ts:14-24`
**Issue:** `run()` only ever prepends a `"\n\n"` separator before the skeleton when
`from !== 0`; it never inserts anything *after* the skeleton to separate it from whatever
content follows the cursor. Any user text sitting after the insertion point gets glued
directly onto the last table row (`...| 내용 | 내용 |hello`), and GFM table parsing
silently discards everything after the last cell delimiter on that line. Verified by running
the plugin's exact insertion algorithm through the production pipeline
(`markdownProcessor.process`):

```
input doc (from=0, non-empty doc "hello"):
  "| 제목1 | 제목2 |\n| --- | --- |\n| 내용 | 내용 |hello"
output:
  <table>...<tr><td>내용</td><td>내용</td></tr></tbody></table>
```

`hello` vanishes entirely — no error, no warning, permanent content loss for anything
sharing a line with the insertion point (including inserting at any position that isn't the
literal end of the document, since the separator is only ever added *before* the skeleton,
never after it).

**Fix:** Always insert a trailing separator between the skeleton and any content that
remains after `to`, e.g.:
```ts
function run(state: EditorState): TransactionSpec {
  return state.changeByRange((range) => {
    const { from, to } = range;
    const atLineStart = state.doc.lineAt(from).from === from;
    const atLineEnd = to === state.doc.lineAt(to).to;
    const before = atLineStart ? "" : "\n\n";
    const after = atLineEnd ? "" : "\n\n";
    const insert = `${before}${SKELETON}${after}`;
    return {
      changes: { from, to, insert },
      range: EditorSelection.cursor(from + before.length + SKELETON.length),
    };
  });
}
```
Add a regression test that inserts a table with non-empty trailing content on the same line
and asserts that content survives in the resulting doc string.

---

### CR-02: HR plugin turns the preceding line into a heading instead of inserting a divider

**File:** `src/components/editor/plugins/hr.ts:10-20`
**Issue:** `INSERT = "\n---\n"` is spliced in with only a single leading newline. When the
cursor sits at the end of a non-blank text line (the plugin's own pinned test fixture:
`doc: "x"`, cursor at `from: 1`), the result `"x\n---\n"` is not a thematic break in
CommonMark — `text\n---` immediately following non-blank content is the Setext H2 heading
syntax. Verified against the production pipeline:

```
input:  "x\n---\n"   (exactly what hr.run produces for doc "x", cursor at end)
output: "<h2>x</h2>"
```

The plugin's entire purpose (EDIT-04, "inserts a thematic break") is inverted in its most
common usage — clicking the HR button after typing a line of text silently converts that
line into a heading, with no visible `<hr>` at all. This is the primary path through the
plugin (its own committed unit test exercises exactly this scenario and only asserts the
raw doc string, never the rendered output, so the regression was never caught).

**Fix:** A thematic break needs a blank line before (and after) it whenever adjacent content
isn't already blank, per CommonMark:
```ts
function run(state: EditorState): TransactionSpec {
  return state.changeByRange((range) => {
    const { from, to } = range;
    const line = state.doc.lineAt(from);
    const needsLeadingBlank = line.text.slice(0, from - line.from).trim().length > 0;
    const insert = `${needsLeadingBlank ? "\n\n" : "\n"}---\n`;
    return {
      changes: { from, to, insert },
      range: EditorSelection.cursor(from + insert.length),
    };
  });
}
```
Add a regression test asserting `hr.run` on `"x"` at `from:1` renders as `<hr>`, not
`<h2>`, through the shared pipeline (or at minimum asserts the doc string contains a blank
line before `---`).

## Warnings

### WR-01: Code-block plugin produces an unclosed fence when wrapping a selection with trailing same-line content

**File:** `src/components/editor/plugins/code-block.ts:22-41`
**Issue:** When wrapping a non-empty selection, the closing fence is appended directly
before whatever follows the selection on that line, e.g. doc `"x hello"` selecting `"x"`
(from 0 to 1) produces `"```\nx\n``` hello"`. A closing fence line in CommonMark may only
contain the fence characters (plus optional leading whitespace) — trailing text after the
fence means the fence line is **not** recognized as a closer, so the code block never
closes and swallows the rest of the document into a single `<pre><code>` block. Verified:

```
input:  "```\nx\n``` hello"
output: "<pre><code>x\n``` hello\n</code></pre>"
```

No characters are deleted, but everything after that point renders as literal code-block
content until (if ever) a genuine closing fence line is found later in the document —
effectively hiding arbitrary amounts of subsequent content from the rendered preview.

**Fix:** Same shape as CR-01/CR-02 — check whether `to` sits at end-of-line; if not, add a
newline (and, symmetrically, check `from`) so the fence delimiters always land on their own
line:
```ts
const atLineEnd = to === state.doc.lineAt(to).to;
const closer = atLineEnd ? `\n${fence}` : `\n${fence}\n`;
```

### WR-02: Heading plugin doesn't strip conflicting list/blockquote prefixes (asymmetric with sibling plugins)

**File:** `src/components/editor/plugins/heading.ts:38-64`
**Issue:** `bullet-list.ts`, `ordered-list.ts`, `task-list.ts`, and `blockquote.ts` all
share `ANY_LIST_PREFIX_RE` so that applying any one of them to a line already carrying a
*different* prefix (bullet/ordered/task/blockquote) replaces it instead of nesting
(documented in each file's header comment). `heading.ts`'s `ATX_RE` only recognizes
existing heading markers (`#{1,4} `), so applying a heading to an existing list line does
not strip the list marker — it just prepends the heading marker in front of it. Verified:

```
input:  "# - item"   (what heading(1).run produces on doc "- item")
output: "<h1>- item</h1>"
```

The list marker survives as literal heading text instead of being replaced, which is
inconsistent with the conflict-resolution contract every other block-prefix plugin
implements, and produces a malformed/confusing result with no test coverage.

**Fix:** Reuse (or share) the same `ANY_LIST_PREFIX_RE` to compute `stripLen` when the line
isn't already an ATX heading:
```ts
const stripLen = match ? match[0].length : (ANY_LIST_PREFIX_RE.exec(line.text)?.[0].length ?? 0);
```

### WR-03: HR plugin destroys selected text with no wrap/preserve behavior

**File:** `src/components/editor/plugins/hr.ts:12-20`
**Issue:** For a non-empty selection, `run()` unconditionally replaces `{from, to}` with
`INSERT`, discarding the selected text entirely (no wrap, no re-insertion elsewhere). Every
sibling insert-type plugin (`link`, `image`) preserves selected text as the label; `hr` has
no such preservation and no test exercises the non-empty-selection path, so this is an
unverified/undocumented data-loss path: select any text and click the HR toolbar button, and
that text is silently gone.
**Fix:** At minimum, insert the divider at `to` (after the selection) rather than replacing
`[from, to]`, or explicitly document + test that this is intended replace-not-wrap behavior.

### WR-04: `PreviewPane`'s catch block swallows all render exceptions silently

**File:** `src/components/preview/PreviewPane.tsx:23-38`
**Issue:** Any exception thrown by `renderMarkdown` (not just the documented "pipeline
exception" case) is caught and replaced with a generic error state, with nothing logged
anywhere. This is fine for user-facing behavior, but it means a real pipeline regression
(e.g. a future rehype-react incompatibility) would only ever manifest to a developer as
"미리보기를 표시할 수 없어요" in the UI, with no stack trace, console entry, or telemetry hook to
diagnose it.
**Fix:** At minimum, `console.error` (or route through whatever logging exists) in the
catch block before rendering the fallback UI.

## Info

### IN-01: `ANY_LIST_PREFIX_RE` duplicated verbatim across 4 plugin files

**File:** `src/components/editor/plugins/bullet-list.ts:12`, `ordered-list.ts:12`,
`task-list.ts:12`, `blockquote.ts:11`
**Issue:** The identical regex `/^(?:- \[ \] |- |\d+\. |> )/` is copy-pasted into four
separate files. This doesn't violate the "no plugin imports another plugin" invariant
(a shared constant could live in a non-plugin utility module), but if a new list-type
marker is ever added, all four copies must be updated in lockstep or they silently drift
out of sync.
**Fix:** Extract to a shared non-plugin module, e.g. `src/components/editor/plugins/shared-patterns.ts` (not itself a plugin, so importing it from each plugin file doesn't violate the 1-feature-1-file/no-cross-plugin-import rule), and import the constant from there.

### IN-02: `Toolbar.tsx`'s `GROUP_SIZES` is a hardcoded array disconnected from plugin metadata

**File:** `src/components/editor/Toolbar.tsx:22`
**Issue:** `GROUP_SIZES = [4, 3, 3, 3]` must sum to exactly `plugins.length` (13) and must
stay in the exact order documented in the header comment. Nothing enforces this at
compile time or runtime — adding/removing a plugin from `plugins` in `index.ts` without
also updating this array silently misassigns plugins to the wrong toolbar group (or drops
the last ones from `buildGroups()`'s `slice`).
**Fix:** Either assert `GROUP_SIZES.reduce((a,b)=>a+b,0) === plugins.length` (fail loud in
dev), or give each `EditorPlugin` a `group` field and derive grouping from that instead of a
positional array.

### IN-03: `pipeline.ts` casts a hast text node to a fabricated shape via `as unknown as`

**File:** `src/lib/markdown/pipeline.ts:49-53`
**Issue:** `textToRaw` mutates a `Text` node in place into a `raw`-typed node via
`node as unknown as { type: string; value: string }`, which bypasses hast's type system
entirely. This is scoped only to the CommonMark-comparison fork (well-commented, and not
reachable from `markdownProcessor`/`renderMarkdown`), so it's not a security or correctness
issue in the production path — but the double-cast pattern is a maintainability smell that
would hide a real hast API misuse if `hast-util-to-html`'s `raw` node shape ever changes.
**Fix:** No action required unless this pattern spreads to other files; flagging for
awareness only.

---

_Reviewed: 2026-08-02T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
