# Phase 3: Folder Tree (Closure Table) - Pattern Map

**Mapped:** 2026-08-08
**Files analyzed:** 15 (신규/수정 대상)
**Analogs found:** 15 / 15

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/db/schema.ts` (folder, folderClosure 추가) | model | CRUD | `src/db/schema.ts` (workspace/workspaceMember, 기존 파일 확장) | exact |
| `src/lib/closure.ts` (getWorkspaceFolders/getSubtree/createFolder/moveFolder/softDeleteFolder) | service | CRUD + batch(closure rewrite) | `src/app/api/workspaces/route.ts` (POST의 `db.transaction`), `src/lib/rbac.ts` (모듈 구조) | role-match |
| `src/lib/validation.ts` (`folderSchema` 추가) | utility | transform | `src/lib/validation.ts`(기존 `workspaceSchema`, 기존 파일 확장) | exact |
| `src/app/api/folders/route.ts` (POST 생성) | route | CRUD | `src/app/api/workspaces/route.ts` (POST) | exact |
| `src/app/api/folders/[id]/route.ts` (PATCH 이름변경 / DELETE 소프트삭제) | route | CRUD | `src/app/api/workspaces/[id]/route.ts` (DELETE) | exact |
| `src/app/api/folders/[id]/move/route.ts` (POST 이동) | route | request-response (트랜잭션 + 사이클 체크) | `src/app/api/workspaces/route.ts` (POST의 `db.transaction` 패턴) + `src/app/api/workspaces/[id]/route.ts` (조회 후 requireRole 순서) | role-match(신규 서브패턴: workspaceId 서버 재조회) |
| `src/app/(main)/w/[wsId]/page.tsx` (수정 — 사이드바 grid 추가, `getWorkspaceFolders` 호출) | route(서버 컴포넌트) | request-response | 기존 파일 자체(수정) — `EditorPreviewLayout` 조립 방식 | exact |
| `src/components/tree/FolderTree.tsx` | component | transform(state) | `src/components/layout/EditorPreviewLayout.tsx` (조립형 최상위 컴포넌트) | role-match |
| `src/components/tree/FolderTreeNode.tsx` | component | event-driven(hover/dnd) | `src/components/workspace/WorkspaceCard.tsx` (row/card 상호작용 + 조건부 액션 버튼) | role-match |
| `src/components/tree/FolderContextMenu.tsx` | component | event-driven | `src/components/ui/Modal.tsx` (open/onClose + Escape 키 패턴) | role-match |
| `src/components/tree/MoveFolderModal.tsx` | component | request-response(mutation) | `src/components/workspace/DeleteWorkspaceDialog.tsx` (모달 기반 mutation + fetch + error state) | exact |
| `src/components/tree/InlineRenameInput.tsx`(또는 `FolderTreeNode` 내부) | component | request-response(mutation) | `src/components/workspace/CreateWorkspaceModal.tsx` (제출 시 fetch + 클라 zod 가드 + 에러표시) | role-match |
| `src/components/tree/tree-utils.ts` (`buildTree`, `isDescendantOrSelf`) | utility | transform | 신규 패턴(순수 함수) — 기존 코드베이스에 트리 순회 유틸 없음 | no-analog(RESEARCH 코드 예시로 대체) |
| `tests/folder/closure.test.ts`, `tests/folder/rbac.test.ts`, `tests/folder/cross-workspace.test.ts` | test | CRUD 검증 | `tests/rbac/matrix.test.ts` + `tests/rbac/helpers.ts` | exact |
| `tests/folder/query-count.test.ts` | test | batch/계측 | 신규 패턴(RESEARCH의 `debug` 훅 예시) — 기존 테스트에 쿼리카운트 계측 없음 | no-analog(RESEARCH 코드 예시로 대체) |
| `e2e/folder-tree.spec.ts` | test | event-driven(DnD) | 기존 `e2e/workspace-create.spec.ts` 류 signup→workspace 플로 위에 작성(파일 미열람이나 RESEARCH가 지목) | role-match |

## Pattern Assignments

### `src/db/schema.ts` (model, CRUD) — folder + folder_closure 추가

**Analog:** 기존 `workspace`/`workspaceMember` 테이블 정의 (같은 파일, 라인 12-36)

**컬럼/제약 관례** (schema.ts 1-36 전체에서 추출):
```typescript
import { boolean, check, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// workspace 패턴: uuid PK defaultRandom, isDeleted boolean default(false), timestamp withTimezone defaultNow
export const workspace = pgTable("workspace", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// workspaceMember 패턴: 복합 PK + FK cascade + check 제약(role enum)
export const workspaceMember = pgTable(
  "workspace_member",
  {
    workspaceId: uuid("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.userId] }),
    check("workspace_member_role_check", sql`${table.role} IN ('OWNER','ADMIN','EDITOR','VIEWER')`),
  ],
);
```

**적용:** `folder`는 `workspace`와 동일하게 `uuid` PK(defaultRandom), `workspaceId` FK(`onDelete: "cascade"`), `parentId` self-FK(nullable), `name text notNull`, `isDeleted boolean default(false)`, `isTrashRoot boolean default(false)`, `createdAt`/`updatedAt timestamp withTimezone`. `folderClosure`는 `workspaceMember`처럼 **복합 PK**(`ancestorId`, `descendantId`) + FK(`onDelete: "cascade"` — folder 삭제 시 closure 행도 정리, 단 Phase 3의 소프트삭제는 `is_deleted` 플래그만 바꾸므로 실제 hard delete는 발생 안 함) + `depth integer notNull`. **CONTEXT.md 잠금(Pitfall 6):** `(parentId, name)` 등 형제-유일성 unique index를 추가하지 않는다 — 스키마에 그런 제약이 전혀 없다는 게 결정이다.

**마이그레이션:** `pnpm drizzle-kit generate` → `pnpm drizzle-kit migrate` (TRD §3 원천, 기존 워크플로 그대로).

---

### `src/lib/closure.ts` (service, CRUD/batch) — 6개 함수

**Analog:** `src/app/api/workspaces/route.ts` POST 핸들러의 `db.transaction` 사용, `src/lib/rbac.ts`의 모듈 최상위 함수 export 구조.

**트랜잭션 패턴** (workspaces/route.ts 34-38):
```typescript
const created = await db.transaction(async (tx) => {
  const [ws] = await tx.insert(workspace).values({ name: parsed.data.name }).returning();
  await tx.insert(workspaceMember).values({ workspaceId: ws.id, userId, role: "OWNER" });
  return ws;
});
```
**적용:** `createFolder`/`moveFolder`/`softDeleteFolder`가 이 형태를 그대로 따른다. RESEARCH Pattern 3/4/5의 SQL(TRD §4 원문 이식)을 이 트랜잭션 콜백 안에 배치한다. `moveFolder`는 **사이클 체크 SELECT를 콜백의 첫 문장**으로 둔다(TOCTOU 방지, RESEARCH Pitfall 1).

**의존성 주입(RESEARCH A3 설계 판단):** `getSubtree`/`getWorkspaceFolders`는 두 번째 인자로 `db`/`tx`를 선택적으로 받도록 설계 권장(cascade 삭제의 read skew 방지 + 쿼리카운트 테스트 격리). 구체 시그니처는 실행자 재량이나 "cascade 삭제의 서브트리 조회와 UPDATE가 같은 트랜잭션 안"이라는 불변식은 반드시 지킨다.

**에러 클래스:** `rbac.ts`의 `ForbiddenError extends Error` 관례를 그대로 따라 `CycleError extends Error`(closure.ts 내부)를 둔다.

---

### `src/lib/validation.ts` (utility, transform) — `folderSchema` 추가

**Analog:** 같은 파일의 기존 `workspaceSchema` (라인 참조는 RESEARCH가 `[VERIFIED: src/lib/validation.ts:28-34]`로 이미 인용).

```typescript
export const folderSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "폴더 이름을 입력해 주세요.")
    .max(255, "폴더 이름은 255자를 넘을 수 없습니다."),
});
export type FolderInput = z.infer<typeof folderSchema>;
```
구조는 `workspaceSchema`와 동일(trim → min → max), 메시지·max값만 CONTEXT.md 잠금대로 변경(255자, 형제 유일성 없음).

---

### `src/app/api/folders/route.ts` (route, CRUD) — POST 생성

**Analog:** `src/app/api/workspaces/route.ts` (전체 12-41)

**Imports 패턴** (workspaces/route.ts 1-7):
```typescript
import { auth } from "@/auth";
import { db } from "@/db";
import { workspace, workspaceMember } from "@/db/schema";
import { forbiddenResponse } from "@/lib/rbac";
import { workspaceSchema } from "@/lib/validation";

