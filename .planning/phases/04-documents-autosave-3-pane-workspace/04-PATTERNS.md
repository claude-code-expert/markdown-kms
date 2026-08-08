# Phase 4: Documents, Autosave & 3-Pane Workspace - Pattern Map

**Mapped:** 2026-08-08
**Files analyzed:** 18
**Analogs found:** 18 / 18

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/db/schema.ts` (document 테이블 추가) | model | CRUD | `folder`/`folderClosure` 테이블 정의(같은 파일) | exact |
| `src/lib/documents.ts` (createDocument/getDocument/softDeleteDocument 등) | service | CRUD | `src/lib/closure.ts`(createFolder/getSubtree/softDeleteFolder, DbClient 패턴) | exact |
| `src/lib/documents.ts`의 `autosaveDocument` | service | request-response(조건부 UPDATE) | 없음(신규 프로토콜, TRD §7 확정) — 구조만 `closure.ts` DbClient 패턴 차용 | role-match |
| `src/lib/closure.ts`(휴지통 확장: `restoreFolder`/`permanentlyDeleteFolder`/`resolveWorkspaceIdForTrashItem`) | service | CRUD(cascade) | 기존 `moveFolder`/`softDeleteFolder`(같은 파일) | exact |
| `src/lib/validation.ts`(`documentSchema`, PUT body schema) | utility(zod) | 입력 검증 | `folderSchema`(같은 파일) | exact |
| `src/app/api/documents/route.ts` (POST) | route/controller | CRUD | `src/app/api/folders/route.ts` | exact |
| `src/app/api/documents/[id]/route.ts` (GET/PUT/DELETE) | route/controller | request-response + CRUD(seq 가드) | `src/app/api/folders/[id]/route.ts`(PATCH/DELETE) | exact |
| `src/app/api/trash/[type]/[id]/restore/route.ts` | route/controller | event-driven(상태 전이) | `src/app/api/folders/[id]/move/route.ts`(IDOR 재유도 + 에러 매핑 구조) | role-match |
| `src/app/api/trash/[type]/[id]/route.ts` (DELETE 완전삭제) | route/controller | CRUD(비가역 hard delete) | `src/app/api/folders/[id]/route.ts`의 DELETE | role-match |
| `src/components/document/useAutosave.ts` | hook | event-driven(디바운스+seq) | 없음(신규 클라 프로토콜) — 상태 전이 구조는 `CreateWorkspaceModal.tsx`의 submitting/error state 차용 | role-match |
| `src/components/document/SaveStatusBar.tsx` | component | request-response(상태 표시) | Phase 3 `.spinner`/`.pending` 패턴(`FolderTreeNode.module.css`) | role-match |
| `src/components/document/DocumentWorkspace.tsx` | component | 조립(container) | `src/components/layout/EditorPreviewLayout.tsx` | exact |
| `src/components/document/EmptyState.tsx` | component | — | 없음(신규, UI-SPEC 카피만) | no-analog(단순) |
| `src/app/(main)/w/[wsId]/layout.tsx` | route(RSC) | request-response | `src/app/(main)/w/[wsId]/page.tsx`(현재 파일, 이관 대상) | exact |
| `src/app/(main)/w/[wsId]/d/[docId]/page.tsx` | route(RSC) | request-response | `src/app/(main)/w/[wsId]/page.tsx`(requireRole+notFound 패턴) | exact |
| `src/app/(main)/w/[wsId]/trash/page.tsx` | route(RSC) | request-response | `src/app/(main)/w/[wsId]/page.tsx` + 목록 렌더는 `FolderTree.tsx`의 items 패턴 | role-match |
| `src/components/tree/FolderTree.tsx`/`FolderTreeNode.tsx`/`FolderContextMenu.tsx` (문서 노드 확장) | component | CRUD(mutation trigger) | 자기 자신(기존 폴더 노드 패턴을 문서 리프에 이식) | exact |
| `src/components/trash/TrashList.tsx`, `RestoreRootBanner.tsx` | component | CRUD + 알림 | `FolderTree.tsx`(목록+ConfirmDialog+router.refresh 패턴) | role-match |

## Pattern Assignments

### `src/db/schema.ts` — document 테이블 (model, CRUD)

**Analog:** `folder`/`folderClosure` 정의(같은 파일, 51-91행)

**핵심 패턴** — TRD §3 DDL을 `folder` 테이블과 동일한 Drizzle 관례로 옮긴다:
```typescript
export const document = pgTable(
  "document",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
    // ON DELETE CASCADE 없음(RESEARCH Pitfall 4) — folder 삭제 시 document 행을 먼저 지워야 한다
    folderId: uuid("folder_id").references(() => folder.id),
    title: text("title").notNull().default(""),
    content: text("content").notNull().default(""),
    savedSeq: bigint("saved_seq", { mode: "number" }).notNull().default(0), // TRD §7 seq 가드
    isDeleted: boolean("is_deleted").notNull().default(false),
    isTrashRoot: boolean("is_trash_root").notNull().default(false),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // folder와 동일한 활성-조회 부분 인덱스 관례(NFR-2.2)
    index("document_active_idx").on(table.workspaceId, table.folderId).where(sql`${table.isDeleted} = false`),
  ],
);
```
`bigint`는 folder/folderClosure에 없는 신규 import — `drizzle-orm/pg-core`에서 추가로 import한다. `folder`의 self-FK(`AnyPgColumn`) 패턴은 document에는 불필요(자기참조 없음).

---

### `src/lib/documents.ts` — 신설 (service, CRUD)

**Analog:** `src/lib/closure.ts` 전체(DbClient 패턴, 위 Read 결과 1-67행)

**Imports/DbClient 패턴** (closure.ts 12-22행 그대로 복제):
```typescript
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { document } from "@/db/schema";

