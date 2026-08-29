// 빈 목적지 이미지(`![alt]()`)가 `<img src="">`로 새어나가면 브라우저가 현재 페이지 URL을
// 다시 받고(HTML 명세: 빈 URL = 문서 기준 URL), React는 콘솔 경고를 낸다.
// 업로드 플레이스홀더 `![업로드 중...]()`가 정확히 이 모양이라 실제로 터졌던 버그다.
import { describe, expect, it } from "vitest";
import { markdownProcessor, markdownProcessorPreSanitize } from "@/lib/markdown/pipeline";

const render = async (md: string) => String(await markdownProcessor.process(md));

describe("빈 src 이미지 (렌더 fork)", () => {
  it('`![alt]()` 는 <img src=""> 를 만들지 않는다', async () => {
    const html = await render("![업로드 중...]()");
    expect(html).not.toContain("<img");
    expect(html).not.toContain('src=""');
  });

  it("alt 텍스트는 남긴다 — 업로드 중 미리보기가 비어 보이지 않게", async () => {
    expect(await render("![업로드 중...]()")).toContain("업로드 중...");
  });

  it("alt 가 비면 아무것도 남기지 않는다", async () => {
    const html = await render("![]()");
    expect(html).not.toContain("<img");
    expect(html.replace(/<\/?p>/g, "").trim()).toBe("");
  });

  it("정상 이미지는 그대로 렌더한다", async () => {
    const html = await render("![고양이](/api/uploads/r2/w/ws-1/abc.png)");
    expect(html).toContain("<img");
    expect(html).toContain('src="/api/uploads/r2/w/ws-1/abc.png"');
    expect(html).toContain('alt="고양이"');
  });

  // 링크·목록 안에 중첩된 경우도 재귀로 잡아야 한다 — 최상위만 훑으면 새어나간다.
  it("중첩된 빈 이미지도 잡는다", async () => {
    const html = await render("- [![업로드 중...]()](https://example.com)");
    expect(html).not.toContain("<img");
    expect(html).toContain("업로드 중...");
  });

  // sanitize가 허용하지 않는 프로토콜의 src를 떼어내면 src 없는 img가 남는다.
  it("sanitize 가 src 를 제거한 이미지도 잡는다", async () => {
    const html = await render('<img src="javascript:alert(1)" alt="위험">');
    expect(html).not.toContain("<img");
    expect(html).not.toContain("javascript:");
  });
});

describe("CommonMark 정합성 fork는 건드리지 않는다", () => {
  // 스펙은 `![foo]()` 를 `<img src="" alt="foo" />` 로 렌더하는 게 정답이다. 이 fork에까지
  // 변환을 넣으면 conformance 스위트가 깨진다.
  it('`![foo]()` 를 <img src="" /> 그대로 낸다', async () => {
    const html = String((await markdownProcessorPreSanitize.process("![foo]()")).value);
    expect(html).toContain('src=""');
    expect(html).toContain('alt="foo"');
  });
});
