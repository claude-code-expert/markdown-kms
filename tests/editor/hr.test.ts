// D-P2-04/EDIT-04 contract for the hr (thematic break) plugin: inserts a '---' line of its
// own after the cursor/selection, leaving a fresh empty line below to continue typing.
// [Rule 1 - CR-02] A blank line is prepended before '---' whenever the on-line content
// preceding the insertion point is non-empty, so CommonMark reads a thematic break instead
// of a Setext H2 heading (pipeline-accurate fixture, corrected from the pre-gap-closure
// pinned string per 02-06 GAP-1). [Rule 1 - WR-03] A non-empty selection is preserved
// (rule inserted after `to`), not destroyed (GAP-5).
import { describe, expect, it } from "vitest";
import { apply } from "./test-utils";
import { hr } from "@/components/editor/plugins/hr";

describe("hr plugin (thematic break insert)", () => {
  it("inserts a blank line then '---' after non-empty on-line content in 'x'", () => {
    const { doc, selection } = apply((state) => hr.run(state), "x", { from: 1, to: 1 });
    expect(doc).toBe("x\n\n---\n");
    expect(selection).toEqual({ from: 7, to: 7 });
  });

  it("inserts a bare '\\n---\\n' when the on-line content before the cursor is empty", () => {
    const { doc, selection } = apply((state) => hr.run(state), "", { from: 0, to: 0 });
    expect(doc).toBe("\n---\n");
    expect(selection).toEqual({ from: 5, to: 5 });
  });

  it("preserves a non-empty selection instead of destroying it (GAP-5, WR-03)", () => {
    const { doc } = apply((state) => hr.run(state), "hello world", { from: 0, to: 5 });
    expect(doc).toBe("hello\n\n---\n world");
    expect(doc).toContain("hello");
  });
});
