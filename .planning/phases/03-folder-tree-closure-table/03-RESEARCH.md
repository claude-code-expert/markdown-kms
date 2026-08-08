# Phase 3: Folder Tree (Closure Table) - Research

**Researched:** 2026-08-08
**Domain:** Postgres Closure Table (Drizzle ORM) + native HTML5 drag-and-drop tree UI
**Confidence:** MEDIUM (backend/SQL patterns cross-checked against official docs; DnD/query-count testing patterns cross-checked against MDN/porsager README; in-repo conventions read directly from source)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**트리 상호작용 UX**
- 생성/이름변경/삭제 트리거: 우클릭 컨텍스트 메뉴 + hover 시 노출되는 액션 버튼.
- 폴더 이동: 드래그앤드롭을 기본으로 하되(사이클은 거부·시각 피드백), "이동" 메뉴를 폴백으로 제공.
- 이름변경: 인라인 제자리 편집(트리 노드가 텍스트 입력으로 전환).
- 펼침/접힘 상태: 클라이언트 임시 상태(비영속) — Phase 2의 비영속 계약과 일관. 영속화는 Phase 4/5로 미룸.

**범위·쓰기 의미**
- Phase 3 삭제 범위: 폴더 소프트삭제 cascade **데이터 연산**만 구현(TRD §4 — 서브트리 폴더/문서에 `is_deleted=true, deleted_at=now()`, 삭제 대상에만 `is_trash_root=true`, closure 행은 보존). 휴지통 **뷰 UI**·복원 화면은 Phase 4.
- UI 갱신: 서버 확정 후 갱신(mutation await → 트리 갱신). 낙관적 UI는 지연이 측정으로 문제될 때만 도입.
- 폴더 이름 검증: 서버에서 비어있지 않음·trim·최대 255자. 형제 간 중복 이름 허용(스키마에 sibling-unique 제약 없음).
- 초기 트리 로딩: 서버 컴포넌트에서 Closure Table 서브트리 단일 쿼리로 초기 로드(TRD §4). 문서 포함 시 +1 쿼리(문서는 Phase 4에서 합류).

**Locked (TRD §4 / PRD §3·§2 — 확정, 재논의 아님)**
- 서브트리 조회: `folder_closure JOIN folder WHERE ancestor_id=:id AND is_deleted=false` 단일 쿼리.
- 폴더 생성: 부모 조상 행 복사(`INSERT ... SELECT ancestor_id, :newId, depth+1 ... WHERE descendant_id=:parentId`) + self 행 `(newId,newId,0)`.
- 폴더 이동: 서브트리 기존 조상 링크 DELETE → 새 부모 조상 × 서브트리 CROSS JOIN INSERT. 사이클은 `(움직일 폴더 → 새 부모)` closure 행 존재 여부로 사전 거부(동일 트랜잭션).
- 권한(서버 `requireRole`, UI 숨김은 보안 아님): 생성·이동·이름변경·소프트삭제 = **EDITOR+**, 완전삭제(휴지통) = **ADMIN+**.
- 복원: `is_trash_root` 기준 서브트리를 `is_deleted=false`로. 원 부모가 삭제 상태면 `parent_id=NULL`(루트)로 재부모화 + closure 재작성 + UI 안내(PRD §2-3).

### Claude's Discretion
- 컨텍스트 메뉴/DnD 라이브러리 선택 또는 자체 구현, 트리 노드 컴포넌트 구조, API 라우트 네이밍은 코드베이스 관례(CSS Modules·ui-kit 토큰·zod 입력 검증) 따라 재량.

### Deferred Ideas (OUT OF SCOPE)
- 휴지통 뷰 UI·복원 화면·완전삭제(ADMIN) UI → Phase 4.
- 펼침/접힘 상태 영속화, 낙관적 UI → 필요/측정 시 Phase 4/5.
- 문서를 폴더에 넣기·이동(document.folder_id) → Phase 4(문서 도입과 함께).

**UI-SPEC lock (03-UI-SPEC.md, verified but not re-litigated here):** 260px 고정 사이드바, CSS Modules + ui-kit 토큰, lucide-react 아이콘, 네이티브 HTML5 DnD + 자체 팝업 메뉴(신규 의존성 금지), `Modal`/`ConfirmDialog` 재사용.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TREE-01 | 사이드바에 워크스페이스>폴더>자식 폴더>문서 계층 트리가 표시된다 | Architecture Patterns §"초기 트리 로드" — flat single-query load + client-side tree build; Tree Node Contract already locked in UI-SPEC |
| TREE-02 | 폴더 계층은 Closure Table로 저장되고 서브트리 조회가 단일 쿼리로 수행된다 | Code Examples §getSubtree/getWorkspaceFolders; Testing Strategy §쿼리 수 단언(postgres.js `debug` hook) |
| TREE-03 | 폴더 생성·이름 변경·이동·소프트 삭제가 동작한다. 자기 자손으로의 이동은 거부된다 | Code Examples §createFolder/renameFolder/moveFolder/softDeleteFolder; Common Pitfalls §트랜잭션 내 사이클 체크 |
</phase_requirements>

## Summary

Phase 3의 핵심은 세 갈래다: (1) TRD §4가 이미 확정한 4개 Closure Table 연산을 Drizzle의 `sql` 템플릿으로 정확히 구현하는 것, (2) 이동 연산의 사이클 체크를 rewiring과 **같은 트랜잭션**에 두어 TOCTOU를 막는 것, (3) UI-SPEC이 이미 잠근 네이티브 HTML5 DnD + 자체 컨텍스트 메뉴를 신규 의존성 없이 구현하는 것이다. TRD §4의 SQL은 재설계 대상이 아니라 검증 대상이며, 실제로 검증 중 한 가지 중요한 보완점을 발견했다: TRD의 "서브트리 단일 쿼리" 패턴은 `:folderId`라는 조상 파라미터를 요구하는데, 워크스페이스 자체를 표현하는 `folder` 행이 스키마에 없다(`parent_id IS NULL`은 "워크스페이스 루트 직속"을 뜻할 뿐 루트 행 자체가 아니다 — TRD §3 DDL 직접 확인). 따라서 **초기 전체 트리 로드는 closure join이 아니라 `WHERE workspace_id=:id AND is_deleted=false` 평면 단일 쿼리**로 수행하고, closure join 기반 서브트리 조회(TRD §4 원문 패턴)는 생성·이동·cascade 삭제처럼 **특정 폴더를 기준점으로 하는 연산**에서 쓰인다. 둘 다 트리 깊이와 무관한 고정 쿼리 수이므로 NFR-1.3(TREE-02)을 동일하게 만족한다.

