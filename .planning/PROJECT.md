# markdown-kms

## What This Is

워크스페이스 기반 마크다운 문서 관리 웹 애플리케이션. 사용자는 워크스페이스 안에서 폴더 트리로 문서를 조직하고, 듀얼 뷰(에디터 + 실시간 미리보기)로 CommonMark 0.31.2 정합 마크다운을 작성하며, 4단계 역할(Owner/Admin/Editor/Viewer) RBAC로 협업한다. 팀 내 문서 작성·조직·공유가 대상이다.

## Core Value

에디터에 입력하면 60ms 안에 미리보기에 정확히(CommonMark 0.31.2 + GFM 3종) 렌더링되는 문서 작성 경험. 이것이 무너지면 나머지 기능은 의미가 없다.

## Requirements

### Validated

(None yet — ship to validate)

### Active

R1 (P0 — 제품 성립선):
- [ ] 이메일 가입·로그인, 기본 워크스페이스 EDITOR 자동 가입
- [ ] 3분할 화면: 폴더 트리 사이드바 + 에디터 + 미리보기 + 하단 저장 상태 바
- [ ] 에디터 서식 전부(헤딩·인라인 4·목록 3·블록 3·삽입 3 = 플러그인 14종) + 60ms 미리보기
- [ ] 1초 디바운스 자동 저장 (seq 가드로 역순 도착 무시)
- [ ] 폴더 트리 CRUD — Closure Table, 서브트리 단일 쿼리
- [ ] 문서 CRUD, 소프트 삭제 + cascade, 휴지통 복원·완전 삭제
- [ ] RBAC 4역할, 서버 검증 403, 워크스페이스 생성(생성자=OWNER)

R2 (P1 — 협업·보존):
- [ ] 이미지 업로드(커서 위치 삽입), 툴바 lucide·툴팁·pressed
- [ ] 임시 저장(1분 스냅샷)·크래시 복구, 테마·레이아웃 전환
- [ ] 태그 최대 3개, 제목·본문·태그 검색(pg_trgm)
- [ ] 문서 .md export, 폴더 .zip export(구조 유지)
- [ ] 가입 신청·승인, 회원 검색·초대 메일(서명 일회성 토큰)

R3 (P2):
- [ ] 프레젠테이션 모드 + TOC 섹션 내비게이션
- [ ] Google OAuth (Auth.js provider 추가로 확장)

### Out of Scope

- 실시간 동시 편집(CRDT/OT) — 복잡도 대비 v1 가치 낮음, REQUIREMENT §7 명시 제외
- 댓글·버전 히스토리·위키 링크·외부 공개 링크·알림·감사 로그 — REQUIREMENT §7 명시 제외
- 다중 세션 충돌 병합 — last-write-wins로 확정 (PRD §6), seq 가드는 단일 세션 순서 보장 장치
- CommonMark 외 GFM 문법(footnote·autolink 등) — 파싱 범위는 취소선·태스크·표 3종만

## Context

- 코드 없는 설계 완료 상태. `docs/REQUIREMENT.md`(원 요구사항, 검증 완료) → `docs/PRD.md`(공백 9건 해석 확정, 최종 권한 매트릭스, 릴리스 R1~R3) → `docs/TRD.md`(스택·전체 DDL·API·프로토콜) 순으로 우선한다. 요구사항 모호점은 전부 PRD §2에서 이미 결정됐다.
- `docs/ui-kit.html` — 디자인 토큰 원천 (IBM Plex Sans/Mono, accent #2563eb, lucide, 순수 CSS 변수, 32 컴포넌트).
- 아키텍처 결정 이력은 `changelog/changelog.md` (append-only).
- 루트 `CLAUDE.md`에 불변식 10개 정리 (sanitize 필수, RBAC 서버 전용, Closure Table, seq 가드 등).

## Constraints

- **Tech stack**: Next.js 15 App Router + TypeScript / PostgreSQL 16 + Drizzle ORM / Auth.js v5 / CodeMirror 6 / unified(remark-gfm·rehype-sanitize) — TRD §1 확정, changelog 기록됨
- **패키지 매니저**: pnpm 고정 — npm/yarn 명령 금지
- **방법론**: TDD — 테스트가 구현보다 먼저 커밋. 에디터 서식 기능은 플러그인 1기능 1파일(`run(state): TransactionSpec` 순수 함수, 플러그인 간 import 금지)
- **Performance**: keystroke → 미리보기 DOM 갱신 p95 ≤ 60ms (10,000자 문서 기준, NFR-1.1)
- **Security**: sanitize 미통과 raw HTML 렌더링 금지(NFR-3.1), 권한 검증 서버 전용(NFR-3.2), 초대 토큰 서명·일회성·만료(NFR-3.3)
- **정합성**: CommonMark 0.31.2 spec.json 테스트 통과 기준 (NFR-5.1), export는 원문 무손실 (NFR-5.2)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Closure Table로 폴더 계층 저장 | 서브트리 단일 쿼리, 재귀 N+1 금지 (NFR-1.3) | — Pending |
| 소프트 삭제 + is_trash_root cascade | 휴지통엔 직접 삭제 항목만, 복원은 플래그 역연산 | — Pending |
| 자동 저장 seq 가드 (`WHERE saved_seq < :seq`) | NFR-1.2 "취소 금지" 유지하며 역순 도착 무시 | — Pending |
| ORM Prisma → Drizzle 교체 | 스키마=TS 코드로 DDL 1:1, closure 벌크는 sql 템플릿 | — Pending |
| 에디터 플러그인 = `run(state)` 순수 함수 | DOM 없이 테스트 가능, TDD 단위 = 모듈 경계 | — Pending |
| 검색은 pg_trgm ILIKE | 한국어에 PG 기본 FTS 사전 부재, trigram이 실용 해법 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-01 after initialization*
