---
phase: 03-folder-tree-closure-table
reviewed: 2026-08-08T00:00:00Z
depth: deep
files_reviewed: 16
files_reviewed_list:
  - src/db/schema.ts
  - src/lib/closure.ts
  - src/lib/validation.ts
  - src/app/api/folders/route.ts
  - src/app/api/folders/[id]/route.ts
  - src/app/api/folders/[id]/move/route.ts
  - src/app/(main)/w/[wsId]/page.tsx
  - src/app/(main)/w/[wsId]/page.module.css
  - src/components/tree/FolderTree.tsx
  - src/components/tree/FolderTreeNode.tsx
  - src/components/tree/FolderContextMenu.tsx
  - src/components/tree/MoveFolderModal.tsx
  - src/components/tree/tree-utils.ts
  - tests/folder/closure.test.ts
  - tests/folder/cross-workspace.test.ts
  - tests/folder/rbac.test.ts
  - tests/folder/query-count.test.ts
  - e2e/folder-tree.spec.ts
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-08-08
**Depth:** deep
**Files Reviewed:** 16 (+ 4 test files 참고용으로 함께 확인)
**Status:** issues_found

## Summary

`c50553b..acdbaba` 범위(03-01~03-05)를 커밋 단위로 diff와 실제 소스를 직접 읽고, closure-table 재배선(`moveFolder`)·cascade soft-delete(`softDeleteFolder`)·4개 API 라우트의 IDOR/RBAC 경로를 추적했다.

**핵심 결론: Critical(보안·데이터 유실) 등급 결함은 발견하지 못했다.** 요청서(focus)의 최우선 항목들 — IDOR(workspaceId 서버 재도출), SQL 파라미터 바인딩, TOCTOU(cycle check와 재배선이 한 트랜잭션), closure DELETE/INSERT의 외부/내부 링크 분리, getSubtree/getWorkspaceFolders의 depth 독립 단일 쿼리, 에러→HTTP 코드 매핑 — 은 모두 코드와 테스트로 실제 검증했고 의도대로 동작한다. `tests/folder/*.test.ts`가 이 경로들(교차 워크스페이스 이동 거부, cycle 409, malformed uuid 400, RBAC 매트릭스)을 이미 커버하고 있어 회귀에 대한 안전망도 있다.

다만 **소프트 삭제 상태(`is_deleted`)를 무시하는 조회 지점이 여러 라우트에 반복**되어 있고, 그중 하나(`softDeleteFolder`의 이중 호출)는 `is_trash_root` 불변식을 실제로 깨뜨릴 수 있는 재현 가능한 시나리오다. 이 클래스의 결함을 WR-01/WR-02로 묶었다. 나머지는 코드 중복(DRY)과 클라이언트 검증 비대칭 수준의 품질 이슈다.

## Warnings

### WR-01: `softDeleteFolder`를 이미 삭제된 폴더에 다시 호출하면 `is_trash_root` 불변식이 깨진다

**File:** `src/lib/closure.ts:126-134`, `src/app/api/folders/[id]/route.ts:52-70`

**Issue:** `DELETE /api/folders/[id]`는 대상 폴더의 `is_deleted` 상태를 확인하지 않는다(`resolveWorkspaceIdOrForbidden`은 `workspaceId`만 조회, `eq(folder.isDeleted, false)` 필터 없음). 이미 삭제된 폴더(직접 삭제 target이 아니라 상위 트리 cascade로 이미 `is_deleted=true`가 된 자손)의 id로 다시 DELETE를 호출하면:

1. `resolveWorkspaceIdOrForbidden`이 여전히 row를 찾아 `workspaceId`를 반환 → `requireRole` 통과(호출자가 해당 워크스페이스 EDITOR+이면 성공).
2. `softDeleteFolder(id)` → `getSubtree(id, tx)`는 `isDeleted=false`만 반환하므로 이미 삭제된 대상은 subtree에 없어 `ids=[]`.
3. `inArray(folder.id, [])`는 drizzle-orm이 `sql\`false\``로 컴파일하므로 (`node_modules/drizzle-orm/sql/expressions/conditions.js:73-80`) 0행 UPDATE — 여기까지는 무해.
4. 그러나 그 다음 `UPDATE folder SET is_trash_root = true WHERE id = folderId`는 **무조건** 실행된다. 이미 부모의 cascade로 삭제된 자손 폴더가 **자신도 `is_trash_root=true`**가 되어, 하나의 실제 삭제 작업(A 삭제)의 결과가 A와 그 자손 B 두 개의 독립된 trash-root처럼 DB에 남는다.

