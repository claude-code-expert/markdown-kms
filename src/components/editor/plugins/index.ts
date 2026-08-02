// Plugin registry: toolbar order + keymap -> dispatch(plugin.run(view.state)).
// UI-SPEC toolbar group order: ① heading dropdown -> ② inline 4 (bold/italic/
// strikethrough/inline-code) -> ③ list 3 (bullet/ordered/task) -> ④ block 3
// (blockquote/code-block/hr) -> ⑤ insert 3 (link/image/table).
//
// `heading` is exported separately (not part of `plugins`) because it's a level
// factory (`heading(level): EditorPlugin`), not a single plugin instance — the
// heading dropdown (HeadingDropdown.tsx) renders its 5 levels itself and imports
// `heading` directly. The other 13 plugins are flat toolbar buttons and live in
// `plugins`, in the exact UI-SPEC order above (groups ②-⑤).
import { keymap, type KeyBinding } from "@codemirror/view";
import { bold } from "./bold";
import { italic } from "./italic";
import { strikethrough } from "./strikethrough";
import { inlineCode } from "./inline-code";
import { bulletList } from "./bullet-list";
import { orderedList } from "./ordered-list";
import { taskList } from "./task-list";
import { blockquote } from "./blockquote";
import { codeBlock } from "./code-block";
import { hr } from "./hr";
import { link } from "./link";
import { image } from "./image";
import { table } from "./table";
import { heading } from "./heading";
import type { EditorPlugin } from "./types";

export const plugins: EditorPlugin[] = [
  bold,
  italic,
  strikethrough,
  inlineCode,
  bulletList,
  orderedList,
  taskList,
  blockquote,
  codeBlock,
  hr,
  link,
  image,
  table,
];

export { heading };

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
