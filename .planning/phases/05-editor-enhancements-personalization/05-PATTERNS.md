# Phase 5: Editor Enhancements & Personalization - Pattern Map

**Mapped:** 2026-08-08
**Files analyzed:** 15
**Analogs found:** 15 / 15

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/db/schema.ts` (+`documentDraft` table) | model | CRUD | `src/db/schema.ts` (`document` table, 위 발췌) | exact |
| `drizzle/` 신규 마이그레이션 | migration | batch | 기존 drizzle-kit 산출물(명령 실행, 손편집 없음) | exact |
| `src/lib/storage.ts` | utility | file-I/O | 없음(신규 관심사) — RESEARCH Code Examples가 유일한 원천 | no-analog(리서치로 대체) |
| `src/app/api/uploads/route.ts` | route | request-response | `src/app/api/documents/[id]/route.ts` (PUT) | role-match |
| `src/app/api/documents/[id]/draft/route.ts` (PUT/DELETE) | route | CRUD | `src/app/api/documents/[id]/route.ts` (PUT/DELETE) | exact |
| `src/lib/documents.ts` (+`upsertDraft`/`getDraft`/`deleteDraft`) | service | CRUD | `src/lib/documents.ts` (`autosaveDocument`/`softDeleteDocument`, 같은 파일 확장) | exact |
| `src/lib/validation.ts` (+`draftBodySchema`) | utility | transform | `src/lib/validation.ts` (`autosaveBodySchema`) | exact |
| `src/components/document/draft-controller.ts` | utility | event-driven | `src/components/document/autosave-controller.ts` | exact |
| `src/components/document/useDraft.ts` | hook | event-driven | `src/components/document/useAutosave.ts` | exact |
| `src/components/document/DraftRecoveryDialog.tsx` | component | request-response | `src/components/ui/ConfirmDialog.tsx` | exact |
| `src/components/editor/useImageUpload.ts` | hook | file-I/O | `src/components/document/useAutosave.ts`(fetch 래핑 관례) + RESEARCH Pattern 1/2 | role-match |
| `src/components/editor/ImageDropzone.tsx` | component | event-driven | 신규(UI-SPEC 오버레이 계약 참조) | no-analog(UI-SPEC로 대체) |
| `src/components/editor/UploadErrorBanner.tsx` | component | request-response | Phase 4 배너류(`SaveStatusBar` 에러 상태) | role-match |
| `src/components/editor/Toolbar.tsx` (MODIFIED) | component | event-driven | 자기 자신(현재 버전) | exact |
| `src/components/editor/Toolbar.module.css` (MODIFIED) | config | — | 자기 자신 + UI-SPEC CSS 전문 | exact |
| `src/components/editor/plugins/image.ts` | component(plugin) | transform | 자기 자신(변경 없음, run(state) 계약 유지) | exact |
| `src/components/layout/EditorPreviewLayout.tsx` (MODIFIED) | component | event-driven | 자기 자신(현재 버전) + `EditorHost.tsx`의 forwardRef 패턴 | exact |
| `src/components/document/DocumentWorkspace.tsx` (MODIFIED) | component | event-driven | 자기 자신(현재 버전) | exact |
| `src/components/layout/LayoutModeToggle.tsx` | component | event-driven | 사이드바 헤더 버튼류(트리 "새 폴더" 버튼) | role-match |
| `src/components/layout/ThemeToggle.tsx` | component | event-driven | 사이드바 "휴지통" 고정 행(Phase 4) | role-match |
| `src/app/globals.css` (+`[data-theme="dark"]`) | config | — | 자기 자신(`:root` 블록) | exact |
| `src/app/(main)/w/[wsId]/layout.tsx` (MODIFIED, cookies 읽기) | provider | request-response | 자기 자신(현재 버전, `requireRole` 동적 렌더링 이미 존재) | exact |
| 리사이즈 핸들(EditorPreviewLayout 내부) | component | event-driven | 신규(네이티브 DOM 이벤트) — RESEARCH Pattern 7 코드가 유일한 원천 | no-analog(리서치로 대체) |

## Pattern Assignments

### `src/db/schema.ts` (+`documentDraft`)

**Analog:** `src/db/schema.ts`의 `document` 테이블 정의 (94-120행)

**핵심 패턴 (그대로 이식):**
```ts
export const document = pgTable(
  "document",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspace.id, { onDelete: "cascade" }),
    ...
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("document_active_idx").on(table.workspaceId, table.folderId).where(sql`${table.isDeleted} = false`),
  ],
);
```
TRD §3이 `document_draft`를 `document_id`(uuid, PK — `references(() => document.id, { onDelete: "cascade" })`), `content`(text), `updated_at`(timestamptz)로 확정했다. **문서당 1행**이 불변식이므로 별도 `id` 서러게이트 키를 만들지 않고 `document_id` 자체를 PK로 둔다(위 `document` 테이블처럼 `defaultRandom()` uuid PK를 새로 발명하지 않는다 — draft는 document의 종속 엔티티). 인덱스는 불필요(PK 조회만).

---

### `src/lib/storage.ts`

**Analog:** 없음(코드베이스에 파일 I/O 서비스가 처음 등장) — RESEARCH.md "Code Examples: 이미지 업로드 — storage 모듈" 섹션(414-458행)이 완성된 구현을 이미 제공한다. **그대로 채용**한다: `saveUpload(file: File): Promise<{url}|{error}>` 단일 export, 매직바이트 스니핑(png/jpeg/gif/webp) → uuid 파일명 → `public/uploads/`에 write. Pitfall 1(File.type 미신뢰)·Pitfall 3(크기 체크 먼저) 순서를 반드시 지킨다.

**구조적 유사점:** `src/lib/documents.ts`처럼 "이 파일 하나가 하나의 관심사를 완전히 캡슐화"하는 관례(TRD §8 "storage 모듈 하나에 격리")를 따른다 — 함수 시그니처만 신규.

---

### `src/app/api/uploads/route.ts`

**Analog:** `src/app/api/documents/[id]/route.ts` PUT 핸들러 (14-49행)

**Imports + runtime 패턴:**
```ts
import { ForbiddenError, forbiddenResponse, requireRole } from "@/lib/rbac";
export const runtime = "nodejs"; // Pitfall 4: fs 접근 필수, documents/[id]/route.ts:6과 동일 관례
```

**Auth 패턴 (그대로 복제, 12-30행 구조):**
```ts
try {
  await requireRole(wsId, "EDITOR");
} catch (err) {
  if (err instanceof ForbiddenError) return forbiddenResponse();
  throw err;
}
```
이 라우트는 `documents/[id]/route.ts`처럼 URL 파라미터에서 document id로 workspace를 역산하는 게 아니라, **쿼리스트링 `wsId`를 직접 받는다**(업로드는 문서에 종속되지 않는 독립 리소스). `requireRole`의 `UUID_RE` fail-closed 가드(rbac.ts:15,42)가 `wsId="1"` 같은 스푸핑을 이미 막으므로 별도 uuid zod 검증을 라우트에서 중복할 필요는 선택.

**Body 파싱 + 에러 응답 패턴:** RESEARCH Code Examples(462-497행)의 완성 코드를 그대로 채용 — `formData()` → `File` 타입가드 → `saveUpload()` → 결과에 따라 400/200. `documents/[id]/route.ts`의 "zod safeParse 실패 시 첫 메시지를 400으로" 관례(38-44행)와 동형으로, `storage.ts`의 `{error: "TOO_LARGE"|"BAD_TYPE"}` union을 UI-SPEC Copywriting Contract 문구로 매핑한다.

---

### `src/app/api/documents/[id]/draft/route.ts` (PUT/DELETE)

**Analog:** `src/app/api/documents/[id]/route.ts` 전체 (PUT 14-49행, DELETE 58-76행)

**핵심: uuid 검증 → IDOR 방지 워크스페이스 역산 → requireRole → 본문 검증 → 서비스 호출**, 4단 구조를 그대로 복제한다.
```ts
export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  const target = await resolveWorkspaceIdForDocument(id);
  if (!target) return forbiddenResponse();
  try { await requireRole(target.workspaceId, "EDITOR"); }
  catch (err) { if (err instanceof ForbiddenError) return forbiddenResponse(); throw err; }
  const parsed = draftBodySchema.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "잘못된 요청입니다." }, { status: 400 });
  await upsertDraft(id, parsed.data.content);
  return Response.json({}, { status: 200 });
}
```
`resolveWorkspaceIdForDocument`를 재사용(신규 함수 아님, `src/lib/documents.ts:36-46`) — draft도 활성 문서에만 붙는다는 원칙이 그대로 적용된다. DELETE는 body 없이 `deleteDraft(id)` 호출로 DELETE 핸들러(58-76행)를 그대로 축소 복제.

**GET은 만들지 않는다** — `documents/[id]/route.ts`의 "GET is deliberately absent" 주석(12-13행)과 동일 이유: draft 비교는 RSC(`d/[docId]/page.tsx`)가 `getDraft()`를 직접 호출한다(Pitfall 7).

---

### `src/lib/documents.ts` (+`upsertDraft`/`getDraft`/`deleteDraft`)

**Analog:** 같은 파일의 `autosaveDocument`(110-123행) + `restoreDocument`의 트랜잭션 관례

**Core upsert 패턴:**
```ts
// document_draft PK가 document_id 자체 — drizzle onConflictDoUpdate로 upsert
export async function upsertDraft(documentId: string, content: string, client: DbClient = db) {
  await client
    .insert(documentDraft)
    .values({ documentId, content, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: documentDraft.documentId,
      set: { content, updatedAt: new Date() },
    });
}

