---
phase: 04-documents-autosave-3-pane-workspace
verified: 2026-08-08T06:54:09Z
status: human_needed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Trash 뷰에서 부모 폴더가 삭제된 상태로 남겨진 독립-트래시 문서를 복원해 RestoreRootBanner가 실제로 화면에 뜨는지 확인 (relocatedToRoot=true 경로)"
    expected: "'{문서명}'의 원래 폴더가 삭제되어 워크스페이스 루트로 복원했어요.' 배너가 표시되고, 트리에서 문서가 루트에 나타난다"
    why_human: "restoreDocument/restoreFolder의 relocatedToRoot 플래그는 lib 레벨 유닛 테스트로 증명됐고 TrashList의 배너 렌더 조건(`{bannerName && <RestoreRootBanner .../>}`)도 코드상 존재·배선 확인됨 — 하지만 실제 브라우저에서 '부모 폴더 삭제 후 복원' 시나리오를 끝까지 구동해 배너 텍스트/배치를 assert하는 e2e/유닛 테스트가 없다 (04-05-SUMMARY D3, human_judgment: true로 이미 자체 표기됨)"
  - test: "ADMIN 권한 사용자로 로그인해 휴지통에서 완전 삭제 버튼 클릭 → ConfirmDialog 확인 → 행이 목록에서 사라지는지 확인"
    expected: "ADMIN은 완전 삭제 버튼이 활성 상태이고, 확인 다이얼로그 승인 시 항목이 물리적으로 삭제되어 목록에서 즉시 사라진다"
    why_human: "ADMIN 서버 인가(403 게이트)와 FK 순서 완전삭제는 tests/trash/permanent-delete.test.ts·tests/trash/rbac.test.ts로 증명됐고, EDITOR에 대한 비활성+안내 게이팅은 e2e로 증명됐다 — 하지만 시드 기본 워크스페이스의 e2e 사용자가 EDITOR라서 ADMIN 역할로 실제 UI를 클릭해 확인→소멸을 구동하는 테스트는 없다 (04-05-SUMMARY D4, human_judgment: true로 이미 자체 표기됨)"
---

# Phase 4: Documents, Autosave & 3-Pane Workspace Verification Report

**Phase Goal:** 사용자가 신뢰할 수 있는 seq-가드 자동저장과 복구 가능한 휴지통을 갖춘 완전한 3분할 화면에서 문서를 생성·편집·관리할 수 있다.
**Verified:** 2026-08-08T06:54:09Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 3분할 화면(사이드바+에디터+미리보기+상태바)이 함께 보이고, 트리에서 연 문서가 에디터에 로드된다 | ✓ VERIFIED | `src/app/(main)/w/[wsId]/layout.tsx`(사이드바+requireRole+notFound)+`d/[docId]/page.tsx`(getDocument workspace-scoped)+`DocumentWorkspace.tsx`(제목/EditorPreviewLayout/SaveStatusBar 3행)가 코드상 실재하고 배선됨. e2e `document-workspace.spec.ts` 2건("creates a document..."·"shows the document as a leaf in the tree...") 통과 확인 |
| 2 | 문서 생성·수정·소프트삭제가 되고, 삭제된 문서는 즉시 휴지통에 나타난다 | ✓ VERIFIED | `POST /api/documents`(생성)·`DELETE /api/documents/[id]`(EDITOR+, IDOR, `softDeleteDocument`가 `is_deleted/is_trash_root=true` 설정)가 코드 확인됨. `getWorkspaceDocuments`가 삭제된 문서를 제외해 트리에서 즉시 사라짐. `tests/documents/crud.test.ts` DELETE 케이스(5건) + e2e "deletes the open document via the tree menu..." 통과 |
| 3 | 1초 입력 정지 후 자동저장, 상태바 저장중→저장됨/실패(재시도) 전이, 역순(stale) 응답은 무시되고 최신 발신 seq 응답만 "저장됨"을 표시한다 | ✓ VERIFIED (behavior-dependent, 테스트로 증명) | `autosave-controller.ts`가 `sentSeq !== latestSentSeq` 비교로 stale 응답을 폐기(코드 확인, `AbortController`/fetch `signal` 미사용 확인). 서버 `autosaveDocument`가 `WHERE saved_seq < seq`(drizzle `lt()`)로 역순을 0행 무시. 단일 지정 테스트 `tests/documents/autosave-controller.test.ts -t "send A then send B (newer); A resolves late..."` 및 `tests/documents/autosave-seq-guard.test.ts`(11건) 재실행해 통과 확인. e2e 자동저장 상태바 전이 테스트는 격리 실행 시 통과(아래 "알려진 e2e 결과" 참고) |
| 4 | 휴지통 cascade 복원(원위치 또는 루트)과 완전삭제(ADMIN+ 게이팅)가 동작한다 | ✓ VERIFIED | `closure.ts`의 `softDeleteFolder`(문서 cascade, 독립-트래시 보존)·`restoreFolder`/`documents.ts`의 `restoreDocument`(closure join 기반 복원, 독립-트래시 제외, `moveFolder(id,null,tx)` 재사용으로 루트 재배치)·`permanentlyDeleteFolder`(document DELETE→folder DELETE FK 순서) 코드 확인. 통합 trash 라우트(`POST .../restore` EDITOR+, `DELETE ...` ADMIN+)가 `resolveWorkspaceIdForTrashItem`로 서버 재유도 후 `requireRole` 적용. `tests/trash/restore.test.ts`·`permanent-delete.test.ts`·`rbac.test.ts`·`tests/folder/closure.test.ts` 재실행 통과, e2e `document-trash.spec.ts` 2건("deletes a document, restores it..."·"shows the permanent-delete button gated...") 통과. 단, UI에서 배너 렌더/ADMIN 클릭스루의 실제 브라우저 구동은 미검증 — 아래 Human Verification 항목 참고 |

