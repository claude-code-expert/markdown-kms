# Changelog — 결정 기록 (append-only, 최신이 위)

## 2026-08-16 — 디자인 시스템 적용: 폰트 IBM Plex → DM Sans/Mono, 다크 팔레트 전면 교체, 전역 radius/motion 토큰 도입 (Phase 9)
- **결정**: (1) 폰트를 `next/font/google`의 IBM Plex Sans/Mono에서 `docs/design_system/fonts/*.woff2`(DM Sans 400/500/600/700, DM Mono 400)를 이식한 `next/font/local` 자체호스팅으로 교체(D-03) — CSS 변수명(`--font-ibm-plex-sans/mono`)은 하위 CSS Modules 호환을 위해 그대로 유지. (2) `[data-theme="dark"]` + `@media prefers-color-scheme` 다크 팔레트를 기존 blue-accent(`--accent: #3b82f6`)에서 Dracula 파생 팔레트(`--accent: #7359f8`, `--bg: #0e0d11` 등)로 전면 교체, 라이트 `:root` 색상은 무변경(D-04). (3) `--radius-sm/md/lg`(squircle 6/12/18px), `--duration-fast/standard/slow`(180/240/300ms), `--ease-fluid/--ease-elastic` 8개 전역 토큰을 신설해 테마 무관 공통 적용(D-05).
- **이유**: `docs/design_system/`(draculatheme.com 스크랩, 카피·이미지는 미사용하고 토큰만 추출) 룩앤필을 랜딩·워크스페이스 메인·에디터 3개 화면에 적용해 "이 페이지 뭘로 만들었지" 신선한 인상을 주려는 사용자 요구(09-CONTEXT.md 사용자 발화). 색상만 바꾸는 게 아니라 타입/반경/모션까지 전역 교체해야 그 인상이 성립한다는 판단.
- **대안**: (1) 다크 팔레트만 교체하고 라이트도 유지 — 검토했으나 D-06에서 라이트는 `docs/ui-kit.html`을 색상 원천으로 계속 쓰기로 확정, 다크만 신규 파생. (2) Google Fonts CDN에서 DM Sans 직접 로드 — 자체호스팅(`public/fonts/`) 대신 CDN 왕복이 생겨 기각. (3) 반경/모션을 컴포넌트별 하드코딩 유지 — 전역 토큰 없이는 6개 UI 프리미티브 간 일관성이 깨져 기각.
- **영향**: `src/app/layout.tsx`(폰트 로더 교체) · `src/app/globals.css`(다크 팔레트 전면 교체 + 전역 토큰 8개 신설) · `src/components/ui/*.module.css`(6개 프리미티브 토큰 소비) · 로그인/회원가입/대시보드/에디터 화면 CSS Modules 전체(09-01~09-03). `CLAUDE.md` §문서 체계의 `docs/ui-kit.html` 설명을 "라이트=ui-kit.html 색상 + 신규 전역 타입/반경/모션, 다크=신규 Dracula 파생 색상 + 동일 전역 타입/반경/모션"으로 갱신(D-06). 신규 백엔드 기능·API 계약 변경 없음 — AUTH-01/02·WS-01/02·DOC-01/02는 `e2e/design-system-flow.spec.ts` 통합 회귀로 무변경 확인.

## 2026-08-02 — 미리보기 줄바꿈: 단일 엔터 → `<br>` (CommonMark 0.31.2 이탈, remark-breaks 추가)
- **결정**: 렌더 파이프라인에 `remark-breaks`를 추가해 단일 `\n`(엔터 1번)을 hard break `<br>`로 렌더. Phase 2 UAT 중 제품 오너 지시로 잠긴 CommonMark 0.31.2 soft-break 불변식(TRD §5)을 명시적으로 override. 적용 범위는 렌더 fork(`markdownProcessor`·`markdownProcessorReact`)뿐 — CommonMark 정합성 fork(`markdownProcessorPreSanitize`)는 순수 유지.
- **이유**: 에디터 사용자는 엔터=줄바꿈을 기대하나 순수 CommonMark은 단일 soft break를 공백 처리해 "엔터가 미리보기에 반영 안 됨"으로 보였다(UAT 리포트).
- **대안**: (1) 순수 CommonMark 유지 — 스펙 정합·불변식 보존이나 사용자 기대와 어긋남(오너 기각). (2) 전역 적용 — CommonMark conformance suite 651/652가 깨져 스펙 참조 fork의 존재 의미 상실. 렌더 fork 한정으로 둘 다 회피.
- **영향**: `remark-breaks@4` 의존성 신규 추가. `src/lib/markdown/pipeline.ts` `baseProcessor({breaks})` 분기. TRD §1 스택 행·§5 다이어그램+이탈 불릿 개정. 잠금 테스트 `tests/markdown/line-breaks.test.ts` 신규(렌더=`<br>`, conformance fork=순수). 기존 markdown/spec/editor 스위트 734건 회귀 없음(단일 `\n` 픽스처 부재). export 원문(NFR-5.2)은 파이프라인 역변환 안 하므로 무영향.