export const runtime = "nodejs";
```

**JSON 파싱 가드 + zod 검증 패턴** (workspaces/route.ts 19-32):
```typescript
let body: unknown;
try {
  body = await req.json();
} catch {
  return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
}

const parsed = workspaceSchema.safeParse(body);
if (!parsed.success) {
  return Response.json(
    { error: parsed.error.issues[0]?.message ?? "잘못된 요청입니다." },
    { status: 400 },
  );
}
```
**적용 시 차이점:** 워크스페이스 생성은 "세션만 있으면 됨"이지만 폴더 생성은 **`workspaceId`(신규 필드, body 또는 부모 폴더에서 유도) + `requireRole(workspaceId, "EDITOR")`**가 반드시 필요하다(FR 대상 아님 — WS-02와 달리 폴더 생성은 role-gated). `parentId`가 있으면 RESEARCH Pitfall 2대로 그 폴더의 `workspaceId`가 요청 대상과 일치하는지 트랜잭션 안에서 검증.

---

### `src/app/api/folders/[id]/route.ts` (route, CRUD) — PATCH 이름변경 / DELETE 소프트삭제

**Analog:** `src/app/api/workspaces/[id]/route.ts` (전체) — **RESEARCH가 이미 이 정확한 이식을 코드 예시로 제공**(Code Examples §"라우트 핸들러 골격 — 이름변경").

**핵심 골격** (workspaces/[id]/route.ts 13-38 이식, RESEARCH가 folder에 맞춰 다시 쓴 버전):
```typescript
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  // 워크스페이스 [id]/route.ts와의 핵심 차이: wsId가 URL에 없으므로 폴더 행에서 서버가 직접 조회
  const [target] = await db.select({ workspaceId: folder.workspaceId }).from(folder).where(eq(folder.id, id));
  if (!target) return forbiddenResponse(); // 존재하지 않음 = 멤버십도 확인 불가 = 403

  try {
    await requireRole(target.workspaceId, "EDITOR");
  } catch (err) {
    if (err instanceof ForbiddenError) return forbiddenResponse();
    throw err;
  }
  // ... zod body 검증 → update → 204
}
```
**DELETE(소프트삭제 cascade)는** workspaces/[id]/route.ts DELETE(13-38)의 "requireRole 먼저 → 대상 조회 → update" 순서를 따르되, 단일 `update`가 아니라 `closure.ts`의 `softDeleteFolder(id)` 트랜잭션 함수를 호출한다. **완전삭제(ADMIN)는 이 phase 범위 밖**(Phase 4) — `requireRole(target.workspaceId, "EDITOR")`만 필요.

---

### `src/app/api/folders/[id]/move/route.ts` (route, request-response) — POST 이동

**Analog:** `src/app/api/workspaces/[id]/route.ts`의 조회→requireRole 순서 + `src/lib/closure.ts`의 `moveFolder` 트랜잭션.

**신규 서브패턴(기존 코드베이스에 없음, RESEARCH Pitfall 3이 명시):**
```typescript
// 워크스페이스 경계를 넘는 IDOR 방지 — 반드시 서버가 폴더 행에서 workspaceId를 재조회
const [target] = await db.select({ workspaceId: folder.workspaceId }).from(folder).where(eq(folder.id, id));
if (!target) return forbiddenResponse();
await requireRole(target.workspaceId, "EDITOR"); // ForbiddenError → forbiddenResponse() 패턴은 위와 동일

