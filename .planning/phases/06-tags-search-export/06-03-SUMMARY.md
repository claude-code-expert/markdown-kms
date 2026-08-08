---
phase: 06-tags-search-export
plan: 03
subsystem: search
tags: [pg_trgm, postgresql, unicode-nfc, drizzle, react, debounce]

requires:
  - phase: 06-tags-search-export (06-01)
    provides: document_tag table, pg_trgm GIN indexes (gin_trgm_ops), NFD->NFC backfill, normalizeNFC helper in src/lib/validation.ts
  - phase: 06-tags-search-export (06-02)
    provides: replaceTags/getTags service, PUT tags route (consumed indirectly via document_tag for tag-match search)

provides:
  - searchWorkspace(workspaceId, q) — pg_trgm ILIKE over title/content/tag, workspace-scoped, parameter-bound
  - GET /api/workspaces/[id]/search — VIEWER+, NFC-normalizes q before querying
  - SearchBox + SearchResultsList + useSearchResults hook (debounce, race guard) mounted in FolderTree sidebar

affects: [06-04-export, phase-7-collaboration]

actuals:
  tokens: 7300
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "검색 라우트가 normalizeNFC(q)를 호출한 뒤 이미-정규화된 q를 searchWorkspace로 넘긴다 — 정규화 책임은 항상 호출부(라우트) 경계, 서비스 함수 내부가 아니다(documents.ts autosaveDocument의 동일 원칙)"
    - "레이스 가드는 AbortController가 아니라 시퀀스 번호 비교로 늦은 응답을 무시한다(autosave-controller.ts sentSeq 관례의 UI판)"
    - "DOM 상 비인접한 두 슬롯(검색 입력 vs 결과 리스트)이 상태를 공유해야 할 때, 상태 훅과 두 프레젠테이션 컴포넌트를 전부 같은 파일에서 export하고 부모(FolderTree)가 훅을 호출해 양쪽에 내려준다 — 새 파일을 늘리지 않는다"

key-files:
  created:
    - src/lib/search.ts
    - src/app/api/workspaces/[id]/search/route.ts
    - src/components/tree/SearchBox.tsx
    - src/components/tree/SearchBox.module.css
    - tests/search/helpers.ts
    - tests/search/nfc-normalize.test.ts
    - tests/search/idor.test.ts
  modified:
    - src/components/tree/FolderTree.tsx

key-decisions:
  - "searchWorkspace는 q를 재정규화하지 않는다 — NFC 정규화는 호출부(GET 라우트)의 책임으로 고정, 06-01의 문서 스키마 write-time 정규화 원칙과 동형"
  - "태그 매칭은 EXISTS 서브쿼리로, 태그 목록 반환은 별도 상관 서브쿼리(array_agg)로 분리 — WHERE로 필터된 LEFT JOIN 행 하나만 쓰면 title/content로 매칭된 문서의 태그 일부가 누락되는 버그가 난다"
  - "SearchResultsList/useSearchResults를 SearchBox.tsx 한 파일에서 함께 export — 검색 입력(헤더 위)과 결과 패널(.tree 슬롯)이 FolderTree의 DOM상 비인접 위치라 상태를 부모로 끌어올려야 했고, 신규 파일을 늘리지 않는 편이 plan의 파일 목록과 일치"
  - "useSearchResults의 'idle' 상태가 '쿼리 없음'과 '디바운스 대기 중' 두 UI-SPEC 상태를 모두 흡수 — 실제 fetch가 발사되기 전까지 status를 건드리지 않으므로 별도 'typing' 상태 없이 '이전 상태 유지' 요구사항이 자연히 만족된다"

patterns-established:
  - "검색/자동완성류 디바운스+레이스가드가 필요할 때 autosave-controller.ts의 시퀀스 비교 패턴(useRef 카운터, 응답 시점에 최신 발사 seq와 비교)을 재사용한다"

requirements-completed: [DOC-04]

