---
phase: 03-folder-tree-closure-table
verified: 2026-08-08T13:10:00Z
status: human_needed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
deferred:
  - truth: "사이드바 계층에 문서(document) 리프 노드가 표시된다(ROADMAP SC1 원문 '워크스페이스 > 폴더 > 자식 폴더 > 문서')"
    addressed_in: "Phase 4"
    evidence: "Phase 4 Success Criteria 1: '워크스페이스 화면이 폴더 사이드바·에디터·미리보기·상태 바를 함께 보여주고, 트리에서 연 문서가 에디터에 로드된다.' — document 테이블/트리 노드는 Phase 4 산출물이며 Phase 3에는 document 테이블이 없다(closure.ts softDeleteFolder 주석에도 '문서 cascade는 Phase 4' 명시)."
human_verification:
  - test: "폴더를 자기 자손 위로 드래그하면 커서가 '금지(not-allowed)'로 바뀌고, 유효한 다른 폴더 위로 드래그하면 accent 아웃라인이 즉시 나타나는지 실브라우저(`pnpm dev`)에서 확인한다."
    expected: "자손/자기 자신 드롭 타깃 = 금지 커서 + 옅은 빨간 배경(dropRejected), 유효 타깃 = accent 아웃라인(dropValid) — 드래그 도중 시각 피드백이 즉시 나타난다."
    why_human: "VALIDATION.md가 이 항목을 Manual-Only로 명시(자동 스냅샷보다 사람 눈이 확실). 03-05-PLAN.md Task 3의 <human-check>이며, 03-05-SUMMARY.md가 '이번 세션에서 실행하지 않음(Manual Verification Pending)'이라고 스스로 기록함 — 로직(dragover가 사이클 타깃에서만 preventDefault를 생략)은 코드 검사로 확인했으나 실브라우저 시각 확인은 아직 없음."
  - test: "MoveFolderModal에서 이동 대상 자신과 그 서브트리가 회색(pointer-events: none)으로 렌더되는지 실브라우저에서 확인한다."
    expected: "드래그 중인 폴더 자신 + 하위 폴더 전체가 리스트에서 클릭 불가·회색 처리된다."
    why_human: "isDescendantOrSelf 로직과 itemDisabled CSS 클래스는 코드로 확인했으나(존재·배선 확인됨), e2e에 별도 검증이 없다고 03-05-SUMMARY.md D7이 스스로 명시(human_judgment: true)."
---

# Phase 3: Folder Tree (Closure Table) Verification Report

**Phase Goal:** Users can organize documents into a folder hierarchy backed by an efficient Closure Table tree store
**Verified:** 2026-08-08T13:10:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 사이드바가 워크스페이스 > 폴더 > 자식 폴더 계층을 표시한다 (TREE-01) | ✓ VERIFIED | `src/app/(main)/w/[wsId]/page.tsx`가 `getWorkspaceFolders(wsId)`를 서버에서 호출해 `<FolderTree>`로 전달, `FolderTree.tsx`가 `buildTree`로 계층화 후 `FolderTreeNode`를 재귀 렌더(들여쓰기 8+16×depth, 자식 있을 때만 체브론). 직접 재실행한 e2e `e2e/folder-tree.spec.ts:38` "shows a child folder indented under its parent, expanded via the chevron" — PASS. 문서(document) 리프 노드는 Phase 4 산출물이라 deferred(아래 참조). |
| 2 | 폴더 서브트리 조회가 Closure Table 대상 단일 쿼리로 수행되고, 재귀적 N+1이 아니다 (TREE-02) | ✓ VERIFIED | `src/lib/closure.ts`의 `getWorkspaceFolders`(평면 단일 SELECT)와 `getSubtree`(closure join 단일 SELECT)에 재귀/루프 없음. `tests/folder/query-count.test.ts`가 depth-2 vs depth-6 트리에서 동일한 실행 SQL statement 수를 `postgres` `debug` 콜백으로 직접 카운트해 단언 — 직접 재실행 결과 PASS(2건 모두, `getWorkspaceFolders`/`getSubtree`). |
| 3 | 폴더 생성·이름변경·이동·소프트삭제가 정확히 동작한다 (TREE-03) | ✓ VERIFIED | `createFolder`(self+조상 closure 행), `PATCH /api/folders/[id]`(이름변경), `POST /api/folders/[id]/move`(이동), `DELETE /api/folders/[id]`(cascade 소프트삭제, closure 보존)가 모두 구현·배선됨. `tests/folder/closure.test.ts`·`rbac.test.ts`·`cross-workspace.test.ts` 및 `e2e/folder-tree.spec.ts`의 생성/인라인 이름변경/DnD 이동/삭제 시나리오 — 직접 재실행 결과 전부 PASS. |
| 4 | 자기 자손으로의 폴더 이동은 rewiring 전 동일 트랜잭션 사이클 체크로 거부된다 (TREE-03) | ✓ VERIFIED (행동 검증됨) | `moveFolder`가 트랜잭션의 **첫 문장**으로 `(folderId → newParentId)` closure 행 존재 여부를 SELECT하고, 존재 시 DELETE/INSERT 전에 `CycleError`를 throw(자기 자신 이동도 self 행으로 동일하게 걸림). `tests/folder/closure.test.ts`의 두 테스트가 이동 전/후 **전체 closure 테이블 스냅샷을 비교해 동일함을 단언**(rewiring이 전혀 일어나지 않았음을 증명, 단순 존재/배선이 아닌 실제 상태-불변 행동 검증) — 직접 재실행 결과 PASS. 라우트 레벨에서도 `CycleError→409`, `CrossWorkspaceError→400` 매핑을 `cross-workspace.test.ts`로 확인. |

