---
phase: 09-design-system-application
verified: 2026-08-15T16:37:41Z
status: human_needed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "라이트 모드로 랜딩(로그인/회원가입)·워크스페이스 메인(/dashboard)·에디터 글쓰기 화면(/w/[wsId]/d/[docId])을 브라우저에서 열어 DM Sans 타이포·반경 스케일·press 피드백·squircle 코너가 의도대로 보이는지 확인"
    expected: "docs/design_system 토큰(타이포/반경/모션)이 라이트 배경 위에서 ui-kit.html 색상과 조화롭게 보이고, 버튼 클릭 시 scale(0.98) press 피드백이 체감된다"
    why_human: "grep/vitest는 CSS 선언이 존재하고 var() 참조가 걸려 있음만 증명한다 — 실제 렌더 결과의 시각적 조화·타이포 대비·모션 체감은 육안 확인이 필요"
  - test: "[data-theme=\"dark\"]로 전환 후 세 화면을 모두 열어 Dracula 파생 다크 팔레트(#0e0d11/#7359f8 등) 대비와 SaveStatusBar '저장됨' accent 배지, FolderTreeNode 활성 노드 accent 강조를 확인"
    expected: "다크 배경에서 텍스트 대비가 충분하고 accent 요소가 화면당 하나의 강조 포인트로 명확히 인지된다"
    why_human: "다크 대비 체감·color-mix() 드롭 하이라이트 톤은 코드 검사로 판단 불가"
  - test: "워크스페이스 메인의 680px 중앙 정렬 리스트 컨테이너와 워크스페이스 카드 메타 라인(소유자·생성일·문서/폴더 개수)이 docs/images/workspace-main-wireframe.svg 구성과 실제로 일치하는지, 에디터 화면이 docs/images/write-form-wireframe.svg 배치(사이드바·브레드크럼·툴바·보기모드 4버튼·분할·상태바)와 일치하는지 확인"
    expected: "두 화면 모두 와이어프레임이 지정한 레이아웃 구획과 시각적으로 대응한다"
    why_human: "레이아웃 매칭은 스크린샷 대 와이어프레임 비교이며 자동 검증 도구가 이 phase에 없음 — 09-01/02/03 SUMMARY가 각각 D-06/D4/D5로 이미 이 항목을 human 확인 대상으로 명시하고 `/gsd-verify-work 9`로 defer함"
gaps: []
---

# Phase 9: Design System Application Verification Report

