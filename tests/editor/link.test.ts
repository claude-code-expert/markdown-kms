// D-P2-09 Insert UX Contract (skeleton, no dialog): Link -> '[텍스트](url)' with the
// editable placeholder pre-selected so typing can replace it immediately.
import { describe, expect, it } from "vitest";
import { apply } from "./test-utils";
import { link } from "@/components/editor/plugins/link";

describe("link plugin (D-P2-09 skeleton insert)", () => {
  it("empty selection inserts '[텍스트](url)' with '텍스트' selected", () => {
    const { doc, selection } = apply((state) => link.run(state), "", { from: 0, to: 0 });
    expect(doc).toBe("[텍스트](url)");
    expect(selection).toEqual({ from: 1, to: 4 });
  });

  it("non-empty selection 'x' inserts '[x](url)' with 'url' selected", () => {
    const { doc, selection } = apply((state) => link.run(state), "x", { from: 0, to: 1 });
    expect(doc).toBe("[x](url)");
    expect(selection).toEqual({ from: 4, to: 7 });
  });
});
