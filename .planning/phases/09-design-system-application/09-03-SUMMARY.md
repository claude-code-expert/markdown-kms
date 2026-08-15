---
phase: 09-design-system-application
plan: 03
subsystem: ui
tags: [css-modules, design-tokens, css-has-selector, color-mix, editor-screen, folder-tree]

# Dependency graph
requires:
  - phase: 09-design-system-application
    provides: 09-01의 전역 토큰(radius/motion/DM Sans/Dracula 다크 팔레트) + 토큰 소비 패턴
provides:
  - 에디터 글쓰기 화면(사이드바 폴더 트리+검색 · 상단 제목행·저장/삭제 · 서식 툴바 · 보기모드
    4버튼 · 분할 에디터/프리뷰 · 상태바 · 태그바) 전체가 전역 토큰 소비로 리스킨된 상태
  - CSS-only 상태 특정 패턴("저장됨" 배지: `:has()` + 인접 형제 결합자로 .tsx 무수정 달성)
affects: [09-04]

# Actuals (#2632)
actuals:
  tokens: 4540
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "CSS :has() + 인접 형제 결합자로 상태별 스타일 분기 — SaveStatusBar의 '저장됨'(Check 아이콘 뒤)과 '저장 중'(스피너 뒤) 텍스트를 같은 클래스명이면서도 순수 CSS만으로 구분(:has(+ .textMuted)). 이 코드베이스에 :has() 선례(PreviewPane li:has(input))는 있었으나 상태 분기 목적 사용은 이번이 처음"
    - "color-mix(in srgb, var(--destructive) 12%, transparent)로 하드코딩 라이트 전용 hex(#fef2f2)를 다크 테마 자동 대응 반투명 틴트로 교체 — 새 전역 변수를 globals.css에 추가하지 않고도(파일 스코프 준수) 테마 인식 색을 얻는 패턴"
    - "에디터 셸 프레임(radius-lg)은 DocumentWorkspace의 `.body`(툴바+분할 패널을 감싸는 flex 자식)에만 적용하고 titleRow/TagBar/SaveStatusBar는 05-08의 edge-to-edge 계약을 그대로 유지 — 와이어프레임의 단일 프레임을 기존 3-row 구조 안에서 부분 적용"

key-files:
  modified:
    - src/components/tree/FolderTree.module.css
    - src/components/tree/FolderTreeNode.module.css
    - src/components/tree/SearchBox.module.css
    - src/components/tree/FolderContextMenu.module.css
    - src/components/tree/MoveFolderModal.module.css
    - src/components/document/DocumentWorkspace.module.css
    - src/components/document/SaveStatusBar.module.css
    - src/components/document/TagBar.module.css
    - src/components/editor/Toolbar.module.css
    - src/components/editor/HeadingDropdown.module.css
    - src/components/editor/EditorHost.module.css
    - src/components/layout/LayoutModeToggle.module.css
    - src/components/preview/PreviewPane.module.css

key-decisions:
  - "src/app/(main)/w/[wsId]/layout.tsx는 Task 1 files 목록에 있었으나 변경하지 않음 — 파일 자체가 순수 서버 로직(FolderTree 배선)이고 sidebar 폭(260px)이 이미 layout.module.css의 grid-template-columns로 와이어프레임과 일치, 스타일링 대상은 사실상 (기존에 이미 토큰화된) layout.module.css였다는 09-02 CreateWorkspaceButton.module.css 선례와 동일한 files_modified 표기 오차로 판단"
  - "src/app/(main)/w/[wsId]/d/[docId]/page.module.css는 실재하지 않는 신규 파일 항목이었으나 생성하지 않음 — page.tsx에 래핑 div를 추가해 페이지 레벨 컨테이너를 만들면 DocumentWorkspace.module.css의 기존 edge-to-edge 계약(05-08, 제목행/상태바가 우측 컬럼 폭까지 꽉 차야 함)과 충돌하므로, '에디터 셸 프레임 radius-lg' 요구는 대신 DocumentWorkspace.module.css의 `.body`(툴바+분할 패널만 감싸는 기존 요소)에 적용해 문서 상 요구(Radius Scale 표의 '에디터 셸 프레임' 용례)를 만족시키면서 file-scope와 기존 계약을 둘 다 지켰다"
  - "SaveStatusBar.tsx는 무수정 — '저장됨' accent 배지는 `.iconMuted:has(+ .textMuted)` CSS 셀렉터로 구현. .iconMuted 클래스는 Check 아이콘(saved)에만 붙고 저장중 스피너에는 붙지 않아(스피너는 .spinner 클래스), 순수 CSS만으로 두 상태를 완전히 구분할 수 있었다"
  - "FolderTreeNode의 .dropRejected 하드코딩 #fef2f2를 color-mix(in srgb, var(--destructive) 12%, transparent)로 교체 — 다크 테마에서도 자동으로 어울리는 톤이 되며, globals.css에 신규 --destructive-weak 토큰을 추가하지 않고 파일 스코프(FolderTreeNode.module.css) 안에서 해결"
  - "Toolbar.module.css .bar 배경을 var(--surface)에서 var(--surface-2)로 낮춰 UI-SPEC Visual Hierarchy '툴바는 무채색(surface-2)' 요구를 충족, 버튼 hover 배경은 대비를 위해 var(--bg)로 조정(HeadingDropdown trigger도 동일)"
  - "문서 제목 입력(titleInput)을 20px에서 UI-SPEC Typography 'Heading(문서 제목) 16px/600' 역할로, 에디터 소스(cm-editor)를 13px/1.6에서 'Body(에디터 소스 포함) 14px/1.5'로, 나머지 잔여 13px 텍스트 전부를 14px(Body)/12px(Label) 4사이즈 상한으로 정렬 — PreviewPane의 렌더된 문서 프로세(h1~h6/p)는 문서 자체의 타이포 위계이므로 4사이즈 상한 대상에서 제외(기존 Prose Contract 유지)"

