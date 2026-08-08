---
phase: 05-editor-enhancements-personalization
verified: 2026-08-08T09:01:47Z
status: human_needed
score: 4/4 must-haves verified (code-level), 4 present-but-behavior-unverified for felt/visual timing
behavior_unverified: 4
overrides_applied: 0
human_verification:
  - test: "Toolbar 버튼에 마우스를 올려 300ms 후에 툴팁이 나타나고, 마우스를 떼면 즉시 사라지는지 확인 (EDIT-10)"
    expected: "hover 300ms 뒤에 툴팁이 페이드인, hover 해제 시 지연 없이 즉시 사라짐. 클릭 중에는 배경 accent-weak/텍스트 accent로 순간 pressed 표시."
    why_human: "코드(Toolbar.module.css :active, transition-delay 300ms 분리 규칙)는 존재·배선이 확인됐으나 CSS 타이밍의 '체감'은 실제 브라우저에서만 관찰 가능"
  - test: "문서를 편집하고 60초 대기(draft upsert) → 새로고침 → 복구 다이얼로그가 자동으로 뜨는지, 복원/폐기/나중에 3버튼이 각각 의도대로 동작하는지 확인 (EDIT-11)"
    expected: "재진입 시 draft가 document보다 최신이면 '임시 저장된 내용이 있어요' 다이얼로그 자동 open. 복원 클릭 시 에디터에 draft 내용이 적재되고 뒤이어 자동저장이 발생해 draft가 서버에서 삭제됨. 폐기 클릭 시 DELETE 호출로 draft만 사라지고 에디터는 그대로. 나중에 클릭 시 다이얼로그만 닫히고 다음 진입 시 재표시."
    why_human: "60초 컨트롤러 발사 규칙(fake-timer)·stale seq에서 draft 생존(실 DB)·isDraftNewer 비교(unit)·restore dispatch 코드는 각각 개별적으로 테스트 green이지만, '편집→60초→새로고침→다이얼로그→복원' 전체 크래시 복구 루프를 처음부터 끝까지 실제 타이머·실제 리로드로 관통하는 자동 테스트는 이 phase에 없음(05-05 SUMMARY D4가 이미 human_judgment:true로 표시)"
  - test: "다크 모드로 전환 후 새로고침 시 흰 화면 깜빡임(FOUC) 없이 즉시 다크로 렌더되는지, 사이드바 테마 토글 클릭이 즉시 라이트/다크를 전환하는지 확인 (EDIT-12)"
    expected: "새로고침 순간에도 흰 배경이 잠깐도 보이지 않고 바로 다크. 토글 클릭 시 즉시(리로드 없이) 색이 바뀜."
    why_human: "RSC cookies()→data-theme 렌더 로직은 3케이스 unit 테스트로 green이지만, no-FOUC는 SSR 하이드레이션 타이밍이라 실제 브라우저 새로고침에서만 관찰 가능(05-07 SUMMARY D2가 이미 human_judgment:true로 표시)"
  - test: "레이아웃 모드 3버튼(분할/에디터만/미리보기만)을 각각 클릭해 패널이 정확히 전환되는지, split 모드에서 경계를 드래그해 20~80% 범위에서 비율이 부드럽게 바뀌고 새로고침 후에도 유지되는지 확인 (EDIT-12)"
    expected: "클릭 즉시 그리드가 전환(미리보기만=에디터/툴바 사라짐, 에디터만=미리보기 사라짐). 드래그 중 커서가 col-resize로 바뀌고 20%/80% 경계에서 멈춤. 드래그 종료 후 새로고침해도 같은 비율 유지."
    why_human: "clampRatio 순수 함수(20~80 경계)와 그리드 조건부 렌더는 코드 확인+unit 테스트로 충분하지만, 드래그의 실제 손맛과 새로고침 후 시각적 일치는 실 브라우저에서만 검증 가능(05-08 SUMMARY D1/D3/D4가 이미 human_judgment:true로 표시)"
---

# Phase 5: Editor Enhancements & Personalization Verification Report

