// D-P2-06/07/08 contract for the bold plugin. Marker: '**' (this plan's pinned convention).
// Mirrors RESEARCH Pattern 1's changeByRange shape: empty-selection insert (caret between
// markers), non-empty wrap (re-select wrapped text), duplicate-application toggle-off.
import { describe, expect, it } from "vitest";
import { apply } from "./test-utils";
import { bold } from "@/components/editor/plugins/bold";

describe("bold plugin (D-P2-06/07/08)", () => {
  it("empty selection inserts '****' with the caret between the marker pairs", () => {
    const { doc, selection } = apply((state) => bold.run(state), "", { from: 0, to: 0 });
    expect(doc).toBe("****");
    expect(selection).toEqual({ from: 2, to: 2 });
  });

  it("non-empty selection 'x' wraps -> '**x**' with x re-selected", () => {
    const { doc, selection } = apply((state) => bold.run(state), "x", { from: 0, to: 1 });
    expect(doc).toBe("**x**");
    expect(selection).toEqual({ from: 2, to: 3 });
  });

  it("duplicate application on '**x**' (selecting x) toggles off -> 'x'", () => {
    const { doc, selection } = apply((state) => bold.run(state), "**x**", { from: 2, to: 3 });
    expect(doc).toBe("x");
    expect(selection).toEqual({ from: 0, to: 1 });
  });

  // spec-less edge EDIT-02/encoding: Korean syllables are single UTF-16 code units each,
  // so marker placement at the selection's code-unit boundaries must not mojibake.
  it("wraps a Korean selection '가나' at code-unit boundaries -> '**가나**' with no mojibake", () => {
    const { doc, selection } = apply((state) => bold.run(state), "가나", { from: 0, to: 2 });
    expect(doc).toBe("**가나**");
    expect(selection).toEqual({ from: 2, to: 4 });
  });
});
