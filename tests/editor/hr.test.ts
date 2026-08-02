// D-P2-04/EDIT-04 contract for the hr (thematic break) plugin: inserts a '---' line of its
// own at the cursor position, leaving a fresh empty line below the cursor to continue typing.
import { describe, expect, it } from "vitest";
import { apply } from "./test-utils";
import { hr } from "@/components/editor/plugins/hr";

describe("hr plugin (thematic break insert)", () => {
  it("inserts a '---' thematic-break line at the cursor position in line 'x'", () => {
    const { doc, selection } = apply((state) => hr.run(state), "x", { from: 1, to: 1 });
    expect(doc).toBe("x\n---\n");
    expect(selection).toEqual({ from: 6, to: 6 });
  });
});
