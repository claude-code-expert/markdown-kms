// Plugin registry: toolbar order + keymap -> dispatch(plugin.run(view.state)).
// `bold` only for now (this plan's tracer slice); 02-04 appends the remaining
// 13 plugins to this same array, in the toolbar group order from the UI-SPEC.
import { keymap, type KeyBinding } from "@codemirror/view";
import { bold } from "./bold";
import type { EditorPlugin } from "./types";

export const plugins: EditorPlugin[] = [bold];

const bindings: KeyBinding[] = plugins
  .filter((plugin): plugin is EditorPlugin & { keymap: string } => Boolean(plugin.keymap))
  .map((plugin) => ({
    key: plugin.keymap,
    run(view) {
      view.dispatch(plugin.run(view.state));
      return true;
    },
  }));

export const editorKeymap = keymap.of(bindings);