기존 코드베이스는 이미 이 phase가 그대로 재사용할 패턴을 갖추고 있다: `requireRole`(EDITOR+ 게이트), `db.transaction(async (tx) => {...})`(POST `/api/workspaces`에서 이미 사용 중), zod 스키마(`src/lib/validation.ts`), 실제 Postgres에 대고 도는 통합 테스트(`vi.mock("@/auth")` + `tests/rbac/helpers.ts` 팩토리 + `afterEach`에서 workspace 행 삭제 → FK cascade로 하위 행 자동 정리). 신규 의존성은 없다 — DnD·컨텍스트 메뉴는 UI-SPEC이 이미 네이티브 API로 확정했고, 쿼리 개수 단언은 이미 설치된 `postgres`(porsager) 패키지의 `debug` 콜백 옵션으로 충분하다(별도 쿼리 카운팅 라이브러리 불필요).

**Primary recommendation:** `src/lib/closure.ts`에 `getWorkspaceFolders`(평면 초기 로드) / `getSubtree`(TRD §4 조상 기준 조회, cascade 삭제 등에서 재사용) / `createFolder` / `renameFolder` / `moveFolder`(사이클 체크 + rewiring을 한 `db.transaction` 안에) / `softDeleteFolder`(cascade) 6개 함수로 구현하고, API 라우트는 폴더 id로부터 `workspaceId`를 **서버에서 직접 조회**해 `requireRole`에 넘긴다(클라이언트가 보낸 workspaceId를 신뢰하지 않음 — IDOR 방지).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 초기 트리 로드(전체 폴더 목록) | Frontend Server (SSR) | Database | `w/[wsId]/page.tsx`가 서버 컴포넌트에서 단일 쿼리로 로드해 초기 HTML에 트리를 싣는다(Phase 1의 `requireRole`+`notFound()` 게이트 재사용) — 클라이언트 로딩 스피너가 필요 없다는 UI-SPEC 결정과 정합 |
| 폴더 CRUD/이동/삭제 연산(closure 재작성) | API / Backend | Database | 트랜잭션·사이클 체크·권한 검증이 전부 서버 신뢰 경계 안에 있어야 한다(NFR-3.2, CLAUDE.md 불변식) |
| 사이클 사전 판정(즉시 시각 피드백) | Browser / Client | — | UI-SPEC이 명시: "판정은 클라이언트가 즉시 계산" — 이미 메모리에 있는 트리를 순회. **신뢰 경계 아님**, 서버가 동일 트랜잭션에서 반드시 재검증 |
| 트리 렌더·DnD·컨텍스트 메뉴·인라인 편집 | Browser / Client | — | 순수 UI 상호작용, 네이티브 HTML5 DnD API(브라우저 제공) |
| 권한 검증(EDITOR+) | API / Backend | — | `requireRole` — UI 버튼 숨김은 보안 아님(CLAUDE.md) |
| Closure 행 정합성(재귀 없는 조인) | Database | — | PostgreSQL 16 네이티브 인덱스/조인이 재귀 쿼리를 대체 |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.45.2 (already installed) [VERIFIED: package.json:14] `"drizzle-orm": "0.45.2"` | ORM + `sql` 템플릿으로 closure 벌크 연산 | TRD §1이 이미 확정. `postgres-js` 드라이버 어댑터 사용 중(`src/db/index.ts:1` `drizzle-orm/postgres-js`) |
| postgres | 3.4.9 (already installed) [VERIFIED: package.json:23] `"postgres": "3.4.9"` | 실제 DB 드라이버(drizzle-orm/postgres-js가 감싸는 대상) | 이미 `src/db/index.ts`에서 사용 중 |
| zod | 4.4.3 (already installed) [VERIFIED: package.json:29] `"zod": "4.4.3"` | 폴더 이름 등 입력 검증 스키마 | `src/lib/validation.ts`에 이미 동일 패턴(`workspaceSchema`) 존재 |
| lucide-react | ^1.28.0 (already installed) [VERIFIED: package.json:15] `"lucide-react": "^1.28.0"` | 트리 아이콘(Folder/ChevronRight/FolderPlus/Pencil/FolderInput/Trash2/MoreHorizontal) | UI-SPEC이 지정, 이미 설치됨 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (없음 — 이 phase는 신규 패키지를 추가하지 않는다) | — | — | — |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 네이티브 HTML5 Drag and Drop API | `dnd-kit`, `react-dnd` | UI-SPEC이 이미 기각: 리스트 재정렬처럼 더 복잡한 요구가 생기기 전까지 YAGNI. 트리 노드 하나를 다른 노드 위로 드롭하는 단순 상호작용에 라이브러리는 과잉 |
| 자체 팝업 컨텍스트 메뉴 | Radix `DropdownMenu`, `@floating-ui/react` | shadcn 미도입 확정(01/02-UI-SPEC과 동일 근거) — CSS Modules + 고정 위치 팝업으로 충분한 규모 |
| postgres.js `debug` 콜백으로 쿼리 수 카운트 | pg-mem, 쿼리 프록시 라이브러리 | 이미 설치된 드라이버의 내장 옵션 몇 줄로 충분, 새 의존성/모킹 계층 불필요 |

**Installation:** 불필요 — 신규 패키지 없음.

**Version verification:** 위 4개 패키지는 이미 `package.json`에서 직접 읽은 고정 버전이므로(레지스트리 재조회 불필요) `npm view` 대신 파일 인용으로 검증했다(`[VERIFIED: package.json:라인]`, 값은 위 표에 verbatim 인용).

## Package Legitimacy Audit

**신규 패키지 없음 — 이 phase는 이미 설치된 의존성만 사용한다.** Package Legitimacy Gate는 신규 패키지 설치가 있을 때만 필수이므로 스킵한다. UI-SPEC이 명시적으로 DnD/컨텍스트 메뉴 신규 라이브러리 도입을 기각했고(Registry Safety 섹션 "서드파티: 없음"), 백엔드도 이미 설치된 `drizzle-orm`/`postgres`/`zod`만 사용한다.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
[초기 로드 — 서버 컴포넌트]
브라우저 GET /w/:wsId
  → w/[wsId]/page.tsx (RSC)
      → requireRole(wsId, "VIEWER")  [기존 Phase 1 게이트, 변경 없음]
      → lib/closure.ts: getWorkspaceFolders(wsId)  ── 1 쿼리 (flat, workspace_id 필터)
      → 클라이언트로 folder[] 전달 → FolderTree가 parent_id로 트리 구성(클라이언트 메모리)

