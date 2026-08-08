---
phase: 06-tags-search-export
plan: 02
subsystem: api

tags: [drizzle, postgresql, zod, react, css-modules, rbac]

requires:
  - phase: 06-tags-search-export
    provides: "06-01: document_tag table ((document_id, tag) composite PK, FK cascade), tagsBodySchema (<=3, trim/min(1)), NFC transform pattern"

provides:
  - "replaceTags(documentId, tags[], client) — single db.transaction: DELETE all -> case-insensitive dedup (first-seen casing) -> INSERT -> COUNT>3 throw TagLimitError (auto-rollback)"
  - "getTags(documentId, client) — string[] read"
  - "PUT /api/documents/[id]/tags — EDITOR+, 4-stage IDOR shape, TagLimitError -> 400"
  - "TagBar component — chip input mounted between titleRow and body, 3-limit disabled, duplicate-rejected, save-fail revert, all var(--token) refs"
  - "d/[docId]/page.tsx RSC wiring — getTags(docId) joins the existing Promise.all, flows to DocumentWorkspace as initialTags"

affects: [06-03-search, 06-04-export]

actuals:
  tokens: 5800
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "TagBar의 즉시-로컬-반영+백그라운드 PUT은 handleTitleChange(제목 입력)와 동일 원칙 — 트리의 '서버 확정 후 반영' 원칙과 다른 카테고리(태그는 이미 확정된 문서에 대한 replace-all이라 낙관적 갱신이 안전)"
    - "라우트의 TagLimitError -> 400 매핑은 tagsBodySchema의 max(3) 뒤에 있는 벨트-앤-서스펜더 백스톱 — 직접 API 우회(zod를 거치지 않는 호출)에서만 실제로 도달 가능, replace.test.ts가 replaceTags를 직접 호출해 그 경로를 증명"

key-files:
  created:
    - src/app/api/documents/[id]/tags/route.ts
    - src/components/document/TagBar.tsx
    - src/components/document/TagBar.module.css
    - tests/tags/helpers.ts
    - tests/tags/replace.test.ts
    - tests/tags/rbac.test.ts
  modified:
    - src/lib/documents.ts
    - src/components/document/DocumentWorkspace.tsx
    - "src/app/(main)/w/[wsId]/d/[docId]/page.tsx"

key-decisions:
  - "TagBar의 at-limit-disabled/duplicate-rejected/save-fail 세 상태를 Task 1에서 한 번에 구현 — Task 2로 쪼개면 그 사이 커밋에서 컴포넌트가 절반만 동작하는 상태가 남는다. Task 2는 그 결과를 rbac.test.ts로 확인하는 역할(신규 프로덕션 코드 없음)로 재정의"
  - "getTags는 06-PATTERNS 확정 코드의 {tag: string}[] select 결과를 string[]로 map해 반환 — TagBar initialTags prop과 replaceTags의 반환 타입(string[])을 통일해 페이지/컴포넌트 양쪽에서 별도 변환 없이 쓴다"

patterns-established: []

requirements-completed: [DOC-03]

coverage:
  - id: D1
    description: "replaceTags가 단일 트랜잭션으로 기존 태그를 전부 교체하고(replace-all), 4번째 태그 삽입 시 COUNT(*)>3 로 TagLimitError를 던져 트랜잭션이 롤백된다(이전 태그 집합 보존)"
    requirement: "DOC-03"
    verification:
      - kind: unit
        ref: "tests/tags/replace.test.ts#replaceTags / getTags"
        status: pass
    human_judgment: false
  - id: D2
    description: "replaceTags가 대소문자만 다른 중복 태그를 첫 등장 원형을 보존하며 1개로 dedup한다"
    requirement: "DOC-03"
    verification:
      - kind: unit
        ref: "tests/tags/replace.test.ts#dedups case-insensitively, preserving the first-seen casing"
        status: pass
    human_judgment: false
  - id: D3
    description: "PUT /api/documents/:id/tags가 EDITOR+이고, 3개 이하 200 / 4개 400 / 비-uuid 400을 반환한다"
    requirement: "DOC-03"
    verification:
      - kind: unit
        ref: "tests/tags/replace.test.ts#PUT /api/documents/[id]/tags"
        status: pass
    human_judgment: false
  - id: D4
    description: "VIEWER는 403이고 document_tag가 변경되지 않으며, 타 워크스페이스 문서 태그 수정 시도는 403(IDOR)이고 DB가 변경되지 않는다"
    requirement: "DOC-03"
    verification:
      - kind: unit
        ref: "tests/tags/rbac.test.ts#RBAC/IDOR — PUT /api/documents/[id]/tags"
        status: pass
    human_judgment: false
  - id: D5
    description: "TagBar가 DocumentWorkspace의 titleRow와 body 사이에 렌더되고, RSC의 getTags 결과로 초기 chip이 채워지며, 3개 도달 시 입력이 비활성화되고, 중복/저장실패 상태가 UI-SPEC 카피대로 표시된다"
    requirement: "DOC-03"
    verification: []
    human_judgment: true
    rationale: "Playwright MCP가 이 실행 환경에 연결되어 있지 않아 실 브라우저 렌더/상호작용(3개 제한 비활성, 중복 에러 문구, X 제거, 새로고침 후 유지, 다크/라이트)을 자동 확인할 수 없다 — 06-02-PLAN.md Task 2의 human-check 항목 그대로 사람의 UAT 필요"

