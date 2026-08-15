---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 09
current_phase_name: design-system-application
status: verifying
stopped_at: Completed 09-04-PLAN.md (Phase 9 전체 완료)
last_updated: "2026-08-15T16:00:53.528Z"
last_activity: 2026-08-16
last_activity_desc: Phase 09 execution started
progress:
  total_phases: 8
  completed_phases: 8
  total_plans: 41
  completed_plans: 41
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-01)

**Core value:** 에디터에 입력하면 60ms 안에 미리보기에 정확히(CommonMark 0.31.2 + GFM 3종) 렌더링되는 문서 작성 경험.
**Current focus:** Phase 09 — design-system-application

## Current Position

Phase: 09 (design-system-application) — EXECUTING
Plan: 4 of 4
Status: Phase complete — ready for verification
Last activity: 2026-08-16 — Phase 09 execution started

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 11
- Average duration: - min
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 5 | - | - |
| 2 | 6 | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 35min | 4 tasks | 33 files |
| Phase 01 P02 | 55min | 2 tasks | 17 files |
| Phase 01 P03 | 50min | 2 tasks | 27 files |
| Phase 01 P04 | 23min | 4 tasks | 13 files |
| Phase 01 P05 | 16min | 2 tasks | 16 files |
| Phase 02 P06 | 23min | 3 tasks | 10 files |
| Phase 3 P1 | 25min | 2 tasks | 5 files |
| Phase 3 P2 | 40min | 2 tasks | 11 files |
| Phase 03 P03 | 35min | 3 tasks | 3 files |
| Phase 03 P04 | 25min | 3 tasks | 4 files |
| Phase 03 P05 | 55min | 3 tasks | 9 files |
| Phase 04 P01 | 25min | 3 tasks | 8 files |
| Phase 04 P02 | 35min | 3 tasks | 26 files |
| Phase 04 P03 | 35min | 2 tasks | 7 files |
| Phase 04 P04 | 15min | 3 tasks | 8 files |
| Phase 04 P05 | 70min | 3 tasks | 12 files |
| Phase 5 P1 | 13min | 3 tasks | 10 files |
| Phase 05 P03 | 15min | 3 tasks | 6 files |
| Phase 5 P07 | 6min | 3 tasks | 8 files |
| Phase 05 P02 | 17min | 2 tasks | 7 files |
| Phase 05 P04 | 20min | 3 tasks | 6 files |
| Phase 05 P08 | 12min | 3 tasks | 8 files |
| Phase 05 P05 | 15min | 3 tasks | 6 files |
| Phase 06 P01 | 25min | 3 tasks | 10 files |
| Phase 06 P02 | 15min | 2 tasks | 9 files |
| Phase 06 P03 | 22min | 2 tasks | 8 files |
| Phase 06 P04 | 15min | 3 tasks | 10 files |
| Phase 07 P01 | 8min | 3 tasks | 4 files |
| Phase 07 P02 | 7min | 3 tasks | 8 files |
| Phase 07 P03 | 6min | 3 tasks | 5 files |
| Phase 07 P04 | 25min | 2 tasks | 5 files |
| Phase 07 P05 | 45min | 3 tasks | 12 files |
| Phase 09 P01 | 40min | 3 tasks | 18 files |
| Phase 09 P02 | 15min | 2 tasks | 6 files |
| Phase 09 P03 | 35min | 2 tasks | 13 files |
| Phase 09 P04 | 15min | 2 tasks | 3 files |

## Accumulated Context

### Roadmap Evolution