type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];
```

**활성-전용 IDOR 헬퍼** — `resolveActiveWorkspaceId`(closure.ts 35-41행)를 그대로 본떠 문서용으로 작성:
```typescript
// getDocument는 workspaceId까지 함께 스코프(RESEARCH Pitfall 6, IDOR)
export async function getDocument(documentId: string, workspaceId: string, client: DbClient = db) {
  const [row] = await client
    .select()
    .from(document)
    .where(and(eq(document.id, documentId), eq(document.workspaceId, workspaceId), eq(document.isDeleted, false)));
  return row ?? null;
}

// PUT 라우트 전용 — 활성 문서만(휴지통에 저장 시도는 거부), workspaceId 없이 id만으로 조회
export async function resolveWorkspaceIdForDocument(documentId: string, client: DbClient = db) {
  const [row] = await client
    .select({ workspaceId: document.workspaceId })
    .from(document)
    .where(and(eq(document.id, documentId), eq(document.isDeleted, false)));
  return row ?? null;
}
```

**createDocument** — `createFolder`(closure.ts 47-67행)와 동형이나 closure 트랜잭션 불필요(document는 closure table 없음):
```typescript
export async function createDocument(workspaceId: string, folderId: string | null, title: string, client: DbClient = db) {
  const [created] = await client.insert(document).values({ workspaceId, folderId, title }).returning();
  return created;
}
```

**softDeleteDocument** — `softDeleteFolder`(closure.ts 144-155행)의 단일-행 버전(cascade 없음, 문서는 리프):
```typescript
export async function softDeleteDocument(documentId: string, client: DbClient = db) {
  await client
    .update(document)
    .set({ isDeleted: true, deletedAt: new Date(), isTrashRoot: true })
    .where(and(eq(document.id, documentId), eq(document.isDeleted, false))); // WR-01 동형 idempotency
}
```

**autosaveDocument (seq 가드)** — RESEARCH Pattern 2(`.returning()` 배열 길이 판정)를 그대로 이식:
```typescript
export async function autosaveDocument(documentId: string, content: string, title: string, seq: number, client: DbClient = db) {
  const rows = await client
    .update(document)
    .set({ content, title, savedSeq: seq, updatedAt: new Date() })
    .where(and(eq(document.id, documentId), lt(document.savedSeq, seq)))
    .returning({ id: document.id });
  return rows.length === 1; // false는 에러가 아니라 stale 요청이 자연 무시된 것(TRD §7)
}
```

---

### `src/lib/closure.ts` 확장 — softDeleteFolder cascade + 휴지통 헬퍼 (service, CRUD/cascade)

**Analog:** 같은 파일의 `softDeleteFolder`/`moveFolder`/`getSubtree`

**Pattern 4 (RESEARCH 인용) — softDeleteFolder에 document cascade 추가:**
```typescript
// 파일 136-138행의 예고 주석("Phase 4 will extend this transaction with
// `document WHERE folder_id = ANY(ids)`")을 그대로 실행 — softDeleteFolder 트랜잭션
// 내부, folder UPDATE 다음 줄에 추가.
await tx
  .update(document)
  .set({ isDeleted: true, deletedAt: new Date() })
  .where(and(inArray(document.folderId, ids), eq(document.isDeleted, false)));
