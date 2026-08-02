// D-P2-06/07/08 contract for the ordered-list plugin. Marker: 'N. ' (line prefix),
// numbering sequentially 1..N across the selected contiguous lines (RESEARCH Open
// Question #1, pinned by tests/editor/ordered-list.test.ts). Toggle-off when every
// selected line already carries a numbered-list prefix.
// Pure run(state): TransactionSpec — no EditorView/DOM access (TRD §6), and this file
// imports no other plugin (CLAUDE.md 1-feature-1-file invariant).
import { type EditorState, type TransactionSpec } from "@codemirror/state";
import { ListOrdered } from "lucide-react";
import type { EditorPlugin } from "./types";

const OWN_RE = /^\d+\. /;
const ANY_LIST_PREFIX_RE = /^(?:- \[ \] |- |\d+\. |> )/;

function run(state: EditorState): TransactionSpec {
  return state.changeByRange((range) => {
    const startLine = state.doc.lineAt(range.from);
    const endLine = state.doc.lineAt(range.to);
    const lines = [];
    for (let n = startLine.number; n <= endLine.number; n++) {
      lines.push(state.doc.line(n));
    }

    const allOwn = lines.every((line) => OWN_RE.test(line.text));

    const changes = lines.map((line, index) => {
      const match = ANY_LIST_PREFIX_RE.exec(line.text);
      const stripLen = match ? match[0].length : 0;
      const insert = allOwn ? "" : `${index + 1}. `;
      return { from: line.from, to: line.from + stripLen, insert };
    });

    return { changes, range: range.map(state.changes(changes)) };
  });
}

export const orderedList: EditorPlugin = {
  id: "ordered-list",
  icon: ListOrdered,
  tooltip: "번호 매기기 목록",
  run,
};