// body.newParentId 검증 후 closure.moveFolder(id, newParentId) 호출
// CycleError → 409, 워크스페이스 불일치 → 400 (closure.ts 내부에서 판정)
```
`body.newParentId`가 다른 워크스페이스 폴더를 가리키면 400(RESEARCH Pitfall 2) — `closure.ts`의 `moveFolder` 트랜잭션 내부에서 `newParentId`의 `workspaceId`를 조회해 비교.

---

### `src/app/(main)/w/[wsId]/page.tsx` (수정) — 사이드바 grid + 초기 트리 로드

**Analog:** 파일 자체(기존 `requireRole(wsId,"VIEWER")+notFound()` 게이트는 그대로 유지). UI-SPEC Layout Contract가 `grid-template-columns: 260px minmax(0,1fr)`로 감싸라고 명시.

**적용:** 기존 `requireRole` 호출 뒤에 `const folders = await getWorkspaceFolders(wsId)` 한 줄 추가, `<FolderTree folders={folders} workspaceId={wsId} />`를 좌측 컬럼에 배치. 서버 컴포넌트이므로 클라이언트 로딩 스피너 없음(UI-SPEC "loading" 상태 참조).

---

### `src/components/tree/FolderTree.tsx` / `FolderTreeNode.tsx` (component)

**Analog:** `src/components/layout/EditorPreviewLayout.tsx`(조립형 최상위, "use client" + 로컬 state), `src/components/workspace/WorkspaceCard.tsx`(행 단위 컴포넌트 + 조건부 액션 버튼 + 자식 다이얼로그 오픈 상태 관리).

**조립형 최상위 패턴** (EditorPreviewLayout.tsx 1-28):
```typescript
"use client";
import { useRef, useState } from "react";
// ...
export function EditorPreviewLayout() {
  const [content, setContent] = useState("");
  return (
    <div className={styles.grid}>
      {/* 자식 컴포넌트 조립 */}
    </div>
  );
}
```
`FolderTree`는 `folders: Folder[]` prop을 받아 `tree-utils.buildTree`로 트리 구조를 만들고, 펼침/접힘 state(Set<string>, 비영속 — CONTEXT.md)와 `draggedId`/`selectedId` state를 소유한다.

**행 컴포넌트 + 조건부 액션 버튼 패턴** (WorkspaceCard.tsx 24-54):
```typescript
export function WorkspaceCard({ id, name, role }: WorkspaceCardProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  return (
    <Card className={styles.card}>
      <Link href={`/w/${id}`} className={styles.name}>{name}</Link>
      {role === "OWNER" && (
        <>
          <button onClick={() => setDeleteOpen(true)} aria-label={`${name} 삭제`}><Trash2 size={16} /></button>
          <DeleteWorkspaceDialog open={deleteOpen} ... onClose={() => setDeleteOpen(false)} />
        </>
      )}
    </Card>
  );
}
```
`FolderTreeNode`는 이 형태를 따르되 role 조건 대신 hover 조건(`opacity` 토글, UI-SPEC)으로 kebab 버튼을 노출하고, 클릭 시 `DeleteWorkspaceDialog` 대신 `FolderContextMenu`를 그 자리에 연다. `draggable`/`onDragStart`/`onDragOver`/`onDrop`은 RESEARCH Pattern 6·7을 그대로 사용(신규 패턴, 아래 tree-utils 참고).

---

### `src/components/tree/FolderContextMenu.tsx` (component)

**Analog:** `src/components/ui/Modal.tsx`의 Escape 키 리스너 + backdrop 클릭 닫기 패턴.

```typescript
useEffect(() => {
  if (!open) return;
  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") onClose();
  }
  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}, [open, onClose]);