**Score:** 4/4 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/db/schema.ts` + `drizzle/0003_*.sql` | document 테이블(TRD §3), 활성 조회 부분 인덱스 | ✓ VERIFIED | 04-01 커밋(`6db7b1a`) 확인, `folder_id`에 CASCADE 없음(완전삭제 FK 순서 근거) |
| `src/lib/documents.ts` | CRUD/소프트삭제/자동저장/복원/완전삭제 서비스 | ✓ VERIFIED | 8개 함수 전부 실재·읽음: getWorkspaceDocuments/getDocument/resolveWorkspaceIdForDocument/createDocument/softDeleteDocument/restoreDocument/permanentlyDeleteDocument/autosaveDocument |
| `src/lib/closure.ts` (trash 확장) | softDeleteFolder cascade + restoreFolder + permanentlyDeleteFolder + resolveWorkspaceIdForTrashItem + getTrashItems | ✓ VERIFIED | 04-04에서 추가된 5개 함수 전부 실재, 로직 상세 확인(위 truth 4 참고) |
| `src/app/api/documents/route.ts`, `[id]/route.ts` | POST 생성, PUT 자동저장, DELETE 소프트삭제 | ✓ VERIFIED | 3개 핸들러 전부 코드 확인, EDITOR+ RBAC + IDOR 재유도 패턴 일치 |
| `src/app/api/trash/[type]/[id]/route.ts`, `restore/route.ts` | 통합 trash 라우트(복원 EDITOR+/완전삭제 ADMIN+) | ✓ VERIFIED | 코드 확인, zod 타입/uuid 검증 + requireRole 순서 정확 |
| `src/app/(main)/w/[wsId]/layout.tsx`, `page.tsx`, `d/[docId]/page.tsx` | 3분할 라우트 분할(사이드바 공유 + 빈 상태 + 문서 RSC) | ✓ VERIFIED | 코드 확인, requireRole/notFound/getDocument workspace-scope 전부 배선됨 |
| `src/components/document/autosave-controller.ts`, `useAutosave.ts`, `SaveStatusBar.tsx`, `DocumentWorkspace.tsx` | 순수 컨트롤러 + React 훅 + 상태바 UI + 3행 워크스페이스 | ✓ VERIFIED | 코드 확인, 저장중/저장됨/저장실패+재시도 UI 텍스트 정확히 "저장 중…"/"저장됨"/"저장 실패" |
| `src/components/tree/DocumentTreeLeaf.tsx` | 문서 트리 리프(클릭 열기, 컨텍스트 메뉴 '삭제') | ✓ VERIFIED | e2e로 열기·삭제 플로 모두 검증됨 |
| `src/app/(main)/w/[wsId]/trash/page.tsx`, `src/components/trash/TrashList.tsx`, `RestoreRootBanner.tsx` | 휴지통 목록 RSC + 복원/완전삭제 UI + 루트 배너 | ✓ VERIFIED(코드) / 일부 UI 시나리오 human_needed | 코드/배선 확인(권한 불리언 서버 산출→클라 전달, 배너 조건부 렌더). 배너 실제 렌더·ADMIN 클릭스루는 human verification 항목으로 이관 |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `EditorHost.onChange`/제목 input | `PUT /api/documents/:id` | `useAutosave.scheduleSave` → `autosave-controller.fire` → `fetch` | ✓ WIRED | 코드 확인, `DocumentWorkspace.tsx`가 두 핸들러 모두에서 `scheduleSave` 호출 |
| `autosaveDocument`의 `WHERE saved_seq < seq` | Postgres | drizzle `lt(document.savedSeq, seq)` | ✓ WIRED | 코드 확인, 서버가 자동저장 순서의 유일한 심판(반환 rows.length로 판단) |
| `DocumentTreeLeaf` 클릭 | `w/[wsId]/d/[docId]` | `next/link` | ✓ WIRED | e2e "opening on click" 통과로 확인 |
| DELETE route → `softDeleteDocument` → `getWorkspaceDocuments` | 트리에서 즉시 사라짐 | `is_deleted=false` 필터 | ✓ WIRED | 코드 + e2e 확인 |
| `restoreFolder`/`restoreDocument` → `moveFolder(id,null,tx)`/`folderId=null` | 루트 재배치 | 원 부모 삭제 시 분기 | ✓ WIRED | 코드 확인 + `tests/trash/restore.test.ts` 재실행 통과 |
| `permanentlyDeleteFolder` → `document` DELETE 먼저 → `folder` DELETE | FK 위반 회피 | 트랜잭션 내 순서 | ✓ WIRED | 코드 확인 + `tests/trash/permanent-delete.test.ts` 재실행 통과 |
| trash 라우트 → `resolveWorkspaceIdForTrashItem` → `requireRole`(restore:EDITOR/permanent:ADMIN) | IDOR-safe RBAC | 서버 재유도 | ✓ WIRED | 코드 확인 + `tests/trash/rbac.test.ts` 재실행 통과 |
| `body.relocatedToRoot` → `setBannerName` → `<RestoreRootBanner>` | 루트-복원 안내 배너 | `TrashList.handleRestore` | ✓ WIRED (렌더 조건 코드상 존재) — 실제 브라우저 시나리오는 미검증 | Human Verification 항목 1 참고 |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| 서버 seq 가드(역순/동률/신규 seq) | `pnpm vitest run tests/documents/autosave-seq-guard.test.ts` | 11 passed | ✓ PASS |
| 클라 컨트롤러 stale 응답 폐기(단일 지정 테스트) | `pnpm vitest run tests/documents/autosave-controller.test.ts -t "send A then send B (newer); A resolves late..."` | 1 passed (7 skipped, 필터링됨) | ✓ PASS |
| 전체 단위/통합 테스트 스위트 | `pnpm vitest run` | 39 files / 880 tests passed | ✓ PASS |
| 타입체크 | `pnpm exec tsc --noEmit` | clean, no output | ✓ PASS |
| E2E 전체 스위트 | `pnpm exec playwright test` | 19/20 passed, 1 알려진 flake | ⚠️ 아래 참고 |
| 알려진 flake 격리 재실행 | `pnpm exec playwright test e2e/document-workspace.spec.ts -g "creates a document, autosaves seq-guarded edits"` | 1 passed | ✓ PASS |

**알려진 e2e 결과 상세:** `e2e/document-workspace.spec.ts`의 "creates a document, autosaves seq-guarded edits, and restores them after a refresh" 테스트가 전체 스위트 동시 실행 시 "저장 중…" 과도 텍스트를 놓치는 타이밍 flake(1-worker 부하 하의 디바운스 타이밍 이슈)로 실패했으나, 격리 재실행 시 통과함. `.planning/WINDOWS.md` id=5에 04-03 시점부터 이미 기록된 알려진 이슈이며, 이번 세션의 회귀가 아님(자동저장 로직 자체는 위 단위 테스트로 별도 증명됨). `.planning/WINDOWS.md` id=3·4(preview-perf/workspace-delete 라우트 분할 불일치)는 브랜치 최신 커밋(`58b1a95`)에서 이미 수정·fixed 처리됨. id=1·2는 Phase 3 소관의 human-check 항목으로 이 phase의 스코프 밖.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| DOC-01 | 04-01, 04-02, 04-03 | 문서 생성·수정·삭제, 소프트삭제 즉시 휴지통 반영 | ✓ SATISFIED | 스키마+서비스(04-01)+생성/자동저장(04-02)+삭제(04-03) 전부 코드/테스트 확인, REQUIREMENTS.md `Complete` 표기 일치 |
| DOC-02 | 04-04, 04-05 | 휴지통 복원(cascade, 원위치/루트)·완전삭제(ADMIN+) | ✓ SATISFIED (백엔드 전량, UI 일부 human_needed) | 백엔드(04-04) 전 함수 유닛/통합 테스트로 증명, UI(04-05) 코드/배선 확인. 배너 렌더·ADMIN 클릭스루 실제 구동은 human verification |
| EDIT-07 | 04-01, 04-02 | 1초 정지 자동저장, 상태바 전이, seq 가드 역순 무시 | ✓ SATISFIED | 서버(04-01)+클라(04-02) 양쪽 seq 가드 코드/테스트 확인, `AbortController` 미사용 확인(NFR-1.2) |

REQUIREMENTS.md에 Phase 4로 매핑된 요구사항 3건(DOC-01/DOC-02/EDIT-07) 모두 plan `requirements` 필드에 선언되어 있음 — 고아(orphaned) 요구사항 없음.

### Anti-Patterns Found

Phase 4에서 생성/수정된 `src/` 파일 34개 전수 스캔 — `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/"coming soon"/"not yet implemented" 패턴 0건. 디버트 마커 없음.