**Phase Goal:** docs/design_system/의 브랜드 디자인 시스템(brand.json·DESIGN.md·DESIGN-HANDOFF.md·system/)을 랜딩(회원가입/로그인)·워크스페이스 메인·에디터 글쓰기 화면에 적용해 룩앤필을 재작업한다. 신규 백엔드 기능 없음 — 기존 기능(RBAC, autosave seq-guard, soft-delete, closure-table 폴더, 서식 플러그인 등) 100% 유지, 순수 프레젠테이션 레이어 리스킨 + 인터랙션 재작업.
**Verified:** 2026-08-15T16:37:41Z (KST 2026-08-16 01:37)
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP Success Criteria) | Status | Evidence |
|---|---|---|---|
| 1 | 랜딩 페이지가 docs/design_system 토큰(브랜드 컬러·타이포·컴포넌트)을 적용한 회원가입/로그인 폼(+Google 버튼 placeholder)을 보여준다 | ✓ VERIFIED (wiring) | globals.css `:root`에 `--radius-sm/md/lg`, `--duration-fast/standard/slow`, `--ease-fluid/--ease-elastic` 8개 토큰 존재(라인 28-35); 6개 UI 프리미티브에 하드코딩 반경 0건, `Button.module.css`에 `scale(0.98)` press 피드백, `Card`/`Modal`에 squircle `@supports` 블록 확인; `login-form.tsx`/`signup-form.tsx`에 `disabled` "Google로 계속하기" 버튼 존재, `signIn("google"` 미배선, `400+ apps` 마케팅 카피 0건; DM Sans 500/600/700 폰트가 CR-01 수정 후 MD5 전부 상이(아래 참조)함을 직접 확인. 실제 화면 렌더 결과는 Human Verification #1 참조 |
| 2 | 워크스페이스 메인이 docs/images/workspace-main-wireframe.svg 구성(슬림 탑바·폴더 트리 없는 중앙 정렬 카드 리스트·워크스페이스 만들기·행 클릭 진입)대로 실제 워크스페이스 데이터를 조회해 리스팅한다 | ✓ VERIFIED (wiring) | `listMembershipsForUser`가 `createdAt`/`ownerName`/`docCount`/`folderCount`를 drizzle `sql` correlated subquery로 실측 반환(하드코딩 없음, `src/lib/db-membership.ts`); `WorkspaceCard.tsx`가 4필드를 props로 받아 메타 라인 렌더, `dashboard/page.tsx`가 4필드 전달(grep 확인); `/dashboard` 라우트 무변경. 레이아웃이 와이어프레임과 실제로 일치하는지는 Human Verification #3 참조 |
| 3 | 문서 에디터 화면이 docs/images/write-form-wireframe.svg 구성(사이드바 폴더 트리+검색·상단 브레드크럼/제목/저장·삭제·서식 툴바·보기모드 4버튼·분할 에디터/프리뷰·상태바)대로 재구성되고, 기존 에디터 기능(서식/자동저장/저장 버튼/미리보기)이 회귀 없이 동작한다 | ✓ VERIFIED | `src/components/{tree,document,editor,preview}/*.tsx` 전체가 phase 9 커밋 범위(1cd3cc3..284410c)에서 diff 0건(git diff 직접 확인) — 로직 무접촉이 구조적으로 증명됨; `FolderTreeNode.module.css` `.selected`가 accent 강조 확인; `Toolbar.module.css`가 `var(--surface-2)` 무채색 확인; `SaveStatusBar.module.css`의 `.iconMuted:has(+ .textMuted)` CSS-only 셀렉터로 "저장됨" accent 배지 구현 확인, `SaveStatusBar.tsx` 카피 문자열("저장 중…"/"저장됨"/"저장 실패") 무변경 확인. **자동저장 seq-guard 상태 전이("저장 중…"→"저장됨")는 이 검증에서 직접 실행한 `e2e/design-system-flow.spec.ts` (아래 참조)가 실제로 이 전이를 assert하며 1/1 pass** — 상태-전이 계열 진실이라 symbol 존재만으로는 부족하다는 원칙에 따라 배선 확인에 그치지 않고 행동 증거까지 확보함. 레이아웃이 와이어프레임과 실제로 일치하는지는 Human Verification #3 참조 |
| 4 | 로그인부터 워크스페이스 생성/가입, 폴더 생성, 문서 생성/수정/삭제까지 전체 플로우가 새 UI에서 매 단계 vitest+playwright 회귀 테스트로 검증된다 | ✓ VERIFIED | 이 검증 세션에서 직접 실행: `pnpm vitest run` → **1062/1062 pass**; `pnpm exec playwright test e2e/design-system-flow.spec.ts` → **1/1 pass**(회원가입→워크스페이스 생성(OWNER)→폴더 생성→문서 생성→편집(자동저장 seq-guard 전이)→소프트삭제→휴지통 노출, 20.6s); `CLAUDE.md`에 "DM Sans" 문자열 존재, `changelog/changelog.md`에 "#7359f8" 문자열 존재(D-06 반영) 확인 |

**Score:** 4/4 truths verified (0 present-but-behavior-unverified)

### Code Review Remediation Verification (commit 284410c)

작업 지시에 따라 09-REVIEW.md의 발견사항 3건이 실제로 디스크에서 해소됐는지 커밋 메시지가 아니라 파일 내용으로 직접 재확인:

| Finding | Claimed Fix | Disk Verification | Status |
|---|---|---|---|
| CR-01 (Critical): DM Sans 500/600/700이 400과 byte-identical | `@fontsource/dm-sans`(OFL 실제 웨이트 파일)로 교체 | `md5` 직접 계산 결과 4개 파일(400/500/600/700) 전부 상이한 해시(`9598e18…`/`aa95224…`/`c64569e…`/`9508ec8…`), 파일 크기도 18192/14304/14144/14348 bytes로 전부 다름 | ✓ RESOLVED |
| WR-01: WorkspaceCard 메타 라인에 `title` fallback 없음 | `title={...}` 속성 추가 | `WorkspaceCard.tsx:47`에 `title={\`소유자 ${ownerName ?? "-"} · ...\`}` 존재 확인 | ✓ RESOLVED |
| WR-02: `db-membership.ts` 신규 JSDoc이 영문 | 한글로 재작성 | `db-membership.ts:10-16` JSDoc 전문이 한글(식별자/결정 태그 `D-08`/`T-09-02-SQLI`만 원문 유지)로 확인 | ✓ RESOLVED |

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `public/fonts/dm-sans-{400,500,600,700}.woff2`, `dm-mono-400.woff2` | 자체호스팅 폰트, 서로 다른 웨이트 | ✓ VERIFIED | 5개 파일 존재, MD5 전부 상이(CR-01 수정 확인) |
| `src/app/globals.css` 전역 토큰 8개 + 다크 팔레트 | radius/duration/ease + Dracula 파생 색 | ✓ VERIFIED | 라인 28-35(토큰), 43-55(다크 팔레트), `#3b82f6` 0건 |
| `src/components/ui/*.module.css` (6개) | var(--radius-*) 참조, press 피드백, squircle | ✓ VERIFIED | 하드코딩 반경 0건, `scale(0.98)` 확인, squircle `@supports` 2건 |
| `login-form.tsx`/`signup-form.tsx` Google placeholder | disabled, OAuth 미배선 | ✓ VERIFIED | `disabled` 속성 + `signIn("google"` 0건 |
| `src/lib/db-membership.ts` 확장 반환 | createdAt/ownerName/docCount/folderCount | ✓ VERIFIED | correlated subquery 4필드, 테스트 5/5(SUMMARY, vitest 전체 재확인으로 간접 확인) |
| `src/components/workspace/WorkspaceCard.tsx` | 확장 props + 메타 라인 + title fallback | ✓ VERIFIED | props 4개 확장, title 속성 존재(WR-01 해소) |
| `src/components/{tree,document,editor,preview}/*.module.css` | 토큰 소비, .tsx 무수정 | ✓ VERIFIED | var(--radius-*) 유입 확인, 관련 .tsx 전부 diff 0 |
| `e2e/design-system-flow.spec.ts` | 전체 플로우 e2e | ✓ VERIFIED | 이 세션에서 직접 실행 1/1 pass |
| `CLAUDE.md` §문서체계 갱신 | 라이트/다크 이원 토큰 설명 | ✓ VERIFIED | "DM Sans" 매치, 라이트=ui-kit.html/다크=Dracula 파생 서술 확인 |
| `changelog/changelog.md` Phase 9 엔트리 | 비가역 결정 기록 | ✓ VERIFIED | "#7359f8" 매치, 폰트/팔레트/토큰 결정 서술 확인 |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `layout.tsx` 폰트 variable | `globals.css` body font-family | `--font-ibm-plex-sans` 변수명 일치 | ✓ WIRED | `layout.tsx:18`/`globals.css:97` 변수명 동일, 소스만 DM Sans로 교체 |
| `listMembershipsForUser` 반환 | `dashboard/page.tsx` → `WorkspaceCardProps` | 4필드 전달 체인 | ✓ WIRED | grep으로 3개 지점 모두 확인 |
| `SaveStatusBar.module.css` `:has()` 셀렉터 | `SaveStatusBar.tsx` DOM 구조(`.iconMuted`+`.textMuted` 인접) | CSS-only 상태 분기 | ✓ WIRED | 마크업 구조가 셀렉터 전제와 일치, "저장됨"에서만 `.iconMuted:has(+ .textMuted)` 매치 |
| `e2e/design-system-flow.spec.ts` | 3개 리스킨 화면(랜딩/워크스페이스/에디터) | 크로스-화면 사용자 여정 | ✓ WIRED | 실행 결과 1/1 pass로 크로스-화면 배선 확인 |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| 전체 단위 테스트 무회귀 | `pnpm vitest run` | 1062/1062 pass, 17.91s | ✓ PASS |
| 전체 플로우 e2e(로그인→워크스페이스→폴더→문서 CRUD→휴지통, seq-guard 상태 전이 포함) | `pnpm exec playwright test e2e/design-system-flow.spec.ts` | 1/1 pass, 20.6s | ✓ PASS |
| 신규 폰트 파일 무결성 | `md5 public/fonts/dm-sans-*.woff2` | 4개 해시 전부 상이 | ✓ PASS |
| tsx 파일 무접촉(순수 스타일링 주장 검증) | `git diff --name-only 1cd3cc3~1 284410c \| grep tsx` | 계획대로 5개 파일만(login-form/signup-form/dashboard page/layout/WorkspaceCard) — tree/document/editor/preview 0건 | ✓ PASS |