**실패 시나리오:** A(폴더) > B(하위 폴더). 사용자가 A를 삭제 → A.is_trash_root=true, B.is_trash_root=false (의도된 상태). 이후 (이전 세션에서 캐시된 id·재시도 더블클릭 경쟁·직접 API 호출 등으로) `DELETE /api/folders/{B.id}`가 한 번 더 호출되면 B.is_trash_root=true로 바뀐다. Phase 4에서 "휴지통 = `is_trash_root=true` 목록"을 그대로 조회하면 B가 A의 하위 항목이 아니라 별도의 최상위 휴지통 항목으로 중복 노출되고, A만 복원해도 B는 별도로 남는 등 복원 로직이 꼬인다.

**Fix:** `softDeleteFolder`(또는 DELETE 라우트)에서 대상이 이미 삭제된 상태면 멱등하게 아무 것도 하지 않도록 가드를 추가한다.

```ts
export async function softDeleteFolder(folderId: string, client: DbClient = db) {
  return client.transaction(async (tx) => {
    const [target] = await tx.select({ isDeleted: folder.isDeleted }).from(folder).where(eq(folder.id, folderId));
    if (!target || target.isDeleted) return; // 이미 삭제됨 — 재삭제로 is_trash_root를 덮어쓰지 않는다

    const subtree = await getSubtree(folderId, tx);
    const ids = subtree.map((f) => f.id);
    await tx.update(folder).set({ isDeleted: true, deletedAt: new Date() }).where(inArray(folder.id, ids));
    await tx.update(folder).set({ isTrashRoot: true }).where(eq(folder.id, folderId));
  });
}
```

### WR-02: 폴더 변경(PATCH/POST create/POST move) 라우트가 삭제된(`is_deleted=true`) 대상·부모 row를 걸러내지 않는다

**File:** `src/app/api/folders/[id]/route.ts:13-16`(`resolveWorkspaceIdOrForbidden`), `src/app/api/folders/[id]/move/route.ts:22`, `src/app/api/folders/route.ts:40-43`, `src/lib/closure.ts:88-95`(`moveFolder`의 cross-workspace 조회)

**Issue:** 위 네 지점 모두 `folder.id`로 워크스페이스/부모 존재 여부를 조회할 때 `isDeleted` 조건이 없다. 정상 UI 플로우에서는 `getWorkspaceFolders`가 이미 삭제된 폴더를 클라이언트에 내려주지 않으므로 사용자가 실수로 트리거하긴 어렵지만, id를 직접 아는 호출자는:

- 삭제된 폴더를 `PATCH`로 이름 변경할 수 있다("삭제됨" 상태에서 이름이 바뀐 채로 남아, Phase 4 복원 시 사용자가 의도치 않은 이름을 보게 됨).
- 삭제된 폴더를 새 폴더의 `parentId`로 지정해 생성할 수 있다(POST). 새로 만든 자식은 closure 조상 링크가 정상 복사되지만, 부모가 `getWorkspaceFolders`에서 제외되므로 클라이언트 `buildTree`가 이 자식을 "루트"로 잘못 표시한다(`tree-utils.ts:13-25`, 부모를 `byId`에서 못 찾으면 무조건 `roots`에 편입).
- 삭제된 폴더를 이동 대상(`newParentId`)으로 지정해 살아있는 폴더를 그 아래로 옮길 수 있다 — 이동된 폴더는 살아있는데(`is_deleted=false`) 부모는 죽어 있어(getWorkspaceFolders에서 제외) 트리에 잘못 루트로 뜬다.