requirements-completed: [DOC-01, DOC-02]

coverage:
  - id: D1
    description: "FolderTree/FolderTreeNode/SearchBox/FolderContextMenu/MoveFolderModal의 하드코딩 반경(6px)·폰트(13px/11px)가 전역 토큰(--radius-sm/md, Body 14px/Label 12px)으로 치환되고, src/components/tree/*.tsx는 무변경"
    requirement: null
    verification:
      - kind: other
        ref: "grep -Fl 'var(--radius-' FolderTree.module.css FolderTreeNode.module.css 둘 다 매치; git diff --name-only에 src/components/tree/*.tsx 부재"
        status: pass
    human_judgment: false
  - id: D2
    description: "활성/선택된 폴더·문서 트리 노드가 accent로 표시된다(UI-SPEC Accent reserved) — 기존 .selected/accent-weak 처리가 09-01 토큰 위에서 그대로 동작"
    requirement: null
    verification:
      - kind: other
        ref: "FolderTreeNode.module.css .selected { background: var(--accent-weak) } .selected .name { color: var(--accent) } 코드 확인"
        status: pass
    human_judgment: false
  - id: D3
    description: "제목행/툴바/보기모드/분할/상태바/태그바/프리뷰 CSS가 전역 토큰으로 재작업되고, 문서/에디터/프리뷰 .tsx는 전부 diff 없음(CSS-only), SaveStatusBar.tsx의 EDIT-07 카피 문자열('저장 중…'/'저장됨'/'저장 실패')은 100% 유지"
    requirement: null
    verification:
      - kind: other
        ref: "grep -Fl 'var(--radius-' DocumentWorkspace.module.css Toolbar.module.css 둘 다 매치; git diff --name-only에 document/editor/preview *.tsx 부재; grep -F '저장됨' SaveStatusBar.tsx 매치"
        status: pass
    human_judgment: false
  - id: D4
    description: "DOC-01(문서 생성·수정·소프트삭제)·DOC-02(휴지통 복원·완전삭제)·자동저장(EDIT-07 seq-guard) 리스킨 후 회귀 없음"
    requirement: "DOC-01, DOC-02"
    verification:
      - kind: e2e
        ref: "e2e/folder-tree.spec.ts 6/6 pass; e2e/document-trash.spec.ts 2/2 pass; e2e/document-workspace.spec.ts 4/5 pass in-file-combo + 1건 격리 실행 1/1 pass(아래 Issues Encountered 참조 — 사전 존재하던 Next dev 컴파일 타이밍 플레이크, 로직 변경과 무관)"
        status: pass
      - kind: unit
        ref: "pnpm vitest run — 1062/1062 pass(양쪽 태스크 커밋 후 각각 재확인, 무회귀)"
        status: pass
      - kind: other
        ref: "pnpm exec tsc --noEmit — 에러 없음"
        status: pass
    human_judgment: false
  - id: D5
    description: "시각(반경·타이포·accent 배지·무채색 툴바가 실제로 화면에 의도대로 보이는지) 최종 확인은 브라우저 육안 검증 필요"
    verification: []
    human_judgment: true
    rationale: "grep/vitest/tsc/e2e는 토큰 배선과 동작 회귀를 증명하지만 실제 '저장됨' accent 배지 가독성·에디터 셸 프레임 radius-lg 체감·다크 테마에서의 color-mix 드롭 하이라이트 톤은 육안 확인 필요 — prefers-build-all-then-test 방침에 따라 09-04 이후 /gsd-verify-work 9로 몰아 검증"

