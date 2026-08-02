// GFM-3-only conformance: asserts strikethrough/table/task-list parse, AND that
// footnote / autolink-literal syntax (the other 2 of the "bundled 5" GFM features)
// render as LITERAL text — the exactly-3-GFM-extensions invariant (CLAUDE.md
// "GFM은 취소선·태스크·표 3종만 활성"; RESEARCH conflict #2 / Pitfall 2).
//
// Contract for 02-03 (lib/markdown/pipeline.ts):
//   export const markdownProcessor: Processor
//     The FULL pipeline (remark-parse -> remarkGfmSubset -> remark-rehype
//     (allowDangerousHtml: true) -> rehype-raw -> rehype-sanitize(defaultSchema) ->
//     HTML-string stringifier, e.g. rehype-stringify) such that
//     `String(await markdownProcessor.process(md))` yields sanitized HTML as a string.
//     This is distinct from any rehype-react-based variant used for production DOM
//     rendering (PreviewPane.tsx) — tests run in Vitest's "node" environment with no
//     DOM, so a string-stringify variant is required for assertion purposes.
//   remarkGfmSubset (lib/markdown/remark-gfm-subset.ts) MUST compose only the 3
//     granular micromark/mdast-util gfm-{strikethrough,table,task-list-item}
//     extensions — the bundled remark-gfm plugin (which cannot disable footnote/
//     autolink-literal) MUST NOT be used (RESEARCH Pitfall 2).
//
// This file is RED by design until 02-03 creates @/lib/markdown/pipeline.
import { describe, it, expect } from "vitest";
import { markdownProcessor } from "@/lib/markdown/pipeline";

describe("GFM 3-extension-only conformance", () => {
  it("strikethrough (~~x~~) parses to a del element", async () => {
    const html = String(await markdownProcessor.process("~~struck~~"));
    expect(html).toContain("<del>struck</del>");
  });

  it("pipe table parses to a table element", async () => {
    const md = ["| a | b |", "| --- | --- |", "| 1 | 2 |"].join("\n");
    const html = String(await markdownProcessor.process(md));
    expect(html).toContain("<table>");
  });

  it("task-list item (- [ ] x) parses to a disabled checkbox input", async () => {
    const html = String(await markdownProcessor.process("- [ ] todo"));
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("disabled");
  });

  it("GUARD: footnote reference ([^1]) renders as literal text, not a footnote link", async () => {
    const md = ["Text with a note[^1].", "", "[^1]: The footnote body."].join("\n");
    const html = String(await markdownProcessor.process(md));
    // remark-gfm's footnote extension is deliberately NOT composed — the raw
    // markers must survive as plain text, and no footnote/backref anchor may appear.
    expect(html).toContain("[^1]");
    expect(html).not.toContain('href="#fn');
    expect(html).not.toContain('id="fn');
  });

  it("GUARD: autolink-literal (bare URL) renders as literal text, not an anchor", async () => {
    const md = "Visit https://example.com for more.";
    const html = String(await markdownProcessor.process(md));
    // remark-gfm's autolink-literal extension is deliberately NOT composed — a
    // bare URL must NOT be auto-wrapped in an <a> tag.
    expect(html).toContain("https://example.com");
    expect(html).not.toContain('<a href="https://example.com"');
  });
});
