// D-P2-06/07/08 contract for the inline-code plugin. Marker: '`' (single backtick).
import { describe, expect, it } from "vitest";
import { apply } from "./test-utils";
import { inlineCode } from "@/components/editor/plugins/inline-code";

describe("inline-code plugin (D-P2-06/07/08)", () => {
  it("empty selection inserts '``' with the caret between the marker pairs", () => {
    const { doc, selection } = apply((state) => inlineCode.run(state), "", { from: 0, to: 0 });
    expect(doc).toBe("``");
    expect(selection).toEqual({ from: 1, to: 1 });
  });

  it("non-empty selection 'x' wraps -> '`x`' with x re-selected", () => {
    const { doc, selection } = apply((state) => inlineCode.run(state), "x", { from: 0, to: 1 });
    expect(doc).toBe("`x`");
    expect(selection).toEqual({ from: 1, to: 2 });
  });

  it("duplicate application on '`x`' (selecting x) toggles off -> 'x'", () => {
    const { doc, selection } = apply((state) => inlineCode.run(state), "`x`", { from: 1, to: 2 });
    expect(doc).toBe("x");
    expect(selection).toEqual({ from: 0, to: 1 });
  });
});