export async function getDraft(documentId: string, client: DbClient = db) {
  const [row] = await client.select().from(documentDraft).where(eq(documentDraft.documentId, documentId));
  return row ?? null;
}

export async function deleteDraft(documentId: string, client: DbClient = db) {
  await client.delete(documentDraft).where(eq(documentDraft.documentId, documentId));
}
```
`DbClient` 유니온 타입(파일 상단 8행)을 그대로 재사용 — 새 타입 정의 불필요. Pitfall 5에 따라 `autosaveDocument`의 반환값(`rows.length === 1`, 120-123행)을 게이트로 삼아, PUT `/api/documents/[id]` 라우트 안에서 `if (await autosaveDocument(...)) { await deleteDraft(id); }`로 연쇄시킨다(이 게이팅은 `documents/[id]/route.ts` PUT 핸들러 수정 지점).

---

### `src/lib/validation.ts` (+`draftBodySchema`)

**Analog:** 같은 파일의 `autosaveBodySchema`(63-67행)

```ts
// PUT 임시저장 body 전용(TRD §7) — content만, seq 없음(draft는 순서 가드 불필요, 1분 주기 upsert)
export const draftBodySchema = z.object({
  content: z.string(),
});
export type DraftBodyInput = z.infer<typeof draftBodySchema>;
```
`documentSchema`(55-58행)의 "content는 trim 없음" 주석 규칙을 그대로 승계 — draft도 CodeMirror 원문 그대로 저장한다.

---

### `src/components/document/draft-controller.ts`

**Analog:** `src/components/document/autosave-controller.ts` (전체 80행)

RESEARCH Pattern 4(244-274행)가 이미 완성 코드를 제공 — 그대로 채용한다. 핵심 차이: 자동저장은 디바운스(`setTimeout` 재설정), draft는 "더티 플래그 + 고정 주기"(`setInterval`)다.
```ts
export function createDraftController({ send, intervalMs = 60_000 }: DraftControllerOptions) {
  let dirty = false;
  let latestContent = "";
  const timer = setInterval(() => {
    if (!dirty) return;
    dirty = false;
    void send(latestContent);
  }, intervalMs);
  return {
    onContentChange(content: string) { latestContent = content; dirty = true; },
    dispose() { clearInterval(timer); },
  };
}
```
`autosave-controller.ts`의 "React-less 순수 함수, `send` 주입으로 테스트가 fake timer만으로 검증 가능"이라는 설계 원칙(1-5행 주석)을 그대로 승계 — seq 가드/재시도 로직은 draft에 없다(TRD §7 확정, "취소 없이"의 자동저장 전용 개념이 draft엔 적용 안 됨. Anti-Pattern 참조).

---

### `src/components/document/useDraft.ts`

**Analog:** `src/components/document/useAutosave.ts` (전체 44행)

```ts
"use client";
import { useEffect, useMemo } from "react";
import { createDraftController } from "./draft-controller";

