# Phase 3: Folder Tree (Closure Table) - Context

**Gathered:** 2026-08-08
**Status:** Ready for planning

<domain>
## Phase Boundary

워크스페이스 안에서 문서를 담을 **폴더 계층**을 Closure Table로 구현한다. 사이드바가 `워크스페이스 > 폴더 > 하위 폴더` 트리를 보여주고, 폴더를 생성·이름변경·이동·소프트삭제할 수 있다. 서브트리 조회는 재귀 없이 Closure Table 단일 쿼리로 수행한다(N+1 금지, NFR-1.3). 폴더를 자기 자손으로 이동하는 사이클은 동일 트랜잭션 조상 체크로 사전 거부한다.

**이 phase가 하는 것:** folder + folder_closure 스키마·마이그레이션, 4연산(생성/이동/이름변경/소프트삭제 cascade) API + 서버 권한, 사이드바 트리 UI.
**이 phase가 안 하는 것:** 문서 CRUD·자동저장·3분할 화면(Phase 4), 휴지통 **뷰 UI**·완전삭제 UI(Phase 4). 폴더 소프트삭제 cascade의 **데이터 연산**은 여기서 구현하되 휴지통 화면은 Phase 4 소관.
</domain>

<decisions>
## Implementation Decisions

### 트리 상호작용 UX
- 생성/이름변경/삭제 트리거: 우클릭 컨텍스트 메뉴 + hover 시 노출되는 액션 버튼.
- 폴더 이동: 드래그앤드롭을 기본으로 하되(사이클은 거부·시각 피드백), "이동" 메뉴를 폴백으로 제공.
- 이름변경: 인라인 제자리 편집(트리 노드가 텍스트 입력으로 전환).
- 펼침/접힘 상태: 클라이언트 임시 상태(비영속) — Phase 2의 비영속 계약과 일관. 영속화는 Phase 4/5로 미룸.

### 범위·쓰기 의미
- Phase 3 삭제 범위: 폴더 소프트삭제 cascade **데이터 연산**만 구현(TRD §4 — 서브트리 폴더/문서에 `is_deleted=true, deleted_at=now()`, 삭제 대상에만 `is_trash_root=true`, closure 행은 보존). 휴지통 **뷰 UI**·복원 화면은 Phase 4.
- UI 갱신: 서버 확정 후 갱신(mutation await → 트리 갱신). 낙관적 UI는 지연이 측정으로 문제될 때만 도입(선제 최적화 금지, Phase 2 60ms 원칙과 동일 태도).
- 폴더 이름 검증: 서버에서 비어있지 않음·trim·최대 255자. 형제 간 중복 이름 허용(스키마에 sibling-unique 제약 없음).
- 초기 트리 로딩: 서버 컴포넌트에서 Closure Table 서브트리 단일 쿼리로 초기 로드(TRD §4). 문서 포함 시 +1 쿼리(문서는 Phase 4에서 합류).

### Locked (TRD §4 / PRD §3·§2 — 확정, 재논의 아님)
- 서브트리 조회: `folder_closure JOIN folder WHERE ancestor_id=:id AND is_deleted=false` 단일 쿼리.
- 폴더 생성: 부모 조상 행 복사(`INSERT ... SELECT ancestor_id, :newId, depth+1 ... WHERE descendant_id=:parentId`) + self 행 `(newId,newId,0)`.
- 폴더 이동: 서브트리 기존 조상 링크 DELETE → 새 부모 조상 × 서브트리 CROSS JOIN INSERT. 사이클은 `(움직일 폴더 → 새 부모)` closure 행 존재 여부로 사전 거부(동일 트랜잭션).
- 권한(서버 `requireRole`, UI 숨김은 보안 아님): 생성·이동·이름변경·소프트삭제 = **EDITOR+**, 완전삭제(휴지통) = **ADMIN+**.
- 복원: `is_trash_root` 기준 서브트리를 `is_deleted=false`로. 원 부모가 삭제 상태면 `parent_id=NULL`(루트)로 재부모화 + closure 재작성 + UI 안내(PRD §2-3).

### Claude's Discretion
- 컨텍스트 메뉴/DnD 라이브러리 선택 또는 자체 구현, 트리 노드 컴포넌트 구조, API 라우트 네이밍은 코드베이스 관례(CSS Modules·ui-kit 토큰·zod 입력 검증) 따라 재량.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/rbac.ts` — `requireRole(workspaceId, minRole)`, `ROLE_RANK`, `forbiddenResponse()`. 모든 변경 API가 경유하는 서버 권한 관문. Phase 3 폴더 변경 API는 EDITOR/ADMIN으로 재사용.
- `src/db/schema.ts` — 현재 user/workspace/workspace_member만 존재. folder·folder_closure 테이블을 TRD §3 DDL대로 추가(document는 Phase 4).
- `src/app/(main)/w/[wsId]/page.tsx` — 워크스페이스 호스트 라우트. `requireRole(wsId,"VIEWER")+notFound()` 게이트 유지. 트리 사이드바가 붙을 자리.
- `src/components/layout/EditorPreviewLayout.tsx` — Phase 2 레이아웃. Phase 3 사이드바는 이후 Phase 4 3분할과 합류하므로 조립 가능하게.

### Established Patterns
- 서버 전용 권한(NFR-3.2), REST Route Handler + zod 입력 검증(TRD §2), Drizzle `sql` 템플릿으로 Closure 벌크 연산(TRD §1).
- CSS Modules + `docs/ui-kit.html` 디자인 토큰(IBM Plex, accent #2563eb, lucide 아이콘).
- TDD: 실패 테스트 먼저 → 최소 구현 → 리팩터(TRD §10). Closure 연산은 통합 테스트로 재귀 없음·사이클 거부·cascade 역연산을 assert.

### Integration Points
- `/api/*` 폴더 CRUD/move 라우트 신규. 트리 사이드바는 `w/[wsId]` 라우트에서 서버 컴포넌트로 초기 서브트리 로드.
- 로컬 postgres: Homebrew PG16 @ 5433 무비번(.env DATABASE_URL). drizzle-kit generate→migrate로 folder 테이블 반영.
</code_context>

<specifics>
## Specific Ideas

- Closure Table 불변식: 삭제해도 closure 행 보존 → 복원이 그대로 역연산. 이동은 서브트리 조상 링크만 재작성(자손 내부 링크 불변).
- 성공 기준(ROADMAP): 사이드바 계층 표시 · 서브트리 단일 쿼리 · 생성/이름변경/이동/소프트삭제 동작 · 자기 자손으로 이동은 rewiring 전 사이클 체크로 거부.
</specifics>

<deferred>
## Deferred Ideas

- 휴지통 뷰 UI·복원 화면·완전삭제(ADMIN) UI → Phase 4.
- 펼침/접힘 상태 영속화, 낙관적 UI → 필요/측정 시 Phase 4/5.
- 문서를 폴더에 넣기·이동(document.folder_id) → Phase 4(문서 도입과 함께).
</deferred>
