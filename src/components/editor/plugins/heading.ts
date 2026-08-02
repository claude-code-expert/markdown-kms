// D-P2-06/07/08 contract: heading is a line-prefix REPLACE (not a wrap) — level 1-4
// map to '#'..'####', level 0 maps to paragraph (prefix stripped, no marker). Applying
// the SAME level a selected line already has toggles it back to paragraph; applying a
// DIFFERENT level replaces the existing prefix (no nesting, e.g. '# x' -> heading(2) ->
// '## x', never '## # x'). Multi-line selections re-prefix each selected line
// independently (RESEARCH Open Question #1, pinned by tests/editor/heading.test.ts).
//
// `heading` is a factory (`heading(level): EditorPlugin`), not a single exported plugin
// object like the other 13 plugins, because it needs a level parameter — this is the
// pinned import contract tests/editor/heading.test.ts requires.
//
// [Rule 1 - WR-02] Sibling line-prefix plugins (bullet-list, ordered-list, task-list,
// blockquote) all replace a CONFLICTING prefix rather than nesting it. heading.ts's ATX_RE
// only recognized existing heading markers, so applying a heading to an existing list line
// left the list marker as literal heading text. ANY_LIST_PREFIX_RE mirrors those sibling
// plugins' shape (inlined here, not imported — CLAUDE.md 1-feature-1-file invariant
// forbids cross-plugin imports) so a conflicting list/blockquote prefix is stripped first
// when the line isn't already an ATX heading (GAP-4).
//
// Pure run(state): TransactionSpec — no EditorView/DOM access (TRD §6), and this file
// imports no other plugin (CLAUDE.md 1-feature-1-file invariant).
import { type EditorState, type TransactionSpec } from "@codemirror/state";
import { Heading1, Heading2, Heading3, Heading4, Pilcrow, type LucideIcon } from "lucide-react";
import type { EditorPlugin } from "./types";

export type HeadingLevel = 0 | 1 | 2 | 3 | 4;

// [WR-02] Recognizes 1-6 hashes for STRIPPING even though this app only ever writes 1-4:
// a level-5/6 heading is valid CommonMark (typed by hand), and must be REPLACED, not nested
// (`##### x` + level 2 -> `## x`, never `## ##### x`). `allSameLevel` stays correct because
// a 5/6 match length never equals the 1-4 target level, so it never toggles those off.
const ATX_RE = /^(#{1,6}) /;
const ANY_LIST_PREFIX_RE = /^(?:- \[ \] |- |\d+\. |> )/;

const ICONS: Record<HeadingLevel, LucideIcon> = {
  0: Pilcrow,
  1: Heading1,
  2: Heading2,
  3: Heading3,
  4: Heading4,
};

const LABELS: Record<HeadingLevel, string> = {
  0: "본문",
  1: "제목 1",
  2: "제목 2",
  3: "제목 3",
  4: "제목 4",
};

function makeRun(level: HeadingLevel) {
  return function run(state: EditorState): TransactionSpec {
    return state.changeByRange((range) => {
      const startLine = state.doc.lineAt(range.from);
      const endLine = state.doc.lineAt(range.to);
      const lines = [];
      for (let n = startLine.number; n <= endLine.number; n++) {
        lines.push(state.doc.line(n));
      }

      const allSameLevel =
        level > 0 &&
        lines.every((line) => {
          const match = ATX_RE.exec(line.text);
          return (match ? match[1].length : 0) === level;
        });

      const changes = lines.map((line) => {
        const match = ATX_RE.exec(line.text);
        const stripLen = match
          ? match[0].length
          : (ANY_LIST_PREFIX_RE.exec(line.text)?.[0].length ?? 0);
        const insert = level === 0 || allSameLevel ? "" : `${"#".repeat(level)} `;
        return { from: line.from, to: line.from + stripLen, insert };
      });

      return { changes, range: range.map(state.changes(changes)) };
    });
  };
}

export function heading(level: HeadingLevel): EditorPlugin {
  return {
    id: level === 0 ? "heading-p" : `heading-${level}`,
    icon: ICONS[level],
    tooltip: LABELS[level],
    run: makeRun(level),
  };
}