export function useDraft(docId: string) {
  const controller = useMemo(
    () =>
      createDraftController({
        send: async (content) => {
          const res = await fetch(`/api/documents/${docId}/draft`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ content }),
          });
          return { ok: res.ok };
        },
      }),
    [docId],
  );

  useEffect(() => () => controller.dispose(), [controller]);

  return { onContentChange: controller.onContentChange };
}
```
`useAutosave.ts`의 "얇은 래퍼, 모든 로직은 순수 컨트롤러에" 원칙(3-5행 주석)을 그대로 승계. `status` state는 draft에 불필요(UI-SPEC이 draft 저장 자체에 대한 시각 피드백을 요구하지 않음 — SaveStatusBar는 자동저장 전용으로 유지).

---

### `src/components/document/DraftRecoveryDialog.tsx`

**Analog:** `src/components/ui/ConfirmDialog.tsx` (전체 72행)

`ConfirmDialog`를 새 컴포넌트로 감싸지 않고 **직접 사용 + children 슬롯 확장**(UI-SPEC "Draft Recovery Dialog Contract" 210행 지침, `ConfirmDialog.tsx:20행` 주석 "Plan 05의 delete-workspace 재입력 필드도 이 슬롯 재사용"과 동일 선례):
```tsx
<ConfirmDialog
  open={hasNewerDraft}
  title="임시 저장된 내용이 있어요"
  cancelLabel="나중에"
  confirmLabel="복원"
  onCancel={() => setHasNewerDraft(false)}
  onConfirm={handleRestore}
