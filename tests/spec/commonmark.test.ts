// CommonMark 0.31.2 conformance runner (652 fixtures from commonmark-spec@0.31.2).
//
// Contract for 02-03 (lib/markdown/pipeline.ts):
//   export const markdownProcessorPreSanitize: Processor
//     A unified processor that runs remark-parse -> remarkGfmSubset -> remark-rehype
//     (allowDangerousHtml: true) and STOPS BEFORE rehype-sanitize/rehype-raw, emitting
//     HTML via a stringifier (e.g. rehype-stringify) so `String(await processor.process(md))`
//     equals the CommonMark spec's expected HTML fixture. TRD §10: "스펙은 raw HTML 보존을
//     기대하므로" the comparison must happen pre-sanitize, since sanitize intentionally
//     strips content the spec expects to survive (e.g. raw <div> blocks).
//
// This file is RED by design until 02-03 creates @/lib/markdown/pipeline.
import { describe, it, expect } from "vitest";
import { tests } from "commonmark-spec";
import { markdownProcessorPreSanitize } from "@/lib/markdown/pipeline";

describe("CommonMark 0.31.2 conformance", () => {
  for (const example of tests) {
    it(`#${example.number} (${example.section})`, async () => {
      const file = await markdownProcessorPreSanitize.process(example.markdown);
      expect(String(file)).toBe(example.html);
    });
  }
});