[변경 연산 — 클라이언트 상호작용 → API 왕복 → 서버 확정 후 재조회]
FolderTree(클라이언트)
  ├─ 우클릭/hover kebab → 컨텍스트 메뉴 → "새 하위 폴더"/"이름 변경"/"이동..."/"삭제"
  ├─ 인라인 이름 입력 → Enter
  └─ dragstart → dragover(클라이언트 사이클 판정, isDescendant 순회) → drop
         │
         ▼
   fetch(POST/PATCH/DELETE /api/folders*)
         │
         ▼
   Route Handler
     1. zod로 body 검증 (이름 trim/비어있지않음/≤255)
     2. 대상 folder 행에서 workspace_id를 서버가 직접 SELECT (클라이언트 workspaceId 불신)
     3. requireRole(workspaceId, "EDITOR")
     4. db.transaction(async (tx) => {
          (이동만) 사이클 체크: closure에 (움직일 폴더→새 부모) 행 존재? → 존재 시 409
          closure 재작성(생성/이동/삭제 각각 TRD §4 SQL)
          folder 행 갱신
        })
     5. 200/201/204
         │
         ▼
   클라이언트: await 성공 → getWorkspaceFolders 재조회 → 트리 재렌더 (낙관적 UI 없음, UI-SPEC pending 스타일)
```

### Recommended Project Structure
```
src/
├── lib/
│   └── closure.ts              # TRD §4 4연산 + getWorkspaceFolders (신규)
├── lib/validation.ts           # folderSchema 추가 (기존 파일 확장)
├── app/api/
│   ├── workspaces/[id]/tree/route.ts   # GET 초기 트리(선택 — RSC가 직접 lib 호출해도 무방)
│   └── folders/
│       ├── route.ts            # POST 생성
│       └── [id]/
│           ├── route.ts        # PATCH 이름변경 / DELETE 소프트삭제 cascade
│           └── move/route.ts   # POST 이동 (body: { newParentId })
├── components/tree/
│   ├── FolderTree.tsx           # 트리 루트, folder[] → 트리 구조 빌드(client)
│   ├── FolderTreeNode.tsx       # 노드 1개: hover/selected/pending/dnd 상태
│   ├── FolderContextMenu.tsx    # 우클릭/kebab 공용 팝업 메뉴
│   ├── MoveFolderModal.tsx      # "이동" 폴백 모달 (Modal 재사용)
│   ├── tree-utils.ts            # buildTree(folder[]), isDescendant(tree, id, candidateId)
│   └── *.module.css
```

### Pattern 1: 초기 전체 트리 — 평면 단일 쿼리 (closure join 아님)
**What:** `folder` 테이블에는 워크스페이스 루트를 표현하는 행이 없다(`parent_id IS NULL` = 워크스페이스 직속, TRD §3 DDL). 따라서 "전체 트리"에는 TRD §4의 `ancestor_id=:folderId` 서브트리 패턴을 적용할 조상 id가 없다.
**When to use:** `w/[wsId]/page.tsx` 초기 로드, 그리고 트리 재조회(뮤테이션 후 refetch) 전부.
**Example:**
```typescript
// src/lib/closure.ts — Source: TRD §3 DDL(직접 읽음, workspace_id 컬럼이 모든 folder 행에 있음) + TRD §4(서브트리 패턴이 ancestor 필요) 교차 확인
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { folder } from "@/db/schema";

// TREE-02: 트리 깊이와 무관한 고정 1쿼리. closure join이 아니라 workspace_id 평면 필터.
export async function getWorkspaceFolders(workspaceId: string) {
  return db
    .select()
    .from(folder)
    .where(and(eq(folder.workspaceId, workspaceId), eq(folder.isDeleted, false)));
}
```

### Pattern 2: 폴더 기준 서브트리 조회 — TRD §4 원문 패턴 (생성/삭제에서 재사용)
**What:** 특정 폴더를 기준으로 그 서브트리(자신 포함)를 구할 때만 closure join을 쓴다.
**When to use:** cascade 소프트삭제 대상 id 목록 산출(§4), 향후 Phase 6 zip export.
**Example:**
```typescript
// Source: TRD §4 원문 SQL을 Drizzle query builder로 옮김 (재설계 아님, 그대로 이식)
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { folder, folderClosure } from "@/db/schema";

export async function getSubtree(folderId: string) {
  return db
    .select({ id: folder.id, parentId: folder.parentId, name: folder.name, workspaceId: folder.workspaceId })
    .from(folder)
    .innerJoin(folderClosure, eq(folderClosure.descendantId, folder.id))
    .where(and(eq(folderClosure.ancestorId, folderId), eq(folder.isDeleted, false)));
}
```

### Pattern 3: 폴더 생성 — 조상 복사 + self 행
**What:** TRD §4 "부모의 조상 행 복사 + self 행"을 그대로 구현. `parentId`가 `NULL`(워크스페이스 루트 생성)이면 `WHERE descendant_id = NULL` 비교는 SQL 3치 논리상 항상 거짓이라 자연히 0행이 복사된다 — 별도 `if` 분기 없이도 안전하다(Common Pitfalls 참고, 단 Wave 0에서 반드시 테스트로 확인).
**Example:**
```typescript
// Source: TRD §4 "폴더 생성" 원문 SQL 이식
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { folder, folderClosure } from "@/db/schema";

export async function createFolder(workspaceId: string, parentId: string | null, name: string) {
  return db.transaction(async (tx) => {
    const [created] = await tx.insert(folder).values({ workspaceId, parentId, name }).returning();

    // 조상 복사: parentId가 null이면 descendant_id=NULL 매치 없어 0행 (안전)
    await tx.execute(sql`
      INSERT INTO folder_closure (ancestor_id, descendant_id, depth)
      SELECT ancestor_id, ${created.id}, depth + 1
      FROM folder_closure
      WHERE descendant_id = ${parentId}
    `);

    // self 행 (depth 0) — 모든 폴더가 반드시 가져야 함, 조건 없이 항상 실행
    await tx.insert(folderClosure).values({ ancestorId: created.id, descendantId: created.id, depth: 0 });

    return created;
  });
}
```

### Pattern 4: 폴더 이동 — 동일 트랜잭션 사이클 체크 → rewiring
**What:** TRD §4 "서브트리의 기존 조상 링크 DELETE 후 새 부모 조상 × 서브트리 CROSS JOIN INSERT", 사이클 체크가 반드시 먼저·같은 트랜잭션.
**When to use:** DnD drop 성공 또는 "이동" 모달 확인.
**Example:**
```typescript
// Source: TRD §4 "폴더 이동" 원문 SQL 이식 + WebSearch[CITED: orm.drizzle.team/docs/transactions] 트랜잭션 콜백이 throw 시 자동 rollback
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { folder, folderClosure } from "@/db/schema";