```
`FolderContextMenu`는 `Modal`처럼 backdrop 전체를 덮지 않고 고정 위치(우클릭 좌표 또는 kebab 버튼 위치) 팝업으로 렌더 — `Modal`의 오픈/클로즈/Escape 로직만 재사용, 레이아웃(box 스타일)은 UI-SPEC의 dropdown-menu 사양(`docs/ui-kit.html` 이식)을 새로 CSS Modules로 작성.

---

### `src/components/tree/MoveFolderModal.tsx` (component, request-response)

**Analog:** `src/components/workspace/DeleteWorkspaceDialog.tsx` — 모달/다이얼로그 기반 mutation의 fetch + 로딩 + 에러 상태 관리 표준 골격.

```typescript
const [submitting, setSubmitting] = useState(false);
const [error, setError] = useState<string | null>(null);

async function handleConfirm() {
  setError(null);
  setSubmitting(true);
  try {
    const res = await fetch(`/api/folders/${folderId}/move`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ newParentId: selectedId }),
    });
    if (!res.ok) {
      setError(MOVE_ERROR);
      setSubmitting(false);
      return;
    }
    onMoved();
    onClose();
  } catch {
    setError(MOVE_ERROR);
    setSubmitting(false);
  }
}
```
`Modal`(재사용, `ConfirmDialog` 아님 — UI-SPEC이 명시적으로 `Modal` 지정)로 감싸고, 본문에 들여쓰기 트리 리스트(선택 가능 항목 + 자기 서브트리 `pointer-events:none` 회색 처리)를 렌더. 에러 카피는 Copywriting Contract의 "폴더를 이동하지 못했어요..." 재사용.

---

### `InlineRenameInput` (FolderTreeNode 내부 또는 별도 파일)

**Analog:** `src/components/workspace/CreateWorkspaceModal.tsx`의 제출 핸들러(클라 zod 최소 가드 + fetch + 에러 표시).

```typescript
const parsed = folderSchema.safeParse({ name });
if (!parsed.success) {
  setError(parsed.error.issues[0]?.message ?? RENAME_ERROR);
  return;
}
// fetch PATCH /api/folders/:id, 실패 시 원래 이름 복구(Escape와 동일 취급)
```
UI-SPEC: Enter/blur=제출, Escape=취소(원래 이름 복구, 낙관적 반영 없음 — 서버 응답 대기 후에만 트리 갱신).

---

### `src/components/tree/tree-utils.ts` (utility, transform) — No analog, RESEARCH 코드 그대로 채택

기존 코드베이스에 트리 순회 유틸이 없다. RESEARCH Pattern 6이 제공한 순수 함수를 그대로 채택(신규 의존성 없음, 순수 함수라 플러그인 규칙과도 정합):
```typescript
export function isDescendantOrSelf(folders: { id: string; parentId: string | null }[], rootId: string, candidateId: string): boolean {
  if (rootId === candidateId) return true;
  const childrenOf = (id: string) => folders.filter((f) => f.parentId === id);
  const stack = [...childrenOf(rootId)];
  while (stack.length) {
    const node = stack.pop()!;
    if (node.id === candidateId) return true;
    stack.push(...childrenOf(node.id));
  }
  return false;
}
```
`buildTree(folders)`도 같은 파일에 신규 작성(부모-자식 map 구성, 표준 O(n) 알고리즘 — 특정 분석 대상 없음).

---

### 테스트 파일

**Analog (통합 테스트 인프라):** `tests/rbac/matrix.test.ts` + `tests/rbac/helpers.ts` — `addMember`/`mockSessionFor` 팩토리, `vi.mock("@/auth")`, `afterEach`에서 workspace 행 삭제 → FK cascade 정리 패턴을 `tests/folder/*.test.ts` 전체가 그대로 재사용.

**쿼리 카운트 테스트:** 기존 테스트에 선례 없음 — RESEARCH의 `postgres` `debug` 콜백 코드 예시(Code Examples §"쿼리 개수 단언")를 그대로 채택.

**E2E:** 기존 `e2e/workspace-create.spec.ts` 류의 signup→workspace 흐름 위에 트리 상호작용(hover, 우클릭, DnD `dragTo`)을 추가.

---

## Shared Patterns

### 서버 전용 권한 (requireRole)
**Source:** `src/lib/rbac.ts` (`requireRole`, `ForbiddenError`, `forbiddenResponse`, `ROLE_RANK`)
**Apply to:** `folders/route.ts`, `folders/[id]/route.ts`, `folders/[id]/move/route.ts` 전부.
```typescript
try {
  await requireRole(workspaceId, "EDITOR");
} catch (err) {
  if (err instanceof ForbiddenError) return forbiddenResponse();
  throw err;
}
```
**Phase 3 전용 확장:** URL에 `wsId`가 없는 라우트(folders/[id]/*)는 클라이언트가 보낸 workspaceId를 절대 신뢰하지 않고, `SELECT workspace_id FROM folder WHERE id = :folderId`로 서버가 직접 조회한 뒤 그 값을 `requireRole`에 넘긴다(IDOR 방지, RESEARCH Pitfall 3 — rbac.ts의 fail-closed UUID 가드와 같은 철학).

### uuid path 파라미터 검증
**Source:** `src/app/api/workspaces/[id]/route.ts` 16-21 (`z.uuid().safeParse(id)`)
**Apply to:** 모든 `folders/[id]*` 라우트의 `id`/`newParentId` 파라미터.

### db.transaction 자동 롤백
**Source:** `src/app/api/workspaces/route.ts` 34-38
**Apply to:** `closure.ts`의 `createFolder`/`moveFolder`/`softDeleteFolder` — 콜백이 throw하면 자동 롤백, 수동 ROLLBACK SQL 금지.

### 모달/다이얼로그 기반 mutation UX (fetch → 로딩 → 에러)
**Source:** `src/components/workspace/CreateWorkspaceModal.tsx`, `DeleteWorkspaceDialog.tsx`
**Apply to:** `MoveFolderModal.tsx`, 인라인 이름변경/생성 입력, 컨텍스트 메뉴 "삭제" 확인(`ConfirmDialog` 재사용).

### JSON 파싱 가드 + zod 400 응답
**Source:** `src/app/api/workspaces/route.ts` 19-32
**Apply to:** `POST /api/folders`, `PATCH /api/folders/[id]`, `POST /api/folders/[id]/move`.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/components/tree/tree-utils.ts` | utility | transform | 기존 코드베이스에 트리 순회/사이클 판정 유틸이 없음 — RESEARCH Pattern 6 코드 그대로 채택 |
| `tests/folder/query-count.test.ts` | test | 계측 | 기존 테스트에 postgres.js `debug` 훅 사용 사례 없음 — RESEARCH Code Examples 코드 그대로 채택 |
| DnD 이벤트 배선(`dragstart`/`dragover`/`drop`) | component(event handler) | event-driven | 코드베이스에 기존 DnD 상호작용 없음(신규 영역) — MDN 인용 기반 RESEARCH Pattern 6·7 그대로 채택 |

## Metadata

**Analog search scope:** `src/db/schema.ts`, `src/app/api/workspaces/**`, `src/lib/rbac.ts`, `src/lib/validation.ts`, `src/components/ui/**`, `src/components/workspace/**`, `src/components/layout/EditorPreviewLayout.tsx`, `tests/rbac/**`
**Files scanned:** 11 (직접 Read) + RESEARCH/UI-SPEC/CONTEXT 문서 3
**Pattern extraction date:** 2026-08-08
