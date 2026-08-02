---
phase: 02-markdown-rendering-editor-formatting
reviewed: 2026-08-02T06:12:02Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/components/editor/plugins/hr.ts
  - src/components/editor/plugins/table.ts
  - src/components/editor/plugins/code-block.ts
  - src/components/editor/plugins/heading.ts
  - src/components/preview/PreviewPane.tsx
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
status: resolved
resolution: "CR-01 + WR-02 fixed inline (commits 20621dd/4a4590c); WR-01 + IN-01 + IN-02 deferred with rationale (see Resolution)."
---

# Phase 02: Code Review Report (Re-review, post gap-closure plan 02-06)

**Reviewed:** 2026-08-02T06:12:02Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Re-review of the six gap-closure fixes from plan 02-06 (GAP-1..6: hr Setext-heading collision
and selection destruction, table/code-block same-line gluing, heading nesting over a
conflicting list prefix, PreviewPane swallowed render exceptions). Diff base: `78da262`
(pre-gap-closure state).

Four of the six fixes are correct and complete:
- **hr.ts (GAP-1/GAP-5):** the rule is inserted at `to` (never replacing `[from, to]`), so a
  non-empty selection's text now survives, and `needsLeadingBlank` correctly disambiguates the
  Setext-heading collision whenever there's non-blank content before the insertion point.
- **table.ts (GAP-2):** `atLineStart`/`atLineEnd` are computed uniformly regardless of whether
  the range is a caret or a selection, so both "click with nothing selected" and "select then
  click" get the blank-line padding needed to avoid gluing onto same-line neighbors, and an
  already-empty document gets no superfluous padding.
- **heading.ts (GAP-4):** `ANY_LIST_PREFIX_RE` is correctly inlined (no cross-plugin import,
  per the 1-feature-1-file invariant) and strips a conflicting list/blockquote prefix before
  writing the ATX marker, for the common list-prefix shapes.
- **PreviewPane.tsx (GAP-6):** the render exception is now logged via `console.error`, and the
  fallback JSX is a fixed, non-interpolated string — no caught error, stack, or markdown
  content leaks into the returned tree. No `dangerouslySetInnerHTML` anywhere; the sanitize
  pipeline remains the sole place unsafe content is dropped.

