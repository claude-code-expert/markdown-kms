// Regression gate for the "caret lands in FRONT of an inserted line prefix" bug (Phase 2 UAT).
// The five line-prefix plugins (heading, blockquote, bullet/ordered/task list) position the
// caret with `range.map(state.changes(changes))`. Its default assoc (-1) maps a caret sitting
// AT the insertion point (line.from — i.e. the caret is at line start, the common toolbar case,
// or the line is empty) to BEFORE the inserted prefix, so the user ends up typing in front of
// the marker and the formatting never applies. The existing plugin tests only asserted the doc
// string, never the selection, so this went green while being wrong (02-REVIEW root cause).
//
// The fix maps with assoc +1 (after the inserted text). These cases pin the caret so it can't
// silently regress again.
import { describe, expect, it } from "vitest";
import { apply } from "./test-utils";
import { heading } from "@/components/editor/plugins/heading";
import { blockquote } from "@/components/editor/plugins/blockquote";
import { bulletList } from "@/components/editor/plugins/bullet-list";
import { orderedList } from "@/components/editor/plugins/ordered-list";
import { taskList } from "@/components/editor/plugins/task-list";

describe("caret lands after an inserted line prefix (not in front of it)", () => {
  it("heading(1) on a line-start caret puts the caret after '# '", () => {
    const { doc, selection } = apply((s) => heading(1).run(s), "item", { from: 0, to: 0 });
    expect(doc).toBe("# item");
    expect(selection).toEqual({ from: 2, to: 2 });
  });

  it("heading(1) on an empty line puts the caret after '# '", () => {
    const { doc, selection } = apply((s) => heading(1).run(s), "", { from: 0, to: 0 });
    expect(doc).toBe("# ");
    expect(selection).toEqual({ from: 2, to: 2 });
  });

  it("blockquote on a line-start caret puts the caret after '> '", () => {
    const { selection } = apply((s) => blockquote.run(s), "item", { from: 0, to: 0 });
    expect(selection).toEqual({ from: 2, to: 2 });
  });

  it("bulletList on a line-start caret puts the caret after '- '", () => {
    const { selection } = apply((s) => bulletList.run(s), "item", { from: 0, to: 0 });
    expect(selection).toEqual({ from: 2, to: 2 });
  });

  it("orderedList on a line-start caret puts the caret after '1. '", () => {
    const { selection } = apply((s) => orderedList.run(s), "item", { from: 0, to: 0 });
    expect(selection).toEqual({ from: 3, to: 3 });
  });

  it("taskList on a line-start caret puts the caret after '- [ ] '", () => {
    const { selection } = apply((s) => taskList.run(s), "item", { from: 0, to: 0 });
    expect(selection).toEqual({ from: 6, to: 6 });
  });

  it("REGRESSION: a mid-line caret still shifts forward by the prefix length", () => {
    const { selection } = apply((s) => heading(1).run(s), "item", { from: 2, to: 2 });
    expect(selection).toEqual({ from: 4, to: 4 });
  });
});
