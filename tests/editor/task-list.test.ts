// D-P2-06/07/08 contract for the task-list plugin. Marker: '- [ ] ' (line prefix), parsed by
// mdast-util-gfm-task-list-item downstream (02-01 RESEARCH).
import { describe, expect, it } from "vitest";
import { apply } from "./test-utils";
import { taskList } from "@/components/editor/plugins/task-list";

describe("task-list plugin (D-P2-06/07/08)", () => {
  it("wraps a line 'x' -> '- [ ] x'", () => {
    const { doc } = apply((state) => taskList.run(state), "x", { from: 0, to: 0 });
    expect(doc).toBe("- [ ] x");
  });

  it("toggles off '- [ ] x' -> 'x'", () => {
    const { doc } = apply((state) => taskList.run(state), "- [ ] x", { from: 6, to: 6 });
    expect(doc).toBe("x");
  });
});