export class CycleError extends Error {}

export async function moveFolder(folderId: string, newParentId: string | null) {
  return db.transaction(async (tx) => {
    if (newParentId) {
      // 사이클 체크: closure에 (folderId → newParentId) 행이 있으면 newParentId는
      // folderId의 자손(또는 folderId 자신, self 행이 항상 존재하므로 자기-이동도 여기서 걸린다).
      const [cycle] = await tx
        .select({ hit: sql<number>`1` })
        .from(folderClosure)
        .where(and(eq(folderClosure.ancestorId, folderId), eq(folderClosure.descendantId, newParentId)));
      if (cycle) throw new CycleError();
    }

    // 서브트리의 기존 "외부" 조상 링크만 제거 (서브트리 내부 링크는 보존)
    await tx.execute(sql`
      DELETE FROM folder_closure
      WHERE descendant_id IN (SELECT descendant_id FROM folder_closure WHERE ancestor_id = ${folderId})
        AND ancestor_id NOT IN (SELECT descendant_id FROM folder_closure WHERE ancestor_id = ${folderId})
    `);

    if (newParentId) {
      await tx.execute(sql`
        INSERT INTO folder_closure (ancestor_id, descendant_id, depth)
        SELECT p.ancestor_id, c.descendant_id, p.depth + c.depth + 1
        FROM folder_closure p
        CROSS JOIN folder_closure c
        WHERE p.descendant_id = ${newParentId} AND c.ancestor_id = ${folderId}
      `);
    }

    await tx.update(folder).set({ parentId: newParentId, updatedAt: new Date() }).where(eq(folder.id, folderId));
  });
}
```

### Pattern 5: 소프트삭제 cascade
**What:** 서브트리 전체(자신 포함)에 `is_deleted=true`, 삭제 명령 대상에만 `is_trash_root=true`. closure 행은 그대로 둔다(복원의 역연산 전제).
**Example:**
```typescript
// Source: TRD §4 "폴더 삭제" 원문 + PRD §2-2 cascade
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { folder } from "@/db/schema";
import { getSubtree } from "./closure";

export async function softDeleteFolder(folderId: string) {
  return db.transaction(async (tx) => {
    const subtree = await getSubtree(folderId); // tx 밖 함수 재사용이 아니라 tx 스코프로 동일 구현을 인라인하거나
                                                  // getSubtree(folderId, tx)처럼 옵션 db 인자를 받도록 설계 권장(아래 Pitfall 참고)
    const ids = subtree.map((f) => f.id);
    await tx.update(folder).set({ isDeleted: true, deletedAt: new Date() }).where(inArray(folder.id, ids));
    await tx.update(folder).set({ isTrashRoot: true }).where(eq(folder.id, folderId));
    // Phase 4: 여기서 document WHERE folder_id = ANY(ids)도 함께 is_deleted=true (this phase엔 document 테이블 없음)
  });
}
```

### Pattern 6: 클라이언트 즉시 사이클 판정 (신뢰 경계 아님, UX 보조)
**What:** UI-SPEC "판정은 클라이언트가 즉시 계산" — 드래그 중인 폴더의 서브트리를 이미 로드된 `folder[]`에서 순회해 드롭 대상이 그 서브트리에 포함되는지 확인. API 왕복 없음.
**Example:**
```typescript
// src/components/tree/tree-utils.ts
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
```typescript
// dragover 핸들러에서:
function onDragOver(e: React.DragEvent, targetId: string) {
  if (isDescendantOrSelf(folders, draggedId, targetId)) return; // preventDefault() 호출 안 함 → 브라우저 기본 "금지" 커서
  e.preventDefault(); // Source: [CITED: developer.mozilla.org/docs/Web/API/HTML_Drag_and_Drop_API] dragover에서 preventDefault 해야 drop이 허용됨
  // 유효 대상 스타일 적용(UI-SPEC accent-weak 배경)
}
```

### Pattern 7: dragstart는 반드시 setData 호출
**What:** [CITED: developer.mozilla.org/docs/Web/API/HTML_Drag_and_Drop_API] `dataTransfer.setData()`는 `dragstart` 안에서만 데이터 스토어를 변경할 수 있고, Firefox는 이걸 호출하지 않으면 드래그 자체를 시작하지 않는다.
**Example:**
```typescript
function onDragStart(e: React.DragEvent, folderId: string) {
  e.dataTransfer.setData("text/plain", folderId); // Firefox 필수 — 빈 문자열이라도 반드시 호출
  e.dataTransfer.effectAllowed = "move";
  setDraggedId(folderId);
}
```

### Anti-Patterns to Avoid
- **클라이언트가 보낸 `workspaceId`를 `requireRole`에 그대로 넘기기:** 이동/이름변경/삭제 라우트는 URL에 `wsId`가 없다(폴더 id만 있음). 서버가 대상 폴더 행에서 `workspace_id`를 직접 SELECT한 뒤 그 값으로 `requireRole`을 호출해야 한다 — 그렇지 않으면 크로스 워크스페이스 IDOR이 뚫린다.
- **이동 시 새 부모가 다른 워크스페이스에 속하는지 검증하지 않기:** `newParentId`가 다른 워크스페이스의 폴더면 400으로 거부해야 한다(워크스페이스 경계를 넘는 이동은 스펙에 없다).
- **사이클 체크를 rewiring과 별도 요청/트랜잭션으로 분리:** TOCTOU 레이스 — 반드시 `db.transaction` 콜백 안, DELETE/INSERT 전에.
- **`sql.raw()`로 이름/id를 문자열 삽입:** 항상 `sql\`...${value}...\`` 파라미터 바인딩만 사용(Security Domain §SQL Injection 참고).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 트랜잭션 롤백 | try/catch + 수동 ROLLBACK SQL | `db.transaction(async (tx) => {...})` | 콜백이 throw하면 자동 롤백([CITED: orm.drizzle.team/docs/transactions]) — 수동 관리는 커밋 누락/이중 커밋 버그를 만든다 |
| 쿼리 개수 계측 | 커스텀 SQL 파서/프록시 | 이미 설치된 `postgres`(porsager) 드라이버의 `debug: (connection, query, params, types) => {...}` 콜백([CITED: github.com/porsager/postgres README]) | 새 의존성 없이 정확히 실행된 SQL 문 수를 셀 수 있다 |
| 드래그앤드롭 | 커스텀 mousedown/mousemove 트래킹 | 네이티브 HTML5 Drag and Drop API | 브라우저가 드래그 고스트 이미지·드롭존 판정을 이미 제공. UI-SPEC이 이미 이 방향으로 잠금 |
| 재귀 서브트리 순회 | `WITH RECURSIVE` CTE 또는 애플리케이션 재귀 join | Closure Table (이미 스키마에 존재) | NFR-1.3이 재귀 자체를 금지 — Closure Table의 존재 이유 |

