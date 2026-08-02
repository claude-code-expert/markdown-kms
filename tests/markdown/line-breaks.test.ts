// Phase 2 UAT decision (TRD §5 deviation): the RENDERING pipeline treats a single Enter
// (soft line ending) as a visible <br>, via remark-breaks. This is intentionally NOT strict
// CommonMark 0.31.2 (where a lone "\n" is a soft break rendered as whitespace). The deviation
// is scoped to the rendering forks only — the CommonMark-conformance fork stays pure, which
// this file pins so the two never silently converge.
import { describe, it, expect } from "vitest";
import { markdownProcessor, markdownProcessorPreSanitize } from "@/lib/markdown/pipeline";

describe("line-break rendering (remark-breaks, rendering forks only)", () => {
  it("renders a single newline as <br> in the rendering pipeline", async () => {
    const html = String(await markdownProcessor.process("가\n나"));
    expect(html).toContain("<br");
    expect(html).toContain("가");
    expect(html).toContain("나");
  });

  it("still renders a blank line as separate paragraphs", async () => {
    const html = String(await markdownProcessor.process("가\n\n나"));
    expect(html).toContain("<p>가</p>");
    expect(html).toContain("<p>나</p>");
  });

  it("keeps the CommonMark-conformance fork pure: a single newline is NOT a <br> there", async () => {
    const file = await markdownProcessorPreSanitize.process("가\n나");
    expect(String(file.value)).not.toContain("<br");
  });
});
