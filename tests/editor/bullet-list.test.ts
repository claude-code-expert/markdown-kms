// D-P2-06/07/08 contract for the bullet-list plugin. Marker: '- ' (line prefix, not a wrap).
import { describe, expect, it } from "vitest";
import { apply } from "./test-utils";
import { bulletList } from "@/components/editor/plugins/bullet-list";

describe("bullet-list plugin (D-P2-06/07/08)", () => {
  it("wraps a line 'x' -> '- x'", () => {
    const { doc } = apply((state) => bulletList.run(state), "x", { from: 0, to: 0 });
    expect(doc).toBe("- x");
  });

  it("toggles off '- x' -> 'x'", () => {
    const { doc } = apply((state) => bulletList.run(state), "- x", { from: 2, to: 2 });
    expect(doc).toBe("x");
  });

  it("empty line -> '- '", () => {
    const { doc } = apply((state) => bulletList.run(state), "", { from: 0, to: 0 });
    expect(doc).toBe("- ");
  });

  it("2-line selection 'a\\nb' prefixes each line -> '- a\\n- b'", () => {
    const { doc } = apply((state) => bulletList.run(state), "a\nb", { from: 0, to: 3 });
    expect(doc).toBe("- a\n- b");
  });
});