**Score:** 4/4 truths verified (0 present-but-behavior-unverified)

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | 사이드바 계층에 문서(document) 리프 노드 표시 (ROADMAP SC1 원문의 "…자식 폴더 > 문서") | Phase 4 | Phase 4 Success Criteria 1: "트리에서 연 문서가 에디터에 로드된다." Phase 3에는 document 테이블이 없음(`closure.ts` softDeleteFolder 주석: "Phase 4 will extend this transaction with `document WHERE folder_id = ANY(ids)` once the document table exists"). |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/schema.ts` (folder/folderClosure) | TRD §3 DDL 1:1 이식, 형제-유일성 제약 없음, `folder_active_idx` 부분 인덱스 | ✓ VERIFIED | 컬럼·FK·PK·인덱스 전부 확인, unique(parent_id,name) 없음(grep 무매치) |
| `drizzle/0002_third_tattoo.sql` | folder/folder_closure CREATE TABLE 포함 마이그레이션, dev DB 적용 | ✓ VERIFIED | 파일 존재, `pg_isready localhost:5433` 접속 확인, 테스트가 이 스키마 위에서 실제로 통과 |
| `src/lib/closure.ts` | createFolder/getWorkspaceFolders/getSubtree/moveFolder/softDeleteFolder/CycleError/CrossWorkspaceError | ✓ VERIFIED | 5개 함수 + 2개 에러 클래스 전부 존재, 각각 파라미터화된 SQL 템플릿 사용(SQLi 없음), db/tx 주입 패턴 일관 |
| `src/app/api/folders/route.ts`, `[id]/route.ts`, `[id]/move/route.ts` | EDITOR+ 게이트, workspace_id 서버 재조회(IDOR 방지) | ✓ VERIFIED | 세 라우트 모두 클라이언트 workspaceId를 requireRole에 직접 넘기지 않음 — parentId/folder 행에서 서버가 SELECT한 값만 사용. rbac.test.ts/cross-workspace.test.ts 재실행 PASS |
| `src/components/tree/{FolderTree,FolderTreeNode,FolderContextMenu,MoveFolderModal,tree-utils}.tsx` | 계층 렌더·컨텍스트 메뉴·인라인 이름변경·DnD·이동 모달 | ✓ VERIFIED | page.tsx → FolderTree → FolderTreeNode(재귀) 배선 확인, 전 e2e 시나리오 재실행 PASS |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `w/[wsId]/page.tsx` | `getWorkspaceFolders(wsId)` → `<FolderTree>` | 서버 컴포넌트 초기 로드 | ✓ WIRED | 직접 확인(코드 읽음), 데이터가 하드코딩 빈 배열이 아니라 실제 DB SELECT 결과 |
| `FolderTree` 생성 입력 | `POST /api/folders` → `router.refresh()` | fetch + 서버 확정 후 재조회 | ✓ WIRED | 낙관적 UI 없음, 성공 응답 후에만 refresh — e2e 확인 |
| `FolderTreeNode` DnD drop | `POST /api/folders/[id]/move` → `moveFolder` | `onDropOn` 콜백 → fetch → refresh | ✓ WIRED | e2e "moves a folder onto another folder via drag and drop" PASS |
| `PATCH/DELETE/move` routes | `SELECT workspace_id FROM folder WHERE id=:id` → `requireRole(EDITOR)` | 서버 재조회(IDOR 방지) | ✓ WIRED | 코드·테스트 모두 확인(비멤버 타 워크스페이스 folder id → 403) |
| `moveFolder` 사이클 체크 | DELETE/INSERT rewiring | 동일 `db.transaction` 콜백 내 순차 실행 | ✓ WIRED | 코드 확인 + 스냅샷-불변 테스트로 행동 증명 |

### Behavioral Spot-Checks (직접 재실행, SUMMARY 주장 아님)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 폴더 단위 테스트 전체 | `pnpm vitest run tests/folder` | 47/47 pass | ✓ PASS |
| 전체 vitest 스위트(회귀 없음) | `pnpm vitest run` | 32 files / 806 tests pass | ✓ PASS |
| 타입체크 | `pnpm exec tsc --noEmit` | 출력 없음(clean) | ✓ PASS |
| 폴더 트리 e2e | `pnpm exec playwright test e2e/folder-tree.spec.ts` | 6/6 pass | ✓ PASS |
| 전체 e2e 스위트(회귀 없음) | `pnpm exec playwright test` | 15/15 pass | ✓ PASS |
| 커밋 존재 확인 | `git cat-file -t <13개 SUMMARY 인용 커밋>` | 전부 `commit` | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TREE-01 | 03-02, 03-05 | 사이드바 워크스페이스>폴더>자식 폴더 계층 표시 | ✓ SATISFIED | (문서 리프는 Phase 4로 deferred, 위 참조) |
| TREE-02 | 03-01, 03-02, 03-03 | Closure Table + 단일 쿼리 서브트리/전체 조회 | ✓ SATISFIED | query-count.test.ts 재실행 확인 |
| TREE-03 | 03-01~03-05 | 생성·이름변경·이동·소프트삭제 + 사이클 거부 | ✓ SATISFIED | closure/rbac/cross-workspace 테스트 + e2e 재실행 확인 |

REQUIREMENTS.md에 Phase 3로 매핑된 요구사항은 TREE-01/02/03 셋뿐이며 orphaned 항목 없음.

### Anti-Patterns Found

Phase 3가 수정한 12개 핵심 파일(schema.ts, closure.ts, validation.ts, 3개 folders API route, FolderTree 계열 5개 컴포넌트, page.tsx)에 `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/"coming soon"/"not yet implemented" 패턴 grep — **매치 없음**. 디버트 마커 없음.

