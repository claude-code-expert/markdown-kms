// D-P2-09 Insert UX Contract (skeleton, no dialog): Image -> '![alt](url)' with the editable
// placeholder pre-selected so typing can replace it immediately.
import { describe, expect, it } from "vitest";
import { apply } from "./test-utils";
import { image } from "@/components/editor/plugins/image";

describe("image plugin (D-P2-09 skeleton insert)", () => {
  it("empty selection inserts '![alt](url)' with 'alt' selected", () => {
    const { doc, selection } = apply((state) => image.run(state), "", { from: 0, to: 0 });
    expect(doc).toBe("![alt](url)");
    expect(selection).toEqual({ from: 2, to: 5 });
  });

  it("non-empty selection 'x' inserts '![x](url)' with 'url' selected", () => {
    const { doc, selection } = apply((state) => image.run(state), "x", { from: 0, to: 1 });
    expect(doc).toBe("![x](url)");
    expect(selection).toEqual({ from: 5, to: 8 });
  });
});