>
  <p>마지막 저장 이후 자동으로 임시 저장된 더 최신 내용이 있어요. 복원할까요?</p>
  <button type="button" className={styles.discard} onClick={handleDiscard}>폐기</button>
</ConfirmDialog>
```
`destructive` prop은 사용하지 않는다("복원"이 primary/accent 액션 — UI-SPEC Color 섹션 105행). "폐기" 버튼은 `SaveStatusBar`의 "재시도" 버튼 스타일(destructive 텍스트, weight 600)을 이식.

---

### `src/components/editor/useImageUpload.ts` + `Toolbar.tsx`(MODIFIED)

**Analog:** RESEARCH Pattern 1(209-226행) + `useAutosave.ts`의 fetch 래핑 관례

```tsx
// Toolbar.tsx 발췌 — image만 특수 처리, 나머지 13개는 기존 onClick 그대로(58-60행 패턴 유지)
onClick={() => {
  const view = getView();
  if (!view) return;
  if (plugin.id === "image") {
    onImageButtonClick();
    return;
  }
  view.dispatch(plugin.run(view.state));
  view.focus();
}}
```
`onMouseDown={(event) => event.preventDefault()}`(현재 54행)는 image 버튼에도 그대로 유지 — 포커스 유지 목적은 파일 선택 트리거에도 적용된다. `plugins/image.ts`(현재 33-38행)는 **한 글자도 수정하지 않는다** — `run(state)` 계약 유지, 버튼 클릭만 Toolbar 레벨에서 가로챈다(TRD §6 불변식 보존).

`useImageUpload`는 placeholder 삽입/치환을 `getView().dispatch({changes:...})`로 직접 수행한다(RESEARCH Pattern 2 리터럴 문자열 검색, Pitfall 2 동시 업로드 방지를 위한 "진행 중" 플래그 포함) — `EditorHost`의 `updateListener` 계약(51-53행, `update.docChanged`시 `onChangeRef.current` 호출)을 그대로 통과하므로 기존 자동저장 파이프라인이 이어받는다(별도 강제 저장 불필요).

---

### `src/components/layout/EditorPreviewLayout.tsx` (MODIFIED — getView 상위 노출)

**Analog:** `src/components/editor/EditorHost.tsx`의 `forwardRef`+`useImperativeHandle` 패턴 (8-17, 38-40행)

```tsx
export interface EditorPreviewLayoutHandle {
  getView: () => EditorView | null;
}