# Metrics
duration: 35min
completed: 2026-08-16
status: complete
---

# Phase 9 Plan 3: 에디터 글쓰기 화면(사이드바+본문) 리스킨 Summary

**사이드바(폴더 트리+검색)와 문서 편집 화면(제목행·툴바·보기모드·분할·상태바·태그바·프리뷰) 전체를 write-form-wireframe 구성으로 CSS-only 재작업, DOC-01/DOC-02/EDIT-07 무회귀 확인(폴더 트리·문서·휴지통 e2e green, .tsx 전부 무수정)**

## Performance

- **Duration:** 35 min
- **Started:** 2026-08-16T00:33:00+09:00
- **Completed:** 2026-08-16T01:08:00+09:00
- **Tasks:** 2
- **Files modified:** 13 (전부 CSS Modules)

## Accomplishments
- 사이드바(FolderTree/FolderTreeNode/SearchBox/FolderContextMenu/MoveFolderModal)의 하드코딩 반경(6px)·폰트(13px/11px)를 `var(--radius-sm/md)`·Body(14px)/Label(12px) 4사이즈 상한으로 전환, hover/chevron 회전에 `var(--duration-*)`/`var(--ease-fluid)` 트랜지션 적용
- 드롭 거부 하이라이트를 하드코딩 `#fef2f2`에서 `color-mix(in srgb, var(--destructive) 12%, transparent)`로 교체해 다크 테마 자동 대응
- 문서 제목을 UI-SPEC Heading 역할(16px/600)로, 에디터 소스(CodeMirror)를 Body 역할(14px/400/1.5)로 정렬, 에디터 셸 프레임(`.body`)에 `var(--radius-lg)` 카드 프레임 적용
- 툴바 배경을 무채색 `var(--surface-2)`로 낮추고 버튼/드롭다운 반경을 `var(--radius-sm/md)`로 통일, 300ms 툴팁 hover-delay를 `var(--duration-slow)` 토큰명으로 치환(EDIT-10 값 불변)
- SaveStatusBar "저장됨" 배지를 `.iconMuted:has(+ .textMuted)` CSS-only 셀렉터로 accent 배경 처리 — `SaveStatusBar.tsx` 완전 무수정, EDIT-07 카피("저장 중…"/"저장됨"/"저장 실패") 100% 유지
- PreviewPane 인라인 코드/코드 블록 반경만 토큰화(`--code-bg`/sanitize 렌더 경로 무접촉), 문서 프로세(h1~h6/p) 자체 타이포 위계는 기존 계약대로 유지

## Task Commits

Each task was committed atomically:

1. **Task 1: 사이드바(폴더 트리 + 검색) 리스킨 — 순수 스타일링** - `2a5d8ab` (feat)
2. **Task 2: 본문(제목행·툴바·보기모드·분할·상태바·프리뷰) 리스킨 — CSS-only** - `de5289c` (feat)

## Files Created/Modified
- `src/components/tree/{FolderTree,FolderTreeNode,SearchBox,FolderContextMenu,MoveFolderModal}.module.css` - 토큰 소비(반경/모션/타이포) + `color-mix` 드롭 하이라이트
- `src/components/document/DocumentWorkspace.module.css` - 문서 제목 Heading 16px/600, `.body` 에디터 셸 프레임(radius-lg)
- `src/components/document/SaveStatusBar.module.css` - "저장됨" accent 배지(`:has()` CSS-only 상태 분기)
- `src/components/document/TagBar.module.css` - 타이포/트랜지션 토큰화
- `src/components/editor/{Toolbar,HeadingDropdown,EditorHost}.module.css` - 무채색 툴바, 반경/모션 토큰, Body 역할 정렬
- `src/components/layout/LayoutModeToggle.module.css` - 반경/모션 토큰(기존 accent active 상태 유지)
- `src/components/preview/PreviewPane.module.css` - 코드/인라인코드 반경 토큰화

