// EditorPlugin contract (TRD §6, verbatim). Every formatting plugin implements
// this interface as a pure run(state): TransactionSpec function — no EditorView
// (DOM) access, which is what keeps every plugin unit-testable without JSDOM.
import type { EditorState, TransactionSpec } from "@codemirror/state";
import type { LucideIcon } from "lucide-react";

export interface EditorPlugin {
  id: string;
  icon: LucideIcon;
  tooltip: string;
  keymap?: string;
  run(state: EditorState): TransactionSpec;
}
