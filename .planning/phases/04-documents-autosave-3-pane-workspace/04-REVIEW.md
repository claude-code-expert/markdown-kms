---
phase: 04-documents-autosave-3-pane-workspace
reviewed: 2026-08-08T06:59:58Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - src/db/schema.ts
  - drizzle/0003_petite_susan_delgado.sql
  - src/lib/documents.ts
  - src/lib/closure.ts
  - src/lib/validation.ts
  - src/lib/rbac.ts
  - src/components/document/autosave-controller.ts
  - src/components/document/useAutosave.ts
  - src/components/document/DocumentWorkspace.tsx
  - src/components/document/SaveStatusBar.tsx
  - src/app/api/documents/route.ts
  - src/app/api/documents/[id]/route.ts
  - src/app/api/trash/[type]/[id]/route.ts
  - src/app/api/trash/[type]/[id]/restore/route.ts
  - src/app/(main)/w/[wsId]/layout.tsx
  - src/app/(main)/w/[wsId]/page.tsx
  - src/app/(main)/w/[wsId]/d/[docId]/page.tsx
  - src/app/(main)/w/[wsId]/trash/page.tsx
  - src/components/tree/DocumentTreeLeaf.tsx
  - src/components/tree/FolderTree.tsx
  - src/components/tree/FolderTreeNode.tsx
  - src/components/tree/tree-utils.ts
  - src/components/trash/TrashList.tsx
  - src/components/trash/RestoreRootBanner.tsx
  - src/components/editor/EditorHost.tsx
  - src/components/layout/EditorPreviewLayout.tsx
  - tests/documents/*, tests/trash/*, e2e/document-workspace.spec.ts, e2e/document-trash.spec.ts (read for coverage cross-check)
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-08-08T06:59:58Z
**Depth:** standard
**Files Reviewed:** 27
**Status:** issues_found

## Summary

autosave seq-guard 코어(`autosave-controller.ts` + `documents.autosaveDocument`)는 검증한 시나리오(디바운스, stale-응답 폐기, reset, retry, `WHERE saved_seq < seq`) 전부 정확했고 매칭되는 유닛 테스트도 촘촘하다. 문서 CRUD·소프트삭제 라우트의 IDOR/RBAC(`resolveWorkspaceIdForDocument` 활성 문서 스코프, mass-assignment 방지, workspaceId 클라 미신뢰)도 견고하다.

다만 **휴지통 완전 삭제 라우트가 대상이 실제로 휴지통에 있는지(is_deleted/is_trash_root) 전혀 검증하지 않는다** — `resolveWorkspaceIdForTrashItem`이 활성/삭제 행을 가리지 않고 workspaceId를 재유도하고, `permanentlyDeleteFolder`/`permanentlyDeleteDocument`도 대상 상태를 확인하지 않아 ADMIN 권한만 있으면 활성(비삭제) 문서·폴더 서브트리를 소프트 삭제 단계 없이 즉시 영구 삭제할 수 있다. 소프트 삭제→휴지통→완전 삭제라는 이 프로젝트의 핵심 불변식(CLAUDE.md "삭제는 소프트 삭제 + cascade")을 이 라우트 하나가 통째로 우회한다. 라이브러리 레벨(`tests/trash/permanent-delete.test.ts`)과 라우트 레벨(`tests/trash/rbac.test.ts`) 테스트 어디에도 "활성 항목에 대한 완전 삭제 거부" 케이스가 없어 이 갭이 무방비로 green이다.

그 외 자동저장 body의 title 필드가 255자를 넘으면 조용히 빈 문자열로 치환되는 silent data-loss, `TrashList`의 미사용 `wsId` prop, `closure.ts`/`documents.ts` 간 workspace-id 조회 헬퍼 중복 등을 경고/정보 등급으로 남긴다.

## Critical Issues

### CR-01: 휴지통 완전 삭제가 "실제로 휴지통에 있는지"를 검증하지 않아 활성 문서/폴더를 즉시 영구 삭제할 수 있다

**File:** `src/app/api/trash/[type]/[id]/route.ts:19` (경유하는 `src/lib/closure.ts:168-179` `resolveWorkspaceIdForTrashItem`, `src/lib/closure.ts:228-240` `permanentlyDeleteFolder`, `src/lib/documents.ts:93-95` `permanentlyDeleteDocument`)

**Issue:**
`DELETE /api/trash/:type/:id`는 `resolveWorkspaceIdForTrashItem(type, id)`으로 workspaceId를 재유도한 뒤 `requireRole(workspaceId, "ADMIN")`만 통과하면 곧장 `permanentlyDeleteFolder`/`permanentlyDeleteDocument`를 호출한다. 그런데:

- `resolveWorkspaceIdForTrashItem`은 의도적으로 `is_deleted` 필터가 없다(주석: "trash 라우트는 반대로 is_deleted=true 행도 resolve해야 한다") — 하지만 이는 **활성(is_deleted=false) 행도 그대로 resolve된다**는 뜻이기도 하다.
- `permanentlyDeleteFolder`/`permanentlyDeleteDocument` 자체도 대상의 `is_deleted`/`is_trash_root`를 전혀 확인하지 않고 무조건 물리 삭제한다.

결과적으로 ADMIN 권한을 가진 사용자가 (또는 브라우저 주소창에서 문서/폴더 id를 그대로 복사해 온 요청이) 휴지통에 넣지 않은 **활성 문서/폴더(및 폴더의 전체 서브트리)** 를 `DELETE /api/trash/document/<active-id>` 또는 `/api/trash/folder/<active-id>` 한 번으로 소프트 삭제 단계 없이 즉시·비가역적으로 삭제할 수 있다. PRD §2-2/TRD §8는 이 라우트를 "휴지통 완전 삭제"로 명시하고 있고 CLAUDE.md 불변식도 "삭제는 소프트 삭제 + cascade"인데, 이 라우트는 그 전제를 검증하지 않는다.

실사용 시나리오(공격이 아니어도 발생): 사용자 A가 휴지통 화면을 열어 문서 X를 본다. 사용자 B가 다른 탭에서 X를 복원한다(X는 이제 활성). A의 화면은 아직 갱신 전이라 여전히 X가 보이고, A가 "완전 삭제"를 누르면 방금 복원되어 활성 상태가 된 X가 그대로 영구 삭제된다 — UI 어디에도 "이미 복원된 항목"이라는 경고가 없다.

`tests/trash/permanent-delete.test.ts`/`tests/trash/rbac.test.ts` 어디에도 "활성 항목에 대한 완전 삭제가 거부되는지" 케이스가 없어(둘 다 `softDeleteFolder`로 미리 트래시에 넣은 대상만 테스트) 이 갭이 회귀 테스트로 잡히지 않는다.

**Fix:** `resolveWorkspaceIdForTrashItem`을 `is_trash_root = true`(또는 최소 `is_deleted = true`)로 필터링해 활성 행은 애초에 resolve되지 않게 하거나, 라우트에서 별도로 대상의 `isTrashRoot`를 확인해 아니면 404/403을 반환한다. 예:

```ts
// closure.ts — resolveWorkspaceIdForTrashItem
if (type === "folder") {
  const [row] = await client
    .select({ workspaceId: folder.workspaceId })
    .from(folder)
    .where(and(eq(folder.id, id), eq(folder.isTrashRoot, true))); // 추가
  return row ?? null;
}
const [row] = await client
  .select({ workspaceId: document.workspaceId })
  .from(document)
  .where(and(eq(document.id, id), eq(document.isTrashRoot, true))); // 추가
return row ?? null;
```

restore 라우트가 같은 헬퍼를 공유하므로, restore 쪽은 이미 `restoreFolder`/`restoreDocument` 내부에서 `isTrashRoot` 가드가 있어 이 필터를 추가해도 동작이 바뀌지 않는다(이미 `!target.isTrashRoot`면 no-op). 필터를 걸면 완전 삭제 라우트가 활성 항목에 대해 404(no target → `forbiddenResponse()`)를 반환하게 되어 원천 차단된다. `tests/trash/permanent-delete.test.ts` 또는 `tests/trash/rbac.test.ts`에 "활성(비삭제) 문서/폴더에 대한 완전 삭제는 거부된다" 케이스를 추가해야 한다.

## Warnings

### WR-01: 제목이 255자를 넘으면 자동저장/생성 시 조용히 빈 문자열로 치환된다 (silent data loss)

**File:** `src/lib/validation.ts:53-56` (`documentSchema`, `PUT /api/documents/[id]`와 `POST /api/documents`가 둘 다 여기서 파생됨)

**Issue:** `title: z.string().trim().max(255, ...).catch("")`는 title이 255자를 초과하면 `.max()` 검증 에러를 던지는 대신 `.catch("")`가 그 필드만 조용히 빈 문자열로 치환한다. `safeParse`는 여전히 `success: true`를 반환하므로 라우트는 400을 내지 않고, `autosaveDocument`/`createDocument`는 사용자가 입력한 제목을 그대로 `""`로 저장해 버린다. 클라이언트(`DocumentWorkspace.tsx` 제목 `<input>`, `FolderTree.tsx`의 `CreateDocumentRootInput`) 어디에도 `maxLength`가 없어 사용자가 긴 제목(예: 붙여넣기)을 입력하면 이 경로를 그대로 탄다 — 에러 메시지도, UI 피드백도 없이 제목이 사라진다.

**Fix:** 길이 초과를 조용히 삼키지 말고 자르거나(트렁케이트) 명시적으로 거부한다.
```ts
title: z.string().trim().max(255, "제목은 255자를 넘을 수 없습니다."), // catch 제거 → 400으로 표면화
// 또는 사용자 입력을 보존하고 싶다면
title: z.string().trim().transform((s) => s.slice(0, 255)),
```
"빈 값 허용"(placeholder 동작)과 "초과 값을 빈 값으로 뭉개기"는 다른 요구사항이므로 분리해야 한다.

### WR-02: `permanentlyDeleteFolder`/`autosaveDocument` 등은 `client` 파라미터를 받지만, 완전삭제 라우트 자체는 트랜잭션 경계 검증이 CR-01 갭과 결합해 더 위험해진다

**File:** `src/app/api/trash/[type]/[id]/route.ts:29-33`

**Issue:** CR-01이 고쳐지기 전까지는, `permanentlyDeleteFolder(id)`가 폴더 타입일 때 서브트리 전체(closure 조인으로 모은 모든 하위 폴더+문서)를 무조건 삭제한다. 활성 폴더 트리의 루트 id가 실수로 넘어오면 트리 전체가 한 번에 사라진다 — 폴더 케이스는 문서 케이스보다 파급 범위가 훨씬 크므로 CR-01 수정 시 폴더/문서 두 타입 모두에 대해 활성 상태 가드가 걸리는지 반드시 확인해야 한다(같은 헬퍼를 공유하므로 자연히 해결되긴 하지만, 회귀 테스트는 폴더 서브트리 케이스도 따로 필요).

**Fix:** CR-01의 수정과 함께 "활성 폴더(서브트리 포함)에 대한 완전 삭제 거부" 케이스를 `tests/trash/rbac.test.ts` 또는 `tests/trash/permanent-delete.test.ts`에 추가.

### WR-03: `closure.ts`와 `documents.ts`에 "문서로부터 workspaceId를 조회"하는 헬퍼가 3곳으로 분산되어 있다

**File:** `src/lib/documents.ts:32-38` (`resolveWorkspaceIdForDocument`, `isDeleted=false`), `src/lib/closure.ts:168-179` (`resolveWorkspaceIdForTrashItem`, 필터 없음, document 분기가 동일한 select를 인라인으로 재구현)

**Issue:** `resolveWorkspaceIdForTrashItem`의 `document` 분기(`closure.ts:177`)는 `documents.ts`의 `resolveWorkspaceIdForDocument`와 사실상 같은 셀렉트를 필터만 다르게 재작성한 것이다. 두 함수가 서로 다른 파일에서 독립적으로 유지보수되면, 한쪽 필터 로직(예: CR-01 수정)이 바뀔 때 다른 쪽과 동기화를 깜빡하기 쉽다.

**Fix:** 필수 사항은 아니지만, `resolveWorkspaceIdForDocument`에 `{ includeTrashed?: boolean }` 같은 옵션을 추가하거나, `resolveWorkspaceIdForTrashItem`의 document 분기가 그 함수를 호출하도록 재사용하면 한 곳만 고치면 된다. 강제 리팩터는 아님 — 지금 상태로도 동작은 정확하다.

## Info

### IN-01: `TrashList`의 `wsId` prop이 선언만 되고 사용되지 않는다

**File:** `src/components/trash/TrashList.tsx:30`, `src/app/(main)/w/[wsId]/trash/page.tsx:32`

**Issue:** `TrashListProps.wsId`가 인터페이스에 선언되고 `trash/page.tsx`에서 `wsId={wsId}`로 넘겨지지만, `TrashList` 컴포넌트 시그니처(`{ items, canRestore, canPermanentDelete }`)는 이를 구조분해하지 않는다 — 죽은 prop.

**Fix:** 실제로 필요 없다면 인터페이스와 호출부에서 제거. 향후 `fetch` 경로를 `wsId` 기반으로 바꿀 계획이 있다면 주석으로 명시.

### IN-02: 문서 트리 kebab 메뉴가 권한과 무관하게 항상 노출되어, 권한 없는 삭제 시도 시 일반 오류 문구만 뜬다

**File:** `src/components/tree/FolderTree.tsx:187-198` (`confirmDeleteDocument`), `src/components/tree/DocumentTreeLeaf.tsx:44-54`

**Issue:** VIEWER도 문서 kebab 메뉴/우클릭 삭제 메뉴를 볼 수 있고(서버가 403을 내므로 보안 문제는 아님 — CLAUDE.md 원칙과 일치), 실패 시 `DELETE_DOCUMENT_ERROR = "문서를 삭제하지 못했어요. 다시 시도해 주세요."`라는 일반 오류만 표시되어 "권한이 없다"는 실제 원인이 사용자에게 전달되지 않는다. `TrashList`는 이미 `canRestore`/`canPermanentDelete`를 서버에서 계산해 disabled+hint로 노출하는 패턴을 쓰는데, 트리 삭제 메뉴만 이 패턴을 따르지 않는다.

**Fix:** 필수는 아니나, 403 응답 시 `errorFor`/`docDeleteError`에 rbac 힌트 문구를 매핑하면 트리와 휴지통의 권한 UX가 일관돼진다.

---

_Reviewed: 2026-08-08T06:59:58Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