**Fix:** 네 지점의 조회에 `and(eq(folder.id, id), eq(folder.isDeleted, false))`를 추가하고, row가 없으면(=삭제됐거나 존재하지 않음) 기존과 동일하게 403/400으로 처리한다. 반복되는 "workspace_id 재도출" 로직이므로 `resolveWorkspaceIdOrForbidden`을 `src/lib/closure.ts` 또는 별도 공유 헬퍼로 옮기고 move 라우트도 그것을 재사용하면 WR-03(중복)도 함께 해소된다.

### WR-03: `move` 라우트가 `[id]/route.ts`의 `resolveWorkspaceIdOrForbidden`을 재사용하지 않고 동일 로직을 재구현

**File:** `src/app/api/folders/[id]/move/route.ts:22-23` vs `src/app/api/folders/[id]/route.ts:13-16`

**Issue:** "no wsId in the URL — server re-derives workspace_id from the target folder row" 로직이 세 라우트(PATCH/DELETE/move)에 필요한데, PATCH/DELETE는 공유 헬퍼 `resolveWorkspaceIdOrForbidden`을 쓰지만 move 라우트는 `db.select({ workspaceId: folder.workspaceId }).from(folder).where(eq(folder.id, id))`를 인라인으로 다시 작성했다. 로직 자체는 현재 동일하지만, WR-02의 `isDeleted` 필터를 추가할 때 한쪽만 고치고 다른 쪽을 빠뜨리기 쉬운 구조다(실제로 지금 이 세 곳 모두 필터가 없는 것도 같은 원인).

**Fix:** `resolveWorkspaceIdOrForbidden`을 `src/lib/closure.ts`(또는 `src/lib/rbac.ts` 근처의 공유 파일)로 옮겨 export하고, `[id]/route.ts`와 `[id]/move/route.ts` 양쪽에서 import해서 쓴다.

## Info

### IN-01: `FolderTreeNode`의 인라인 "새 하위 폴더" 입력이 `folderSchema` 클라이언트 검증을 건너뛴다

**File:** `src/components/tree/FolderTreeNode.tsx:234-237` (`CreateInlineRow.onKeyDown`) vs `src/components/tree/FolderTree.tsx:262-266` (`CreateRootInput.onKeyDown`)

**Issue:** 루트 생성 입력(`CreateRootInput`)은 `folderSchema.safeParse({ name: value })`를 통과한 `parsed.data.name`(trim + 255자 제한 검증됨)만 `onSubmit`에 넘기지만, 하위 폴더 생성 입력(`CreateInlineRow`)은 `value.trim()`이 truthy이기만 하면 검증 없이 원본 `value`(trim되지 않은 값 포함)를 그대로 `onSubmit`에 넘긴다. 서버(`folderSchema` in POST route)가 최종적으로 trim·255자 제한을 강제하므로 데이터 무결성 문제는 없지만, 두 입력 컴포넌트의 검증 로직이 갈라져 있고 하나는 서버 400을 받을 때까지 사용자에게 아무 클라이언트 피드백이 없다(제출 시도 후 일반 `CREATE_ERROR` 메시지만 표시).

**Fix:** `CreateInlineRow.onKeyDown`도 `CreateRootInput`과 동일하게 `folderSchema.safeParse`를 거쳐 `parsed.data.name`을 제출하도록 통일한다.

### IN-02: `MoveFolderModal`/`FolderContextMenu`의 메뉴 팝업이 뷰포트 경계를 고려하지 않는다

**File:** `src/components/tree/FolderContextMenu.tsx:43` (`style={{ left: x, top: y }}`)

**Issue:** 컨텍스트 메뉴 위치가 `MouseEvent.clientX/clientY`를 그대로 `left/top`으로 쓴다. 사이드바 하단·우측 근처에서 우클릭하면 메뉴가 화면 밖으로 잘릴 수 있다. 트리 사이드바가 260px 고정폭이라 실질적으로 눈에 띄는 경우는 세로 방향(트리 하단 근처)에서만 발생할 가능성이 높다.

**Fix:** 필요 시 `window.innerWidth/innerHeight` 대비 메뉴 크기를 측정해 좌표를 클램프한다. 단, 지금 사이드바가 고정폭이라 우선순위는 낮다.

---

_Reviewed: 2026-08-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
