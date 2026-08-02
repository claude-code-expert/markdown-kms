// D-P2-06/07/08 contract for the bullet-list plugin. Marker: '- ' (line prefix, not a
// wrap). Per-line, toggle-off on re-application, replaces a differing list-type prefix
// (ordered/task/blockquote) rather than nesting it. Multi-line re-prefixes each line.
// Pure run(state): TransactionSpec — no EditorView/DOM access (TRD §6), and this file
// imports no other plugin (CLAUDE.md 1-feature-1-file invariant).
import { type EditorState, type TransactionSpec } from "@codemirror/state";
import { List } from "lucide-react";
import type { EditorPlugin } from "./types";

const PREFIX = "- ";
const OWN_RE = /^- (?!\[ \] )/;
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

    const changes = lines.map((line) => {
      const match = ANY_LIST_PREFIX_RE.exec(line.text);
      const stripLen = match ? match[0].length : 0;
      const insert = allOwn ? "" : PREFIX;
      return { from: line.from, to: line.from + stripLen, insert };
    });

    return { changes, range: range.map(state.changes(changes)) };
  });
}

export const bulletList: EditorPlugin = {
  id: "bullet-list",
  icon: List,
  tooltip: "글머리 기호 목록",
  run,
};
