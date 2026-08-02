// D-P2-06/07/08 contract for the ordered-list plugin. Marker: '1. ' (line prefix), numbering
// 1..N sequentially across contiguous selected lines (RESEARCH Open Question #1, pinned here).
import { describe, expect, it } from "vitest";
import { apply } from "./test-utils";
import { orderedList } from "@/components/editor/plugins/ordered-list";

describe("ordered-list plugin (D-P2-06/07/08)", () => {
  it("wraps a line 'x' -> '1. x'", () => {
    const { doc } = apply((state) => orderedList.run(state), "x", { from: 0, to: 0 });
    expect(doc).toBe("1. x");
  });

  it("3 contiguous lines 'a\\nb\\nc' number sequentially -> '1. a\\n2. b\\n3. c'", () => {
    const { doc } = apply((state) => orderedList.run(state), "a\nb\nc", { from: 0, to: 5 });
    expect(doc).toBe("1. a\n2. b\n3. c");
  });

  it("toggles off '1. x' -> 'x'", () => {
    const { doc } = apply((state) => orderedList.run(state), "1. x", { from: 3, to: 3 });
    expect(doc).toBe("x");
  });
});
