// D-P2-09 Insert UX Contract + RESEARCH Open Question #2: smallest valid GFM table is a
// 2-column x (header + separator + 1 data row) skeleton with literal placeholder cells,
// inserted with no dialog. A blank-line separator is prefixed when the insertion point
// isn't at line-start so GFM never reads the new skeleton as extra rows of a preceding
// table. [Rule 1 - CR-01] Symmetrically, a blank-line separator is also APPENDED when the
// insertion point isn't at line-end, so trailing same-line content becomes its own block
// instead of gluing onto the last table row and being silently dropped by GFM (GAP-2).
// Pure run(state): TransactionSpec — no EditorView/DOM access (TRD §6), and this file
// imports no other plugin (CLAUDE.md 1-feature-1-file invariant).
import { EditorSelection, type EditorState, type TransactionSpec } from "@codemirror/state";
import { Table as TableIcon } from "lucide-react";
import type { EditorPlugin } from "./types";

const SKELETON = "| 제목1 | 제목2 |\n| --- | --- |\n| 내용 | 내용 |";

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

export const table: EditorPlugin = {
  id: "table",
  icon: TableIcon,
  tooltip: "표 삽입",
  run,
};
