// Single shared markdown pipeline (CLAUDE.md: "마크다운 파이프라인은 lib/markdown/
// 단일 원천"). Three processors fork from the identical parse+GFM+rehype base
// (TRD §5 pipeline order: remark-parse -> remarkGfmSubset -> remark-rehype ->
// rehype-raw -> rehype-sanitize -> {stringify|react}):
//
//   - markdownProcessorPreSanitize: stops BEFORE rehype-raw/rehype-sanitize, for the
//     CommonMark 0.31.2 conformance suite (TRD §10 — the spec expects raw HTML to
//     survive untouched, which sanitize would otherwise strip).
//   - markdownProcessor: the FULL pipeline (+ rehype-raw + rehype-sanitize(defaultSchema)
//     + HTML-string stringify) — used by the GFM/sanitize Vitest suites, which run in a
//     DOM-less "node" environment and assert against an HTML string, not a React tree.
//   - renderMarkdown(): the FULL pipeline ending in rehype-react, for the production
//     PreviewPane — returns a React element tree instead of an HTML string.
//
// No memoization here (CLAUDE.md / TRD §5 — measure the 60ms budget first, in 02-05).
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkBreaks from "remark-breaks";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import rehypeReact from "rehype-react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import type { ReactElement } from "react";
import type { Root, Nodes } from "hast";
import { remarkGfmSubset } from "./remark-gfm-subset";
import { emptyImageToText } from "./empty-image-to-text";
import { schema } from "./schema";

// `breaks: true` inserts remark-breaks (soft line ending -> hard <br>) BEFORE remark-rehype,
// so the RENDERING forks (preview + HTML string) treat a single Enter as a visible line break.
// This is a deliberate product deviation from strict CommonMark 0.31.2 soft-break semantics
// (TRD §5, decided during Phase 2 UAT) and is scoped to the rendering forks ONLY — the
// preSanitize/CommonMark-conformance fork stays pure so the spec suite still compares against
// the reference renderer.
function baseProcessor({ breaks = false }: { breaks?: boolean } = {}) {
  const processor = unified().use(remarkParse).use(remarkGfmSubset);
  if (breaks) processor.use(remarkBreaks);
  return processor.use(remarkRehype, { allowDangerousHtml: true });
}

// [Rule 1 - bug] hast-util-to-html's text handler only escapes `<` and `&`
// (hardcoded subset, no override hook) — but the CommonMark reference renderer
// (which commonmark-spec's fixture HTML was generated against) escapes all of
// `&`, `<`, `>`, `"` in ordinary text content. Converting text nodes to `raw`
// nodes (verbatim output when allowDangerousHtml, per hast-util-to-html's own
// raw.js) lets us pre-escape exactly those 4 characters ourselves — scoped to
// ONLY this pre-sanitize/CommonMark-comparison fork, never markdownProcessor or
// renderMarkdown (whose consumers — sanitize/rehype-react — must keep real text
// nodes; pre-escaping there would render literal "&gt;" strings on screen).
function escapeCommonMarkText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function textToRaw(node: Nodes): void {
  if (node.type === "text") {
    const raw = node as unknown as { type: string; value: string };
    raw.type = "raw";
    raw.value = escapeCommonMarkText(node.value);
    return;
  }
  if ("children" in node) {
    for (const child of node.children) textToRaw(child);
  }
}

function commonmarkTextEscape() {
  return (tree: Root) => {
    textToRaw(tree);
  };
}

const preSanitizeProcessor = baseProcessor()
  .use(commonmarkTextEscape)
  .use(rehypeStringify, {
    allowDangerousHtml: true,
    closeSelfClosing: true, // void elements as `<hr />`, matching the CommonMark reference renderer
    characterReferences: { useNamedReferences: true }, // `&quot;`/`&amp;` not `&#x22;`/`&#x26;` in attributes, matching the reference renderer
  });

// hast-util-to-html also doesn't append a trailing newline after the last root-level
// block (it only inserts "\n" BETWEEN siblings) — but the commonmark-spec fixture HTML
// always does (verified: 651/652 non-empty fixtures end with "\n", the remaining one
// has empty html). Normalized here so the composition itself (parse -> gfm -> rehype,
// unchanged) stays the single source of truth; this wrapper only fixes reference-format
// normalization for the CommonMark byte-exact comparison, not the pipeline stages.
//
// commonmark-spec's own fixture JSON (both `markdown` and `html` fields) represents every
// literal tab character as U+2192 "→" instead of a real U+0009 tab (verified: fixtures
// #1-#11/#40/#82, "Tabs"/"Entity and numeric character references"/"Setext headings"
// sections — the arrow's codepoint is 0x2192, not 0x09, in both fields). Decode "→" back
// to a real tab before parsing (so CommonMark's tab-stop/indentation rules apply
// correctly), then re-encode any literal tab that survives into rendered text back to
// "→" so the comparison matches the fixture's own convention.
const TAB_MARKER = "→";

export const markdownProcessorPreSanitize = {
  async process(markdown: string) {
    const file = await preSanitizeProcessor.process(markdown.replaceAll(TAB_MARKER, "\t"));
    if (typeof file.value === "string") {
      file.value = file.value.replaceAll("\t", TAB_MARKER);
      if (file.value.length > 0 && !file.value.endsWith("\n")) {
        file.value += "\n";
      }
    }
    return file;
  },
};

// emptyImageToText는 sanitize **뒤**에 온다 — sanitize가 허용되지 않은 프로토콜(javascript: 등)의
// src를 떼어내면 그 img도 빈 src가 되므로, 정리된 결과를 보고 판단해야 둘 다 잡힌다.
// 두 렌더 fork에 동일하게 적용한다(CLAUDE.md: 미리보기·프레젠테이션이 같은 파이프라인을 공유).
export const markdownProcessor = baseProcessor({ breaks: true })
  .use(rehypeRaw)
  .use(rehypeSanitize, schema)
  .use(emptyImageToText)
  .use(rehypeStringify);

const markdownProcessorReact = baseProcessor({ breaks: true })
  .use(rehypeRaw)
  .use(rehypeSanitize, schema)
  .use(emptyImageToText)
  .use(rehypeReact, { Fragment, jsx, jsxs });

export function renderMarkdown(markdown: string): ReactElement {
  const file = markdownProcessorReact.processSync(markdown);
  return file.result;
}
