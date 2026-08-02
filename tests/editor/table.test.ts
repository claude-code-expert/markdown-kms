// D-P2-09 Insert UX Contract + RESEARCH Open Question #2: smallest valid GFM table is a
// 2-column x (header + separator + 1 data row) skeleton with literal placeholder cells.
// Two insertions must produce two independent tables, never merged into one (a blank-line
// separator is what keeps GFM from reading the second skeleton as extra rows of the first).
import { describe, expect, it } from "vitest";
import { apply } from "./test-utils";
import { table } from "@/components/editor/plugins/table";

const SKELETON = "| 제목1 | 제목2 |\n| --- | --- |\n| 내용 | 내용 |";

describe("table plugin (D-P2-09 skeleton insert, RESEARCH Open Question #2)", () => {
  it("empty selection inserts the 2-column GFM table skeleton", () => {
    const { doc } = apply((state) => table.run(state), "", { from: 0, to: 0 });
    expect(doc).toBe(SKELETON);
  });

  it("inserting twice yields two independent skeletons, never merged", () => {
    const first = apply((state) => table.run(state), "", { from: 0, to: 0 });
    const second = apply((state) => table.run(state), first.doc, {
      from: first.doc.length,
      to: first.doc.length,
    });
    expect(second.doc).toBe(`${SKELETON}\n\n${SKELETON}`);
  });
});