duration: 15min
completed: 2026-08-08
status: complete
---

# Phase 6 Plan 2: Tags End-to-End Summary

**태그 축을 데이터(replaceTags 트랜잭션)→라우트(PUT EDITOR+ IDOR)→UI(TagBar chip)→RSC(getTags 초기값)까지 관통시킨 tracer — 서버 COUNT 트랜잭션이 3개 제한의 최종 권위**

## Performance

- **Duration:** 15 min
- **Tasks:** 2 (Task 2는 신규 프로덕션 코드 없이 Task 1 구현을 확인하는 테스트만 추가)
- **Files modified:** 9 (3 modified, 6 created)

## Accomplishments
- `replaceTags`(단일 `db.transaction`: DELETE 전체 → trim+NFC+대소문자무시 dedup(첫 등장 원형 보존) → INSERT → `COUNT(*)>3` 이면 `TagLimitError` throw, 자동 롤백) + `getTags` — `src/lib/documents.ts`에 `closure.ts`의 트랜잭션+throw 관례를 그대로 채택
- `PUT /api/documents/[id]/tags` — `documents/[id]/route.ts` PUT의 4단계 IDOR shape(uuid 검증 → `resolveWorkspaceIdForDocument` → `requireRole("EDITOR")` → zod parse) 그대로 복제, `TagLimitError` → 400 매핑
- `TagBar` 컴포넌트 — chip 목록 + bare 입력, Enter/comma 추가, X 제거, 3개 도달 시 입력 비활성, 중복 시도 시 에러 텍스트(다음 keystroke에 소거), 저장 실패 시 로컬 변경 되돌림 + 에러 텍스트. 제목 입력의 "즉시 로컬 갱신 + 백그라운드 저장" 패턴을 그대로 따름. `TagBar.module.css`는 전부 `var(--token)` 참조(하드코딩 hex 없음, 다크 자동 전환)
- `DocumentWorkspace.tsx`의 `titleRow`↔`body` 사이에 `TagBar` 마운트, `initialTags` prop 추가
- `d/[docId]/page.tsx`의 기존 `Promise.all`에 `getTags(docId)` 추가 → `DocumentWorkspace`로 `initialTags` 전달

## Task Commits

1. **Task 1 RED: replaceTags/getTags + PUT tags route 실패 테스트** — `e78f207` (test)
2. **Task 1 GREEN: 태그 서비스 + 라우트 + TagBar + RSC 배선** — `93ccfba` (feat)
3. **Task 2: RBAC/IDOR 방어 확인 테스트** — `7cf52a2` (test)

## Files Created/Modified
- `src/lib/documents.ts` - `TagLimitError` 클래스, `replaceTags`, `getTags` 추가
- `src/app/api/documents/[id]/tags/route.ts` - PUT (EDITOR+, IDOR, TagLimitError→400)
- `src/components/document/TagBar.tsx` - 신규, chip 입력 컴포넌트
- `src/components/document/TagBar.module.css` - 신규, 순수 토큰 참조 스타일
- `src/components/document/DocumentWorkspace.tsx` - TagBar 마운트, `initialTags` prop
- `src/app/(main)/w/[wsId]/d/[docId]/page.tsx` - `getTags` 초기값 배선
- `tests/tags/helpers.ts` - `insertTagRow`/`getTagRows` 팩토리 (함수 아래 직접 DB 검증용)
- `tests/tags/replace.test.ts` - replaceTags/getTags 4케이스 + 라우트 200/400 3케이스
- `tests/tags/rbac.test.ts` - VIEWER 403 + cross-ws IDOR 403(DB 미변경) + 비-uuid 400

## Decisions Made
- TagBar의 3제한/중복/저장실패 상태 전부를 Task 1에서 구현(계획은 Task 2로 분리했으나, 중간 커밋에서 컴포넌트가 절반만 동작하는 상태를 남기지 않기 위함). Task 2는 이 구현을 `rbac.test.ts`로 확인하는 역할로 수행 — 신규 프로덕션 코드 없음(순수 확인 테스트)
- `getTags`는 06-PATTERNS의 `{tag: string}[]` select 결과를 `string[]`로 map — `replaceTags`의 반환 타입과 통일해 `TagBar`의 `initialTags: string[]` prop과 직결

## Deviations from Plan

None — plan executed exactly as written. (TagBar 상태 구현을 Task 1로 앞당긴 것은 계획된 두 태스크의 범위 자체는 그대로이고 실행 순서만 최적화한 것으로, Rule 4 architectural 변경이 아님.)

## Issues Encountered

None. `pnpm vitest run`(944개 전체 green, tags 10개 포함) / `pnpm exec tsc --noEmit` 클린.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- 06-03(검색)·06-04(export)가 복제할 라우트(4단계 IDOR shape)/서비스(트랜잭션+throw)/마운트(titleRow↔body 사이 신규 행) 패턴이 이 tracer로 증명됨
- **UAT 대기:** Task 2의 human-check(브라우저 실 렌더 — 3개 제한 비활성, 중복 에러 문구, X 제거, 새로고침 후 유지, 다크/라이트)는 Playwright MCP 미연결로 수행하지 못함. `/gsd-verify-work 6` 또는 실 브라우저 UAT 필요

---
*Phase: 06-tags-search-export*
*Completed: 2026-08-08*

## Self-Check: PASSED

All created/modified files verified present on disk; all task commits (`e78f207`, `93ccfba`, `7cf52a2`) verified present in git log.
