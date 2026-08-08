// 05-08 Task 1 (TDD): clampRatio is the pure 20-80% clamp that both the
// resize-drag mousemove handler and (indirectly) the persisted splitRatio
// cookie rely on. Exported from EditorPreviewLayout.tsx (no separate lib
// file needed for one small function — Task 1 <action>).
import { describe, expect, it } from "vitest";
import { clampRatio } from "@/components/layout/EditorPreviewLayout";

describe("clampRatio", () => {
  it("passes a value already inside 20-80 through unchanged", () => {
    expect(clampRatio(50)).toBe(50);
  });

  it("clamps a value below 20 up to 20", () => {
    expect(clampRatio(10)).toBe(20);
  });

  it("clamps a value above 80 down to 80", () => {
    expect(clampRatio(95)).toBe(80);
  });

  it("leaves the boundary values 20 and 80 unchanged", () => {
    expect(clampRatio(20)).toBe(20);
    expect(clampRatio(80)).toBe(80);
  });
});
