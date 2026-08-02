// The GFM-3-only unified plugin (CLAUDE.md invariant: "GFM은 취소선·태스크·표 3종만
// 활성"). Composes ONLY the granular strikethrough/table/task-list-item micromark +
// mdast-util-from-markdown extensions directly via `this.data()` — deliberately NOT
// the bundled `remark-gfm` plugin, which hard-codes all 5 GFM features (footnote +
// autolink-literal included) with no per-feature toggle (RESEARCH Pitfall 2 / conflict #2).
import { gfmStrikethrough } from "micromark-extension-gfm-strikethrough";
import { gfmTable } from "micromark-extension-gfm-table";
import { gfmTaskListItem } from "micromark-extension-gfm-task-list-item";
import { gfmStrikethroughFromMarkdown } from "mdast-util-gfm-strikethrough";
import { gfmTableFromMarkdown } from "mdast-util-gfm-table";
import { gfmTaskListItemFromMarkdown } from "mdast-util-gfm-task-list-item";
import type { Plugin } from "unified";

export const remarkGfmSubset: Plugin<[]> = function remarkGfmSubset() {
  const data = this.data();
  const micromarkExtensions = (data.micromarkExtensions ??= []);
  const fromMarkdownExtensions = (data.fromMarkdownExtensions ??= []);

  micromarkExtensions.push(gfmStrikethrough(), gfmTable(), gfmTaskListItem());
  fromMarkdownExtensions.push(
    gfmStrikethroughFromMarkdown(),
    gfmTableFromMarkdown(),
    gfmTaskListItemFromMarkdown()
  );
};