coverage:
  - id: D1
    description: "searchWorkspace(workspaceId, q)가 pg_trgm ILIKE로 title/content/tag 부분일치 검색을 워크스페이스 스코프+is_deleted=false로 수행하고 {id,title,snippet,tags} 형태를 반환한다"
    requirement: "DOC-04"
    verification:
      - kind: unit
        ref: "tests/search/nfc-normalize.test.ts#matches content and tags, not just title, and includes a body snippet"
        status: pass
    human_judgment: false
  - id: D2
    description: "NFD로 조합된 질의가 NFC로 저장된 한국어 문서를 매칭하고 그 역도 성립한다"
    requirement: "DOC-04"
    verification:
      - kind: unit
        ref: "tests/search/nfc-normalize.test.ts#matches an NFC-stored title when the query is NFD, normalized to NFC first"
        status: pass
      - kind: unit
        ref: "tests/search/nfc-normalize.test.ts#also matches when the query is already NFC -- the reverse direction holds too"
        status: pass
    human_judgment: false
  - id: D3
    description: "q에 SQL/LIKE 메타문자가 있어도 파라미터 바인딩으로 리터럴 처리되어 인젝션이 불가능하다 (T-06-SQLI)"
    requirement: "DOC-04"
    verification:
      - kind: unit
        ref: "tests/search/nfc-normalize.test.ts#treats SQL/LIKE metacharacters in q as a literal, parameter-bound value (no injection, no crash)"
        status: pass
    human_judgment: false
  - id: D4
    description: "검색은 워크스페이스 경계를 절대 넘지 않고, GET 라우트는 VIEWER 미만 403·비-uuid 400·빈 q는 빈 결과를 반환한다 (T-06-SEARCH-IDOR)"
    requirement: "DOC-04"
    verification:
      - kind: unit
        ref: "tests/search/idor.test.ts#never returns a document from a different workspace, even with the same matching title"
        status: pass
      - kind: integration
        ref: "tests/search/idor.test.ts#rejects a non-member with 403"
        status: pass
      - kind: integration
        ref: "tests/search/idor.test.ts#allows a VIEWER and returns only same-workspace results"
        status: pass
      - kind: integration
        ref: "tests/search/idor.test.ts#returns 400 for a malformed (non-uuid) workspace id"
        status: pass
      - kind: integration
        ref: "tests/search/idor.test.ts#returns an empty result array for an empty q, without error"
        status: pass
    human_judgment: false
  - id: D5
    description: "사이드바 상단 SearchBox가 300ms 디바운스로 GET /search를 호출하고, 늦게 도착한 이전 요청의 응답은 최신 요청의 응답을 덮어쓰지 않는다(레이스 가드)"
    verification:
      - kind: other
        ref: "src/components/tree/SearchBox.tsx useSearchResults — 시퀀스 번호 비교(seqRef), tsc --noEmit clean"
        status: pass
    human_judgment: true
    rationale: "디바운스 타이밍과 요청 경합은 실제 IME 입력·네트워크 지연 상황에서 브라우저로 관찰해야 하는 시각/타이밍 검증 — 06-VALIDATION.md 수동 항목으로 명시, 실브라우저 검증은 이 phase의 몰아서-검증 정책에 따라 defer"
  - id: D6
    description: "검색 결과 클릭 시 /w/:wsId/d/:docId로 이동하고, idle/loading/results/no-results/error 5개 상태가 UI-SPEC 카피대로 렌더되며, 지우면 .tree로 즉시 복귀한다"
    verification:
      - kind: other
        ref: "src/components/tree/SearchBox.tsx SearchResultsList + FolderTree.tsx searchActive 분기, tsc --noEmit clean, SearchBox.module.css에 하드코딩 hex 없음(grep 확인)"
        status: pass
    human_judgment: true
    rationale: "5개 상태의 실제 렌더 외양(다크/라이트, 스피너, ellipsis/line-clamp)은 실브라우저 시각 확인이 필요 — 06-VALIDATION.md 수동 항목, 이 phase의 몰아서-검증 정책에 따라 defer"

duration: 22min
completed: 2026-08-08
status: complete
---

# Phase 6 Plan 3: Workspace Search Summary

**pg_trgm ILIKE 검색(title/content/tag, NFC 정규화, 파라미터 바인딩)과 사이드바 SearchBox(300ms 디바운스, 시퀀스 기반 레이스 가드)**

## Performance

- **Duration:** 22 min
- **Tasks:** 2
- **Files modified:** 8 (search.ts, route.ts, SearchBox.tsx, SearchBox.module.css, FolderTree.tsx, tests/search/helpers.ts, nfc-normalize.test.ts, idor.test.ts)

## Accomplishments
- `searchWorkspace(workspaceId, q)` — pg_trgm ILIKE로 title/content/tag 부분일치, workspace_id+is_deleted=false 스코프, 전부 drizzle `sql` 템플릿 파라미터 바인딩(SQL 인젝션 불가)
- `GET /api/workspaces/[id]/search` — z.uuid(wsId) → requireRole(wsId, VIEWER) → normalizeNFC(q) → searchWorkspace, 빈 q는 빈 배열(에러 아님)
- NFD로 조합된 한국어 질의가 NFC로 저장된 문서를 매칭하고 그 역도 성립함을 단위 테스트로 증명(DOC-04 성공기준 2)
- `SearchBox`/`SearchResultsList`/`useSearchResults` — 300ms 디바운스, 시퀀스 번호 기반 레이스 가드(autosave-controller.ts 패턴 재사용), idle/loading/results/no-results/error 5개 상태
- `FolderTree.tsx`에 SearchBox를 `.header` 위에 마운트, 검색 활성 시 `.tree` 슬롯이 검색 결과 리스트로 교체(동시 렌더 없음)

## Task Commits

1. **Task 1: searchWorkspace 서비스 + GET 검색 라우트** — `24420a9` (test, RED) → `898c78f` (feat, GREEN)
2. **Task 2: SearchBox UI + FolderTree 마운트** — `19d76cc` (feat)