### Requirements Coverage

Phase 9는 신규 요구사항을 도입하지 않는다 — AUTH-01/AUTH-02(Phase 1 Complete)/WS-01/WS-02(Phase 1 Complete)/DOC-01/DOC-02(Phase 4 Complete)를 리스킨 후 회귀 재확인만 한다(각 PLAN frontmatter `requirements` 필드에 명시).

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| AUTH-01 | 09-01, 09-04 | 가입 즉시 로그인 | ✓ SATISFIED (regression) | vitest 1062/1062 + design-system-flow e2e signup 단계 pass |
| AUTH-02 | 09-01 | 새로고침 세션 유지 | ✓ SATISFIED (regression) | SUMMARY 09-01 session-persistence.spec.ts 4/4 pass 주장, `login-form.tsx`/`signup-form.tsx` 외 인증 흐름 .tsx 무접촉으로 구조적 뒷받침 |
| WS-01 | 09-02, 09-04 | RBAC 403 매트릭스 | ✓ SATISFIED (regression) | vitest 1062/1062(rbac 유닛 포함) 이 세션에서 재확인, `requireRole` 소스 무접촉 |
| WS-02 | 09-02, 09-04 | 생성=OWNER, 삭제=OWNER만 | ✓ SATISFIED (regression) | design-system-flow e2e 워크스페이스 생성 단계 pass |
| DOC-01 | 09-03, 09-04 | 문서 생성·수정·소프트삭제 | ✓ SATISFIED (regression) | design-system-flow e2e 문서 생성/편집/삭제 단계 pass |
| DOC-02 | 09-03, 09-04 | 휴지통 복원/완전삭제 | ✓ SATISFIED (regression, 노출만 직접 재확인) | design-system-flow e2e 휴지통 노출 확인 pass; 복원/완전삭제 자체는 이 phase가 재실행하지 않음(09-04-SUMMARY가 명시적으로 "04-04/04-05가 이미 증명"이라 스코프 축소를 선언 — Phase 4가 원 소유자라 orphaned 아님) |

REQUIREMENTS.md의 Traceability 표는 위 6개 ID를 여전히 원 구현 phase(Phase 1/4)로 매핑한다 — Phase 9는 회귀 재검증 phase이므로 이 표 갱신 대상이 아니며 orphaned requirement 없음.

### Anti-Patterns Found