**Key insight:** 이 phase에서 "직접 구현"할 것은 SQL 자체(TRD §4가 이미 확정)가 아니라, 그 SQL을 **트랜잭션 경계**와 **권한 경계** 안에 정확히 배치하는 배선(wiring)이다.

## Common Pitfalls

### Pitfall 1: 사이클 체크와 rewiring을 분리된 요청으로 처리
**What goes wrong:** 클라이언트가 먼저 "이동 가능?" API를 호출해 OK를 받고, 별도 요청으로 실제 이동을 수행하면 그 사이에 다른 클라이언트가 트리를 바꿔 사이클이 생길 수 있다.
**Why it happens:** "먼저 확인, 그다음 실행"이 REST스럽게 느껴지지만 두 요청 사이엔 트랜잭션 격리가 없다.
**How to avoid:** 사이클 체크 SELECT를 `db.transaction` 콜백의 첫 문장으로 두고, 같은 트랜잭션 안에서 DELETE/INSERT/UPDATE까지 끝낸다(Pattern 4).
**Warning signs:** "이동 가능 여부 확인" 엔드포인트가 별도로 존재한다면 이 안티패턴이다.

### Pitfall 2: 워크스페이스 경계를 넘는 폴더 이동/생성
**What goes wrong:** `parentId`(생성 시) 또는 `newParentId`(이동 시)가 다른 워크스페이스의 폴더를 가리키면 트리가 두 워크스페이스에 걸쳐 뒤섞인다 — closure 테이블엔 workspace_id가 없어(TRD §3 DDL 확인) DB 제약으로 막히지 않는다.
**Why it happens:** `folder_closure`가 `folder(id)`만 참조하고 `workspace_id`를 직접 갖지 않으므로, 애플리케이션 레벨 검증 없이는 크로스 워크스페이스 부모-자식 관계가 그냥 INSERT된다.
**How to avoid:** `createFolder`/`moveFolder`에서 `parentId`/`newParentId`가 있으면 그 폴더 행을 SELECT해 `workspace_id`가 대상 워크스페이스와 같은지 트랜잭션 안에서 검증(불일치 시 400).
**Warning signs:** 폴더 생성/이동 테스트에 "다른 워크스페이스의 폴더를 부모로 지정" 케이스가 없다면 이 검증이 빠졌을 가능성이 높다.

### Pitfall 3: 폴더 id로부터 workspace_id를 서버가 재조회하지 않고 클라이언트 값을 신뢰
**What goes wrong:** PATCH/POST move/DELETE 라우트는 URL에 `wsId`가 없다. body에 `workspaceId`를 클라이언트가 실어 보내고 그걸로 `requireRole`을 호출하면, 공격자가 자신이 EDITOR인 워크스페이스 id를 보내면서 실제로는 다른 워크스페이스의 folder id를 대상으로 지정해 권한을 우회할 수 있다.
**Why it happens:** 라우트 설계상 `wsId`가 경로에 없어 "어딘가에서" 얻어와야 하는데, body가 제일 쉬운 소스로 보인다.
**How to avoid:** 항상 `SELECT workspace_id FROM folder WHERE id = :folderId`로 서버가 직접 구해서 그 값으로 `requireRole` 호출.
**Warning signs:** 라우트 핸들러 시그니처에 `workspaceId`가 `req.json()` 결과에서 곧바로 나온다면 이 취약점이다.

### Pitfall 4: `getSubtree`를 트랜잭션 밖 공유 `db`로 호출해 cascade 삭제와 분리된 스냅샷을 읽음
**What goes wrong:** Pattern 5의 `softDeleteFolder`에서 `getSubtree`가 `db`(공유 클라이언트)를 쓰면 `tx` 밖에서 실행되어, cascade 대상 id 목록이 트랜잭션이 커밋하기 전 다른 트랜잭션의 동시 변경과 어긋날 수 있다(read skew).
**Why it happens:** `getSubtree`를 재사용 가능한 헬퍼로 만들면서 `db` 인자를 하드코딩하기 쉽다.
**How to avoid:** `getSubtree(folderId, dbOrTx: typeof db = db)`처럼 두 번째 인자로 `tx`를 주입할 수 있게 설계하고, cascade 삭제·이동 내부에서는 반드시 `tx`를 넘긴다.
**Warning signs:** `lib/closure.ts`의 함수들이 전부 모듈 스코프의 `db`만 import해서 쓰고 있다면 재확인.

### Pitfall 5: 워크스페이스 루트(`parentId=NULL`) 생성에서 `WHERE descendant_id = NULL` 대신 실수로 `IS NULL`을 씀
**What goes wrong:** `sql\`WHERE descendant_id = ${parentId}\``에서 `parentId`가 `null`이면 파라미터 바인딩된 `= NULL` 비교는 SQL 3치 논리상 항상 `UNKNOWN`(거짓 취급)이라 0행이 매치되어 **의도대로** 조상 복사가 스킵된다. 반대로 실수로 `IS NULL`로 바꿔 쓰면 `descendant_id IS NULL`인 행(존재하지 않는 값, PK NOT NULL이므로 결과는 같지만 의도가 불명확해짐)을 찾게 되어 로직을 읽는 사람이 혼동한다.
**Why it happens:** NULL 비교는 직관과 다르게 동작해서 "명시적으로 분기 처리해야 하나?" 고민하게 만든다.
**How to avoid:** `if (parentId)`로 감싸지 말고 파라미터 바인딩 그대로 두어도 정확하다 — 단, **Wave 0 테스트에 워크스페이스 루트 생성 케이스(부모 없음)를 반드시 포함**해 실제로 0행 복사 + self 행 1개만 생기는지 확인한다(이 동작은 SQL 표준 지식 기반 추론이며 이 세션에서 실제 실행 검증은 하지 않았다 — `[ASSUMED]`, Wave 0에서 반드시 실행 확인).
**Warning signs:** 루트 폴더 생성 테스트가 없다.