**Phase Goal:** Users get a richer, safer, more personalized editing experience — EDIT-09(이미지 업로드) / EDIT-10(툴바 폴리시) / EDIT-11(크래시 복구 draft) / EDIT-12(테마·레이아웃 개인화)
**Verified:** 2026-08-08T09:01:47Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Method

7개 plan(05-01, 02, 03, 04, 05, 07, 08)의 PLAN.md must_haves와 SUMMARY.md coverage 주장을 코드베이스와 직접 대조했다. SUMMARY.md의 "pass" 표시를 그대로 신뢰하지 않고, 실제 소스를 읽고, `pnpm exec tsc --noEmit`, `pnpm vitest run`(919 tests), `pnpm exec playwright test e2e/image-upload.spec.ts`(2 tests, 실 브라우저)를 직접 재실행했으며, PG16(5433)에 `psql \d document_draft`로 마이그레이션이 실제 적용됐는지 확인했다.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria 기준)

| # | Truth (ROADMAP SC) | Status | Evidence |
|---|---------------------|--------|----------|
| 1 | 이미지 업로드 완료 시 커서 위치에 마크다운이 삽입된다 (EDIT-09) | ✓ VERIFIED | `src/lib/storage.ts` 매직바이트 4종 스니핑+5MB 우선 캡(코드·유닛테스트 7건 green), `POST /api/uploads` requireRole EDITOR+ RBAC(유닛 4건 green), `useImageUpload.ts` placeholder→literal-search-replace+동시업로드 가드, **e2e/image-upload.spec.ts 2건을 실 브라우저(`pnpm exec playwright test`)로 직접 재실행해 통과 확인**(툴바 클릭→파일선택→서버검증→마크다운 삽입, 동시 두 번째 선택 무시) |
| 2 | 툴바 버튼이 lucide 아이콘 + 300ms 이내 hover 툴팁 + 클릭 pressed를 갖는다 (EDIT-10) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 아이콘: `Toolbar.tsx`가 plugin registry의 `Icon`을 `<Icon size={16}/>`로 렌더(Phase 2부터 존재, 코드 확인). Pressed: `Toolbar.module.css` `.button:active { background: var(--accent-weak); color: var(--accent) }` 존재. 300ms: `.tooltip`이 hide-immediate(`opacity 0s linear 0s`)/show-delayed(`.buttonWrap:hover .tooltip { transition: opacity 0s linear 300ms }`)로 분리돼 존재. **CSS 규칙은 코드로 확인되나 체감 타이밍은 자동 테스트 대상이 아님** — 아래 human_verification 참조 |
| 3 | 1분 스냅샷 autosave가 크래시 복구를 가능케 하고, 재진입 시 최신 스냅샷이면 복원 여부를 묻는다 (EDIT-11) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 구성요소별로는 강하게 검증됨: (a) `document_draft` 테이블이 PG16(5433)에 실제 적용됨(`psql \d document_draft` 직접 확인, document_id PK + ON DELETE CASCADE 확인) (b) `createDraftController` 60초 dirty-flag 발사 규칙 — fake-timer 5케이스 green(입력 없으면 미발사·발사 후 리셋·마지막 값만 1회 전송·dispose 정지) (c) `PUT /api/documents/:id` 핸들러가 `autosaveDocument`의 **boolean 반환값**으로 `deleteDraft`를 게이트(200 상태코드가 아님) — 실 DB 통합테스트 2건(stale seq에서 draft 생존, 최신 seq에서 draft 삭제) green (d) `isDraftNewer(draft, doc)` strict `>` 비교, RSC가 `Promise.all([getDocument, getDraft])`로 같은 요청에서 조회해 raw timestamp를 클라에 노출하지 않음 — unit 4케이스 green (e) `DocumentWorkspace.handleRestore`가 `getView().dispatch({from:0,to:len,insert:draftContent})` 단 1회로 적재하고 별도 강제저장·삭제 호출 없이 기존 자동저장 파이프라인에 위임(코드 확인, `DocumentWorkspace.tsx`가 `@codemirror/view`·`@codemirror/state`를 import하지 않음도 확인). **그러나 "편집→60초 대기→새로고침→다이얼로그 자동 open→복원 클릭"이라는 크래시 복구 전체 루프를 관통하는 자동 테스트(e2e)가 이 phase에 없다** — 각 조각은 검증됐지만 이어붙인 전체 동작은 사람이 눈으로 확인해야 함(05-05 SUMMARY도 이미 human_judgment:true로 self-flag) |
| 4 | 라이트/다크 테마와 split/에디터전용/미리보기전용 레이아웃을 전환할 수 있다 (EDIT-12) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 테마: `globals.css`에 `[data-theme="dark"]` 12토큰 override + `@media (prefers-color-scheme: dark) { :root:not([data-theme]) }` 폴백 둘 다 실제 값으로 존재(코드 직독 확인, UI-SPEC 다크 팔레트 값과 일치). `layout.tsx` RootLayout이 `async` + `await cookies()`로 `theme` 쿠키를 읽어 `<html data-theme>`에 반영 — RSC 렌더 로직 unit 3케이스(없음/light/dark) green. `ThemeToggle.tsx`가 `document.cookie` 직접 쓰기 + `dataset.theme` 갱신(코드 확인, 신규 API 라우트 0개). 레이아웃: `clampRatio` 20~80% 클램프 unit 4케이스 green. `EditorPreviewLayout`이 `layoutMode`에 따라 `gridTemplateColumns/-areas`를 조건부 override(split만 리사이즈 핸들 렌더, editor-only/preview-only는 상대 페인 미렌더 — 코드 확인). 리사이즈 `mouseup` 1회만 쿠키 기록(코드 확인, mousemove에서는 기록 안 함). `LayoutModeToggle`이 클릭 시 `layoutMode` 쿠키 직접 기록. `d/[docId]/page.tsx`가 `await cookies()`로 layoutMode/splitRatio를 읽어 초기 prop 전달, 잘못된 값은 split/50 폴백(코드 확인). **CSS/쿠키/그리드 로직은 정적으로 정확하나, no-FOUC 체감·드래그 손맛·3모드 클릭 전환의 실제 화면 반응은 자동 테스트가 없다**(05-07/05-08 SUMMARY 모두 human_judgment:true로 self-flag) |