## 2026-08-02 — 워크스페이스 삭제: 하드 cascade → 소프트 삭제 (D-15 override)
- **결정**: `DELETE /api/workspaces/:id`를 하드 cascade가 아니라 소프트 삭제(`workspace.is_deleted=true`)로 확정. 행·멤버십 보존, 활성 조회에서 제외, OWNER 전용·기본 워크스페이스 삭제 불가는 유지. Phase 1 실행 중(Plan 01-04 Task 3 decision checkpoint)에 제품 오너 지시로 잠긴 결정 D-15를 명시적으로 override.
- **이유**: 워크스페이스 삭제를 복구 가능하게 하려는 오너 요구. 문서·폴더 소프트 삭제(Phase 4)와 삭제 의미를 일관되게.
- **대안**: 하드 cascade(원 D-15·PRD §3·TRD `ON DELETE CASCADE`) — 스펙 정합·최소지만 비가역이라 오너가 기각. 연구는 워크스페이스 소프트삭제를 Phase-1 scope creep으로 봤으나 오너가 override.
- **영향**: TRD §3(`workspace.is_deleted` 컬럼 추가)·PRD §3·CONTEXT D-15·`01-04-PLAN.md` Task 4 개정. 새 Drizzle 마이그레이션 1건. `src/lib/db-membership.ts` 활성 조회에 `is_deleted=false` 필터, `tests/workspace/delete.test.ts` soft 의미로 재작성. 복원 UI는 Phase 4 휴지통과 함께 도입.

## 2026-08-01 — ORM을 Prisma에서 Drizzle로 교체, 패키지 매니저 pnpm 고정
- **결정**: TRD 확정 당일 사용자 지시로 ORM을 Drizzle ORM으로 교체. 전 명령은 pnpm 경유.
- **이유**: 스키마가 TS 코드(`src/db/schema.ts`)라 TRD §3 DDL과 1:1 대응, Closure Table 벌크 연산을 `sql` 템플릿으로 그대로 쓸 수 있다.
- **대안**: Prisma — 마이그레이션 표준이지만 raw SQL 의존 구간(closure 연산·부분 인덱스)이 많아 이점이 줄어듦.
- **영향**: 코드 없음 단계라 마이그레이션 비용 0. TRD §1·§3·§11, CLAUDE.md 갱신 완료.

## 2026-08-01 — 개발 방법론: GSD 워크플로 + TDD + 에디터 플러그인 아키텍처
- **결정**: 개발은 GSD(phase별 plan→execute→verify)로 진행. TDD(테스트 선행 커밋). 에디터 서식 기능 14종은 1기능 1파일 플러그인(`run(state): TransactionSpec` 순수 함수, 플러그인 간 import 금지).
- **이유**: 플러그인 독립성 보장 요구(사용자 지시). 순수 함수 인터페이스는 DOM 없이 테스트 가능해 TDD 단위와 모듈 경계가 일치한다.
- **대안**: 툴바 핸들러를 에디터 컴포넌트에 인라인 — 기능 추가마다 한 파일이 비대해지고 테스트가 EditorView(DOM)에 묶임.
- **영향**: TRD §6(신설)·§10, CLAUDE.md 불변식에 반영. 기존 섹션 번호 §6~§10 → §7~§11로 이동.

## 2026-08-01 — 초기 스택 확정 (TRD v1.0.0)
- **결정**: Next.js 15 App Router 모놀리스 + PostgreSQL 16 + Auth.js v5 + CodeMirror 6 + unified(remark-gfm·rehype-sanitize) + Vitest/Playwright.
- **이유**: P0~P2 요구를 최소 부품으로 커버. 부분 인덱스(NFR-2.2)·pg_trgm 검색(FR-D4)이 PostgreSQL 지목, OAuth 확장 구조(FR-A2)는 Auth.js provider 추가로 대응.
- **대안**: SPA+별도 API 서버(부품 증가), MySQL(부분 인덱스 없음), Monaco(무게), textarea(커서 API 부재).
- **영향**: 신규 확정이라 깨지는 것 없음. 상세 근거는 docs/TRD.md §1.
