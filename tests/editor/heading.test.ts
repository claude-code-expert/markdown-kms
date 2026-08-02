// D-P2-06/07/08: heading is a line-prefix REPLACE (not a wrap) — level 1-4 -> '#'..'####',
// level 0 -> paragraph (no marker). Same-level re-application toggles back to paragraph
// (D-P2-06 toggle contract). Multi-line selections re-prefix each line independently
// (RESEARCH Open Question #1, resolved here as the pinned fixture).
//
// `heading` is a factory (`heading(level): EditorPlugin`, not a single object like the
// other 13 plugins) because it needs a level parameter — this shape is this plan's pinned
// import contract for 02-03/02-04 to implement against.
import { describe, expect, it } from "vitest";
import { apply } from "./test-utils";
import { heading } from "@/components/editor/plugins/heading";

describe("heading plugin (line-prefix replace, D-P2-06/07/08)", () => {
  it("heading(1) on 'x' (cursor) replaces the line -> '# x'", () => {
    const { doc } = apply((state) => heading(1).run(state), "x", { from: 0, to: 0 });
    expect(doc).toBe("# x");
  });

  it("heading(2) on '# x' replaces the prefix, no nesting -> '## x'", () => {
    const { doc } = apply((state) => heading(2).run(state), "# x", { from: 2, to: 2 });
    expect(doc).toBe("## x");
  });

  it("heading(1) on '# x' toggles off the same level -> 'x' (paragraph)", () => {
    const { doc } = apply((state) => heading(1).run(state), "# x", { from: 2, to: 2 });
    expect(doc).toBe("x");
  });

  it("heading(0) on '## x' replaces with paragraph -> 'x'", () => {
    const { doc } = apply((state) => heading(0).run(state), "## x", { from: 3, to: 3 });
    expect(doc).toBe("x");
  });

  it("heading(1) across a 2-line selection 'a\\nb' prefixes each line -> '# a\\n# b'", () => {
    const { doc } = apply((state) => heading(1).run(state), "a\nb", { from: 0, to: 3 });
    expect(doc).toBe("# a\n# b");
  });

  // [Rule 1 - WR-02/GAP-4] Sibling list/blockquote plugins replace a conflicting prefix
  // rather than nesting it; heading now strips a list marker too instead of prepending
  // '#' in front of it. Pipeline-accurate: verified via tests/markdown/plugin-render.test.ts
  // (renders '<h1>item</h1>', no stray list marker inside the heading).
  it("heading(1) on a list-prefixed line '- item' strips the marker -> '# item'", () => {
    const { doc } = apply((state) => heading(1).run(state), "- item", { from: 0, to: 0 });
    expect(doc).toBe("# item");
  });

  // [Rule 1 - WR-02/GAP-4] An existing level-5/6 ATX heading is valid CommonMark (typed by
  // hand — this app only writes 1-4). The strip must recognize it and REPLACE the marker,
  // not prepend in front of it (which would render '<h2>##### x</h2>' — nesting again).
  // Pipeline-accurate: verified via tests/markdown/plugin-render.test.ts.
  it("heading(2) on an existing level-5 heading '##### x' replaces the marker -> '## x'", () => {
    const { doc } = apply((state) => heading(2).run(state), "##### x", { from: 0, to: 0 });
    expect(doc).toBe("## x");
  });
});
