// D-P2-06/07/08 contract for the italic plugin. Marker: single '*' (RESEARCH objective
// note — chosen over '_' because '*' has no intra-word emphasis restriction, so a
// mid-word wrap still emphasizes).
//  - Empty selection: insert '**' with the caret between the marker pair.
//  - Non-empty selection: wrap the text, re-select the wrapped content.
//  - Duplicate application (selection already framed by lone '*...*'): toggle off.
//  - Guard: if the neighboring '*' is itself the second star of a '**' bold pair, this
//    is NOT a lone italic marker — wrap instead of toggling off, nesting italic inside
//    bold ('**x**' -> '***x***', valid CommonMark strong+em nesting).
// Pure run(state): TransactionSpec — no EditorView/DOM access (TRD §6), and this file
// imports no other plugin (CLAUDE.md 1-feature-1-file invariant).
import { EditorSelection, type EditorState, type TransactionSpec } from "@codemirror/state";
import { Italic as ItalicIcon } from "lucide-react";
import type { EditorPlugin } from "./types";

const MARK = "*";

function run(state: EditorState): TransactionSpec {
  return state.changeByRange((range) => {
    const { from, to } = range;
    const selected = state.doc.sliceString(from, to);

    const before = state.doc.sliceString(Math.max(0, from - MARK.length), from);
    const after = state.doc.sliceString(to, to + MARK.length);
    const beforeBefore = state.doc.sliceString(
      Math.max(0, from - 2 * MARK.length),
      Math.max(0, from - MARK.length)
    );
    const afterAfter = state.doc.sliceString(to + MARK.length, to + 2 * MARK.length);

    const isLoneMarkerPair =
      before === MARK && after === MARK && beforeBefore !== MARK && afterAfter !== MARK;

    if (isLoneMarkerPair) {
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

export const italic: EditorPlugin = {
  id: "italic",
  icon: ItalicIcon,
  tooltip: "기울임",
  run,
};
