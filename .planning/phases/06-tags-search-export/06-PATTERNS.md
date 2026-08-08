# Phase 6: Tags, Search & Export - Pattern Map

**Mapped:** 2026-08-08
**Files analyzed:** 14 (신규 11 + 기존 수정 3)
**Analogs found:** 12 / 14

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/db/schema.ts` (document_tag 추가) | model | CRUD | `documentDraft` 테이블(schema.ts:124-130) | exact |
| `drizzle/0005_*.sql` (custom, pg_trgm+GIN+백필) | migration | batch | `drizzle/0003_*.sql`/`0004_*.sql`(generate 산출물, 문체 참고용) | role-match(수기 작성) |
| `src/lib/documents.ts`(`replaceTags`/`getTags`/`TagLimitError` 추가) | service | CRUD | `closure.ts`의 `softDeleteFolder`(트랜잭션+throw=롤백) | exact |
| `src/lib/search.ts`(신규, `normalizeNFC`/`searchWorkspace`) | service | request-response | `closure.ts`의 `getWorkspaceFolders`(flat 조회, DbClient 주입) | role-match |
| `src/lib/export.ts`(신규, `sanitizeZipSegment`/`buildZipEntries`) | service | file-I/O | `closure.ts`의 `getSubtree`(서브트리 조회 재사용) + 순수 헬퍼는 `validation.ts`의 `normalizeEmail` | role-match |
| `src/lib/validation.ts`(`tagsBodySchema` 추가, `documentSchema`에 NFC transform) | utility | transform | 기존 `documentSchema`/`folderSchema`(zod, 동일 파일) | exact |
| `src/app/api/documents/[id]/tags/route.ts`(PUT) | route | CRUD | `src/app/api/documents/[id]/route.ts`(PUT autosave — 4단계 IDOR shape) | exact |
| `src/app/api/documents/[id]/export/route.ts`(GET) | route | streaming/file-I/O | `src/app/api/documents/[id]/route.ts`(DELETE — IDOR shape, VIEWER 레벨만 다름) | exact |
| `src/app/api/folders/[id]/export/route.ts`(GET, archiver zip) | route | streaming | `src/app/api/folders/[id]/route.ts`류(IDOR shape) + RESEARCH Pattern 3(신규 스트리밍 로직) | role-match |
| `src/app/api/workspaces/[id]/search/route.ts`(GET) | route | request-response | `src/app/api/workspaces/[id]/route.ts`(GET, wsId 검증+requireRole) | exact |
| `src/components/document/TagBar.tsx`(신규) | component | CRUD | `DocumentTreeLeaf.tsx`류의 인라인 입력 패턴 + `FolderTree.tsx`의 `CreateDocumentRootInput`(chip형 인라인 입력의 상태 관리) | role-match |
| `src/components/tree/SearchBox.tsx`(신규) | component | request-response | `FolderTree.tsx`의 fetch→상태 갱신 패턴(`submitCreate` 류) | role-match |
| `src/components/tree/FolderTree.tsx`(export 메뉴 항목 추가) | component | event-driven | 기존 `menuItems`/`docMenuItems` 배열(FolderTree.tsx:251-280) | exact |
| `src/components/document/DocumentWorkspace.tsx`(TagBar 마운트) | component | CRUD | 기존 `titleRow`→`body` 사이 삽입 지점(DocumentWorkspace.tsx:105-117) | exact |

## Pattern Assignments

### `src/db/schema.ts` — `document_tag` 테이블 추가

**Analog:** `documentDraft`(1:N 아닌 PK 조합형은 `workspaceMember`의 복합 PK 패턴과 결합)

**기존 관례** (`src/db/schema.ts:124-130`, `documentDraft`):
```typescript
export const documentDraft = pgTable("document_draft", {
  documentId: uuid("document_id")
    .primaryKey()
    .references(() => document.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

**복합 PK 관례** (`workspaceMember`, `src/db/schema.ts:32-48`):
```typescript
export const workspaceMember = pgTable(
  "workspace_member",
  { workspaceId: uuid(...).references(() => workspace.id, { onDelete: "cascade" }), ... },
  (table) => [primaryKey({ columns: [table.workspaceId, table.userId] }), ...],
);
```

**적용:** `document_tag`는 `(document_id, tag)` 복합 PK — `documentDraft`의 FK+cascade 패턴과 `workspaceMember`의 `primaryKey({ columns: [...] })` 패턴을 결합:
```typescript
export const documentTag = pgTable(
  "document_tag",
  {
    documentId: uuid("document_id").notNull().references(() => document.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
  },
  (table) => [primaryKey({ columns: [table.documentId, table.tag] })],
);
```
`schema.ts:96` 주석 "document_tag 인덱스는 Phase 6"을 이 파일이 해소한다. pg_trgm GIN 인덱스는 drizzle DSL에 넣지 않는다(RESEARCH Pitfall 2 — custom SQL로만 작성, 다음 `generate` 실행 시 DROP 시도 방지).

---

### `drizzle/0005_*.sql` — custom SQL 마이그레이션

**Analog:** `drizzle/0003_petite_susan_delgado.sql`(documentDraft 생성분, `CREATE TABLE`+FK 문체), `drizzle/0004_high_roulette.sql`(GIN 인덱스 문체: `CREATE INDEX ... USING btree (...) WHERE ...`)

**절차:** `pnpm drizzle-kit generate --custom`으로 빈 SQL 파일 생성 → 손으로 작성. 기존 마이그레이션 파일의 문체(각 statement 뒤 `--> statement-breakpoint`, 큰따옴표 identifier)를 그대로 따른다:
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX "document_title_trgm_idx" ON "document" USING gin ("title" gin_trgm_ops) WHERE "document"."is_deleted" = false;
--> statement-breakpoint
CREATE INDEX "document_content_trgm_idx" ON "document" USING gin ("content" gin_trgm_ops) WHERE "document"."is_deleted" = false;
--> statement-breakpoint
UPDATE document SET title = normalize(title, NFC), content = normalize(content, NFC)
  WHERE title IS DISTINCT FROM normalize(title, NFC) OR content IS DISTINCT FROM normalize(content, NFC);
```
마이그레이션 적용 후 `\d document`(psql)로 `gin_trgm_ops`가 실제 포함됐는지 수동 확인(RESEARCH Wave 0 Gaps 마지막 항목).

---

### `src/lib/documents.ts` — `replaceTags`/`getTags`/`TagLimitError` 추가

**Analog:** `src/lib/closure.ts`의 `softDeleteFolder`(트랜잭션 내 throw=자동 롤백 관례, closure.ts:145-164) — 이 phase RESEARCH Pattern 1이 이미 구체 코드를 제공했으므로 그대로 채택.

**기존 트랜잭션+throw 관례** (`closure.ts:145-164`, 구조만 발췌):
```typescript
export async function softDeleteFolder(folderId: string, client: DbClient = db) {
  return client.transaction(async (tx) => {
    const [target] = await tx.select(...).from(folder).where(...);
    if (!target || target.isDeleted) return; // idempotent 가드
    // ... UPDATE 여러 번, 실패 조건이면 throw 하지 않고 사전 반환하는 대신
  });
}
```

**적용할 코드**(RESEARCH Pattern 1 확정본, `documents.ts` 최상단 `DbClient` 타입·import 재사용):
```typescript
export class TagLimitError extends Error {}

export async function replaceTags(documentId: string, rawTags: string[], client: DbClient = db) {
  return client.transaction(async (tx) => {
    await tx.delete(documentTag).where(eq(documentTag.documentId, documentId));
    const seen = new Map<string, string>();
    for (const raw of rawTags) {
      const norm = raw.trim().normalize("NFC");
      if (!norm) continue;
      const key = norm.toLowerCase();
      if (!seen.has(key)) seen.set(key, norm);
    }
    const tags = [...seen.values()];
    if (tags.length > 0) {
      await tx.insert(documentTag).values(tags.map((tag) => ({ documentId, tag })));
    }
    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(documentTag)
      .where(eq(documentTag.documentId, documentId));
    if (count > 3) throw new TagLimitError("태그는 최대 3개까지 저장할 수 있습니다.");
    return tags;
  });
}

export async function getTags(documentId: string, client: DbClient = db) {
  return client.select({ tag: documentTag.tag }).from(documentTag).where(eq(documentTag.documentId, documentId));
}
```
`import { sql } from "drizzle-orm"`, `import { documentTag } from "@/db/schema"` 추가 필요(기존 `import { document, documentDraft, folder } from "@/db/schema"` 확장).

---

### `src/lib/validation.ts` — `tagsBodySchema` + NFC transform

**Analog:** 같은 파일의 `documentSchema`(validation.ts:55-58), `autosaveBodySchema`(63-65)

**기존 관례:**
```typescript
export const documentSchema = z.object({
  title: z.string().trim().max(255, "제목은 255자를 넘을 수 없습니다."),
  content: z.string(),
});
export const autosaveBodySchema = documentSchema.extend({
  seq: z.number().int().nonnegative(),
});
```

**적용**(RESEARCH Pattern 2):
```typescript
export function normalizeNFC(text: string): string {
  return text.normalize("NFC");
}

export const documentSchema = z.object({
  title: z.string().trim().max(255, "제목은 255자를 넘을 수 없습니다.").transform(normalizeNFC),
  content: z.string().transform(normalizeNFC), // trim 없음 유지 — NFR-5.2
});

export const tagsBodySchema = z.object({
  tags: z.array(z.string().trim().min(1)).max(3, "태그는 최대 3개까지 저장할 수 있습니다."),
});
export type TagsBodyInput = z.infer<typeof tagsBodySchema>;
```
`documentSchema`/`autosaveBodySchema`는 `documents/[id]/route.ts`의 autosave PUT과 문서 생성 POST 양쪽에서 이미 쓰이므로, transform 추가는 기존 두 라우트 모두에 자동 적용된다(파일 수정 없이 전파).

---

### `src/app/api/documents/[id]/tags/route.ts` (PUT, EDITOR)

**Analog:** `src/app/api/documents/[id]/route.ts`의 PUT(autosave, route.ts:14-56) — 4단계 IDOR shape(uuid 검증 → `resolveWorkspaceIdForDocument` → `requireRole` → zod parse) 그대로 복제.

**Imports 패턴**(route.ts:1-4):
```typescript
import { z } from "zod";
import { autosaveDocument, deleteDraft, resolveWorkspaceIdForDocument, softDeleteDocument } from "@/lib/documents";
import { ForbiddenError, forbiddenResponse, requireRole } from "@/lib/rbac";
import { autosaveBodySchema } from "@/lib/validation";
```

**IDOR+RBAC 4단계**(route.ts:15-30, 그대로 복제하되 `requireRole`을 `"EDITOR"`로):
```typescript
const { id } = await context.params;
if (!z.uuid().safeParse(id).success) return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
const target = await resolveWorkspaceIdForDocument(id);
if (!target) return forbiddenResponse();
try {
  await requireRole(target.workspaceId, "EDITOR");
} catch (err) {
  if (err instanceof ForbiddenError) return forbiddenResponse();
  throw err;
}
```

**에러 처리**(RESEARCH Code Example, `TagLimitError`→400 매핑은 이 phase 신규지만 형태는 기존 zod 400 처리와 동형):
```typescript
try {
  const tags = await replaceTags(id, parsed.data.tags);
  return Response.json({ tags }, { status: 200 });
} catch (err) {
  if (err instanceof TagLimitError) return Response.json({ error: err.message }, { status: 400 });
  throw err;
}
```

---

### `src/app/api/documents/[id]/export/route.ts` (GET, VIEWER)

**Analog:** 같은 파일 `src/app/api/documents/[id]/route.ts`의 DELETE(route.ts:65-83) — GET이 없는 이 파일에 형제 파일로 신설, IDOR shape 동일(단 `requireRole` 레벨만 `VIEWER`).

**핵심 패턴**(RESEARCH Code Example, 원문 그대로 채택 — 파이프라인 미경유):
```typescript
export const runtime = "nodejs";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  const target = await resolveWorkspaceIdForDocument(id);
  if (!target) return forbiddenResponse();
  try {
    await requireRole(target.workspaceId, "VIEWER");
  } catch (err) {
    if (err instanceof ForbiddenError) return forbiddenResponse();
    throw err;
  }
  const doc = await getDocument(id, target.workspaceId);
  if (!doc) return forbiddenResponse();
  const filename = `${doc.title}.md`;
  const asciiSafe = filename.replace(/[^\x20-\x7E]/g, "_");
  return new Response(doc.content, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${asciiSafe}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
```
**주의(CLAUDE.md 불변식):** `doc.content`를 `lib/markdown`에 절대 통과시키지 않는다 — 원문 그대로 Response body.

---

### `src/app/api/folders/[id]/export/route.ts` (GET, VIEWER, archiver zip)

**Analog:** IDOR shape은 위와 동일(`resolveActiveWorkspaceId` from `closure.ts` 사용). 스트리밍 부분은 기존 코드베이스에 분석적 유사 파일 없음 — RESEARCH Pattern 3/4를 그대로 채택(No Analog 섹션 참조).

**서브트리 조회 재사용**(`closure.ts:73-84`, `getSubtree`):
```typescript
export async function getSubtree(folderId: string, client: DbClient = db) {
  return client
    .select({ id: folder.id, parentId: folder.parentId, name: folder.name, workspaceId: folder.workspaceId })
    .from(folder)
    .innerJoin(folderClosure, eq(folderClosure.descendantId, folder.id))
    .where(and(eq(folderClosure.ancestorId, folderId), eq(folder.isDeleted, false)));
}
```
`buildZipEntries`(신규, `src/lib/export.ts`)는 이 `getSubtree` 결과 + `document WHERE folder_id = ANY(ids)`(closure.ts:159-162의 조회 패턴과 동형)로 구성한다.

**스트리밍 어댑터**(RESEARCH Pattern 3, 그대로 채택):
```typescript
export const runtime = "nodejs";
const archive = archiver("zip", { zlib: { level: 9 } });
const entries = await buildZipEntries(folderId);
for (const entry of entries) archive.append(entry.content, { name: entry.zipPath });
archive.finalize();
const webStream = Readable.toWeb(archive) as ReadableStream;
return new Response(webStream, { headers: { "Content-Type": "application/zip", "Content-Disposition": ... } });
```

---

### `src/app/api/workspaces/[id]/search/route.ts` (GET, VIEWER)

**Analog:** `src/app/api/workspaces/[id]/route.ts`(GET, wsId 검증+`requireRole`) — 동일 IDOR shape이나 wsId가 URL에 직접 있으므로 `resolveWorkspaceIdForDocument` 단계가 없다(1단계 적음).

**패턴**(RESEARCH Architecture Diagram [검색] 섹션 그대로):
```typescript
const { id: wsId } = await context.params;
if (!z.uuid().safeParse(wsId).success) return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
try {
  await requireRole(wsId, "VIEWER");
} catch (err) {
  if (err instanceof ForbiddenError) return forbiddenResponse();
  throw err;
}
const q = new URL(req.url).searchParams.get("q") ?? "";
const results = await searchWorkspace(wsId, normalizeNFC(q.trim()));
return Response.json({ results });
```
`searchWorkspace`(신규 `src/lib/search.ts`)는 Drizzle `sql` 템플릿 파라미터 바인딩(RESEARCH Pattern 2 SQL 발췌) 사용 — 문자열 결합 금지.

---

### `src/components/document/TagBar.tsx` (신규)

**Analog:** `FolderTree.tsx`의 `CreateDocumentRootInput`(인라인 입력+Enter 제출+validation, FolderTree.tsx:444-480)의 상태 관리 형태 + `DocumentWorkspace.tsx`의 "즉시 로컬 갱신+백그라운드 저장" 패턴(titleInput의 `handleTitleChange`, DocumentWorkspace.tsx:77-81).

**참고할 로컬 상태+즉시 반영 패턴**(DocumentWorkspace.tsx:77-81):
```typescript
function handleTitleChange(event: ChangeEvent<HTMLInputElement>) {
  const next = event.target.value;
  setTitle(next);
  scheduleSave(contentRef.current, next);
}
```
TagBar는 이 형태를 따르되 debounce 없이 Enter/comma/X 시점에 즉시 `PUT /api/documents/:id/tags` 호출(UI-SPEC "태그 추가/제거 → 서버 반영" 행). 실패 시 로컬 chip 상태를 되돌리는 로직은 `FolderTree.tsx`의 `confirmDeleteDocument`류 실패 처리(`if (!res.ok) { setError(...); return; }`)와 동일 원칙.

**마운트 지점**(`DocumentWorkspace.tsx:105-117`, `titleRow`와 `body` 사이):
```tsx
<div className={styles.titleRow}>...</div>
{/* 신규: <TagBar documentId={docId} initialTags={initialTags} /> */}
<div className={styles.body}>...</div>
```

---

### `src/components/tree/SearchBox.tsx` (신규)

**Analog:** `FolderTree.tsx`의 fetch→상태 갱신 함수들(`submitCreate` 등, FolderTree.tsx:96-115) — fetch 후 `!res.ok` 분기로 에러 상태 세팅하는 관례. debounce는 신규 로직(No Analog).

**마운트 지점**(`FolderTree.tsx:282-304`, `.header` 바로 위):
```tsx
<nav className={styles.sidebar} aria-label="폴더 트리">
  {/* 신규: <SearchBox workspaceId={workspaceId} onResults={setSearchResults} /> */}
  <div className={styles.header}>...</div>
  <div className={styles.tree}>
    {/* searchActive ? <SearchResults .../> : 기존 tree.map(...) */}
  </div>
```
레이스 컨디션 가드(UI-SPEC "요청 경합" 행)는 `useAutosave`의 seq 가드와 같은 원칙 — 최신 요청의 응답만 반영(요청 시퀀스 번호 또는 AbortController로 이전 요청 무시).

---

### `src/components/tree/FolderTree.tsx` (export 메뉴 항목 추가)

**Analog:** 같은 파일의 `menuItems`/`docMenuItems` 배열(FolderTree.tsx:251-280) — 항목 추가만, 컴포넌트 구조 무변경.

**기존 배열 패턴**(FolderTree.tsx:271-280, 문서 메뉴):
```typescript
const docMenuItems: FolderMenuItem[] = docMenu
  ? [
      { label: "삭제", icon: Trash2, destructive: true, onClick: () => setDocDeleteTarget(...) },
    ]
  : [];
```
**적용**(UI-SPEC 잠금 순서: export 항목은 "삭제" 앞):
```typescript
const docMenuItems: FolderMenuItem[] = docMenu
  ? [
      { label: ".md 내보내기", icon: Download, onClick: () => exportDocument(docMenu.docId, docMenu.docTitle) },
      { label: "삭제", icon: Trash2, destructive: true, onClick: () => setDocDeleteTarget(...) },
    ]
  : [];
```
폴더 메뉴는 "이동..." 다음, "삭제" 앞에 `{ label: ".zip 내보내기", icon: FolderDown, onClick: ... }` 삽입(menuItems 배열, FolderTree.tsx:251-266).

**다운로드 트리거**(UI-SPEC "클릭 동작", blob+숨김 `<a>` — 신규 순수 함수, `discardDraft`(DocumentWorkspace.tsx:24-31)와 동형의 "fetch 결과를 boolean/blob으로 추출하는 순수 함수, 컴포넌트 밖에서 export"):
```typescript
export async function downloadExport(url: string, fallbackFilename: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fallbackFilename;
    a.click();
    URL.revokeObjectURL(a.href);
    return true;
  } catch {
    return false;
  }
}
```

## Shared Patterns

### 서버 전용 RBAC + IDOR 4단계
**Source:** `src/lib/rbac.ts`(`requireRole`, `ForbiddenError`, `forbiddenResponse`, UUID_RE fail-closed 가드) + `src/lib/documents.ts`(`resolveWorkspaceIdForDocument`) / `src/lib/closure.ts`(`resolveActiveWorkspaceId`)
**Apply to:** 태그 PUT(EDITOR), export GET 2종(VIEWER), 검색 GET(VIEWER) — 전부 동일 4단계: `z.uuid()` 검증 → workspaceId 서버 재유도 → `requireRole` → 로직. 클라이언트가 보낸 workspaceId는 절대 신뢰하지 않는다.
```typescript
if (!z.uuid().safeParse(id).success) return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
const target = await resolveWorkspaceIdForDocument(id); // 또는 wsId 직접 검증(검색 라우트)
if (!target) return forbiddenResponse();
try { await requireRole(target.workspaceId, "EDITOR"); }
catch (err) { if (err instanceof ForbiddenError) return forbiddenResponse(); throw err; }
```

### 트랜잭션 내 throw = 자동 롤백
**Source:** `src/lib/closure.ts`(`softDeleteFolder`, `moveFolder`) — DELETE→INSERT→검증→조건부 throw를 하나의 `client.transaction(async (tx) => {...})` 콜백 안에서 수행하는 관례. `replaceTags`가 그대로 재사용(RESEARCH Pitfall 4 경고: COUNT 검증을 트랜잭션 밖에서 하면 롤백 불가).

### DbClient 주입(테스트 격리 + 트랜잭션 합성)
**Source:** `src/lib/closure.ts:18`, `src/lib/documents.ts:8` — 두 파일이 동일한 유니온 타입 별칭을 정의(`typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]`). 신규 `src/lib/search.ts`/`src/lib/export.ts`도 동일 타입을 재사용(파일마다 재정의하지 말고 import 고려 — 현재 코드베이스는 파일마다 재선언하는 관례이므로 이를 따른다).

### zod 400 응답 형태
**Source:** 모든 기존 라우트 공통(`documents/[id]/route.ts`): `Response.json({ error: parsed.error.issues[0]?.message ?? "잘못된 요청입니다." }, { status: 400 })`. `tagsBodySchema` 실패 시에도 동일 형태.

### CSS Modules + ui-kit 토큰(다크 자동 대응)
**Source:** `src/components/document/DocumentWorkspace.module.css`(`titleRow`의 `var(--border)`/`var(--accent)` focus-within 패턴), `src/components/ui/Input.tsx`/`Button.tsx`(ui-kit 이식 원칙, 신규 값 최소화). TagBar/SearchBox 모두 이 관례로 순수 `var(--token)` 참조만 사용, 별도 다크 CSS 없음.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/lib/export.ts`(`sanitizeZipSegment`, `buildZipEntries`, archiver 스트리밍 어댑터) | service | file-I/O | 코드베이스에 zip/스트리밍 선례 없음 — RESEARCH Pattern 3/4(archiver→`Readable.toWeb()`, zip-slip sanitize)를 원천으로 사용 |
| `src/lib/search.ts`(NFC 헬퍼 자체, trigram ILIKE 쿼리) | service | request-response | 코드베이스에 전문검색/trigram 쿼리 선례 없음 — RESEARCH Pattern 2(NFC 쓰기+질의 이중 정규화)를 원천으로 사용. `normalizeEmail`(validation.ts:7-9)이 "trim+정규화 순수 헬퍼"라는 코드 스타일의 유일한 근접 선례 |

## Metadata

**Analog search scope:** `src/db/schema.ts`, `src/lib/{documents,closure,rbac,validation}.ts`, `src/app/api/documents/[id]/route.ts`, `src/app/api/workspaces/[id]/route.ts`, `drizzle/*.sql`, `src/components/{document,tree}/*`, `src/components/ui/{Input,Button}.tsx`
**Files scanned:** 14
**Pattern extraction date:** 2026-08-08
