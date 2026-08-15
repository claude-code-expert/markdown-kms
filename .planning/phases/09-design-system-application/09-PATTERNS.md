# Phase 9: Design System Application - 패턴 맵

**작성일:** 2026-08-15
**분석 대상 파일 수:** 12
**분석 방식:** 모든 타겟 파일이 이미 존재 — "analog"는 대부분 파일 자기 자신(직접 수정 대상). 신규 파일은 없음(순수 리스킨 phase, D-02/D-05).

## File Classification

| 수정 대상 파일 | Role | Data Flow | 근거 Analog | Match |
|---|---|---|---|---|
| `src/app/globals.css` | config (토큰 정의) | transform | 자기 자신 — 기존 `:root`/`[data-theme="dark"]` 2블록 구조 유지, 값만 교체 | exact |
| `public/fonts/*.woff2` + `@font-face` 선언 | config | transform | 없음(신규) — `docs/design_system/fonts/fonts.css` 원본 그대로 이식 | no-analog |
| `src/components/ui/Button.tsx` / `.module.css` | component | request-response(클릭) | 자기 자신 — `var(--token)` 참조 패턴, radius/font만 토큰명 스왑 | exact |
| `src/components/ui/Card.tsx` / `.module.css` | component | transform | 자기 자신 | exact |
| `src/components/ui/Modal.tsx` / `.module.css` | component | event-driven | 자기 자신(Button/Card와 동일 CSS Modules 패턴 재사용) | exact |
| `src/components/ui/ConfirmDialog.tsx` / `.module.css` | component | event-driven | 자기 자신 + `Modal` 패턴 | exact |
| `src/components/ui/Input.tsx` / `.module.css` | component | request-response | 자기 자신 | exact |
| `src/components/ui/Form.tsx` / `.module.css` | component | request-response | 자기 자신 | exact |
| `src/app/(main)/dashboard/page.tsx` | route(RSC) | CRUD(read) | 자기 자신 — `listMembershipsForUser` 호출부만 확장 필드 전달 추가 | exact |
| `src/components/workspace/WorkspaceCard.tsx` / `.module.css` | component | CRUD(read) | 자기 자신 — props 확장(ownerName/createdAt/docCount/folderCount), 마크업에 메타 라인 추가 | exact |
| `src/components/workspace/CreateWorkspaceButton.tsx` | component | event-driven | 자기 자신(스타일만) | exact |
| `src/components/workspace/JoinWorkspaceInput.tsx` | component | event-driven | 자기 자신(스타일만) | exact |
| `src/lib/db-membership.ts` (`listMembershipsForUser`) | service(DB query) | CRUD(read, aggregate) | 자기 자신 — 기존 join에 owner join + count 서브쿼리 2종 추가 | exact |
| `src/app/(main)/w/[wsId]/layout.tsx` | route(RSC) | request-response | 자기 자신(스타일만) | exact |
| `src/components/tree/FolderTree.tsx` / `.module.css` | component | CRUD(read/render) | 자기 자신(D-09: 순수 스타일링만, 로직 무변경) | exact |
| `src/app/(main)/w/[wsId]/d/[docId]/page.tsx` | route(RSC) | CRUD(read) | 자기 자신(스타일만) | exact |
| `src/components/document/DocumentWorkspace.tsx` / `.module.css` | component | event-driven(autosave) | 자기 자신(스타일만, seq-guard 로직 100% 유지) | exact |
| `src/app/(auth)/login/login-form.tsx` | component | request-response | 자기 자신 — `Form`/`Input`/`FormError` 프리미티브 재사용, 마크업 무변경 | exact |
| `src/app/(auth)/signup/signup-form.tsx` | component | request-response | `login-form.tsx`와 동일 `Form` 프리미티브 패턴 | exact |

**핵심 요지:** 이 phase는 신규 파일을 만들지 않는다(폰트 자산 제외). 모든 "analog"는 파일 자기 자신 — CSS Modules + `var(--token)` 간접 참조 패턴이 Phase 1~7에서 이미 확립되어, 이번 phase는 토큰 값과 일부 마크업(카드 메타 라인, disabled Google 버튼)만 바꾸면 된다.

## Pattern Assignments

### `src/app/globals.css` (config, token 정의)

**현재 구조 (전체, 100줄):**
```css
:root {
  --bg: #ffffff;
  --surface: #f8fafc;
  --surface-2: #eef2f6;
  --border: #e5e7eb;
  --border-strong: #cbd5e1;
  --text: #0f172a;
  --muted: #64748b;
  --dim: #94a3b8;
  --accent: #2563eb;
  --accent-strong: #1d4ed8;
  --accent-weak: #eff6ff;
  --destructive: #dc2626;
  --code-bg: #0f172a;
  --space-xs: 4px; /* ... spacing scale, UNCHANGED per UI-SPEC */
}

[data-theme="dark"] { /* 12개 토큰 재선언 — 이 블록을 UI-SPEC 다크 표로 전면 교체 */
  --bg: #0f172a; --accent: #3b82f6; /* ... */
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) { /* 다크 블록과 동일 값 복제 — 이것도 같이 교체해야 함 */
  }
}

body {
  font-family: var(--font-ibm-plex-sans), "IBM Plex Sans", sans-serif; /* → DM Sans로 교체 */
  font-size: 13px; /* → UI-SPEC Body 14px */
}
```

