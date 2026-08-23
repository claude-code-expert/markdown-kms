# 디자인 의뢰 브리프 — 읽는 순서

markdown-kms 전체 사이트를 새 디자인 시스템으로 개편하기 위해 현재 코드베이스를 검수하고 정리한 문서 세트다. 대상 독자는 이 프로젝트를 처음 보는 디자인 담당(다른 Claude Code 세션)이다.

## 문서 목록

1. **[01-OVERVIEW.md](./01-OVERVIEW.md)** — 제품이 뭔지, 스택이 뭔지, 재디자인에서 건드려도 되는 것과 안 되는 것.
2. **[02-SITEMAP.md](./02-SITEMAP.md)** — 전체 라우트 목록과 각 화면 접근 조건.
3. **[03-DESIGN-TOKENS-CURRENT.md](./03-DESIGN-TOKENS-CURRENT.md)** — 지금 쓰이는 색상·타이포·여백·반경·모션 토큰 원본값(라이트/다크). 새 디자인이 이걸 그대로 쓸 필요는 없지만, 뭘 바꾸는지 알려면 뭐가 있었는지부터 봐야 한다.
4. **[04-COMPONENTS.md](./04-COMPONENTS.md)** — 재사용 UI 컴포넌트(버튼·인풋·모달·카드 등)와 에디터 툴바 인벤토리. variant/상태별로 지금 어떻게 생겼는지.
5. **[05-WIREFRAMES.md](./05-WIREFRAMES.md)** — 화면 10개 각각의 레이아웃 구조(위→아래, 좌→우 영역 분해). 이 브리프의 핵심 문서.
6. **[06-USER-FLOWS.md](./06-USER-FLOWS.md)** — 화면을 가로지르는 핵심 사용자 흐름 6개.

## 이 브리프의 성격

전부 **현재 상태를 있는 그대로 기록**한 것이다. "이렇게 디자인하라"는 지시가 아니라 "지금 이렇게 생겼고 이런 기능이 있다"는 사실 기록이며, 색상 hex·픽셀 값도 전부 지금 코드에서 그대로 뽑은 것이다. 새 디자인이 색·타이포·레이아웃 비율·아이콘 세트를 전부 바꿔도 무방하다 — 단, 01-OVERVIEW.md의 "건드리면 안 되는 것" 목록에 있는 기능적 계약(권한 경계, 상태 종류, 데이터 구조)은 유지해야 기존 백엔드/테스트가 깨지지 않는다.

## 코드베이스 위치 참고

- 실제 컴포넌트: `src/components/`(ui/editor/layout/site/tree/document/preview/workspace/members/trash)
- 실제 페이지: `src/app/`(App Router)
- 현재 전역 토큰 원천: `src/app/globals.css`
- 기존(교체 대상) 디자인 근거 문서: `docs/design.md`, `docs/color.json`, `docs/ui-kit.html` — 새 디자인이 이 문서들을 대체하게 된다.
