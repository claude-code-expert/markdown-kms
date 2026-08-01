# Changelog — 결정 기록 (append-only, 최신이 위)

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