### Pitfall 6: 형제 이름 중복을 막는 unique index를 실수로 추가
**What goes wrong:** CONTEXT.md가 명시적으로 "형제 간 중복 이름 허용(스키마에 sibling-unique 제약 없음)"이라고 잠갔다. `(parent_id, name)` unique index를 추가하면 이 잠금 결정을 위반한다.
**Why it happens:** 대부분의 파일시스템/폴더 UI는 형제 유일성을 기대하므로 습관적으로 추가하기 쉽다.
**How to avoid:** 스키마에 어떤 형태로든 이름 유일성 제약을 추가하지 않는다. 서버 검증은 trim/비어있지않음/255자만.

### Pitfall 7: DnD `dragover`에서 `preventDefault()`를 호출하지 않아 drop이 아예 발생하지 않음
**What goes wrong:** 기본적으로 대부분의 엘리먼트는 드롭 대상이 아니다. `dragover`에서 `preventDefault()`를 호출하지 않으면 `drop` 이벤트 자체가 발생하지 않는다([CITED: developer.mozilla.org/docs/Web/API/HTML_Drag_and_Drop_API], Firefox 52+는 이를 엄격히 강제).
**Why it happens:** `drop` 핸들러만 작성하고 `dragover`를 빼먹는 실수가 흔하다.
**How to avoid:** Pattern 6처럼 유효한 대상일 때만 `dragover`에서 `preventDefault()` 호출 — 사이클 대상(거부)일 땐 호출하지 않아 브라우저 기본 "금지" 커서가 자연스럽게 뜨게 둔다(UI-SPEC이 요구하는 정확한 동작).

## Code Examples

### zod 폴더 이름 스키마 (기존 `workspaceSchema` 패턴 재사용)
```typescript
// src/lib/validation.ts에 추가 — Source: [VERIFIED: src/lib/validation.ts:28-34] 기존 workspaceSchema 패턴
// "name: z.string().trim().min(1, "워크스페이스 이름을 입력해 주세요.").max(100, ...)" 과 동일 구조,
// CONTEXT.md 잠금값(비어있지않음·trim·최대 255자)만 다르게 적용
export const folderSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "폴더 이름을 입력해 주세요.")
    .max(255, "폴더 이름은 255자를 넘을 수 없습니다."),
});
export type FolderInput = z.infer<typeof folderSchema>;
```

### 라우트 핸들러 골격 — 이름변경 (기존 DELETE workspace 라우트 패턴 재사용)
```typescript
// src/app/api/folders/[id]/route.ts
// Source: [VERIFIED: src/app/api/workspaces/[id]/route.ts:13-38] 동일 구조(zod path 검증 → 대상 조회 →
// requireRole → 업데이트 → 204/200)를 folder에 맞게 이식. 코드 자체는 새로 작성.
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { folder } from "@/db/schema";
import { ForbiddenError, forbiddenResponse, requireRole } from "@/lib/rbac";
import { folderSchema } from "@/lib/validation";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const [target] = await db.select({ workspaceId: folder.workspaceId }).from(folder).where(eq(folder.id, id));
  if (!target) return forbiddenResponse(); // 존재하지 않음 = 멤버십도 확인 불가 = 403 (기존 workspace DELETE 패턴과 동일)

  try {
    await requireRole(target.workspaceId, "EDITOR");
  } catch (err) {
    if (err instanceof ForbiddenError) return forbiddenResponse();
    throw err;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const parsed = folderSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "잘못된 요청입니다." }, { status: 400 });
  }

  await db.update(folder).set({ name: parsed.data.name, updatedAt: new Date() }).where(eq(folder.id, id));
  return new Response(null, { status: 204 });
}
```

### 쿼리 개수 단언 — postgres.js `debug` 훅
```typescript
// tests/folder/query-count.test.ts — Source: [CITED: github.com/porsager/postgres README]
// "debug: (connection, query, params, types) => {...}" — 실행된 SQL 문마다 1회 호출.
// 프로덕션 src/db/index.ts는 건드리지 않고, 테스트 전용 별도 postgres 클라이언트로 같은
// DATABASE_URL_TEST에 연결해 카운트만 관찰한다(운영 클라이언트에 디버그 훅을 상시 심지 않음).
import { afterAll, beforeAll, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getWorkspaceFolders } from "@/lib/closure";

let queryCount = 0;
const debugClient = postgres(process.env.DATABASE_URL_TEST!, {
  debug: () => {
    queryCount += 1;
  },
});
const debugDb = drizzle(debugClient);

afterAll(() => debugClient.end());

it("getWorkspaceFolders issues exactly 1 SQL statement regardless of tree depth", async () => {
  // beforeEach에서 depth 5+ 트리를 시드했다고 가정
  queryCount = 0;
  await getWorkspaceFolders("<workspaceId>"); // 주의: lib 함수가 공유 db가 아닌 debugDb를 받도록
                                                // 의존성 주입 가능해야 이 테스트가 성립 (closure.ts 함수
                                                // 시그니처에 optional dbClient 인자 권장)
  expect(queryCount).toBe(1);
});
```
**주의(트랜잭션 계열 함수의 카운트):** `db.transaction()`은 postgres.js 레벨에서 `BEGIN`/`COMMIT`(및 필요시 `SAVEPOINT`)을 별도 왕복으로 보낼 수 있다 — `moveFolder`/`createFolder`/`softDeleteFolder`처럼 트랜잭션을 쓰는 함수는 "고정 개수"를 단언하되 그 개수에 BEGIN/COMMIT이 포함될 수 있음을 감안한다(정확한 포함 여부는 이 세션에서 실행 검증하지 않음 — `[ASSUMED]`, Wave 0에서 실제 `debug` 로그를 찍어 확정할 것). 중요한 건 "깊이에 비례해 늘어나지 않는다"는 것이며, 절대 개수는 테스트 작성 시 1회 실행해 확정한다.

## State of the Art

