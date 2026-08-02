// D-P2-09 Insert UX Contract (skeleton, no dialog): Link -> '[텍스트](url)' with the
// editable placeholder pre-selected so typing can replace it immediately. When a
// selection already has text, that text becomes the label and 'url' is selected next
// so the user fills in the destination. A javascript: URL a user later types here is
// neutralized at render by the pipeline sanitize stage (T-02-01) — this plugin never
// bypasses it, it only ever emits markdown skeleton text.
// Pure run(state): TransactionSpec — no EditorView/DOM access (TRD §6), and this file
// imports no other plugin (CLAUDE.md 1-feature-1-file invariant).
import { EditorSelection, type EditorState, type TransactionSpec } from "@codemirror/state";
import { Link as LinkIcon } from "lucide-react";
import type { EditorPlugin } from "./types";

function run(state: EditorState): TransactionSpec {
  return state.changeByRange((range) => {
    const { from, to } = range;
    const selected = state.doc.sliceString(from, to);

    if (from === to) {
      const label = "텍스트";
      return {
        changes: { from, insert: `[${label}](url)` },
        range: EditorSelection.range(from + 1, from + 1 + label.length),
      };
    }

    const urlStart = from + 1 + selected.length + 2; // '[' + label + ']('
    return {
      changes: { from, to, insert: `[${selected}](url)` },
      range: EditorSelection.range(urlStart, urlStart + 3),
    };
  });
}

export const link: EditorPlugin = {
  id: "link",
  icon: LinkIcon,
  tooltip: "링크 삽입",
  run,
};
