# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트

워크스페이스 기반 마크다운 문서 관리 웹앱(markdown-kms). 아직 코드가 없는 설계 단계이며, 구현은 `pnpm create next-app`(scaffold 스킬 규칙) 스캐폴딩으로 시작한다.

`.claude/CLAUDE.md`는 이 프로젝트가 아니라 드롭인 하네스(MCP·commands·skills·hooks) 문서다. 혼동하지 말 것.

## 언어

**모든 문서·산출물은 한글로 작성한다.** `.planning/`의 GSD 산출물(SPEC·PLAN·VERIFICATION·UAT·REVIEW 등), `docs/`, 커밋 메시지 본문, PR 설명, 코드 주석의 설명 문장까지 포함한다. GSD 커맨드·스킬·서브에이전트가 영문으로 생성한 산출물은 한글로 다시 작성한다. 예외는 다음뿐: 코드 식별자, 파일 경로, 라이브러리·API 이름, frontmatter 키(`status`/`phase` 등 구조 필드), 고정된 기술 용어(GFM·CommonMark 등).

## 문서 체계 (우선순위 순)

1. `docs/REQUIREMENT.md` — 원 요구사항 (FR/NFR/US, CommonMark 0.31.2 기준)
2. `docs/PRD.md` — **REQUIREMENT의 공백 9건에 대한 해석 확정(§2)**, 최종 권한 매트릭스(§3), 릴리스 단위 R1(P0)/R2(P1)/R3(P2). REQUIREMENT와 충돌 시 PRD 우선
3. `docs/TRD.md` — 스택·DDL·API·프로토콜 확정. 스키마 변경은 TRD §3 갱신 후 마이그레이션
4. `docs/ui-kit.html` — **라이트 모드** 색상 토큰 원천(accent `#2563eb`, lucide, 순수 CSS 변수). Phase 9(design-system-application, D-06)부터 다크 모드는 별도 파생 팔레트(`docs/design_system/`의 Dracula 스크랩에서 토큰만 추출 — 카피/이미지는 브랜드 자체가 아니므로 미사용)로 전면 교체됐고, 타이포(DM Sans/DM Mono 자체호스팅)·반경(`--radius-sm/md/lg`)·모션(`--duration-*`/`--ease-*`)은 라이트/다크 공통 전역 토큰이다. 새 UI는 **라이트=ui-kit.html 색상 + 신규 전역 타입/반경/모션, 다크=신규 Dracula 파생 색상(`--accent #7359f8` 등) + 동일 전역 타입/반경/모션**을 이식해 쓴다

기능 질문이 생기면 PRD §2 표부터 확인한다. 요구사항의 모호점은 전부 거기서 이미 결정됐다.

## 스택 (TRD §1에서 확정)

Next.js 15 App Router + TypeScript / PostgreSQL 16 + Drizzle ORM / Auth.js v5 / CodeMirror 6 / unified(remark-gfm + rehype-sanitize) / Vitest + Playwright / CSS Modules. 패키지 매니저는 **pnpm 고정** — npm/yarn 명령을 쓰지 않는다.

## 개발 프로세스

- **GSD 워크플로**로 진행한다. 최초 1회 `/gsd-new-project`, 이후 phase마다 `/gsd-discuss-phase` → `/gsd-plan-phase` → `/gsd-execute-phase` → `/gsd-verify-work`. 산출물은 `.planning/`에 쌓인다.
- **TDD**: 실패하는 테스트 먼저 → 최소 구현 → 리팩터 (TRD §10). 특히 에디터 플러그인은 테스트 파일이 구현 파일보다 먼저 커밋된다.

## 명령어 (스캐폴딩 후 유효)

- `pnpm dev` / `pnpm build` — 개발 서버 / 프로덕션 빌드
- `pnpm vitest run` — 단위 테스트 전체, 단일 파일은 `pnpm vitest run tests/editor/bold.test.ts`, 단일 케이스는 `-t "이름"` 추가
- `pnpm exec playwright test` — E2E·60ms 성능 측정
- `pnpm drizzle-kit generate` → `pnpm drizzle-kit migrate` — 스키마 마이그레이션 (원천은 TRD §3, 스키마 파일 `src/db/schema.ts`)
- lint+typecheck+test 일괄은 `/check` (하네스 커맨드)

## 지켜야 할 불변식

깨면 요구사항 위반이 되는 것들. 상세 근거는 괄호의 문서 위치.

- **에디터 서식 기능은 플러그인 1기능 1파일.** `components/editor/plugins/`에 `run(state): TransactionSpec` 순수 함수로 구현하고, 플러그인 간 import 금지. DOM(EditorView) 접근 금지 — 테스트 독립성의 전제다 (TRD §6)
- **마크다운 파이프라인은 `lib/markdown/` 단일 원천.** 미리보기·프레젠테이션이 공유한다. GFM은 취소선·태스크·표 3종만 활성 — footnote 등 다른 GFM 문법을 켜지 않는다 (TRD §5)
- **sanitize 없는 렌더링 금지.** raw HTML은 rehype-sanitize 허용 목록 통과분만 렌더 (NFR-3.1)
- **권한 검증은 서버 전용.** 모든 변경 API는 `lib/rbac.ts`의 `requireRole` 경유, 위반 403. UI 버튼 숨김은 보안이 아니다 (NFR-3.2, 매트릭스는 PRD §3)
- **폴더 계층은 Closure Table.** 깊이 비례 재귀 쿼리(N+1) 금지, 서브트리 조회는 고정 쿼리 수 (NFR-1.3, 연산별 SQL은 TRD §4)
- **삭제는 소프트 삭제 + cascade.** 활성 조회는 `is_deleted = false` 부분 인덱스를 타야 하고, 휴지통 노출은 `is_trash_root = true`만 (PRD §2-2, TRD §4)
- **자동 저장은 seq 가드.** `WHERE saved_seq < :seq`로 역순 도착을 무시한다. 이 조건을 빼면 옛 내용이 새 내용을 덮는다 (TRD §7)
- **태그 최대 3개는 서버에서도 검증** (REQUIREMENT §6), **draft는 문서당 1행 upsert** (NFR-2.1)
- **export는 `document.content` 원문 그대로.** 파이프라인 역변환 금지 (NFR-5.2)
- 미리보기 반영 p95 ≤ 60ms 예산 초과 전까지 블록 메모이제이션 등 선제 최적화 금지 — 측정 먼저 (TRD §5)