### Human Verification Required

1. **RestoreRootBanner 실제 렌더 확인** — 부모 폴더가 삭제된 상태에서 독립적으로 트래시된 문서를 휴지통에서 복원했을 때 배너가 실제로 표시되는지
   - 확인 방법: 폴더 생성 → 그 안에 문서 생성 → 문서만 개별 삭제(폴더는 살아있음) → 폴더도 삭제 → 휴지통에서 그 문서를 복원 → "원래 폴더가 삭제되어 워크스페이스 루트로 복원했어요" 배너와 트리 루트에 문서가 나타나는지 확인
   - 코드 근거: 백엔드 relocatedToRoot 로직은 유닛 테스트로 증명됨, TrashList의 조건부 렌더도 코드상 존재. 실 브라우저 구동 테스트만 없음(04-05-SUMMARY D3에서 이미 self-flagged)

2. **ADMIN 완전삭제 클릭스루 확인** — ADMIN 역할 사용자가 휴지통에서 완전 삭제 버튼을 클릭→확인→항목이 실제로 사라지는지
   - 확인 방법: ADMIN 역할 사용자로 로그인 → 휴지통 진입 → 항목의 "완전 삭제" 버튼(활성 상태여야 함) 클릭 → ConfirmDialog 확인 → 목록에서 즉시 사라지는지 확인
   - 코드 근거: 서버 인가(403)·FK 순서 삭제는 통합 테스트로 증명됨, EDITOR 비활성+안내 게이팅은 e2e로 증명됨. ADMIN 역할의 실제 UI 클릭스루만 없음(04-05-SUMMARY D4에서 이미 self-flagged, 시드 기본 워크스페이스 e2e 사용자가 EDITOR라서)

### Gaps Summary

없음. 4개 관찰 가능한 진실(observable truths) 모두 코드·테스트로 검증됨. 요구사항 3건(DOC-01/DOC-02/EDIT-07) 전부 충족. 디버트 마커·스텁·미배선 링크 없음. 남은 것은 두 개의 UI 최종 확인 항목(위 human verification)뿐이며, 둘 다 백엔드 로직은 이미 테스트로 증명된 상태에서 실 브라우저 최종 확인만 남은 것 — SUMMARY 작성자가 이미 정직하게 self-flag한 항목과 일치한다.

**참고(정보용, 스코어에 영향 없음):** ROADMAP.md의 Phase 4 체크박스(line 19)와 Progress 표가 아직 `[ ]`/`In Progress`로 남아있음 — plan 5/5 executed, 요구사항 REQUIREMENTS.md는 이미 `Complete`로 표기된 상태와 불일치. 이 verification 통과 후 ROADMAP 장부 갱신이 필요(코드 자체의 갭은 아님).

---

_Verified: 2026-08-08T06:54:09Z_
_Verifier: Claude (gsd-verifier)_
