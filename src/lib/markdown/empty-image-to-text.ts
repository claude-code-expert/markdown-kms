// src/lib/markdown/empty-image-to-text.ts — 목적지가 비어 있는 이미지(`![alt]()`)를 alt 텍스트로
// 바꾼다. 렌더 fork 전용이며 CommonMark 정합성 fork에는 절대 넣지 않는다(스펙은 `![foo]()`를
// `<img src="" alt="foo" />`로 렌더하는 게 정답이라 여기서 바꾸면 conformance가 깨진다).
//
// 왜 필요한가: `src=""`는 브라우저가 **현재 페이지 URL을 다시 받는** 동작으로 해석한다(HTML
// 명세상 빈 URL은 문서 기준 URL로 해석됨). React가 콘솔 경고로 잡아주는 것도 그 때문이다.
//
//   An empty string ("") was passed to the src attribute.
//
// 업로드 플레이스홀더 `![업로드 중...]()`가 바로 이 모양이라 파일을 고를 때마다 경고가 났고,
// 사용자가 손으로 `![]()`를 쳐도 같다. 플레이스홀더 문자열만 바꾸면 후자가 남으므로 렌더
// 단계에서 막는다 — 빈 src를 가진 img는 어떤 경로로 들어오든 유효한 출력이 아니다.
//
// alt를 텍스트로 남기는 이유: 업로드 중에는 미리보기에 "업로드 중..."이 보이는 편이 아무것도
// 없는 것보다 낫고, alt가 비었으면 자연히 아무것도 남지 않는다.
import type { Element, Root, RootContent } from "hast";

function isEmptySrcImage(node: RootContent): node is Element {
  if (node.type !== "element" || node.tagName !== "img") return false;
  const src = node.properties?.src;
  // sanitize가 허용되지 않은 프로토콜을 떼어내면 src 자체가 사라진다 — 그 경우도 같이 잡는다.
  return src === undefined || src === null || src === "";
}

function altText(node: Element): string {
  const alt = node.properties?.alt;
  return typeof alt === "string" ? alt : "";
}

function transform(children: RootContent[]): void {
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (isEmptySrcImage(child)) {
      children[i] = { type: "text", value: altText(child) };
      continue;
    }
    if ("children" in child && Array.isArray(child.children)) {
      transform(child.children as RootContent[]);
    }
  }
}

export function emptyImageToText() {
  return (tree: Root) => {
    transform(tree.children);
  };
}