Phase 9가 수정한 전체 파일(커밋 1cd3cc3..284410c, 41개)에 대해 `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER|coming soon|not yet implemented` 스캔 — **0건**.

Info 수준 관찰 1건(비차단): `src/components/document/SaveStatusBar.tsx:3-6`의 Phase 4(04-02)부터 존재하던 주석("저장됨" stays neutral, never accent/green)이 이번 Phase 9의 `SaveStatusBar.module.css`가 실제로 accent 배지(`.iconMuted:has(+ .textMuted) { color: var(--accent) }`, `background: var(--accent-weak)`)를 적용하면서 사실과 어긋나게 됐다. `.tsx`는 이 phase의 file scope 밖이라 손대지 않은 것은 계획대로지만, 주석이 이제 현재 동작을 오도한다 — 향후 `.tsx`를 만지는 어떤 phase든 이 주석을 갱신해야 함(코드 동작 자체는 UI-SPEC Visual Hierarchy 요구대로 정확히 구현됨, 버그 아님).

## Human Verification Required

자동 검증(grep/vitest/tsc/e2e)은 토큰 배선·동작 회귀·리뷰 수정사항을 전부 증명했지만, 실제 화면이 "브랜드 디자인 시스템을 적용한 것처럼 보이는지"와 "와이어프레임 레이아웃과 일치하는지"는 코드 검사로 판단할 수 없다. 4개 SUMMARY 전부가 이 항목들을 `human_judgment: true`로 명시하고 `/gsd-verify-work 9`로 몰아 검증하도록 defer했다(프로젝트 확립 관례 `prefers-build-all-then-test`).

### 1. 라이트 모드 시각 확인

**Test:** 브라우저에서 `/login`, `/signup`, `/dashboard`, `/w/[wsId]/d/[docId]`를 라이트 모드로 열어 확인
**Expected:** DM Sans 타이포·6/12/18px 반경·press 피드백(scale(0.98))이 ui-kit.html 색상 위에서 의도대로 보임
**Why human:** 렌더 결과의 시각적 조화·모션 체감은 육안 확인 필요

### 2. 다크 모드 시각 확인

**Test:** `[data-theme="dark"]`로 전환 후 동일 화면 확인, SaveStatusBar "저장됨" accent 배지·FolderTreeNode 활성 노드 accent 강조 포함
**Expected:** Dracula 파생 팔레트(#0e0d11/#7359f8) 대비가 충분하고 accent 요소가 화면당 하나의 강조점으로 인지됨
**Why human:** 다크 대비 체감·`color-mix()` 드롭 하이라이트 톤은 코드 검사 불가

### 3. 와이어프레임 레이아웃 일치 확인

**Test:** 워크스페이스 메인을 `docs/images/workspace-main-wireframe.svg`와, 에디터 화면을 `docs/images/write-form-wireframe.svg`와 나란히 비교
**Expected:** 슬림 탑바·680px 중앙 정렬 카드 리스트, 사이드바+브레드크럼+툴바+보기모드 4버튼+분할+상태바 배치가 와이어프레임과 대응
**Why human:** 레이아웃 매칭은 스크린샷 대 와이어프레임 비교이며 이 phase에 자동 시각 회귀 도구가 없음

## Gaps Summary

없음. ROADMAP Phase 9 성공기준 4개 전부 기능·배선 차원에서 자동 검증(grep/vitest/e2e, 이 세션에서 재실행 확인)을 통과했고, 09-REVIEW.md의 Critical 1건·Warning 2건 전부 디스크에서 해소가 확인됐다. 남은 항목은 전부 시각 확인(브라우저 육안)이며, 이는 프로젝트가 이미 여러 phase에 걸쳐 일관되게 적용해온 `prefers-build-all-then-test` 방침에 따른 의도적 defer이지 미완성이 아니다.

---

_Verified: 2026-08-15T16:37:41Z_
_Verifier: Claude (gsd-verifier)_
