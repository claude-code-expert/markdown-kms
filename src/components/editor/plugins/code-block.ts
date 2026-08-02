// D-P2-10 contract for the code-block plugin: insert a fence with an EMPTY language
// slot (` ``` ` + newline), caret on the (empty) language line. Wrapping a selection
// fences it on its own line; if the selection itself contains a run of backticks, the
// fence length escalates beyond that run so the inner backticks stay literal content
// instead of terminating the block early (RESEARCH Common Pitfalls #5 backstop fixture).
// [Rule 1 - WR-01] Both fence delimiters must land on their own line: a leading newline is
// added before the opening fence when the selection start isn't already at line-start, and
// a trailing newline is added after the closing fence when the selection end isn't already
// at line-end — otherwise a fence line carrying trailing text isn't recognized as a closer
// in CommonMark, and the rest of the document is swallowed into the code block (GAP-3).
// The language info string is passed through only as a class downstream (PreviewPane) —
// this plugin introduces NO syntax-highlighting library.
// Pure run(state): TransactionSpec — no EditorView/DOM access (TRD §6), and this file
// imports no other plugin (CLAUDE.md 1-feature-1-file invariant).
import { EditorSelection, type EditorState, type TransactionSpec } from "@codemirror/state";
import { Code2 } from "lucide-react";
import type { EditorPlugin } from "./types";

function fenceFor(selected: string): string {
  const longestRun = (selected.match(/`+/g) ?? []).reduce(
    (max, run) => Math.max(max, run.length),
    0
  );
  return "`".repeat(Math.max(3, longestRun + 1));
}

function run(state: EditorState): TransactionSpec {
  return state.changeByRange((range) => {
    const { from, to } = range;
    const selected = state.doc.sliceString(from, to);
    const fence = fenceFor(selected);

    if (from === to) {
      return {
        changes: { from, insert: `${fence}\n\n${fence}` },
        range: EditorSelection.cursor(from + fence.length),
      };
    }

    const atLineStart = state.doc.lineAt(from).from === from;
    const atLineEnd = to === state.doc.lineAt(to).to;
    const opener = atLineStart ? fence : `\n${fence}`;
    const closer = atLineEnd ? fence : `${fence}\n`;
    const contentStart = from + opener.length + 1;
    return {
      changes: { from, to, insert: `${opener}\n${selected}\n${closer}` },
      range: EditorSelection.range(contentStart, contentStart + selected.length),
    };
  });
}

export const codeBlock: EditorPlugin = {
  id: "code-block",
  icon: Code2,
  tooltip: "코드 블록",
  run,
};