### Human Verification Required

VALIDATION.md가 Manual-Only로 명시한 DnD 시각 피드백 항목이 03-05-SUMMARY.md 자체 기록("Manual Verification Pending")대로 아직 실브라우저에서 확인되지 않았다. 사이클 거부의 **서버측 불변식**(rewiring 전 거부, closure 스냅샷 불변)은 통합 테스트로 이미 행동 검증되어 VERIFIED — 아래 항목은 그 위에 얹힌 **클라이언트 시각 피드백**(커서/아웃라인)만의 문제이므로 phase goal 자체를 막지 않지만, UI-SPEC 계약의 일부라 확인이 필요하다.

### 1. DnD 드래그 중 시각 피드백

**Test:** 폴더를 자기 자손 위로 드래그 → 커서가 '금지'로 바뀌는지, 유효한 다른 폴더 위로 드래그 → accent 아웃라인이 즉시 나타나는지 `pnpm dev`로 실브라우저에서 확인
**Expected:** 사이클 타깃 = 금지 커서 + 옅은 빨간 배경, 유효 타깃 = accent 아웃라인
**Why human:** 시각·커서 상태는 자동 스냅샷보다 사람 눈이 확실(VALIDATION.md Manual-Only 항목), 03-05 실행 세션에서 미실행으로 자체 기록됨

### 2. MoveFolderModal 회색 처리

**Test:** 컨텍스트 메뉴 "이동…" 클릭 → 모달에서 이동 대상 자신과 하위 폴더가 회색·클릭 불가로 보이는지 확인
**Expected:** 드래그(이동) 대상 폴더 자신 + 전체 서브트리가 리스트에서 비활성·회색
**Why human:** `isDescendantOrSelf`/`itemDisabled` 로직·CSS는 코드로 존재·배선 확인했으나 03-05-SUMMARY.md D7이 "no dedicated e2e" + `human_judgment: true`로 자체 명시

### Gaps Summary

없음. 4개 truth 모두 코드베이스에서 직접 재실행한 테스트로 VERIFIED. 유일한 미해결 항목은 phase 자신의 계획(PLAN 03-05 Task 3의 `<human-check>`)이 실브라우저 확인을 요구했으나 세션 중 수행되지 않은 시각 피드백 2건 — 이는 서버측 불변식·핵심 로직이 아니라 순수 CSS/커서 상의 UX 확인이라 phase goal 달성을 막는 gap이 아니라 human_verification 대기 항목으로 분류했다. 03-VALIDATION.md의 per-task map/Wave 0 체크리스트가 실행 후에도 seed 상태(draft, 모든 항목 `⬜ pending`)로 남아 있는 것도 발견했다 — 실제 산출물·테스트 결과와는 무관하지만(이 보고서가 코드베이스에서 직접 재검증함) 프로세스 산출물 자체가 갱신되지 않은 점은 참고용으로 남긴다(블로킹 아님).

---

_Verified: 2026-08-08T13:10:00Z_
_Verifier: Claude (gsd-verifier)_