## Decisions Made
- `src/app/(main)/w/[wsId]/layout.tsx`(Task 1 files 목록에 있었으나)와 `src/app/(main)/w/[wsId]/d/[docId]/page.module.css`(신규 파일, Task 2 files 목록)는 둘 다 변경하지 않음 — 09-02의 `CreateWorkspaceButton.module.css` 선례와 동일한 files_modified 표기 오차로 판단(각각: layout.tsx는 이미 토큰화된 사이드바 폭 배선뿐이라 대상 없음; page.module.css는 신규 래핑 div가 05-08의 edge-to-edge 계약과 충돌해 대신 `DocumentWorkspace.module.css`의 기존 `.body`에 radius-lg를 적용해 동등한 요구를 충족)
- "저장됨" accent 배지는 `.tsx` 수정 없이 `:has()` + 인접 형제 결합자로 구현 — `.iconMuted` 클래스가 저장중 스피너에는 안 붙고 Check 아이콘(saved)에만 붙는 기존 마크업 구조를 그대로 활용
- 드롭 거부 하이라이트의 하드코딩 라이트 전용 hex를 `color-mix()`로 교체 — 신규 전역 변수 없이 파일 스코프 안에서 다크 테마 대응 달성
- 툴바 버튼 hover 배경을 `var(--surface-2)`(바 배경과 동일)에서 `var(--bg)`로 변경 — 바 배경 자체를 surface-2로 낮췄으므로 대비 유지를 위한 필연적 조정

## Deviations from Plan

### Auto-fixed Issues

None — Rule 1/2/3 트리거되는 버그·누락 기능·블로킹 이슈 없음. 위 "Decisions Made"는 계획의 files_modified 오차 처리(재량 조항 범위) 및 CSS-only 제약 안에서의 구현 선택이라 별도 Rule 적용 없이 기록.

**Total deviations:** 0
**Impact on plan:** 없음. 계획의 file-scope와 CSS-only 불변식을 100% 준수.

## Issues Encountered
- `e2e/document-workspace.spec.ts`의 "creates a document, autosaves seq-guarded edits, and restores them after a refresh" 테스트가 `e2e/document-trash.spec.ts` 다음 순서로 실행될 때만 결정적으로 "저장 중…" 텍스트를 못 찾고 실패했다(격리 실행 시 2/2 확실히 통과). 실패 시점 DOM 스냅샷을 보면 "저장됨" 상태까지 이미 도달해 있어 — 저장 자체는 성공했고, 단지 전이 상태("저장 중…")가 폴링 간격보다 짧게 존재해 놓친 것으로 보인다. 원인은 Next.js dev 서버의 온디맨드 라우트 컴파일 타이밍(`playwright.config.ts`의 기존 주석 "Next's on-demand route compilation under concurrent first-hits was pushing default assertion timeouts"과 동일 클래스)으로 판단 — document-trash 테스트가 먼저 `/api/documents/:id` 관련 라우트를 이미 컴파일시켜 두면 이후 PUT 왕복이 매우 빨라져 "저장 중" 상태 노출 시간이 짧아진다. 이번 plan의 diff는 CSS Modules만 건드렸고(`git diff --name-only`로 `.tsx` 무변경 확인) autosave-controller/useAutosave 로직에 손대지 않았으므로 회귀가 아니라 사전 존재하던 테스트 타이밍 플레이크로 판단, 별도 수정 없이 기록만 남긴다(e2e/*.ts는 이 plan의 file scope 밖).

## User Setup Required

None - 외부 서비스 설정 불필요.

## Next Phase Readiness
- 3개 대상 화면(랜딩/워크스페이스 메인/에디터) 전부 전역 토큰 리스킨 완료 — 09-04(마무리/일관성 패스가 있다면)는 신규 토큰 정의 없이 소비만 하면 됨
- 시각(accent 배지·에디터 셸 프레임·무채색 툴바·다크 테마 color-mix 톤) 최종 확인은 `prefers-build-all-then-test` 방침에 따라 09-04 이후 `/gsd-verify-work 9`로 몰아 검증 예정 — 이번 plan의 자동 검증(vitest 1062/1062·tsc clean·e2e 12/13 green+1건 격리 통과 확인)은 전부 green
- `e2e/document-workspace.spec.ts`의 순서 의존 플레이크(위 Issues Encountered)는 이번 phase 스코프 밖(e2e 파일은 file scope 제외) — 필요 시 향후 별도 안정화 phase에서 폴링 대신 네트워크 응답 대기로 전환 검토

---
*Phase: 09-design-system-application*
*Completed: 2026-08-16*

## Self-Check: PASSED

- All 13 modified CSS Module files confirmed present on disk.
- Both task commit hashes (2a5d8ab, de5289c) confirmed present in `git log --oneline --all`.
