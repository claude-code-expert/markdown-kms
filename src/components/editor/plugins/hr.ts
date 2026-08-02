// D-P2-04/EDIT-04 contract for the hr (thematic break) plugin: inserts a '---' line of
// its own after the cursor/selection, leaving a fresh empty line below to continue typing.
// [Rule 1 - CR-02] A thematic break needs a blank line before it whenever the on-line
// content preceding the insertion point is non-empty — otherwise CommonMark reads
// "text\n---" as a Setext H2 heading, not a rule. [Rule 1 - WR-03] The rule is inserted
// AFTER the selection (at `to`), never replacing `[from, to]`, so a non-empty selection's
// text is preserved instead of destroyed.
// Pure run(state): TransactionSpec — no EditorView/DOM access (TRD §6), and this file
// imports no other plugin (CLAUDE.md 1-feature-1-file invariant).
import { EditorSelection, type EditorState, type TransactionSpec } from "@codemirror/state";
import { Minus } from "lucide-react";
import type { EditorPlugin } from "./types";

function run(state: EditorState): TransactionSpec {
  return state.changeByRange((range) => {
    const { to } = range;
    const line = state.doc.lineAt(to);
    const needsLeadingBlank = line.text.slice(0, to - line.from).trim().length > 0;
    const insert = `${needsLeadingBlank ? "\n\n" : "\n"}---\n`;
    return {
      changes: { from: to, to, insert },
      range: EditorSelection.cursor(to + insert.length),
    };
  });
}

export const hr: EditorPlugin = {
  id: "hr",
  icon: Minus,
  tooltip: "구분선",
  run,
};
