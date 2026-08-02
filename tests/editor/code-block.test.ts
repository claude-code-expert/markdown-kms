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
});