export const EditorPreviewLayout = forwardRef<EditorPreviewLayoutHandle, EditorPreviewLayoutProps>(
  function EditorPreviewLayout({ initialContent, onChange }, ref) {
    const hostRef = useRef<EditorHostHandle>(null);
    useImperativeHandle(ref, () => ({
      getView: () => hostRef.current?.getView() ?? null,
    }));
    // ...
  },
);
```
`EditorHost`가 이미 정확히 이 패턴을 쓰고 있다(Pitfall 6이 명시적으로 이 패턴 재사용을 지시) — `EditorPreviewLayout`을 현재의 함수 컴포넌트(18행)에서 `forwardRef` 컴포넌트로 승격하는 최소 변경. `DocumentWorkspace`는 이 핸들을 통해서만 뷰에 접근하고 CodeMirror import를 직접 하지 않는다(계층 위반 경고).

---

### `src/app/globals.css` (+`[data-theme="dark"]`), `Toolbar.module.css`(MODIFIED)

**Analog:** 자기 자신의 `:root` 블록 + UI-SPEC Color 섹션(109-131행)이 12개 변수 전문을 이미 확정 — 그대로 이식. `Toolbar.module.css`의 `.tooltip { background: var(--text); }`(현재 61행)만 `background: #0f172a;`로 고정값 교체(UI-SPEC "알려진 예외" 131행).

**Toolbar pressed/tooltip delay (UI-SPEC 144행 원문 그대로):**
```css
.button:active { background: var(--accent-weak); color: var(--accent); }
.tooltip { transition: opacity 0s linear 0s; }
.buttonWrap:hover .tooltip { transition: opacity 0s linear 300ms; opacity: 1; }
```
`Toolbar.tsx`의 JS 상태는 건드리지 않는다(순수 CSS, Pattern 3).

---

### `src/app/(main)/w/[wsId]/layout.tsx` (MODIFIED — cookies 읽기)

**Analog:** 자기 자신의 현재 async RSC 구조(`requireRole` 이미 매 요청 DB 조회, 이미 동적 렌더링 — Pitfall 9가 이 파일을 근거로 인용)

```tsx
import { cookies } from "next/headers";
// ...
const cookieStore = await cookies();
const theme = cookieStore.get("theme")?.value;
```
루트가 아니라 이 layout(또는 `d/[docId]/page.tsx`)에서 레이아웃모드/리사이즈비율 쿠키를 읽어 `DocumentWorkspace`에 prop으로 내려준다(Pitfall 9 — 최상위 `app/layout.tsx`에서 theme 쿠키를 읽는 것은 별개 관심사, 전 라우트 동적 렌더링 트레이드오프를 문서화하고 채택).

---

### `src/components/layout/ThemeToggle.tsx` / `LayoutModeToggle.tsx`

**Analog:** Phase 4 사이드바 "휴지통" 고정 행(40px, hover `var(--surface-2)`) — 파일 직접 미조회했으나 UI-SPEC 186-191행이 스타일 전문을 이미 지정, 구조는 사이드바 기존 고정 행과 동일 클래스 패턴(padding 8px, 아이콘 16px+gap 4px).