**Score:** 4/4 truths present + wired (코드/유닛/통합/e2e 테스트로 뒷받침), 1개(EDIT-09)는 완전한 e2e 행동증거까지 확보. 나머지 3개(EDIT-10/11/12)는 구성요소 단위로는 강하게 검증됐으나 사용자 체감·전체 루프·시각적 타이밍은 자동화 불가 영역으로 남아 human_needed.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/storage.ts` | saveUpload 단일 export, 매직바이트+uuid+size캡 | ✓ VERIFIED | size 우선 체크→arrayBuffer→sniff→uuid 파일명 순서 코드 확인 |
| `src/app/api/uploads/route.ts` | POST, runtime=nodejs, requireRole EDITOR | ✓ VERIFIED | 4단 구조 확인, UI-SPEC 문구 400 매핑 확인 |
| `src/components/editor/useImageUpload.ts` | 업로드 오케스트레이션 + 동시 가드 + 에러 상태 | ✓ VERIFIED | uploadingRef 가드, errorMessage/dismissError 확인 |
| `src/components/editor/ImageDropzone.tsx`, `UploadErrorBanner.tsx` | 드롭존 오버레이 / 에러 배너 | ✓ VERIFIED | UI-SPEC 카피·아이콘 일치 확인 |
| `src/components/layout/EditorPreviewLayout.tsx` | forwardRef getView + grid 변형 + 리사이즈 핸들 | ✓ VERIFIED | EditorPreviewLayoutHandle export, clampRatio export, split에서만 핸들 렌더 확인 |
| `src/db/schema.ts` + `drizzle/0004_high_roulette.sql` | document_draft(document_id PK, CASCADE) | ✓ VERIFIED | `psql \d document_draft`로 실 DB(PG16:5433) 적용 확인 |
| `src/lib/documents.ts` | upsertDraft/getDraft/deleteDraft/isDraftNewer | ✓ VERIFIED | onConflictDoUpdate target=documentId, strict `>` 비교 확인 |
| `src/app/api/documents/[id]/draft/route.ts` | PUT/DELETE, IDOR/RBAC, GET 부재 | ✓ VERIFIED | 4단 구조 documents/[id]/route.ts와 동형 확인, GET 없음 확인 |
| `src/app/api/documents/[id]/route.ts` | autosaveDocument boolean 게이트 draft 삭제 | ✓ VERIFIED | `if (saved) { await deleteDraft(id); }` — 200 상태코드가 아닌 boolean 게이트 확인 |
| `src/components/document/draft-controller.ts` + `useDraft.ts` | 순수 60초 dirty-flag 컨트롤러 | ✓ VERIFIED | React-less, send 주입, fake-timer 5케이스 green |
| `src/components/document/DraftRecoveryDialog.tsx` | ConfirmDialog 확장 3선택지 | ✓ VERIFIED | 복원/폐기/나중에, UI-SPEC 문구 일치 확인 |
| `src/components/document/DocumentWorkspace.tsx` | useDraft + getView 적재 + 폐기 배선 | ✓ VERIFIED | handleRestore 단일 dispatch, CodeMirror 직접 import 없음(Pitfall 6) 확인 |
| `src/app/globals.css` | 다크 12변수 + @media 폴백 | ✓ VERIFIED | 값 직독, UI-SPEC과 일치 확인 |
| `src/app/layout.tsx` | async cookies() → data-theme | ✓ VERIFIED | RSC 렌더 로직 unit 3케이스 green |
| `src/components/layout/ThemeToggle.tsx` | 쿠키+DOM 즉시 전환 | ✓ VERIFIED | document.cookie + dataset.theme 확인, FolderTree 휴지통 행 아래 배치 확인 |
| `src/components/layout/LayoutModeToggle.tsx` | 3버튼 세그먼트 | ✓ VERIFIED | Columns2/PanelRightClose/PanelLeftClose + 쿠키 쓰기 확인 |
| `src/app/(main)/w/[wsId]/d/[docId]/page.tsx` | getDraft 병렬조회 + layoutMode/splitRatio 쿠키 읽기 | ✓ VERIFIED | Promise.all, 폴백(split/50) 확인 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| Toolbar image 버튼 | useImageUpload | onImageButtonClick 가로채기 | ✓ WIRED | `plugin.id === "image"`일 때만 가로채고 나머지 13개 불변(코드 확인) |
| useImageUpload | POST /api/uploads | fetch + FormData | ✓ WIRED | e2e로 실제 왕복 확인 |
| PUT /api/documents/:id | deleteDraft | autosaveDocument boolean 게이트 | ✓ WIRED | 실 DB 통합테스트 2건(양쪽 분기) green |
| draft-controller | PUT /api/documents/:id/draft | useDraft.send | ✓ WIRED | fetch 경로 코드 확인 |
| RSC d/[docId]/page.tsx | DraftRecoveryDialog | hasNewerDraft/draftContent prop | ✓ WIRED | Promise.all 비교→prop만 전달(raw timestamp 미노출) 확인 |
| DraftRecoveryDialog 복원 | EditorPreviewLayoutHandle.getView().dispatch | 단일 dispatch | ✓ WIRED | 별도 강제저장/삭제 없음, 자동저장 파이프라인에 위임 확인 |
| ThemeToggle | globals.css [data-theme] | document.cookie + dataset.theme | ✓ WIRED | 코드 확인(실제 색 전환 렌더는 human_verification) |
| LayoutModeToggle/리사이즈 | EditorPreviewLayout grid | layoutMode/splitRatio cookie → RSC → prop | ✓ WIRED | 코드 확인(실제 전환 렌더는 human_verification) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 전체 유닛/통합 스위트 | `pnpm vitest run` | 47 files / 919 tests passed | ✓ PASS |
| 타입 정합성 | `pnpm exec tsc --noEmit` | clean (no output) | ✓ PASS |
| 이미지 업로드 e2e(실 브라우저) | `pnpm exec playwright test e2e/image-upload.spec.ts` | 2 passed (9.2s) | ✓ PASS |
| document_draft 마이그레이션 실제 적용 | `psql "postgresql://localhost:5433/markdown_kms" -c "\d document_draft"` | PK(document_id), FK CASCADE 확인 | ✓ PASS |
| 테마/레이아웃/복구 다이얼로그 e2e | (없음 — `e2e/`에 theme·layout·draft-recovery 전용 spec 부재) | — | ? SKIP — 05-VALIDATION.md가 이 3개를 Manual-Only로 이미 지정했고, SUMMARY들도 human_judgment:true로 자체 표시함 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| EDIT-09 | 05-01, 05-02 | 이미지 업로드 완료 시 커서 위치 삽입 | ✓ SATISFIED | e2e 실행 확인, 매직바이트/RBAC 유닛 확인 |
| EDIT-10 | 05-07 | lucide 아이콘 + 300ms 툴팁 + pressed | ✓ SATISFIED (코드), 시각 타이밍은 human 확인 필요 | CSS 규칙 존재·배선 확인 |
| EDIT-11 | 05-03, 05-04, 05-05 | 1분 draft + 복구 프롬프트 | ✓ SATISFIED (구성요소별), 전체 루프는 human 확인 필요 | 실 DB 통합 + fake-timer + unit 전부 green |
| EDIT-12 | 05-07, 05-08 | 테마 + 레이아웃 3모드 전환 | ✓ SATISFIED (코드), 시각 전환은 human 확인 필요 | RSC 쿠키 unit + clampRatio unit green |

REQUIREMENTS.md는 4건 모두 Phase 5 / Complete로 이미 표시돼 있으며(28-31, 102-105행), 이 표시가 코드베이스와 실제로 부합함을 위 표가 뒷받침한다. Orphaned requirement 없음(4/4 모두 plan frontmatter `requirements:`에 명시적으로 매핑됨).

### Anti-Patterns Found

없음. Phase 5가 손댄 47개 파일 전체를 TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER-리터럴/coming-soon 패턴으로 스캔했고, `useImageUpload.ts`의 `PLACEHOLDER` 히트는 업로드 중 표시용 상수 변수명(정상 코드)이지 부채 마커가 아니다. `plugins/image.ts`는 Phase 2 이후 커밋 변경이 전혀 없음(`git log`로 확인) — TRD §6 1기능1파일 불변식 보존.

### Human Verification Required

위 frontmatter `human_verification` 4건 참조 (EDIT-10 툴바 타이밍, EDIT-11 크래시 복구 전체 루프, EDIT-12 테마 no-FOUC, EDIT-12 레이아웃 전환/리사이즈). 05-VALIDATION.md의 "Manual-Only Verifications" 표와 05-05/05-07/05-08 SUMMARY.md의 `human_judgment: true` 항목들이 이미 이 4가지를 자체적으로 예고했다 — 이 verification은 그 예고가 실제로 자동화되지 않은 채 남아 있음을 코드베이스 대조로 재확인했을 뿐이며, 새로운 결함을 발견한 것은 아니다.

### Gaps Summary

FAILED 항목, MISSING/STUB 아티팩트, NOT_WIRED 키링크, 부채 마커 없음 — `gaps_found`를 유발할 요소가 없다. 다만 EDIT-10/11/12의 사용자 체감·전체 루프·시각적 타이밍이 자동 테스트 커버리지 밖에 있어(각 plan이 스스로 Manual-Only로 분류) `human_needed`로 분류한다. 이 3개 requirement 모두 구성요소 단위(서버 로직·순수 함수·타이머 규칙·RSC 비교)는 실 DB/실 브라우저 테스트로 뒷받침되는 강한 근거를 갖고 있으므로, human 확인은 "코드가 틀렸을 위험"이 아니라 "체감/타이밍/전체 루프의 최종 확인" 성격이다.

---

_Verified: 2026-08-08T09:01:47Z_
_Verifier: Claude (gsd-verifier)_