**적용 지침:**
- `:root` 라이트 블록은 색상 **무변경**(D-04/D-06) — 그대로 둔다.
- `[data-theme="dark"]` 블록 **전면 교체**: UI-SPEC "다크 모드 CSS 변수 전체 매핑" 표 그대로.
- `@media (prefers-color-scheme: dark)` 블록도 다크 블록과 **동일하게** 재복제(현재도 그렇게 이중 관리되고 있음 — 패턴 유지).
- `:root`에 신규 전역(라이트/다크 공통) 토큰 추가: `--radius-sm/md/lg`(6/12/18px), `--duration-fast/standard/slow`(180/240/300ms), `--ease-fluid`/`--ease-elastic`, 타이포 변수(`--font-sans`/`--font-mono`, 4개 role별 size/weight/line-height는 CSS Modules에서 직접 값 박아도 되고 변수화해도 됨 — 재량).
- `body` 블록의 `font-family`/`font-size`를 DM Sans/14px로 교체. `--font-ibm-plex-sans` next/font 변수는 `layout.tsx`에서 DM Sans local font로 교체 필요(별도 파일).
- spacing(`--space-*`)은 **무변경**(UI-SPEC 명시).

### `src/components/ui/Button.tsx` + `.module.css` (component)

**현재 CSS (전체 44줄, 위 Read 결과 그대로):** `border-radius: 6px` 하드코딩 → `var(--radius-sm)`로 치환. `transition: background-color 0.15s ease` → `var(--duration-fast) var(--ease-fluid)`로 치환. Press 피드백(`transform: scale(0.98) translateY(1px)`) 신규 추가는 `:active` 셀렉터 하나 붙이면 됨 — 컴포넌트 tsx는 무수정.

**Card.module.css 패턴 (5줄, 위 Read 결과):** `border-radius: 8px` → `var(--radius-md)`(12px)로 치환 + `@supports (corner-shape: squircle)` 블록 추가(UI-SPEC 코드 그대로 복붙 가능).

이 두 파일이 나머지 `Modal`/`ConfirmDialog`/`Input`/`Form`의 CSS 변경 원형이다 — 전부 동일하게 하드코딩 radius/transition 값을 `var(--radius-*)`/`var(--duration-*)`로 스왑하는 기계적 작업.

### `src/lib/db-membership.ts` — `listMembershipsForUser` 확장 (service, CRUD)

**현재 (전체 20줄, 위 Read 결과):** `workspaceMember` ⋈ `workspace`, `id`/`name`/`role`만 select.

**확장 방향 (D-08):**
- 소유자 이름: `workspaceMember`에 OWNER 행이 항상 있다는 보장이 없음(시드 워크스페이스는 전원 EDITOR, WorkspaceCard.tsx 주석 참고) — OWNER가 없는 워크스페이스는 owner name을 null 허용하고 UI에서 접거나 "-"로 표시. `leftJoin`으로 `workspaceMember` (role='OWNER') → `user.name` 필요.
- 생성일: `workspace.createdAt` 이미 스키마에 존재(schema.ts:29) — select에 추가만 하면 됨.
- 문서 개수: `document` 테이블(`workspaceId`, `isDeleted`) 서브쿼리 `COUNT(*) WHERE workspace_id = ws.id AND is_deleted = false`.
- 폴더 개수: `folder` 테이블(`workspaceId`, `isDeleted`, `isTrashRoot`) 서브쿼리 — 휴지통 루트(`isTrashRoot=true`)는 폴더 개수에서 제외할지 재량(와이어프레임은 실사용 폴더 개수 의도로 보임, `isTrashRoot=false AND isDeleted=false` 권장).
- Drizzle에서 집계 서브쿼리는 `sql<number>`\`(select count(*) from document where...)\`` 형태 correlated subquery로 select절에 인라인하거나, 별도 `db.select({count: count()}).from(document).where(...)`를 `$dynamic`/group-by 조인으로 구성. 기존 코드베이스에 유사 집계 패턴이 없으므로(no-analog) `drizzle-orm`의 `sql` 템플릿 헬퍼 사용을 권장 — TRD §3 Closure Table의 고정 쿼리 수 불변식과 무관(개수 카운트는 워크스페이스별 N+1 아님, 목록 자체가 이미 워크스페이스 단위이므로 각 필드당 서브쿼리 하나면 충분).

