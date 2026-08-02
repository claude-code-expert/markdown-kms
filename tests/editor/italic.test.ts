// D-P2-06/07/08 contract for the italic plugin. Marker: single '*' (this plan's pinned
// convention — chosen over '_' because '*' has no intra-word emphasis restriction, so a
// mid-word wrap still emphasizes; RESEARCH objective note).
import { describe, expect, it } from "vitest";
import { apply } from "./test-utils";
import { italic } from "@/components/editor/plugins/italic";

describe("italic plugin (D-P2-06/07/08)", () => {
  it("empty selection inserts '**' with the caret between the marker pairs", () => {
    const { doc, selection } = apply((state) => italic.run(state), "", { from: 0, to: 0 });
    expect(doc).toBe("**");
    expect(selection).toEqual({ from: 1, to: 1 });
  });

  it("non-empty selection 'x' wraps -> '*x*' with x re-selected", () => {
    const { doc, selection } = apply((state) => italic.run(state), "x", { from: 0, to: 1 });
    expect(doc).toBe("*x*");
    expect(selection).toEqual({ from: 1, to: 2 });
  });

  it("duplicate application on '*x*' (selecting x) toggles off -> 'x'", () => {
    const { doc, selection } = apply((state) => italic.run(state), "*x*", { from: 1, to: 2 });
    expect(doc).toBe("x");
    expect(selection).toEqual({ from: 0, to: 1 });
  });

  // Backstop (flagged, pending manual confirmation — must_haves nested-emphasis-ordering
  // truth): selecting 'x' inside '**x**' has a single '*' immediately on each side, which a
  // naive single-char toggle-off check would misread as an italic marker and strip the bold
  // pair instead. The guard must notice each neighboring '*' is itself preceded/followed by
  // another '*' (part of the bold pair, not a lone italic marker) and wrap instead, nesting
  // italic inside bold: '**' + '*x*' + '**' -> '***x***' (valid CommonMark strong+em nesting).
  it("guard: does not toggle-off when the neighboring '*' is the second star of a '**' bold pair", () => {
    const { doc, selection } = apply((state) => italic.run(state), "**x**", { from: 2, to: 3 });
    expect(doc).toBe("***x***");
    expect(selection).toEqual({ from: 3, to: 4 });
  });
});
