// D-P2-09 Insert UX Contract + RESEARCH Open Question #2: smallest valid GFM table is a
// 2-column x (header + separator + 1 data row) skeleton with literal placeholder cells,
// inserted with no dialog. Inserting again elsewhere in the document (cursor not at
// position 0) prefixes a blank-line separator so GFM never reads the new skeleton as
// extra rows of a preceding table.
// Pure run(state): TransactionSpec — no EditorView/DOM access (TRD §6), and this file
// imports no other plugin (CLAUDE.md 1-feature-1-file invariant).
import { EditorSelection, type EditorState, type TransactionSpec } from "@codemirror/state";
import { Table as TableIcon } from "lucide-react";
import type { EditorPlugin } from "./types";

const SKELETON = "| 제목1 | 제목2 |\n| --- | --- |\n| 내용 | 내용 |";

function run(state: EditorState): TransactionSpec {
  return state.changeByRange((range) => {
    const { from, to } = range;
    const separator = from === 0 ? "" : "\n\n";
    const insert = `${separator}${SKELETON}`;
    return {
      changes: { from, to, insert },
      range: EditorSelection.cursor(from + insert.length),
    };
  });
}

export const table: EditorPlugin = {
  id: "table",
  icon: TableIcon,
  tooltip: "표 삽입",
  run,
};
