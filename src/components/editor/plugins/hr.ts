// D-P2-04/EDIT-04 contract for the hr (thematic break) plugin: inserts a '---' line of
// its own at the cursor position, leaving a fresh empty line below the cursor to
// continue typing.
// Pure run(state): TransactionSpec — no EditorView/DOM access (TRD §6), and this file
// imports no other plugin (CLAUDE.md 1-feature-1-file invariant).
import { EditorSelection, type EditorState, type TransactionSpec } from "@codemirror/state";
import { Minus } from "lucide-react";
import type { EditorPlugin } from "./types";

const INSERT = "\n---\n";

function run(state: EditorState): TransactionSpec {
  return state.changeByRange((range) => {
    const { from, to } = range;
    return {
      changes: { from, to, insert: INSERT },
      range: EditorSelection.cursor(from + INSERT.length),
    };
  });
}

export const hr: EditorPlugin = {
  id: "hr",
  icon: Minus,
  tooltip: "구분선",
  run,
};
