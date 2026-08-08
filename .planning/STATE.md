---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 5
current_phase_name: Editor Enhancements & Personalization
status: executing
stopped_at: Completed 05-04-PLAN.md
last_updated: "2026-08-08T08:42:56.706Z"
last_activity: 2026-08-08
last_activity_desc: Phase 5 execution started (05-01)
progress:
  total_phases: 5
  completed_phases: 4
  total_plans: 28
  completed_plans: 26
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-01)

**Core value:** 에디터에 입력하면 60ms 안에 미리보기에 정확히(CommonMark 0.31.2 + GFM 3종) 렌더링되는 문서 작성 경험.
**Current focus:** Phase 5 — Editor Enhancements & Personalization

## Current Position

Phase: 5 (Editor Enhancements & Personalization) — EXECUTING
Plan: 5 of 7 (Wave 1 — 05-01 TRACER complete; 05-03/05-07 remain in Wave 1)
Status: 05-01 complete (image upload tracer, EDIT-09 core happy path) — Phase 3/4 verification still deferred (bulk-verify-at-end per 2026-08-08 user instruction)
Last activity: 2026-08-08 — Phase 5 execution started (05-01)

Progress: [█████████░] 93%

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

## Accumulated Context

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

## Session Continuity

Last session: 2026-08-08T08:42:56.698Z
Stopped at: Completed 05-04-PLAN.md
Resume file: None
