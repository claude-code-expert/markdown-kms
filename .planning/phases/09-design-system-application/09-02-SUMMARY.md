---
phase: 09-design-system-application
plan: 02
subsystem: ui
tags: [drizzle-orm, correlated-subquery, css-modules, design-tokens, dashboard]

# Dependency graph
requires:
  - phase: 09-design-system-application
    provides: 09-01의 전역 토큰(radius/motion/DM Sans) + 토큰 소비하는 UI 프리미티브(Card/Button 등)
provides:
  - listMembershipsForUser 확장(createdAt/ownerName/docCount/folderCount, correlated subquery)
  - WorkspaceCard 실측 메타 라인 렌더 + 680px 중앙 정렬 리스트 컨테이너 리스킨
affects: [09-03-editor-screen, 09-04]

# Actuals (#2632)
actuals:
  tokens: 3848
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "drizzle sql 템플릿 correlated subquery로 워크스페이스별 집계(docCount/folderCount/ownerName) — 별도 count() 그룹바이 쿼리 없이 select 절에 인라인, 이 코드베이스 첫 집계 사례(no-analog, PATTERNS.md)"
    - "카드형 프리미티브의 메타 라인은 body wrapper(.body flex-column) + Heading(제목)/Label(메타) 2단 타이포로 분리 — WorkspaceCard가 이 phase의 첫 적용 사례"

key-files:
  created:
    - tests/membership/list-memberships.test.ts
  modified:
    - src/lib/db-membership.ts
    - src/components/workspace/WorkspaceCard.tsx
    - src/components/workspace/WorkspaceCard.module.css
    - src/app/(main)/dashboard/page.tsx
    - src/app/(main)/dashboard/page.module.css
    - src/components/workspace/JoinWorkspaceInput.module.css

key-decisions:
  - "CreateWorkspaceButton.module.css는 실재하지 않는 파일(계획의 files_modified 목록 오차) — CreateWorkspaceButton.tsx는 자체 CSS Module 없이 이미 토큰화된 Button 컴포넌트만 사용해 하드코딩 잔재가 없으므로 변경 없이 스킵"
  - "워크스페이스 목록을 grid(auto-fill 다열)에서 flex-column(단일열 리스트)로 전환하고 outer .grid에 var(--radius-lg) 컨테이너 스타일(border/background/padding)을 부여 — UI-SPEC Visual Hierarchy가 명시한 '680px 중앙 정렬 리스트 컨테이너'는 다열 카드 그리드가 아니라 단일 리스트이므로, 개별 Card(radius-md)는 그대로 두고 바깥 컨테이너만 페이지 레벨(radius-lg)로 감쌈"
  - "page.tsx에 .container 래핑 div 1개 추가(header/grid/joinSection을 680px 중앙 정렬로 묶음) — Task 2 파일 스코프(page.tsx) 내 순수 구조적 변경, auth/redirect/listMembershipsForUser 호출 흐름은 무변경"
  - "JoinWorkspaceInput.module.css의 .feedback 13px를 UI-SPEC Typography 4사이즈 상한(Body 14px)에 맞춰 14px로 흡수 — 계획 텍스트에 명시되진 않았으나 이 파일이 Task 2 file scope에 있고 09-01이 이미 적용한 4사이즈 규율의 자연스러운 연장"
  - "워크스페이스 카드에 별도 '문서' 시각 버튼은 추가하지 않음 — 카드 전체가 이미 Link(워크스페이스 진입)이므로 계획의 재량 조항('시각 버튼만 추가하거나 생략')에 따라 생략, 클릭 가능해 보이는 가짜 어포던스를 늘리지 않음"

requirements-completed: [WS-01, WS-02]

coverage:
  - id: D1
    description: "listMembershipsForUser가 createdAt/ownerName/docCount/folderCount 4필드를 실측 집계로 반환(하드코딩 없음), soft-deleted 워크스페이스/문서/폴더/휴지통루트 폴더는 제외"
    requirement: null
    verification:
      - kind: unit
        ref: "tests/membership/list-memberships.test.ts (5/5 pass — 실측 카운트, 신규 0/0, OWNER 없음 null, 워크스페이스 소프트삭제 제외, 문서·폴더 소프트삭제+휴지통루트 제외)"
        status: pass
    human_judgment: false
  - id: D2
    description: "WorkspaceCard가 4개 확장 필드를 메타 라인으로 렌더하고 dashboard/page.tsx가 실측값을 전달, 카드 제목 1줄 말줄임 유지"
    requirement: null
    verification:
      - kind: other
        ref: "grep -F 'docCount' src/components/workspace/WorkspaceCard.tsx / grep -F 'folderCount' 'src/app/(main)/dashboard/page.tsx' 각 1건 이상 확인"
        status: pass
    human_judgment: false
  - id: D3
    description: "WS-01(RBAC 매트릭스)/WS-02(생성=OWNER, OWNER만 삭제) 리스킨 후 회귀 없음"
    requirement: "WS-01, WS-02"
    verification:
      - kind: e2e
        ref: "e2e/document-workspace.spec.ts, e2e/workspace-create.spec.ts, e2e/workspace-delete.spec.ts — 7/7 pass"
        status: pass
      - kind: unit
        ref: "pnpm vitest run — 1062/1062 pass (rbac 회귀 포함, 무회귀)"
        status: pass
    human_judgment: false
  - id: D4
    description: "시각(타이포·색·반경·680px 중앙 정렬이 실제로 화면에 의도대로 보이는지) 최종 확인은 브라우저 육안 검증 필요"
    verification: []
    human_judgment: true
    rationale: "grep/vitest/e2e는 데이터 배선과 동작 회귀를 증명하지만 실제 중앙 정렬·메타 라인 가독성·radius-lg 컨테이너 체감은 육안 확인 필요 — prefers-build-all-then-test 방침에 따라 09-04 이후 /gsd-verify-work 9로 몰아 검증"

