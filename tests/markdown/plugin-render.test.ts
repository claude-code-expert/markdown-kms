// The missing end-to-end gate (02-VERIFICATION.md / 02-REVIEW.md root cause): no test in
// tests/editor/*.test.ts ever fed a plugin's `run()` output through the real
// `markdownProcessor` pipeline — every fixture only asserted the raw doc string, so a
// plugin could faithfully implement a WRONG contract (e.g. hr's "x\n---\n" reads as a
// Setext H2, not a thematic break) and still go GREEN. This file closes that gap: each
// case applies a plugin's `run()` via the shared `apply()` test-utils helper, then feeds
// the resulting doc through `markdownProcessor` (mirroring tests/markdown/sanitize.test.ts's
// `String(await markdownProcessor.process(md))` pattern) and asserts on the rendered HTML.
import { describe, expect, it } from "vitest";
import { apply } from "../editor/test-utils";
import { markdownProcessor } from "@/lib/markdown/pipeline";
import { hr } from "@/components/editor/plugins/hr";
import { table } from "@/components/editor/plugins/table";
import { codeBlock } from "@/components/editor/plugins/code-block";
import { heading } from "@/components/editor/plugins/heading";

describe("plugin output -> markdownProcessor integration gate", () => {
  describe("hr (GAP-1, CR-02)", () => {
    it("after a non-empty text line renders a thematic break, never a Setext heading", async () => {
      const { doc } = apply((state) => hr.run(state), "hello", { from: 5, to: 5 });
      const html = String(await markdownProcessor.process(doc));
      expect(html).toContain("<hr");
      expect(html).not.toContain("<h2");
    });
  });

  describe("table (GAP-2, CR-01)", () => {
    it("splits trailing same-line content onto its own block instead of dropping it", async () => {
      const { doc } = apply((state) => table.run(state), "hello", { from: 0, to: 0 });
      const html = String(await markdownProcessor.process(doc));
      expect(html).toContain("<table");
      expect(html).toContain("hello");
    });
  });

  describe("code-block (GAP-3, WR-01)", () => {
    it("keeps the closing fence on its own line so trailing same-line content renders outside the code block", async () => {
      const { doc } = apply((state) => codeBlock.run(state), "x hello", { from: 0, to: 1 });
      const html = String(await markdownProcessor.process(doc));
      expect(html).toContain("<pre>");
      const preCloseIdx = html.indexOf("</pre>");
      expect(preCloseIdx).toBeGreaterThan(-1);
      const trailingIdx = html.indexOf("hello");
      expect(trailingIdx).toBeGreaterThan(preCloseIdx);
    });

    // [CR-01] The GAP-3 line-boundary guard must also cover the CARET path (from === to),
    // which is this plugin's primary documented use (toolbar click, nothing selected). A
    // mid-line caret must still put the opening fence on its own line and keep trailing
    // same-line content outside the block — the selection case above never exercised this.
    it("caret mid-line keeps the fence on its own line so trailing content renders outside the block", async () => {
      const { doc } = apply((state) => codeBlock.run(state), "abc hello", { from: 3, to: 3 });
      const html = String(await markdownProcessor.process(doc));
      expect(html).toContain("<pre>");
      const preCloseIdx = html.indexOf("</pre>");
      expect(preCloseIdx).toBeGreaterThan(-1);
      const trailingIdx = html.indexOf("hello");
      expect(trailingIdx).toBeGreaterThan(preCloseIdx);
    });
  });

  describe("heading (GAP-4, WR-02)", () => {
    it("applying a heading to a list-prefixed line strips the list marker instead of nesting it", async () => {
      const { doc } = apply((state) => heading(1).run(state), "- item", { from: 0, to: 0 });
      const html = String(await markdownProcessor.process(doc));
      expect(html).toContain("<h1>item</h1>");
    });

    // [WR-02] The strip must also recognize an existing level-5/6 ATX heading (valid
    // CommonMark, typed by hand — this app only writes 1-4). Otherwise the marker is
    // prepended not replaced, rendering '<h2>##### x</h2>' — the GAP-4 nesting defect again.
    it("applying a heading to an existing level-5 heading replaces the marker instead of nesting it", async () => {
      const { doc } = apply((state) => heading(2).run(state), "##### x", { from: 0, to: 0 });
      const html = String(await markdownProcessor.process(doc));
      expect(html).toContain("<h2>x</h2>");
    });
  });
});