## Files Created/Modified
- `src/lib/search.ts` - `searchWorkspace`: pg_trgm ILIKE 3필드 매칭(EXISTS 서브쿼리로 태그 매칭, 상관 서브쿼리로 전체 태그 목록 반환), `LEFT(content,200)` 스니펫
- `src/app/api/workspaces/[id]/search/route.ts` - GET, VIEWER, wsId가 URL에 직접 있어 IDOR 4단계 중 workspaceId 재유도 단계가 없는 축약형
- `src/components/tree/SearchBox.tsx` - `useSearchResults` 훅(디바운스+레이스가드) + `SearchBox`(입력행) + `SearchResultsList`(결과/no-results/error) 3종 export
- `src/components/tree/SearchBox.module.css` - 전부 `var(--token)` 참조, TagBar 칩의 축소판 pill 스타일 재사용
- `src/components/tree/FolderTree.tsx` - SearchBox 마운트 + `.tree`/검색결과 삼항 분기 추가
- `tests/search/helpers.ts` - NFC_GAK/NFD_GAK 유니코드 fixture 상수(각 문자의 완성형 vs 자모분리형)
- `tests/search/nfc-normalize.test.ts` - NFC/NFD 매칭 양방향, content/tag 매칭, SQL/LIKE 메타문자 안전성, 빈 쿼리
- `tests/search/idor.test.ts` - lib-level 워크스페이스 스코프 + route-level RBAC(403/400/200/빈 결과)

## Decisions Made
- `searchWorkspace`는 `q`를 재정규화하지 않는다 — NFC 정규화는 호출부(GET 라우트)의 책임으로 고정(06-01의 문서 스키마 write-time 정규화 원칙과 동형, documents.ts의 autosaveDocument가 documentSchema를 직접 호출하지 않는 것과 동일 경계)
- 태그 매칭은 `EXISTS` 서브쿼리로 검색 필터링만 하고, 반환할 태그 목록은 별도 상관 서브쿼리(`array_agg`)로 조회 — `WHERE`로 필터된 `LEFT JOIN` 행 하나만 쓰면 title/content로 매칭된 문서가 자신의 태그 일부를 결과에서 누락하는 버그가 났을 것
- `SearchResultsList`/`useSearchResults`를 새 파일로 쪼개지 않고 `SearchBox.tsx` 한 파일에서 함께 export — 검색 입력(`.header` 위)과 결과 패널(`.tree` 슬롯)이 FolderTree의 DOM상 비인접 위치라 상태를 부모로 끌어올려야 했고, plan의 선언된 파일 목록(SearchBox.tsx만 신규)과 일치시킴
- `useSearchResults`의 `idle` 상태가 UI-SPEC의 "쿼리 없음"과 "디바운스 대기 중(typing)" 두 상태를 모두 흡수 — 실제 fetch가 발사되기 전까지 `status`를 건드리지 않으므로 별도 `typing` enum 값 없이 "이전 상태 유지" 요구사항이 자연히 만족됨

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `tests/search/nfc-normalize.test.ts`가 `../rbac/helpers`를 transitively import하면서 `@/auth`(next-auth) → `next/server` 해석 실패로 파일 전체가 로드 실패했다(03-02 선례와 동일 원인). `tests/tags/replace.test.ts`가 쓰는 것과 동일한 `vi.mock("@/auth", () => ({ auth: vi.fn() }))`를 파일 최상단에 추가해 해결 — 실제로 세션을 쓰지 않는 lib-level 테스트에도 이 mock이 필요하다는 점을 확인.
- `client.execute<SearchRow>(sql\`...\`)`의 제네릭 파라미터가 `Record<string, unknown>` 제약을 요구해 `interface SearchRow { ... }`가 타입 에러(TS2344)를 냈다 — `type SearchRow = Record<string, unknown> & { ... }`로 교체해 해결.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `searchWorkspace`/GET 검색 라우트가 실 DB(06-01의 pg_trgm GIN 인덱스, 06-02의 document_tag)로 바로 동작 — 06-04(export)는 이 plan과 독립적이라 블로킹 없음
- DOC-04 요구사항이 이 plan으로 기능 완결 — `requirements mark-complete DOC-04` 반영
- 실브라우저 시각 검증(디바운스 체감, 5개 상태 렌더, IME 한글 입력, 다크/라이트) 4건이 `.planning/STATE.md`의 "Deferred Verification" 섹션에 Phase 6 항목으로 누적되어야 함 — phase 전체 실행 후 `/gsd-verify-work 6`로 몰아서 확인(사용자 지시 2026-08-08)

---
*Phase: 06-tags-search-export*
*Completed: 2026-08-08*

## Self-Check: PASSED

All created files verified present on disk; all task commits (`24420a9`, `898c78f`, `19d76cc`) verified present in git log.