이 phase는 신규 프레임워크 버전 변경이 없다(모든 패키지가 이미 설치되어 있고 TRD가 이미 스택을 확정). 해당 없음.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `sql\`WHERE descendant_id = ${null}\`` 형태의 파라미터 바인딩이 0행 매치를 만든다(SQL 3치 논리) | Common Pitfalls #5, Pattern 3 | 틀리면 워크스페이스 루트 생성 시 예상치 못한 행이 복사되거나 에러 — Wave 0 테스트로 반드시 실행 확인 |
| A2 | `db.transaction()`이 postgres.js 레벨에서 별도 BEGIN/COMMIT 왕복을 만들어 `debug` 콜백 카운트에 포함될 수 있다 | Code Examples §쿼리 개수 단언 | 쿼리 수 단언 테스트의 기대값(1 vs 2 vs 3)이 틀릴 수 있음 — 실제 실행해 debug 로그로 확정 필요, 단언은 "깊이 무관 고정값"으로 작성하고 정확한 절대값은 실행 후 채운다 |
| A3 | `getSubtree`/`getWorkspaceFolders` 등 `lib/closure.ts` 함수가 두 번째 인자로 `db`/`tx`를 선택적으로 받도록 설계하는 것이 트랜잭션 일관성(Pitfall 4)과 테스트 격리(쿼리 카운트 테스트) 둘 다에 필요하다는 설계 판단 | Architecture Patterns, Code Examples | 이 의존성 주입 패턴을 채택하지 않으면 cascade 삭제의 read skew 또는 쿼리 카운트 테스트 불가능 — 플래너가 대안(예: 모든 연산을 항상 트랜잭션으로 감싸기)을 택해도 무방하나 이유는 남겨야 함 |

## Open Questions

1. **API 라우트 정확한 경로/메서드 네이밍**
   - What we know: TRD §8은 `POST/PATCH/DELETE /api/folders*`로만 뭉뚱그려 있고, CONTEXT.md는 "API 라우트 네이밍은... 재량"이라 위임했다.
   - What's unclear: 이동을 `POST /api/folders/:id/move`로 할지 `PATCH /api/folders/:id`에 `parentId` 필드를 포함시켜 통합할지.
   - Recommendation: 이동은 사이클 체크·closure rewiring이라는 이름변경과 전혀 다른 트랜잭션 로직을 타므로 **별도 라우트**(`POST /api/folders/:id/move`)로 분리 — 이름변경(단순 UPDATE)과 섞으면 PATCH 핸들러가 "이름만 바뀌는지 부모도 바뀌는지"를 분기해야 해서 트랜잭션 경계가 흐려진다.

2. **`getSubtree(folderId, dbOrTx)`의 의존성 주입 시그니처를 플래너가 그대로 채택할지**
   - What we know: 이 패턴 없이는 Pitfall 4(cascade 삭제 read skew)와 쿼리 카운트 테스트 격리를 동시에 만족하기 어렵다.
   - What's unclear: 플래너/실행자가 다른 관례(예: 모든 `lib/closure.ts` 함수가 항상 자체 `db.transaction`을 열고, cascade 삭제는 여러 개의 작은 트랜잭션 대신 통째로 하나의 트랜잭션 함수로 인라인)를 택할 수도 있다.
   - Recommendation: 최소 요구사항은 "cascade 삭제의 서브트리 조회와 UPDATE가 같은 트랜잭션 안에 있어야 한다"는 것 — 구체적 함수 시그니처는 실행자 재량으로 두되 이 불변식은 태스크 verification에 명시.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL (Homebrew PG16 @ 5433) | 스키마 마이그레이션 + 통합 테스트 | ✓ | `pg_isready` 응답 확인됨(2026-08-08) | — |
| Node.js | 빌드/테스트 런타임 | ✓ | v24.2.0 | — |
| pnpm | 패키지 매니저(고정) | ✓ | 10.18.3 | — |

**Missing dependencies with no fallback:** 없음.
**Missing dependencies with fallback:** 없음 — 이 phase에 필요한 모든 도구가 이미 로컬에 준비되어 있다.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10(통합/유닛) + Playwright 1.62.1(트리 UI·DnD·계층 렌더) [VERIFIED: package.json devDependencies] `"vitest": "4.1.10"`, `"@playwright/test": "1.62.1"` |
| Config file | `vitest.config.ts`(environment: "node", 신규 jsdom/testing-library 미설치 — 컴포넌트 렌더 단위 테스트는 이 인프라로 불가), `playwright.config.ts`(실브라우저) |
| Quick run command | `pnpm vitest run tests/folder/<file>.test.ts` |
| Full suite command | `pnpm vitest run && pnpm exec playwright test` |

