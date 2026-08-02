// D-P2-10 contract for the code-block plugin: fence with an empty language slot
// (` ``` ` + newline), caret on the (empty) language line. RESEARCH Common Pitfalls #5
// flags fence-escalation near an already-fenced selection as an open question — pinned
// here as a backstop fixture (must_haves backstop truth, flagged pending implementation
// confirmation).
import { describe, expect, it } from "vitest";
import { apply } from "./test-utils";
import { codeBlock } from "@/components/editor/plugins/code-block";

describe("code-block plugin (D-P2-10)", () => {
  it("empty selection inserts an empty-language fence with the caret on the language line", () => {
    const { doc, selection } = apply((state) => codeBlock.run(state), "", { from: 0, to: 0 });
    expect(doc).toBe("```\n\n```");
    expect(selection).toEqual({ from: 3, to: 3 });
  });

  it("wraps a selection 'x' in a fence, re-selecting the content line", () => {
    const { doc, selection } = apply((state) => codeBlock.run(state), "x", { from: 0, to: 1 });
    expect(doc).toBe("```\nx\n```");
    expect(selection).toEqual({ from: 4, to: 5 });
  });

  // Backstop (flagged, pending implementation confirmation): a selection that itself
  // contains a triple-backtick run would otherwise close the fence early if wrapped with
  // the standard 3-backtick fence -- the fence length must escalate to 4 backticks so the
  // inner backticks stay literal content instead of terminating the block early.
  it("escalates fence length when the selection contains a triple-backtick run", () => {
    const { doc } = apply((state) => codeBlock.run(state), "a```b", { from: 0, to: 5 });
    expect(doc).toBe("````\na```b\n````");
  });

  // [Rule 1 - WR-01/GAP-3] The closing fence must land on its own line when trailing
  // same-line content follows the selection, otherwise the fence line isn't recognized as
  // a closer and the rest of the document is swallowed into the code block.
  // Pipeline-accurate: verified via tests/markdown/plugin-render.test.ts.
  it("wraps a selection with trailing same-line content, closing fence on its own line", () => {
    const { doc } = apply((state) => codeBlock.run(state), "x hello", { from: 0, to: 1 });
    expect(doc).toBe("```\nx\n```\n hello");
  });

  // [Rule 1 - CR-01/GAP-3] The caret path (from === to) must apply the same line-boundary
  // guard: a caret mid-line puts the opening fence on its own line and the closing fence on
  // its own line, so neighbouring same-line text is not glued onto a fence (which produced
  // an unterminated block swallowing the rest of the doc). Caret lands on the language slot.
  // Pipeline-accurate: verified via tests/markdown/plugin-render.test.ts.
  it("caret with same-line content on both sides puts both fences on their own lines", () => {
    const { doc, selection } = apply((state) => codeBlock.run(state), "abc hello", { from: 3, to: 3 });
    expect(doc).toBe("abc\n```\n\n```\n hello");
    expect(selection).toEqual({ from: 7, to: 7 });
  });
});