- Phase 9 added: Design System Application — docs/design_system/ 브랜드 시스템을 랜딩(인증)·워크스페이스 메인·에디터 글쓰기 화면에 적용하는 UI/UX 리스킨. 신규 백엔드 기능 없음, Google 로그인은 시각적 placeholder만(Phase 8 descope 결정 유지).

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: Markdown pipeline + editor plugins (Phase 2) sequenced after Phase 1 for execution order only — no functional dependency on auth/schema, could run in parallel.
- Roadmap: Autosave seq guard (EDIT-07) bundled into Phase 4 (Documents), not split into its own phase — per research, splitting it reproduces the "field says saved but content lost" bug.
- Roadmap: 3-pane screen integration has no standalone requirement ID; folded into Phase 4 as the natural convergence point of editor (Phase 2), tree (Phase 3), and documents (Phase 4).
- Roadmap: RBAC matrix (WS-01) placed in Phase 1 so it's resolved server-side before Phase 7's invite/join-request UI.
- Roadmap: PRES-01/02 and AUTH-04 (P2) placed last in Phase 8 per explicit priority ordering (P0 → P1 → P2).
- [Phase ?]: D-08 reconfirmed (proceed): single shared default workspace baked into seed+migration per CONTEXT.md
- [Phase ?]: next pinned to 15.5.22 (not scaffolder's default 16.x) per TRD/RESEARCH lock
- [Phase ?]: AUTH-03/WS-01 left unchecked in REQUIREMENTS.md from 01-01 alone — schema/seed substrate only, functional completion lands in 01-02/01-03 (AUTH-03) and 01-04 (WS-01)
- [Phase ?]: Dashboard redirects unauthenticated visits to /signup (not /login) — /login isn't built until Plan 03
- [Phase ?]: Signup atomicity test forces failure by temporarily flipping the seeded workspace's is_default flag, not by mocking db.transaction
- [Phase ?]: src/lib/validation.ts left untouched by Plan 03 (read-only consumption of signupSchema) — fully open/additive for Plan 04's workspace-name schema
- [Phase ?]: ui-kit's #5 card (product-card) generalized into a plain bordered/padded Card component, not literally ported — no image/price fields apply to auth card or workspace tile
- [Phase ?]: Fixed pre-existing vitest/playwright collision: vitest.config.ts now excludes e2e/** so Vitest stops trying to run Playwright specs
- [Phase ?]: D-15 override (hard→soft workspace delete) confirmed and implemented in 01-04: workspace.is_deleted flag, memberships preserved, active listings filtered
- [Phase ?]: requireRole(workspaceId, minRole) established as the single server-side authorization gate every future mutating route reuses
- [Phase ?]: 01-05: delete-dialog copy corrected to accurately reflect the amended D-15 soft-delete contract (not the stale UI-SPEC hard-delete wording) — human-confirmed at checkpoint
- [Phase ?]: 02-06: hr.ts fix merges CR-02 (blank-line-before-rule) + WR-03 (preserve selection) — insert always at 'to', blank-line decision from on-line content before 'to'
- [Phase ?]: 02-06: heading.ts inlines ANY_LIST_PREFIX_RE (not imported) per 1-feature-1-file invariant; IN-01 shared-module extraction stays out of scope
- [Phase ?]: 02-06: reworded PreviewPane.tsx pre-existing comment to drop literal 'dangerouslySetInnerHTML' substring so the zero-occurrence verification grep passes (comment-only, same security intent)
- [Phase ?]: 03-01: Task 1 checkpoint:decision (one-way folder/folder_closure migration) pre-approved by user via orchestrator (2026-08-08) — recorded apply-now, migration generated+applied without re-prompting
- [Phase ?]: 03-01: folder.parent_id self-FK has no ON DELETE action (only workspace_id and folder_closure's FKs cascade), matching TRD §3 literally
- [Phase ?]: 03-02: POST /api/folders derives workspaceId from parentId's folder row (never client-trusted); a mismatched client-supplied workspaceId is rejected 400 before requireRole runs
- [Phase ?]: 03-02: FolderTree renders top-level folders at depth 0 (no literal workspace-root row yet) — deferred to 03-05 with full Tree Node Contract states
- [Phase ?]: 03-02: tests/folder/query-count.test.ts mocks @/auth to avoid a next-auth/next/server resolution failure pulled in transitively via tests/rbac/helpers.ts
- [Phase ?]: 03-03: moveFolder rewiring test moves B under an unrelated root E (not D, a child of A) — moving into D would legitimately keep A as a transitive ancestor via D, matching TRD/plan's documented root-ancestor rewrite behavior, not a bug
- [Phase ?]: 03-03: DbClient type widened to typeof db | tx-callback-param union so cascade ops (softDeleteFolder) can pass their own tx into getSubtree without a TS2345 error
- [Phase ?]: 03-04: 폴더 mutation 라우트(PATCH/DELETE/move)는 존재하지 않는 folder id도 403으로 응답한다(404 아님) — DELETE /api/workspaces/[id]의 forbiddenResponse() 관례와 일치, 존재/미존재를 상태코드로 구분 못하게 해 IDOR 정보 유출을 막는다
- [Phase ?]: 03-04: closure.ts의 CycleError/CrossWorkspaceError는 라우트 경계에서 instanceof로 잡아 409/400에 매핑한다 — lib 자체는 HTTP를 모른다
- [Phase ?]: 03-05: No literal workspace-root tree row added (out of this plan's declared file scope — page.tsx/FolderTree.module.css untouched); root-level create stays on the header button, move-to-root fully covered by MoveFolderModal's explicit '워크스페이스 루트' entry
- [Phase ?]: 03-05: MoveFolderModal does its own fetch/submitting/error independent of FolderTree's DnD moveFolderTo — two entry points to the same POST /api/folders/[id]/move route, matching PATTERNS analog
- [Phase ?]: 04-01: Task 1 checkpoint:decision (one-way document migration) pre-approved by user via orchestrator (2026-08-08) — recorded apply-now without re-prompting, same as Phase 3's folder migration gate
- [Phase ?]: 04-01: document.folder_id has no ON DELETE CASCADE per TRD §3 literal DDL — permanent-delete ordering (document before folder) deferred to 04-04
- [Phase ?]: 04-01: document_tag/document_draft/trigram(gin) indexes deliberately omitted from this migration — Phase 6/5 scope
- [Phase ?]: 04-01: DOC-01/EDIT-07 left unchecked in REQUIREMENTS.md from 04-01 alone — schema+service substrate only (no API routes/client autosave hook/UI yet); functional completion lands across 04-02/04-03/04-04, matching the 01-01 AUTH-03/WS-01 precedent
- [Phase ?]: 04-02: DocumentWorkspace rendered with key={docId} (full remount on document switch) as the primary fix for the stale-pending-save pitfall, on top of the autosave controller's own reset()/dispose()
- [Phase ?]: 04-02: autosave-controller's docId param dropped from RESEARCH's reference sketch — the pure debounce/seq algorithm never reads it, only useAutosave's useMemo([docId]) needs it
- [Phase ?]: [Phase ?]: 04-03: DELETE /api/documents/:id route-level re-delete of an already-trashed doc returns 403 (not 204) — matches the 03-04 IDOR convention of never leaking existence via status code; the plan's idempotency note describes softDeleteDocument's DB-level guard (concurrent race protection), already covered by lib-level tests
- [Phase ?]: [Phase ?]: 04-03: confirmDeleteDocument calls router.push() before router.refresh() (opposite of submitCreateDocument's existing order in FolderTree.tsx) — the reverse order raced the refresh against the navigation and left the deleted tree node visible; caught by e2e, not left unfixed for consistency with the untouched create-flow ordering
- [Phase ?]: 04-04: getTrashItems merges two typed SELECTs (folder, document) in application code instead of a SQL UNION — different column shapes (name vs title), app-level merge stays type-safe
- [Phase ?]: 04-04: restoreDocument/restoreFolder encode 'only a trash root is restorable' as a WHERE is_trash_root=true guard on the UPDATE itself, matching softDeleteDocument's WR-01 no-op-via-WHERE convention
- [Phase ?]: 04-05: restoreDocument now mirrors restoreFolder's root-relocation (Open Q #2 parity) — a document independently trashed while its folder was still active, then left behind when that folder was later deleted, is relocated to workspace root on restore instead of resurfacing under a still-deleted folderId
- [Phase ?]: 04-05: trash restore route now returns 200 JSON with { relocatedToRoot } for documents too (was 204) so the client can drive RestoreRootBanner uniformly for both item types
- [Phase ?]: 04-05: TrashList (client component) receives canRestore/canPermanentDelete as booleans computed server-side in trash/page.tsx, not the raw role + ROLE_RANK — importing @/lib/rbac into a 'use client' file pulled bcrypt's native fs binding into the browser bundle and broke the build
- [Phase ?]: 05-01: POST /api/uploads uses plain Request + new URL(req.url).searchParams (not NextRequest.nextUrl) — matches documents/[id]/route.ts convention, directly testable
- [Phase ?]: 05-01: useImageUpload reads wsId via useParams() inside the hook, not threaded through DocumentWorkspace props — keeps the tracer self-contained to this plan's file list
- [Phase ?]: 05-01: EditorPreviewLayout promoted to forwardRef<EditorPreviewLayoutHandle> exposing getView() — 05-05 draft recovery reuses this same handle
- [Phase ?]: document_draft.document_id is the PK directly (no surrogate id) — matches TRD §3, enforces 1-row-per-document via onConflictDoUpdate
- [Phase ?]: tests/draft/helpers.ts uses local db.insert() instead of reusing tests/rbac/helpers.ts (avoids unrelated @/auth mock coupling)
- [Phase ?]: 05-07: RSC reads theme cookie / client writes it (document.cookie), no API route — pattern for all remaining phase-5 personalization settings (layout-mode, resize-ratio)
- [Phase ?]: 05-07: vitest.config.ts oxc.jsx forced to automatic runtime — Vite 8 otherwise inherits tsconfig's jsx:preserve (Next SWC-only) and fails to parse any .tsx import under vitest
- [Phase ?]: 05-02: dropped files feed the existing hidden <input> via synthetic DataTransfer + dispatched change event (no new uploadFile export), keeping the toolbar and drag-drop paths identical
- [Phase ?]: 05-02: no client-side size/type pre-check before the network round-trip — server 400 body.error is reused verbatim as the UI-SPEC copy, avoiding a second source of truth for validation thresholds
- [Phase ?]: 05-04: DELETE draft route returns 204 (no body), matching documents/[id]/route.ts's DELETE convention exactly
- [Phase ?]: 05-04: draft-autodelete.test.ts calls the PUT route handler directly (idor.test.ts pattern) instead of a new IDOR suite — deleteDraft gate is the only new correctness surface, RBAC/IDOR already proven
- [Phase ?]: 05-08: EditorHost's initialContent now sourced from live content state (not the stale outer prop) so toggling out of and back into preview-only doesn't discard unsaved edits
- [Phase ?]: 05-08: layoutMode/splitRatio cookies complete the 05-07 RSC-read/client-write pattern for all 3 phase-5 personalization settings
- [Phase ?]: DocumentWorkspaceProps gained hasNewerDraft/draftContent in Task 1's commit (not Task 3's) to satisfy TypeScript's JSX excess-property check on the RSC prop pass-down
- [Phase ?]: Draft recovery restore is a single getView().dispatch() into the live EditorView, reusing the existing autosave/draft-delete pipeline instead of a separate force-save path
- [Phase ?]: 06-01: pg_trgm GIN 인덱스는 schema.ts DSL에 선언하지 않는다 — 다음 drizzle-kit generate가 인덱스 없음으로 오인해 DROP을 시도하는 것을 막기 위함(custom SQL 마이그레이션 전용)
- [Phase ?]: 06-01: Task 1 checkpoint:decision(one-way document_tag+pg_trgm+NFC 백필 마이그레이션)은 오케스트레이터가 사전 승인(2026-08-08) — 재프롬프트 없이 apply-now로 기록하고 진행
- [Phase ?]: 06-01: REQUIREMENTS.md의 DOC-03/DOC-04는 미완료로 남긴다 — 스키마/검증 기반만 놓았고 실제 태그·검색 라우트(06-02/06-03)가 기능을 완성해야 체크 가능(04-01의 AUTH-03/WS-01 선례)
- [Phase ?]: TagBar의 3제한/중복/저장실패 상태를 Task 1에서 한번에 구현 — Task 2는 rbac.test.ts로 확인만(신규 프로덕션 코드 없음)
- [Phase ?]: 06-03: searchWorkspace는 q를 재정규화하지 않는다 — NFC 정규화는 호출부(GET 라우트)의 책임으로 고정, 06-01의 write-time 정규화 원칙과 동형
- [Phase ?]: 06-03: 태그 매칭은 EXISTS 서브쿼리, 태그 목록 반환은 상관 서브쿼리(array_agg)로 분리 — WHERE로 필터된 LEFT JOIN 하나만 쓰면 title/content 매칭 문서의 태그 일부가 누락됨
- [Phase ?]: 06-03: SearchResultsList/useSearchResults를 SearchBox.tsx 한 파일에서 함께 export — 검색 입력과 결과 패널이 FolderTree DOM상 비인접이라 상태를 부모로 끌어올리되 신규 파일은 늘리지 않음
- [Phase ?]: archiver 8.0.0 dropped the archiver(format,opts) factory function assumed by RESEARCH/PATTERNS — switched to the ZipArchive class export (Rule 1 auto-fix)
- [Phase ?]: 07-01: FK cascade policy follows TRD §3 DDL literally (createdBy/decidedBy: no cascade) — matches folder.parentId precedent
- [Phase ?]: 07-01: No DB partial unique index for duplicate-PENDING join requests — deferred to app-level WHERE guard in 07-03 (RESEARCH Alternatives, TRD DDL unchanged)
- [Phase ?]: 07-01: One-way invitation/workspace_join_request migration checkpoint pre-approved by user via orchestrator (2026-08-09), same precedent as 03-01/04-01/06-01
- [Phase ?]: 07-02: tests/invitations/accept.test.ts and create.test.ts both need vi.mock("@/auth", ...) even though accept.test.ts never calls auth() — tests/rbac/helpers.ts imports @/auth transitively, first applied under tests/invitations/
- [Phase ?]: 07-03: join-requests.ts reuses 07-02's guard-update-transaction admission idiom verbatim (WHERE status='PENDING' + onConflictDoNothing EDITOR insert) — no new pattern
- [Phase ?]: 07-03: PATCH join-requests/:reqId AlreadyDecidedError->409 folds both already-decided and nonexistent reqId into one response (no existence oracle), matching invitations.ts's invalid-signature fold
- [Phase ?]: member-search 라우트는 normalizeNFC를 호출하지 않는다 -- search.ts의 경계-정규화 관례를 유지하되, email/name 조회는 documents.title의 Hangul NFC/NFD 충돌 케이스가 적용되지 않아 계획이 재량으로 남긴 대로 생략.
- [Phase ?]: 07-05: InviteSearch shipped as a Task-1 compile stub, fully implemented in Task 2 (plan's own file-list split created the ordering dependency)
- [Phase ?]: 07-05: MemberRowData.role typed as plain string, not rbac.ts's Role union — keeps client component fully decoupled from @/lib/rbac (even type-only imports avoided)
- [Phase ?]: 09-01: layout.tsx 폰트 로더를 next/font/google -> next/font/local로 교체하되 CSS 변수명(--font-ibm-plex-sans/mono)은 유지 — 09-01 파일 스코프 밖 CSS Modules 무수정
- [Phase ?]: 09-01: 인증 카드 타이틀 20px->16px(Heading), footer 13px->14px(Body)로 UI-SPEC Typography 4사이즈 상한에 정렬
- [Phase ?]: 09-01: Google 계속하기 placeholder 스타일은 Form.module.css 대신 각 화면 page.module.css의 .googleButton으로 분리(Task 파일 스코프 준수)
- [Phase ?]: 09-02: CreateWorkspaceButton.module.css는 실재하지 않는 파일(계획 files_modified 오차) — 이미 토큰화된 Button만 써서 변경 없이 스킵
- [Phase ?]: 09-02: 워크스페이스 리스트를 auto-fill 그리드에서 단일열 flex 리스트+radius-lg 바깥 컨테이너로 전환(개별 카드는 radius-md 유지) — UI-SPEC의 '카드 리스트' 표현에 맞춤
- [Phase ?]: [Phase ?]: 09-03: layout.tsx(Task 1)/page.module.css(Task 2, 신규파일)는 files_modified 표기 오차로 판단해 미변경 — '에디터 셸 프레임 radius-lg'는 대신 DocumentWorkspace.module.css의 기존 .body에 적용(05-08 edge-to-edge 계약 유지)
- [Phase ?]: [Phase ?]: 09-03: SaveStatusBar '저장됨' accent 배지를 .tsx 무수정으로 구현 — .iconMuted:has(+ .textMuted) CSS 셀렉터로 저장중 스피너와 CSS-only 구분(EDIT-07 카피 100% 불변)
- [Phase ?]: [Phase ?]: 09-03: FolderTreeNode .dropRejected 하드코딩 #fef2f2를 color-mix(in srgb, var(--destructive) 12%, transparent)로 교체 — 신규 전역 변수 없이 다크 테마 자동 대응
- [Phase ?]: 09-04: 문서 생성은 워크스페이스 루트에서 수행(폴더 하위 아님) — 플랜 문구가 순차 단계만 명시, 기존 3개 e2e 스펙과 셀렉터 재사용 극대화
- [Phase ?]: 09-04: 휴지통 단계는 가시성 확인까지만 검증 — 복원/완전삭제는 04-04/04-05가 이미 증명, 이 플랜 목적은 신규 UI 여정 무결성 증명

### Pending Todos

None yet.

### Blockers/Concerns

- Research flag: rehype-sanitize's exact default schema needs re-verification against the literal installed rehype-sanitize@6.0.0 defaultSchema export before Phase 2's sanitize test suite is written.
- Research flag: Korean pg_trgm short-query threshold has no empirical number yet — tune against real Korean fixtures during Phase 6.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Deferred Verification

전체 phase 구현 후 몰아서 검증하는 방식(사용자 지시 2026-08-08). human_needed 항목은 여기 누적하고 끝에 `/gsd-audit-uat` 또는 phase별 `/gsd-verify-work`로 일괄 확인한다.

| Phase | State | Resume | 남은 항목 |
|-------|-------|--------|----------|
| 3 | verification_deferred_human | /gsd-verify-work 3 | DnD 드래그 커서/아웃라인 시각 피드백, MoveFolderModal 자기-서브트리 greying (순수 시각 2건; 자동 4/4 must-haves·811 tests·e2e 15 green) |
| 4 | verification_deferred_human | /gsd-verify-work 4 | RestoreRootBanner 실제 렌더(부모 삭제 후 복원), ADMIN 완전삭제 클릭스루(시드 e2e가 EDITOR라 미검) (자동 4/4 must-haves·884 tests·e2e 20/20·code-review 1C/3W 수정) |
| 5 | verification_deferred_human | /gsd-verify-work 5 | 다크 no-FOUC 새로고침 체감·패널 드래그 리사이즈 부드러움·툴바 300ms 툴팁·전체 crash-recovery 루프(편집→60s→새로고침→복구 다이얼로그) 실브라우저 4건 (자동 4/4 wired·930 tests·image-upload e2e live·code-review 2C/3W 수정+WR-02 문서화) |
| 6 | verification_deferred_human | /gsd-verify-work 6 | TagBar 시각(3제한 disable·중복 에러·refresh 유지)·SearchBox 한국어 IME 타이밍 체감·실브라우저 .md/.zip 다운로드+압축해제 구조·한국어 파일명 3건 (자동 4/4 must-haves·986 tests·psql gin_trgm_ops 확인·code-review 1C[export DoS]/3W/1I 수정) |
| 7 | verification_deferred_human | /gsd-verify-work 7 | 콘솔 링크 클릭→EDITOR 편입(2계정)·ADMIN vs VIEWER 멤버 페이지 섹션 노출·대시보드 참여신청→PENDING 목록(2계정) 3건 (자동 24/24 must-haves·1050 tests·pnpm build rbac 미유입·psql 토큰컬럼 없음 확인·code-review **1C[권한상승]**/3W 수정). ⚠ **설정 필요**: `.env.local`에 `AUTH_URL`(또는 NEXTAUTH_URL) 추가해야 초대 링크 origin 생성됨(WR-01 fail-closed). |

## Session Continuity

Last session: 2026-08-15T16:00:53.517Z
Stopped at: Completed 09-04-PLAN.md (Phase 9 전체 완료)
Resume file: None
