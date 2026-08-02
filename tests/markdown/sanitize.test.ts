// XSS + task-checkbox + del + table sanitize assertions against the UNMODIFIED
// rehype-sanitize defaultSchema (NFR-3.1, EDIT-08).
//
// RESEARCH conflict #1: hast-util-sanitize@5.0.2's defaultSchema (the literal
// dependency of rehype-sanitize@6.0.0) was verified this phase to ALREADY permit
// `del`, `input[type=checkbox][disabled]`, `table`+subelements, `align`, and
// `code[className=/^language-./]`. This file intentionally imports ONLY the
// unmodified pipeline — no schema merge/override is written here or referenced.
// A schema merge is added later ONLY if one of the assertions below fails against
// the real installed defaultSchema (Common Pitfalls #1).
//
// Contract for 02-03 (lib/markdown/pipeline.ts):
//   export const markdownProcessor: Processor
//     The FULL pipeline (remark-parse -> remarkGfmSubset -> remark-rehype
//     (allowDangerousHtml: true) -> rehype-raw -> rehype-sanitize(defaultSchema,
//     UNMODIFIED) -> HTML-string stringifier) such that
//     `String(await markdownProcessor.process(md))` yields sanitized HTML as a
//     string. Same export identifier as tests/spec/gfm.test.ts's contract.
//
// The XSS fixture strings below are test inputs ONLY — never copy them into
// production code, comments, or action logs elsewhere.
//
// This file is RED by design until 02-03 creates @/lib/markdown/pipeline.
import { describe, it, expect } from "vitest";
import { markdownProcessor } from "@/lib/markdown/pipeline";

describe("sanitize / XSS safety (defaultSchema, unmodified)", () => {
  it("strips a <script> element entirely", async () => {
    const md = "before\n\n<script>alert(1)</script>\n\nafter";
    const html = String(await markdownProcessor.process(md));
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert(1)");
  });

  it("removes on* event-handler attributes (e.g. onerror on an image)", async () => {
    const md = '<img src="x" onerror="alert(1)">';
    const html = String(await markdownProcessor.process(md));
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("alert(1)");
  });

  it("neutralizes a javascript: URL on a link", async () => {
    const md = "[click me](javascript:alert(1))";
    const html = String(await markdownProcessor.process(md));
    expect(html).not.toContain("javascript:alert");
  });

  it("renders a disabled checkbox input for a GFM task-list item (survives sanitize)", async () => {
    const html = String(await markdownProcessor.process("- [ ] todo"));
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("disabled");
  });

  it("renders del and table elements intact (proves defaultSchema already permits GFM output)", async () => {
    const strikeHtml = String(await markdownProcessor.process("~~gone~~"));
    expect(strikeHtml).toContain("<del>");

    const tableMd = ["| a | b |", "| --- | --- |", "| 1 | 2 |"].join("\n");
    const tableHtml = String(await markdownProcessor.process(tableMd));
    expect(tableHtml).toContain("<table>");
  });

  it("strips a <script> element nested inside a table cell (adjacency edge)", async () => {
    const md = [
      "| a | b |",
      "| --- | --- |",
      '| <script>alert(1)</script> | 2 |',
    ].join("\n");
    const html = String(await markdownProcessor.process(md));
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert(1)");
  });

  it("renders empty output for empty/whitespace-only input without throwing", async () => {
    await expect(markdownProcessor.process("")).resolves.toBeDefined();
    await expect(markdownProcessor.process("   \n\t  ")).resolves.toBeDefined();

    const emptyHtml = String(await markdownProcessor.process(""));
    const whitespaceHtml = String(await markdownProcessor.process("   \n\t  "));
    expect(emptyHtml.trim()).toBe("");
    expect(whitespaceHtml.trim()).toBe("");
  });

  it("is idempotent: processing the same input twice yields byte-identical output", async () => {
    const md = "# Title\n\n~~x~~ and a [link](https://example.com)";
    const first = String(await markdownProcessor.process(md));
    const second = String(await markdownProcessor.process(md));
    expect(second).toBe(first);
  });
});