# Metrics
duration: 15min
completed: 2026-08-16
status: complete
---

# Phase 9 Plan 2: 워크스페이스 메인 실측 데이터 + 리스킨 Summary

**listMembershipsForUser를 4필드(소유자/생성일/문서수/폴더수) correlated subquery로 확장하고, 워크스페이스 카드를 실측 메타 라인과 680px 중앙 정렬 리스트 컨테이너로 리스킨(WS-01/WS-02 무회귀)**

## Performance

- **Duration:** 15 min
- **Started:** 2026-08-16T00:17:00+09:00
- **Completed:** 2026-08-16T00:32:14+09:00
- **Tasks:** 2
- **Files modified:** 6 (+ 1 신규 테스트)

## Accomplishments
- `listMembershipsForUser`가 `createdAt`/`ownerName`(OWNER 없으면 null)/`docCount`/`folderCount` 4필드를 drizzle `sql` correlated subquery로 반환 — 전부 parameterized, 문자열 보간 없음(T-09-02-SQLI)
- `docCount`는 `is_deleted=false` 문서만, `folderCount`는 `is_deleted=false AND is_trash_root=false` 폴더만 집계(휴지통 루트 제외), soft-deleted 워크스페이스는 기존대로 결과에서 제외
- `WorkspaceCard`가 "소유자 {ownerName} · 생성일 {createdAt} · 문서 N개 · 폴더 N개" 메타 라인을 렌더(ownerName null → "-"), 카드 제목은 Heading(16px/600) 1줄 말줄임 유지
- 대시보드 워크스페이스 리스트를 680px 중앙 정렬 컨테이너(`var(--radius-lg)`)로 감싸고 페이지 타이틀을 Display(24px/600)로 승격, `JoinWorkspaceInput` 피드백 문구를 Body(14px) 4사이즈 상한에 맞춤
- WS-01(rbac vitest)/WS-02(워크스페이스 생성=OWNER, OWNER만 삭제 e2e) 리스킨 후 무회귀 확인 — vitest 1062/1062, playwright 7/7

## Task Commits

Each task was committed atomically:

1. **Task 1: listMembershipsForUser 집계 확장 (소유자/생성일/문서수/폴더수)** - `954d300` (feat)
2. **Task 2: WorkspaceCard props 확장 + 메타 라인 + 대시보드 화면 리스킨** - `b07b672` (feat)

## Files Created/Modified
- `src/lib/db-membership.ts` - createdAt/ownerName/docCount/folderCount correlated subquery 확장
- `tests/membership/list-memberships.test.ts` - 신규 집계 테스트 5건
- `src/components/workspace/WorkspaceCard.tsx` - props 확장 + 메타 라인 렌더
- `src/components/workspace/WorkspaceCard.module.css` - `.body`/`.meta` 신규, `.name` Heading 타이포로 승격
- `src/app/(main)/dashboard/page.tsx` - 4개 확장 필드 전달 + `.container` 래핑 div
- `src/app/(main)/dashboard/page.module.css` - `.container`(680px 중앙 정렬), `.grid`를 radius-lg 리스트 컨테이너로, `.title` Display 타이포
- `src/components/workspace/JoinWorkspaceInput.module.css` - `.feedback` 13px → 14px(Body)

## Decisions Made
- `CreateWorkspaceButton.module.css`는 실재하지 않는 파일(계획 files_modified의 오차) — `CreateWorkspaceButton.tsx`가 이미 토큰화된 `Button` 컴포넌트만 쓰고 자체 CSS Module이 없어 변경 대상 없음, 스킵
- 리스트 컨테이너를 auto-fill 그리드에서 단일열 flex 리스트로 전환하고 바깥 컨테이너만 `var(--radius-lg)`를 부여(개별 카드는 `var(--radius-md)` 그대로) — UI-SPEC이 "카드 리스트"로 명명한 것과 정렬
- `page.tsx`에 `.container` 래핑 div 1개만 추가(680px 중앙 정렬) — auth/redirect/데이터 조회 흐름은 100% 무변경
- "문서" 시각 버튼은 추가하지 않음(계획의 명시적 재량) — 카드 전체가 이미 Link이므로 별도 버튼은 가짜 어포던스만 늘림

## Deviations from Plan

None - 계획 그대로 실행. `CreateWorkspaceButton.module.css`(파일 미존재) 처리와 `JoinWorkspaceInput.module.css` 13px→14px 흡수는 계획의 "재량"/"UI-SPEC 준수" 조항 범위 내 판단이라 별도 Rule 적용 없이 위 Decisions로 기록.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- 워크스페이스 메인이 실제 DB 조회값으로 렌더되며(D-08 완결), WS-01/WS-02 회귀 없음 확정 — 09-03(에디터 화면)은 동일 전역 토큰만 소비하면 됨
- 시각(680px 중앙 정렬 체감·메타 라인 가독성) 최종 확인은 `prefers-build-all-then-test` 방침에 따라 09-04 이후 `/gsd-verify-work 9`로 몰아 검증 예정 — 이번 plan의 자동 검증(vitest/e2e/grep/tsc)은 전부 green

---
*Phase: 09-design-system-application*
*Completed: 2026-08-16*

## Self-Check: PASSED

- All 7 key files (db-membership.ts, list-memberships.test.ts, WorkspaceCard.tsx/.module.css, dashboard page.tsx/.module.css, JoinWorkspaceInput.module.css) confirmed present on disk.
- Both task commit hashes (954d300, b07b672) confirmed present in `git log --oneline --all`.
