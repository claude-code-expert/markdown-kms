// D-P2-06/07/08 contract for the strikethrough plugin. Marker: '~~' (this plan's pinned
// convention, matches the GFM strikethrough syntax the pipeline (02-01/02-03) parses).
import { describe, expect, it } from "vitest";
import { apply } from "./test-utils";
import { strikethrough } from "@/components/editor/plugins/strikethrough";

describe("strikethrough plugin (D-P2-06/07/08)", () => {
  it("empty selection inserts '~~~~' with the caret between the marker pairs", () => {
    const { doc, selection } = apply((state) => strikethrough.run(state), "", { from: 0, to: 0 });
    expect(doc).toBe("~~~~");
    expect(selection).toEqual({ from: 2, to: 2 });
  });

  it("non-empty selection 'x' wraps -> '~~x~~' with x re-selected", () => {
    const { doc, selection } = apply((state) => strikethrough.run(state), "x", { from: 0, to: 1 });
    expect(doc).toBe("~~x~~");
    expect(selection).toEqual({ from: 2, to: 3 });
  });

  it("duplicate application on '~~x~~' (selecting x) toggles off -> 'x'", () => {
    const { doc, selection } = apply((state) => strikethrough.run(state), "~~x~~", {
      from: 2,
      to: 3,
    });
    expect(doc).toBe("x");
    expect(selection).toEqual({ from: 0, to: 1 });
  });
});