```

**신규 `resolveWorkspaceIdForTrashItem`** — `resolveActiveWorkspaceId`(35-41행)의 정반대(`is_deleted=true` 허용) 버전. **`getSubtree`/`resolveActiveWorkspaceId`를 휴지통 라우트에 재사용하지 말 것**(RESEARCH Pitfall 3 — 두 헬퍼 모두 `is_deleted=false`가 하드코딩돼 있어 항상 빈 결과/403이 난다).

**신규 `restoreFolder`** — RESEARCH Pattern 5를 그대로 채택: 서브트리를 closure 직접 조인으로 읽고(`getSubtree` 재사용 불가), WR-01 대칭으로 "독립 트래시" 항목은 제외, 부모가 삭제 상태면 **기존 `moveFolder(folderId, null, tx)`를 재사용**해 루트 재배치(두 번째 closure 재작성 구현 금지 — Don't Hand-Roll).

**신규 `permanentlyDeleteFolder`** — FK 순서 주의(RESEARCH Pitfall 4): `document.folder_id`에 `ON DELETE CASCADE` 없음. document 행을 먼저 DELETE한 뒤 folder 행을 DELETE(folder_closure는 `ON DELETE CASCADE`로 자동 정리, 수동 삭제 불필요):
```typescript
export async function permanentlyDeleteFolder(folderId: string, client: DbClient = db) {
  return client.transaction(async (tx) => {
    // 서브트리 id 목록은 is_deleted 필터 없이 closure 직접 조인으로 수집(활성/비활성 무관)
    const ids = /* closure join, Pattern 5와 동형 */ [];
    await tx.delete(document).where(inArray(document.folderId, ids)); // 먼저
    await tx.delete(folder).where(inArray(folder.id, ids)); // 그다음(closure는 cascade)
  });
}
```

---

### `src/lib/validation.ts` — `documentSchema` (utility, 입력 검증)

**Analog:** `folderSchema`(38-46행)

```typescript
// TRD §3 title 컬럼 기본값과 동형. content는 CodeMirror 원문 그대로(trim 없음 — 개행/공백이
// 마크다운 의미를 가짐, folderSchema의 trim은 이름 필드 전용이라 title에만 적용).
export const documentSchema = z.object({
  title: z.string().trim().max(255, "제목은 255자를 넘을 수 없습니다.").catch(""),
  content: z.string(),
});

// PUT 자동저장 body 전용(title/content + seq)
export const autosaveBodySchema = documentSchema.extend({
  seq: z.number().int().nonnegative(),
});
```
제목 필수 검증 없음(UI-SPEC "제목 입력 placeholder" 행: 빈 문자열 허용, 04-CONTEXT.md에 필수 언급 없음) — `folderSchema.min(1, ...)`과 달리 `documentSchema.title`은 `min` 없이 빈 문자열 허용.

---

### `src/app/api/documents/route.ts` (POST 생성) — controller, CRUD

**Analog:** `src/app/api/folders/route.ts`(전체)

**Imports + IDOR 패턴** (folders/route.ts 1-4행, 13-17행 주석 그대로 준용):
```typescript
import { z } from "zod";
import { createDocument, resolveWorkspaceIdForDocument } from "@/lib/documents";
import { resolveActiveWorkspaceId } from "@/lib/closure"; // folderId가 있을 때 부모 폴더의 workspaceId 재유도
import { ForbiddenError, forbiddenResponse, requireRole } from "@/lib/rbac";
import { documentSchema } from "@/lib/validation";

export const runtime = "nodejs";

