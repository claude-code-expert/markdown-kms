// WR-01 (05-REVIEW): file.name is client-controlled and was spliced unescaped into the
// inserted markdown's alt text (`![${file.name}](url)`), letting a crafted filename break
// out of the alt and inject a sibling markdown link/image. sanitizeAlt is a pure, exported
// function so this stays a unit test — no EditorView/DOM needed.
import { describe, expect, it } from "vitest";
import { sanitizeAlt } from "@/components/editor/useImageUpload";

describe("sanitizeAlt (WR-01: markdown injection via file.name)", () => {
  it("passes an ordinary filename through unchanged", () => {
    expect(sanitizeAlt("photo.png")).toBe("photo.png");
  });

  it("strips markdown-structural characters so a crafted filename can't inject a sibling link", () => {
    const malicious = "x](https://evil.example/steal) [y";
    const safe = sanitizeAlt(malicious);

    expect(safe).not.toMatch(/[[\]()]/);
    const insert = `![${safe}](/uploads/real.png)`;
    expect(insert.match(/!\[.*?\]\(.*?\)/g)).toHaveLength(1); // exactly one image construct
  });

  it("strips backticks and newlines", () => {
    expect(sanitizeAlt("a`b\nc\rd")).toBe("abcd");
  });
});