**리턴 타입 변경 예시 형태:**
```typescript
export async function listMembershipsForUser(userId: string) {
  return db
    .select({
      id: workspace.id,
      name: workspace.name,
      role: workspaceMember.role,
      createdAt: workspace.createdAt,
      ownerName: sql<string | null>`...`,
      docCount: sql<number>`...`,
      folderCount: sql<number>`...`,
    })
    .from(workspaceMember)
    .innerJoin(workspace, eq(workspaceMember.workspaceId, workspace.id))
    .where(and(eq(workspaceMember.userId, userId), eq(workspace.isDeleted, false)));
}
```

### `src/components/workspace/WorkspaceCard.tsx` (component)

**현재 props (전체 55줄, 위 Read 결과):** `{ id, name, role }` — `Card` 래핑, `Link` 이름, OWNER일 때만 삭제 버튼.

**확장 방향:** props에 `ownerName`/`createdAt`/`docCount`/`folderCount` 추가, 메타 라인 `"소유자 {ownerName} · 생성일 {createdAt} · 문서 {docCount}개 · 폴더 {folderCount}개"` 렌더(Copywriting Contract 그대로). "문서" 버튼은 카드 클릭(`Link`)과 동일 동작이므로 별도 핸들러 없이 시각적 버튼만 추가하거나 `Link`를 감싸는 영역을 넓히는 방식(재량).

### `src/app/(auth)/login/login-form.tsx` + `signup-form.tsx` (component)

**현재 (전체 65줄, 위 Read 결과):** `Form`/`FormField`/`FormLabel`/`FormError`/`FormSubmit`/`Input` 프리미티브 조합 — 이 마크업 구조 자체는 무변경, `Form.module.css`/`Input.module.css`의 토큰 치환만으로 리스킨됨. Google 버튼은 이 폼 아래 신규 추가 요소 — `<button disabled>` + `cursor: not-allowed` + 낮춘 opacity, `onClick` 없음(UI-SPEC Copywriting Contract 그대로).

## Shared Patterns

### CSS Modules + `var(--token)` 간접 참조
**출처:** `src/components/ui/Button.module.css`, `Card.module.css` (Phase 5 다크모드 토글이 이미 이 패턴으로 무수정 리스킨 성공)
**적용 대상:** 모든 `src/components/ui/*`, `WorkspaceCard.module.css`, `FolderTree.module.css`, `DocumentWorkspace.module.css`, auth 폼 CSS
```css
/* 하드코딩 값 → var(--token) 치환이 전부. 컴포넌트 tsx는 절대 수정 안 함. */
border-radius: 6px;  →  border-radius: var(--radius-sm);
transition: background-color 0.15s ease;  →  transition: background-color var(--duration-fast) var(--ease-fluid);
```

### RSC 쿠키 기반 다크모드 (no-FOUC)
**출처:** 기존 `layout.tsx`(Phase 5, CONTEXT.md에서 "건드릴 필요 없음"으로 명시)
**적용 대상:** 없음 — 이 phase는 이 메커니즘을 유지만 하고 건드리지 않는다.

### 서버 전용 RBAC
**출처:** `src/lib/rbac.ts` `requireRole`
**적용 대상:** 없음 — 이 phase는 프레젠테이션 전용이므로 RBAC 로직에 접촉하지 않는다. `WorkspaceCard.tsx`의 `role === "OWNER"` 조건부 렌더는 UX 편의일 뿐(주석에 이미 명시) 이번 phase도 동일하게 유지.

## No Analog Found

| 파일 | Role | Data Flow | 이유 |
|---|---|---|---|
| `public/fonts/*.woff2` + `@font-face` (`fonts.css` 또는 `globals.css` 내 선언) | config | file-I/O | 프로젝트에 자체 호스팅 폰트 이식 사례 없음(기존은 next/font의 IBM Plex) — `docs/design_system/fonts/fonts.css` 원본을 그대로 참고해 이식 |
| `listMembershipsForUser`의 집계 서브쿼리(docCount/folderCount/ownerName) | service | CRUD(aggregate) | 코드베이스에 워크스페이스 단위 COUNT 집계 쿼리 사례 없음 — Drizzle `sql` 템플릿 헬퍼로 신규 작성 필요(위 Pattern Assignments 예시 참고) |

## Metadata

**Analog 검색 범위:** `src/app/`, `src/components/ui/`, `src/components/workspace/`, `src/components/tree/`, `src/components/document/`, `src/lib/`, `src/db/schema.ts`
**스캔 파일 수:** 약 20개 (globals.css, ui 컴포넌트 6쌍, workspace 컴포넌트 3개, db-membership.ts, dashboard/page.tsx, login-form.tsx, schema.ts)
**패턴 추출일:** 2026-08-15
