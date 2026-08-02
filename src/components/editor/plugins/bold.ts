// D-P2-06/07/08 contract: toggle-style bold, marker '**'.
//  - Empty selection: insert '****' with the caret between the marker pairs.
//  - Non-empty selection: wrap the text, re-select the wrapped content.
//  - Duplicate application (selection already framed by '**...**'): toggle off.
// Pure run(state): TransactionSpec — no EditorView/DOM access (TRD §6), and this
// file imports no other plugin (CLAUDE.md 1-feature-1-file invariant).
import { EditorSelection, type EditorState, type TransactionSpec } from "@codemirror/state";
import { Bold as BoldIcon } from "lucide-react";
import type { EditorPlugin } from "./types";

const MARK = "**";

function run(state: EditorState): TransactionSpec {
  return state.changeByRange((range) => {
    const { from, to } = range;
    const selected = state.doc.sliceString(from, to);

    const before = state.doc.sliceString(Math.max(0, from - MARK.length), from);
    const after = state.doc.sliceString(to, to + MARK.length);
    if (before === MARK && after === MARK) {
      const changes = [
        { from: from - MARK.length, to: from, insert: "" },
        { from: to, to: to + MARK.length, insert: "" },
      ];
      return { changes, range: range.map(state.changes(changes)) };
    }

    if (from === to) {
      return {
        changes: { from, insert: `${MARK}${MARK}` },
        range: EditorSelection.cursor(from + MARK.length),
      };
    }

    return {
      changes: { from, to, insert: `${MARK}${selected}${MARK}` },
      range: EditorSelection.range(from + MARK.length, from + MARK.length + selected.length),
    };
  });
}

export const bold: EditorPlugin = {
  id: "bold",
  icon: BoldIcon,
  tooltip: "굵게",
  keymap: "Mod-b",
  run,
};
