// Pure EditorState apply-and-read helper shared by all 14 plugin contract tests.
//
// TRD §6: a plugin's `run(state): TransactionSpec` is a pure function tested by
// "putting state in, asserting the resulting string" with NO EditorView/DOM
// (Vitest `environment: "node"`, no JSDOM). This helper is that harness.
//
// CLAUDE.md / TRD §6 invariant: this file MUST NOT import any plugin module and
// MUST NOT construct an EditorView — it is a shared test utility, not a plugin,
// so it does not violate the 1-plugin-1-file / no-cross-import rule.
import { EditorState, type TransactionSpec } from "@codemirror/state";

export interface Selection {
  from: number;
  to: number;
}

export interface ApplyResult {
  doc: string;
  selection: Selection;
}

/**
 * Builds an EditorState from `doc` + `selection`, applies `run`'s TransactionSpec
 * via `state.update(...)`, and reads the resulting doc string + primary selection
 * range back out. No EditorView is ever constructed.
 */
export function apply(
  run: (state: EditorState) => TransactionSpec,
  doc: string,
  selection: Selection
): ApplyResult {
  const state = EditorState.create({
    doc,
    selection: { anchor: selection.from, head: selection.to },
  });

  const spec = run(state);
  const tr = state.update(spec);

  return {
    doc: tr.state.doc.toString(),
    selection: {
      from: tr.state.selection.main.from,
      to: tr.state.selection.main.to,
    },
  };
}