```tsx
"use client";
export function ThemeToggle({ initialTheme }: { initialTheme: "light" | "dark" }) {
  const [theme, setTheme] = useState(initialTheme);
  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.dataset.theme = next;
    setTheme(next);
  }
  // ...
}
```
RESEARCH Pattern 6(283-297행)의 `document.cookie` 직접 쓰기 관례를 그대로 따른다 — Route Handler 경유 없음.

---

## Shared Patterns

### 서버 전용 RBAC
**Source:** `src/lib/rbac.ts` (`requireRole`, `ForbiddenError`, `forbiddenResponse`)
**Apply to:** `POST /api/uploads`, `PUT/DELETE /api/documents/[id]/draft`
```ts
try {
  await requireRole(workspaceId, "EDITOR");
} catch (err) {
  if (err instanceof ForbiddenError) return forbiddenResponse();
  throw err;
}
```
`UUID_RE` fail-closed 가드가 이미 malformed workspace id를 방어한다(rbac.ts:15,42) — 신규 라우트가 이 가드를 재구현할 필요 없음.

### IDOR 방지 워크스페이스 역산
**Source:** `src/lib/documents.ts` `resolveWorkspaceIdForDocument` (36-46행)
**Apply to:** `PUT/DELETE /api/documents/[id]/draft` — document id에서 workspace id를 서버가 재계산, 클라 신뢰 안 함. 활성(비삭제) 문서만 유효.

### zod 입력 검증 실패 → 400 + 첫 메시지
**Source:** `src/app/api/documents/[id]/route.ts` PUT (38-44행)
```ts
const parsed = schema.safeParse(body);
if (!parsed.success) {
  return Response.json({ error: parsed.error.issues[0]?.message ?? "잘못된 요청입니다." }, { status: 400 });
}
```
**Apply to:** `draft/route.ts`, `uploads/route.ts`(storage 결과의 error union 매핑에도 동일 톤 유지)

### 순수 컨트롤러 + 얇은 React 훅 분리
**Source:** `autosave-controller.ts` + `useAutosave.ts`
**Apply to:** `draft-controller.ts` + `useDraft.ts` — React-less 로직만 `vi.useFakeTimers()`로 단위 테스트, 훅은 fetch 클로저 조립만.

### forwardRef + useImperativeHandle로 명령형 API 상위 노출
**Source:** `src/components/editor/EditorHost.tsx` (8-17, 38-40행)
**Apply to:** `EditorPreviewLayout.tsx` — `getView`를 `DocumentWorkspace`까지 노출(Pitfall 6).

### CSS 변수 override만으로 다크 테마 전파
**Source:** `src/app/globals.css` `:root` 블록(기존 ui-kit 토큰) + 모든 기존 컴포넌트의 `var(--token)` 참조
**Apply to:** `[data-theme="dark"]` 블록 추가만으로 트리/모달/버튼/상태바가 자동 전환 — 컴포넌트별 다크 스타일 재작성 불필요. 예외 1건(`Toolbar.module.css` 툴팁 배경)만 하드코딩.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/storage.ts` | utility | file-I/O | 코드베이스에 파일시스템 쓰기 서비스가 처음 등장 — RESEARCH.md "Code Examples" 섹션의 완성 코드(414-458행)를 원천으로 채택 |
| `src/components/editor/ImageDropzone.tsx` | component | event-driven | 드래그드롭 오버레이가 처음 등장 — UI-SPEC "Image Upload Contract"(149-164행)의 시각 계약을 원천으로 채택 |
| 리사이즈 핸들 로직(EditorPreviewLayout 내부) | event handler | event-driven | 네이티브 mousedown/mousemove 드래그가 처음 등장 — RESEARCH Pattern 7(299-323행) 코드를 원천으로 채택 |

## Metadata

**Analog search scope:** `src/components/document/`, `src/components/editor/`, `src/components/layout/`, `src/components/ui/`, `src/app/api/documents/[id]/`, `src/lib/`, `src/db/schema.ts`, `src/app/globals.css`, `src/app/(main)/w/[wsId]/layout.tsx`
**Files scanned:** 15 (모두 required_reading 대상, 재읽기 없음)
**Pattern extraction date:** 2026-08-08