const createDocumentBodySchema = documentSchema.pick({ title: true }).extend({
  folderId: z.uuid().nullable(),
  workspaceId: z.uuid().optional(),
});
```
**핵심 CRUD 패턴** — folders/route.ts의 POST(18-61행)를 그대로 이식: `folderId`가 있으면 `resolveActiveWorkspaceId(folderId)`로 workspaceId 재유도 + 클라 workspaceId 불일치 시 400, `folderId===null`이면 body의 workspaceId를 uuid로 검증해 사용. `requireRole(workspaceId, "EDITOR")` 이후 `createDocument` 호출, 201 응답.

---

### `src/app/api/documents/[id]/route.ts` (GET/PUT/DELETE) — controller, request-response + CRUD

**Analog:** `src/app/api/folders/[id]/route.ts`(PATCH/DELETE 구조), RESEARCH Pattern 2(PUT 본문)

**PUT(자동저장) 전체 예시는 RESEARCH.md "Pattern 2"에 이미 완성돼 있음** — `resolveWorkspaceIdForDocument`로 활성 문서만 허용 → `requireRole(EDITOR)` → `autosaveBodySchema.safeParse` → `autosaveDocument()` 호출 → `Response.json({ seq }, { status: 200 })`(0행 갱신이어도 200, 에러 아님).

**DELETE(소프트삭제)** — folders/route.ts DELETE(45-63행)와 동형, `softDeleteFolder` 대신 `softDeleteDocument` 호출.

**GET** — folders에는 없는 신규지만 `resolveActiveWorkspaceId`+`requireRole(VIEWER)` 패턴은 동일하게 준용(TRD §8 API 표의 GET 엔드포인트, 외부 소비자용 — RSC는 이 라우트를 fetch하지 않는다, Anti-pattern 경고 참조).

---

### `src/app/api/trash/[type]/[id]/restore/route.ts`, `.../route.ts`(완전삭제) — controller

**Analog:** `src/app/api/folders/[id]/move/route.ts`(IDOR 재유도 + 에러 매핑 구조)

핵심 골격(9-53행)을 그대로 따른다: URL의 `id`를 zod `z.uuid()`로 검증 → `resolveWorkspaceIdForTrashItem(type, id)`(신규, `is_deleted` 필터 없음)로 workspaceId 재유도, 없으면 `forbiddenResponse()` → 복원은 `requireRole(EDITOR)`, 완전삭제는 `requireRole(ADMIN)` → `restoreFolder`/`restoreDocument` 또는 `permanentlyDeleteFolder`/`permanentlyDeleteDocument` 호출 → 204. `type`(`folder`|`document`)에 따라 두 서비스 함수 중 분기.

---

### `src/components/document/useAutosave.ts` — 신설 (hook, event-driven)

**Analog:** 없음(신규 클라 프로토콜) — 구조는 RESEARCH.md "Pattern 1"에 완성 코드가 있음(214-280행), 그대로 채택. **AbortController 절대 사용 금지**(NFR-1.2, Anti-pattern 경고). 상태 값 3종(`saving`/`saved`/`error`)의 setState 패턴은 `CreateWorkspaceModal.tsx`의 `submitting`/`error` state(20-32행)와 동일한 관례(useEffect로 open/docId 전환 시 리셋).

---

### `src/components/document/SaveStatusBar.tsx` — 신설 (component)

**Analog:** Phase 3 `.spinner`/`.pending` CSS 관례(`FolderTreeNode.module.css`, `isPending && <span className={styles.spinner} />`, FolderTreeNode.tsx 148행) — 12px 축소판 스피너를 그대로 재사용, 신규 스피너 발명 금지(UI-SPEC "저장 중" 행).

---

### `src/components/document/DocumentWorkspace.tsx` — 신설 (component, container)

**Analog:** `src/components/layout/EditorPreviewLayout.tsx`(전체, 위 Read 결과)

`content` state를 로컬 `useState("")`가 아니라 `initialContent` prop으로 초기화하고, `EditorHost onChange`를 `useAutosave.scheduleSave`에 연결한다. `EditorPreviewLayout` 내부(그리드·Toolbar·EditorHost·PreviewPane 배선)는 건드리지 않고 그대로 감싼다(EditorPreviewLayout.tsx 3-6행 주석이 이미 이 확장을 예고). 제목 `<input>` + `EditorPreviewLayout` + `SaveStatusBar` 3단 세로 배치(UI-SPEC Layout Contract).

---

### `src/app/(main)/w/[wsId]/layout.tsx`, `d/[docId]/page.tsx`, `trash/page.tsx` — 신설 (RSC)

**Analog:** `src/app/(main)/w/[wsId]/page.tsx`(전체, 위 Read 결과) — RESEARCH.md "Pattern 3"에 `layout.tsx`/`d/[docId]/page.tsx` 완성 코드 있음, 그대로 채택. `requireRole(wsId,"VIEWER")` → `ForbiddenError` catch → `notFound()` 패턴을 3개 파일 모두에서 반복(기존 page.tsx 26-31행과 동일 관용구). **Anti-pattern**: RSC가 자기 `/api/documents/:id`를 fetch하지 않는다 — `lib/documents.ts` 함수를 직접 호출(기존 `page.tsx`가 `getWorkspaceFolders`를 직접 호출하는 것과 동형, 36행).

`trash/page.tsx`는 `getTrashItems(wsId)`(신규, folder ∪ document `is_trash_root=true` UNION 또는 두 쿼리 병합)를 호출해 `<TrashList>`에 전달.

---

### `FolderTree.tsx`/`FolderTreeNode.tsx`/`FolderContextMenu.tsx` 확장 (문서 노드)

**Analog:** 자기 자신(기존 폴더 노드 패턴)

- **트리 병합**: `buildTree`(tree-utils.ts)를 제네릭화하지 말 것(Anti-pattern, RESEARCH). 대신 `FolderTreeNodeCtx`에 `documentsByFolderId: Map<string|null, DocumentRow[]>`를 추가(FolderTreeNode.tsx 11-30행 ctx 인터페이스에 필드 추가하는 방식과 동일 관례) — `FolderTreeNode` 렌더 말미에 해당 폴더 소속 문서 리프를 렵.
- **"새 문서" 헤더 버튼**: `FolderTree.tsx`의 `headerButton`(189-196행, `FolderPlus` 아이콘)을 그대로 복제해 `FilePlus2` 아이콘으로 교체, `creatingRoot` 대신 신규 `creatingDocumentRoot` state.
- **문서 컨텍스트 메뉴**: `FolderContextMenu`(전체) 그대로 재사용하되 `menuItems`를 1항목("삭제", `Trash2`)만 전달(FolderTree.tsx 167-183행의 `menuItems` 배열 구성 패턴).
- **문서 리프 노드(`DocumentTreeLeaf.tsx`, 신설)**: `FolderTreeNode.tsx`의 row 렌더 부분(93-149행)에서 `draggable`/DnD 핸들러 전부 제거, 체브론은 항상 `chevronSpace`(hasChildren 분기 없음), 클릭은 `onSelect` 토글이 아니라 `next/link`로 `w/[wsId]/d/[docId]` 즉시 이동(UI-SPEC Tree Node Contract "클릭" 행).
- **인라인 생성 입력**: `CreateInlineRow`(FolderTreeNode.tsx 222-254행)를 문서용으로 복제, `folderSchema` 대신 `documentSchema.pick({title:true})`로 검증, 제출 성공 시 `router.push(`/w/${wsId}/d/${created.id}`)`(Interaction Contract "생성 흐름" — 문서만 유일하게 생성 후 즉시 이동).

---

### `src/components/trash/TrashList.tsx`, `RestoreRootBanner.tsx` — 신설 (component)

**Analog:** `FolderTree.tsx`의 목록/뮤테이션 패턴(submitDelete류 async 함수 + `router.refresh()` + `ConfirmDialog` 재사용)

- 복원 클릭: `FolderTree.tsx`의 `moveFolderTo`(107-121행)와 동형 — `fetch` → 실패 시 인라인 에러, 성공 시 `router.refresh()`. 확인 다이얼로그 없음(UI-SPEC "복원 클릭" 행, 가역적이라 마찰 불필요 — `confirmDelete`류 패턴 생략).
- 완전삭제 클릭: `FolderTree.tsx`의 `deleteTarget`/`confirmDelete`(49-51행, 123-135행) + `ConfirmDialog`(전체, `destructive` prop) 그대로 재사용.
- 권한 게이팅(비활성 버튼+안내): 새 패턴, 기존 코드베이스에 선례 없음 — UI-SPEC Trash Contract "권한 게이팅" 행의 문구를 그대로 사용, `disabled` + 인접 `<span>` 안내 텍스트.

---

## Shared Patterns

### 서버 전용 RBAC + IDOR 재유도
**Source:** `src/lib/closure.ts`의 `resolveActiveWorkspaceId`(35-41행), `src/app/api/folders/[id]/route.ts`(전체), `src/app/api/folders/route.ts`(13-17행 주석)
**Apply to:** 모든 documents/trash API 라우트
```typescript
const target = await resolveWorkspaceIdForDocument(id); // 또는 트래시용 비활성-허용 버전
if (!target) return forbiddenResponse();
try {
  await requireRole(target.workspaceId, "EDITOR");
} catch (err) {
  if (err instanceof ForbiddenError) return forbiddenResponse();
  throw err;
}
```
클라이언트가 보낸 `workspaceId`는 인가에 절대 사용하지 않는다 — URL의 `id`(document/folder)에서 서버가 재유도한 값만 신뢰(`req.body.workspaceId`는 생성 시 부모 폴더 유도값과의 불일치 검사에만 사용, folders/route.ts 41행).

### zod 안전 파싱 + 400 에러 응답
**Source:** `src/app/api/folders/route.ts`(26-32행), 모든 folders 라우트 반복
**Apply to:** documents/trash 라우트 body 검증 전부
```typescript
const parsed = schema.safeParse(body);
if (!parsed.success) {
  return Response.json({ error: parsed.error.issues[0]?.message ?? "잘못된 요청입니다." }, { status: 400 });
}
```

### DbClient 주입 + 트랜잭션(cascade 연산)
**Source:** `src/lib/closure.ts` 12-22행 타입 정의, `softDeleteFolder`/`moveFolder`의 `client.transaction(async (tx) => {...})` 패턴
**Apply to:** `lib/documents.ts`, `lib/closure.ts` 확장 함수 전부(테스트 주입 + 트랜잭션 내부 일관성)

### 클라 뮤테이션 submitting/error state
**Source:** `src/components/workspace/CreateWorkspaceModal.tsx`(20-32행), `src/components/tree/FolderTree.tsx`(submitCreate/submitRename/confirmDelete)
**Apply to:** 새 문서 생성 인라인 입력, 휴지통 복원/완전삭제 버튼 — `fetch` → 실패 시 인라인 `{동작}하지 못했어요. 다시 시도해 주세요.` 텍스트, 성공 시 `router.refresh()`(낙관적 UI 없음, 04-CONTEXT.md 원칙 승계).

### ConfirmDialog 재사용(비가역 액션)
**Source:** `src/components/ui/ConfirmDialog.tsx`(전체)
**Apply to:** 문서 소프트삭제 확인, 휴지통 완전삭제 확인(`destructive` prop) — 신규 다이얼로그 컴포넌트 만들지 않는다.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/components/document/EmptyState.tsx` | component | — | 단순 카피 전용 컴포넌트, 참조할 만한 기존 "빈 상태" 컴포넌트가 별도 파일로 분리돼 있지 않음(Phase 3는 FolderTree.tsx 209-215행에 인라인으로만 존재) — UI-SPEC Copywriting Contract 문구만 따르면 충분 |
| 휴지통 권한 게이팅 안내(disabled+텍스트) | UI 패턴 | — | 코드베이스에 "비활성+설명" 조합의 선례가 아직 없음(Phase 1-3은 버튼 자체를 숨기거나 항상 노출) — UI-SPEC 문구를 그대로 구현 |

## Metadata

**Analog search scope:** `src/lib/`, `src/app/api/folders/`, `src/app/(main)/w/`, `src/components/{layout,editor,tree,ui,workspace}/`, `src/db/schema.ts`
**Files scanned:** 13 (직접 Read) + CONTEXT/RESEARCH/UI-SPEC 3
**Pattern extraction date:** 2026-08-08