However, the **code-block.ts fix for GAP-3 is incomplete**: the line-boundary check was only
added to the "has a selection" branch. The plain-caret branch — which is the primary
documented use case for this plugin ("insert a fence with an EMPTY language slot ... caret on
the (empty) language line") — still glues the opening fence directly onto same-line
neighboring text when the caret isn't already at a line boundary, reproducing the exact GAP-3
symptom (unterminated fence swallowing the rest of the document) for the single most common
invocation of the plugin. This is a blocker. Two further edge-case gaps not covered by the
02-06 plan were also found: hr.ts inserts a superfluous leading blank line at absolute
document/line start, and heading.ts nests instead of replacing when an existing line already
has a level-5/6 ATX heading (outside this app's own 1-4 range).

## Critical Issues

### CR-01: code-block.ts caret-only path never received the GAP-3 line-boundary fix

**File:** `src/components/editor/plugins/code-block.ts:33-38`
**Issue:** The file's own header comment states the invariant plainly: "a leading newline is
added before the opening fence when the selection start isn't already at line-start, and a
trailing newline is added after the closing fence when the selection end isn't already at
line-end — otherwise a fence line carrying trailing text isn't recognized as a closer in
CommonMark, and the rest of the document is swallowed into the code block (GAP-3)." This is
implemented only in the `from !== to` branch (lines 40-48). The `from === to` branch — a bare
caret with nothing selected, which is the primary flow this plugin exists for (its own file
comment: "caret on the (empty) language line") — skips the check entirely:

```ts
if (from === to) {
  return {
    changes: { from, insert: `${fence}\n\n${fence}` },
    range: EditorSelection.cursor(from + fence.length),
  };
}
```

Repro: doc = `"abcdef"`, caret at offset 3 (between `abc` and `def`), click the code-block
toolbar button with nothing selected. Result: `"abc```\n\n```def"`. `` abc``` `` is not a
valid fence opener (the backticks aren't at line-start, per CommonMark's fenced-code-block
rule), so line 1 is just an ordinary paragraph containing literal backticks; `` ```def `` on
line 3 opens an unterminated fence (with `def` as its info string) that has no matching
closer anywhere below it, silently swallowing everything after it to EOF — the identical
symptom GAP-3 was raised to fix, reproduced for the caret-only path.
**Fix:**
```ts
function run(state: EditorState): TransactionSpec {
  return state.changeByRange((range) => {
    const { from, to } = range;
    const selected = state.doc.sliceString(from, to);
    const fence = fenceFor(selected);
    const atLineStart = state.doc.lineAt(from).from === from;
    const atLineEnd = to === state.doc.lineAt(to).to;
    const opener = atLineStart ? fence : `\n${fence}`;
    const closer = atLineEnd ? fence : `${fence}\n`;
    const contentStart = from + opener.length + 1;

    if (from === to) {
      return {
        changes: { from, insert: `${opener}\n\n${closer}` },
        range: EditorSelection.cursor(contentStart),
      };
    }

    return {
      changes: { from, to, insert: `${opener}\n${selected}\n${closer}` },
      range: EditorSelection.range(contentStart, contentStart + selected.length),
    };
  });
}
```
Add a regression test: caret placed mid-line with non-whitespace text on both sides, assert
the resulting doc string has the opening fence on its own line and the trailing text on its
own line after the closer (or, better, run the result through the shared pipeline and assert
the trailing text is NOT part of the `<pre><code>` block).

## Warnings

### WR-01: hr.ts inserts a superfluous leading blank line at absolute document/line start

**File:** `src/components/editor/plugins/hr.ts:18-19`
**Issue:** `needsLeadingBlank` only chooses between one and two leading newlines
(`"\n---\n"` vs `"\n\n---\n"`) — it never produces zero. When `to` is the very start of the
document (or the very first line, with nothing above it at all), a leading `\n` is still
emitted even though there is no preceding content that could ever be misread as Setext-heading
text. For a brand-new/empty document (`state.doc` = `""`, `to = 0`), the plugin produces
`"\n---\n"` — a stray blank line above the rule with nothing above it to separate from —
instead of `"---\n\n"`. Not data-destroying, but it contradicts the file's own stated rule
("needs a blank line before it whenever the on-line content preceding the insertion point is
non-empty") — the "preceding is empty" branch should special-case true document/line start as
needing zero leading newlines, not one.
**Fix:**
```ts
function run(state: EditorState): TransactionSpec {
  return state.changeByRange((range) => {
    const { to } = range;
    const line = state.doc.lineAt(to);
    const before = line.text.slice(0, to - line.from);
    const needsLeadingBlank = before.trim().length > 0;
    const leading = to === 0 ? "" : needsLeadingBlank ? "\n\n" : "\n";
    const insert = `${leading}---\n`;
    return {
      changes: { from: to, to, insert },
      range: EditorSelection.cursor(to + insert.length),
    };
  });
}
```

### WR-02: heading.ts nests instead of replacing when the existing line is a level-5/6 ATX heading

**File:** `src/components/editor/plugins/heading.ts:28,64-71`
**Issue:** `ATX_RE = /^(#{1,4}) /` only recognizes ATX headings of level 1-4 (this app's own
supported range). A line that already contains a valid CommonMark level-5 or level-6 ATX
heading (`"##### x"` / `"###### x"`, e.g. typed by hand or pasted in) matches neither
`ATX_RE` nor `ANY_LIST_PREFIX_RE`, so `stripLen` is `0`. Applying any heading level from the
toolbar then **prepends** the new marker instead of replacing the existing one — e.g.
`"##### x"` + apply level 2 → `"## ##### x"` — reproducing precisely the "nesting instead of
replacing" defect GAP-4 fixed for conflicting list prefixes, just left open for out-of-range
ATX heading levels.
**Fix:** widen the detection regex (it only needs to *recognize* the marker for stripping
purposes — the app never itself writes levels 5/6, but must still replace them if a line
already has one):
```ts
const ATX_RE = /^(#{1,6}) /;
```
`insert` generation is unaffected (it already only ever writes 1-4 `#`s via
`"#".repeat(level)`), and `allSameLevel` correctly stays `false` for a 5/6-level line since
`match[1].length` (5 or 6) will never equal the target `level` (1-4).

## Info

### IN-01: heading.ts (and sibling prefix plugins) don't recognize a checked task-list marker

**File:** `src/components/editor/plugins/heading.ts:29` (identical pattern also in
`bullet-list.ts:12`, `ordered-list.ts:12`, `blockquote.ts:11`, `task-list.ts:12`)
**Issue:** `ANY_LIST_PREFIX_RE = /^(?:- \[ \] |- |\d+\. |> )/` only matches the *unchecked*
task marker `- [ ] `. A checked item (`- [x] text` / `- [X] text`) falls through to the bare
`- ` alternative, so only two characters are stripped and `"[x] text"` remains as literal
content after the new prefix is applied, e.g. `"- [x] done"` + heading level 2 →
`"## [x] done"`. This is a pre-existing limitation shared identically across all five
prefix-replacing plugins (not introduced by the 02-06 gap-closure diff), so it's flagged as a
tracking note rather than a regression.
**Fix:** if ever addressed, fix it once in a shared pattern reused by all five files (still
respecting the no-cross-plugin-import invariant via a small shared, non-plugin module), e.g.
`/^(?:- \[[ xX]\] |- |\d+\. |> )/`.

### IN-02: PreviewPane.tsx logs via a render-time side effect

**File:** `src/components/preview/PreviewPane.tsx:35`
**Issue:** `console.error` runs directly inside the component's render body (inside the
`catch`). This is a minor departure from "render should be a pure function" — under React
StrictMode's dev-mode double-invocation of render, this can log the same failure twice, which
is a red herring during debugging. Not a correctness issue for production output, and the
exception is synchronous (thrown by the synchronous `renderMarkdown` call), so the catch
itself is sound.
**Fix:** low priority; not required for this phase. If it becomes noisy in practice, consider
routing through an error boundary instead of a local try/catch.

---

## Resolution (post-review, inline fix)

Fixed inline during the execute-phase code-review gate (TDD: RED cases → fix), each
exercising the REAL path through `markdownProcessor` so the blind spot cannot recur:

- **CR-01 (code-block caret) — FIXED** (`20621dd` RED, `4a4590c` fix). The line-boundary
  guard now runs for both the caret (`from === to`) and wrap branches; caret still lands on
  the empty language slot. New pipeline case: caret mid-line → trailing text renders outside
  the block. Full suite 748 GREEN, `tsc` clean.
- **WR-02 (heading h5/h6) — FIXED** (same commits). `ATX_RE` widened to `/^(#{1,6}) /` for
  stripping; app still only writes 1-4; `allSameLevel` unaffected. New pipeline case:
  `##### x` + level 2 → `<h2>x</h2>`.
- **WR-01 (hr leading blank at doc-start) — DEFERRED (cosmetic).** Zero rendered-output
  impact (a correct `<hr>` either way); the plan's own must_have sanctions one leading
  newline for empty on-line content. Not worth churning a GREEN fixture.
- **IN-01 (`- [x]` checked-task marker) — DEFERRED (pre-existing).** Shared across all 5
  prefix plugins; the 02-06 plan explicitly deferred IN-01 (shared-regex extraction).
- **IN-02 (`console.error` in render body) — DEFERRED (harmless).** The log was required by
  the plan; StrictMode double-log is dev-only cosmetic.

---

_Reviewed: 2026-08-02T06:12:02Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Resolution: 2026-08-02 (inline fix — CR-01/WR-02 closed, WR-01/IN deferred)_