**중요 발견 [VERIFIED: package.json devDependencies 전체 확인, jsdom/@testing-library 항목 없음]:** `vitest.config.ts`가 `environment: "node"`로 고정돼 있고 jsdom/happy-dom/testing-library가 설치돼 있지 않다. 즉 "FolderTree 컴포넌트를 마운트해 렌더 결과를 단언"하는 식의 Vitest 컴포넌트 테스트는 **이 인프라로 지원되지 않는다**(신규 의존성 추가 없이는). TREE-01(계층 표시)·DnD·컨텍스트 메뉴 상호작용은 기존 e2e 스펙들과 동일하게 **Playwright**로 검증한다 — 이미 설치돼 있고, HTML5 네이티브 DnD(dragstart/dragover/drop 이벤트 시퀀스)를 실브라우저에서 그대로 재현할 수 있다.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TREE-01 | 사이드바가 워크스페이스>폴더>자식폴더 계층을 표시 | e2e (Playwright) | `pnpm exec playwright test e2e/folder-tree.spec.ts` | ❌ Wave 0 |
| TREE-02 | 서브트리 조회가 트리 깊이와 무관한 고정 쿼리 수 | integration (Vitest, `debug` 훅) | `pnpm vitest run tests/folder/query-count.test.ts` | ❌ Wave 0 |
| TREE-02 | 서브트리 조회가 실제로 올바른 폴더 집합을 반환(정합성) | integration (Vitest, 실 Postgres) | `pnpm vitest run tests/folder/closure.test.ts -t "getSubtree"` | ❌ Wave 0 |
| TREE-03 | 생성이 조상 복사 + self 행을 정확히 만든다(루트 생성 포함, Pitfall 5) | integration (Vitest) | `pnpm vitest run tests/folder/closure.test.ts -t "createFolder"` | ❌ Wave 0 |
| TREE-03 | 이름변경이 EDITOR+에서만 동작(403 매트릭스) | integration (Vitest, RBAC 매트릭스 패턴 재사용) | `pnpm vitest run tests/folder/rbac.test.ts` | ❌ Wave 0 |
| TREE-03 | 이동이 서브트리 내부 링크는 보존하고 외부 링크만 재작성 | integration (Vitest) | `pnpm vitest run tests/folder/closure.test.ts -t "moveFolder"` | ❌ Wave 0 |
| TREE-03 | 자기 자손으로 이동은 rewiring 전 거부(사이클) — 자기 자신으로 이동도 포함 | integration (Vitest) | `pnpm vitest run tests/folder/closure.test.ts -t "cycle"` | ❌ Wave 0 |
| TREE-03 | 소프트삭제가 서브트리 전체를 cascade하고 closure 행은 보존 | integration (Vitest) | `pnpm vitest run tests/folder/closure.test.ts -t "softDelete"` | ❌ Wave 0 |
| TREE-03 | DnD 드롭이 이동 API를 호출하고 트리가 재조회된다 | e2e (Playwright, `dragTo`/`dragAndDrop`) | `pnpm exec playwright test e2e/folder-tree.spec.ts -g "drag"` | ❌ Wave 0 |
| (교차 검증) | 크로스 워크스페이스 IDOR 방지(Pitfall 2·3) | integration (Vitest) | `pnpm vitest run tests/folder/cross-workspace.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** 해당 태스크가 건드리는 파일의 quick run (예: `pnpm vitest run tests/folder/closure.test.ts`)
- **Per wave merge:** `pnpm vitest run && pnpm exec playwright test`
- **Phase gate:** Full suite green (기존 759개 Vitest 테스트 + 신규 폴더 테스트 + 기존 e2e 스펙 + 신규 `folder-tree.spec.ts`) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/folder/closure.test.ts` — createFolder/moveFolder/softDeleteFolder/getSubtree/getWorkspaceFolders 정합성 (TRD §10 TDD 순서: 구현보다 먼저 커밋)
- [ ] `tests/folder/query-count.test.ts` — TREE-02 고정 쿼리 수 단언(postgres.js `debug` 훅)
- [ ] `tests/folder/rbac.test.ts` — 폴더 CRUD/이동/삭제 EDITOR+ 매트릭스 (기존 `tests/rbac/matrix.test.ts` + `tests/rbac/helpers.ts` 패턴 재사용, `addMember`/`mockSessionFor` 그대로 사용 가능)
- [ ] `tests/folder/cross-workspace.test.ts` — Pitfall 2·3 IDOR 방지 회귀 테스트
- [ ] `e2e/folder-tree.spec.ts` — TREE-01 계층 표시 + DnD 이동 + 컨텍스트 메뉴 + 인라인 이름변경 (기존 `e2e/workspace-create.spec.ts` 패턴처럼 실 signup→workspace 흐름 위에 작성)
- [ ] `src/lib/validation.ts`에 `folderSchema` 추가(신규 파일 아님, 기존 파일 확장이므로 Wave 0 "신규 파일" 목록엔 없지만 테스트보다 먼저 커밋되어야 하는 대상은 아님 — zod 스키마 자체는 구현물이라 TDD 대상)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Phase 1에서 이미 확정(Auth.js v5), 이 phase는 변경 없음 |
| V3 Session Management | no | 상동 |
| V4 Access Control | yes | `requireRole(workspaceId, "EDITOR")` 재사용 — 단, workspaceId는 반드시 서버가 대상 folder 행에서 조회(Pitfall 3), 클라이언트 제공값 금지 |
| V5 Input Validation | yes | zod `folderSchema`(trim/비어있지않음/≤255) + `z.uuid()` path 파라미터 검증(기존 `WR-05` 패턴 재사용) |
| V6 Cryptography | no | 해당 없음 |

### Known Threat Patterns for {Next.js Route Handler + Drizzle + Postgres}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL Injection via `sql` 템플릿에 원문 문자열 삽입 | Tampering | Drizzle `sql\`...${value}...\`` 파라미터 바인딩만 사용, `sql.raw()`에 사용자 입력 금지([CITED: orm.drizzle.team/docs/sql] — 인터폴레이션된 값은 자동 파라미터화됨) |
| IDOR — 폴더 id는 알지만 그 워크스페이스 멤버가 아닌 사용자가 이동/삭제 요청 | Elevation of Privilege | `requireRole`이 매 요청마다 DB에서 멤버십 재조회(이미 구현됨) + workspaceId를 폴더 행에서 서버가 직접 조회(Pitfall 3) |
| 크로스 워크스페이스 트리 오염(다른 워크스페이스 폴더를 부모로 지정) | Tampering | 생성/이동 시 parentId/newParentId의 workspace_id를 대상과 비교 검증(Pitfall 2) |
| 클라이언트 사이클 판정을 서버가 생략(신뢰) | Tampering | 서버가 동일 트랜잭션에서 반드시 재검증(Pattern 4) — 클라이언트 판정은 UX 보조일 뿐 |
| 사이클 체크와 rewiring 사이 레이스(TOCTOU) | Tampering | 단일 `db.transaction` 안에서 순차 실행(Pitfall 1) |

## Sources

### Primary (HIGH confidence)
- 없음 — context7 MCP가 이 세션 환경에서 사용 불가해(도구 미등록) 전부 WebSearch로 대체 조사했다.

### Secondary (MEDIUM confidence)
- WebSearch → orm.drizzle.team/docs/transactions — `db.transaction()` 자동 커밋/롤백 시맨틱
- WebSearch → orm.drizzle.team/docs/sql — `sql` 템플릿 파라미터 바인딩, `db.execute(sql\`...\`)`
- WebSearch → github.com/porsager/postgres README — `debug: (connection, query, params, types) => {}` 콜백 시그니처
- WebSearch → developer.mozilla.org/docs/Web/API/HTML_Drag_and_Drop_API — `dataTransfer.setData()`는 dragstart에서만, `dragover`의 `preventDefault()` 필수
- WebSearch → percona.com/blog/moving-subtrees-in-closure-table (Bill Karwin 패턴) — closure table 이동/사이클 체크 표준 절차, TRD §4가 이미 이 패턴을 따르고 있음을 교차 확인

### Tertiary (LOW confidence)
- 없음

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — 전부 이미 설치된 패키지, `package.json`에서 직접 읽음([VERIFIED])
- Architecture (Closure Table SQL 4연산): HIGH — TRD §4/§3을 직접 읽고 이식, 재설계 없음. 단, "초기 트리는 평면 쿼리" 발견은 이 세션의 추론([VERIFIED: TRD §3/§4] 교차 확인이지만 명시적으로 문서화되어 있지 않은 결론이므로 discuss-phase나 플랜 체크 단계에서 한 번 더 확인 권장)
- DnD/쿼리 카운트 테스트 패턴: MEDIUM — WebSearch가 공식 문서(MDN, drizzle-orm 공식 docs, porsager/postgres README)를 인용했지만 context7로 원문을 직접 fetch하지 못해 MEDIUM으로 분류
- 트랜잭션 내 BEGIN/COMMIT의 `debug` 카운트 포함 여부(A2): LOW/ASSUMED — Wave 0 실행 검증 필요

**Research date:** 2026-08-08
**Valid until:** 2026-09-07 (30일 — 스택이 이미 고정되어 안정적, 빠르게 변하는 영역 아님)
