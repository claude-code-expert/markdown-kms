# Phase 4: Documents, Autosave & 3-Pane Workspace - Context

**Gathered:** 2026-08-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2(에디터·미리보기)와 Phase 3(폴더 트리)를 문서 위에서 수렴시킨다. 3분할 화면(사이드바 + 에디터 + 미리보기 + 하단 저장 상태 바)에서 문서를 생성·편집·소프트삭제하고, 1초 디바운스 seq-가드 자동저장으로 안정 저장하며, 휴지통에서 복원·완전삭제한다.

**이 phase가 하는 것:** document 스키마·마이그레이션, 문서 CRUD + 자동저장 API(seq 가드), 3분할 레이아웃 조립·문서 열기, 저장 상태 바, 휴지통 뷰(복원·완전삭제).
**이 phase가 안 하는 것:** 임시저장/크래시 복구 draft(FR-E10 = **Phase 5**), 이미지 업로드·툴바 폴리시·테마/레이아웃 전환(Phase 5), 태그·검색·export(Phase 6). document_tag/document_draft 테이블은 여기서 만들지 않는다(각각 Phase 6/5).
</domain>

<decisions>
## Implementation Decisions

### 3분할 + 문서 라이프사이클
- 레이아웃: 고정 3분할 — 사이드바 260px + 에디터|미리보기 1:1 + 하단 저장 상태 바. 리사이즈 핸들은 Phase 5(layout switching)로 미룸.
- 문서 열기: URL 라우트 `w/[wsId]/d/[docId]`. `w/[wsId]/layout.tsx`가 사이드바를 공유하고, `d/[docId]/page.tsx`(RSC)가 문서를 로드해 에디터에 적재 → 딥링크·새로고침 복원. (클라 상태-only는 새로고침 소실이라 배제.)
- 새 문서 생성: 폴더 컨텍스트 메뉴 "새 문서" + 루트 헤더 버튼(폴더 생성과 대칭). 생성된 문서는 트리에 문서 노드로 표시(folder_id 기준, NULL=루트 직속).
- 제목 편집: 에디터 상단 제목 입력(`document.title`). 자동저장 payload에 title 포함.

### 자동저장 + 상태바 (TRD §7 — 확정, 재논의 아님)
- 1초 디바운스 → `PUT /api/documents/:id { content, title, seq }`. `seq`는 에디터 세션 단조증가 정수.
- 서버: `UPDATE document SET content=:c, title=:t, saved_seq=:seq, updated_at=now() WHERE id=:id AND saved_seq < :seq`. 옛 요청은 `saved_seq < seq` 거짓 → 취소 없이 자연 무시(NFR-1.2).
- 클라: in-flight 요청 추적, **최신 전송 seq에 매칭되는 응답에만** "저장됨" 표시 — 역순(stale) 응답은 무시하고 새 상태를 덮지 않는다.
- 상태바 전이: `저장 중` → 2xx `저장됨` / 실패 `저장 실패` + 재시도 버튼(재시도는 현재 내용으로 **새 seq** 발급).
- 문서 열람 시 클라 seq는 서버 `saved_seq`부터 시작. 다중 세션 last-write-wins(PRD §6).

### 휴지통
- 진입: 라우트 `w/[wsId]/trash` (사이드바 하단 "휴지통" 링크).
- 노출: `is_trash_root=true`만(직접 삭제 항목), 폴더·문서 혼합(PRD §2-2).
- 복원: cascade(하위 함께), 원 폴더가 삭제 상태면 워크스페이스 루트로 복원 + UI 안내(PRD §2-3). EDITOR+.
- 완전삭제: ADMIN+ 전용, 확인 다이얼로그, document/folder 행 + closure 행 hard delete(비가역, PRD §3).

### 문서 소프트삭제
- 문서 소프트삭제: `is_deleted=true, deleted_at=now(), is_trash_root=true`. EDITOR+. 폴더 cascade 삭제 시 하위 문서도 소프트삭제되지만 trash_root는 삭제 대상에만(Phase 3 softDeleteFolder 확장 — 이제 document 테이블이 존재하므로 문서까지 cascade).

### Claude's Discretion
- 자동저장 클라 훅 구조(디바운스·in-flight·seq 카운터), 상태바 컴포넌트, 라우트 파일 배치, `EditorPreviewLayout`를 documentId-aware로 확장 vs 새 `DocumentWorkspace` 컴포넌트 — 코드베이스 관례(CSS Modules·ui-kit·zod·requireRole·DbClient 패턴) 따라 재량.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/editor/EditorHost.tsx` — `forwardRef<EditorHostHandle>`, `onChange(content)`. uncontrolled CodeMirror. Phase 4가 초기 content 주입 + onChange를 자동저장에 연결.
- `src/components/preview/PreviewPane.tsx` — `content` prop, sanitize 파이프라인 렌더. 그대로 재사용.
- `src/components/layout/EditorPreviewLayout.tsx` — 현재 로컬 `useState("")`(비영속). Phase 4가 documentId-aware로 확장(서버 content 로드 + 자동저장 배선) 또는 신규 래퍼.
- `src/app/(main)/w/[wsId]/page.tsx` — 현재 FolderTree 사이드바 + EditorPreviewLayout. `layout.tsx`로 사이드바 추출 + `d/[docId]/page.tsx` 신설.
- `src/lib/closure.ts` — `resolveActiveWorkspaceId`·`softDeleteFolder`·DbClient 주입 패턴. document 연산(createDocument/soft-delete/autosave/restore/permanent)이 동일 패턴 따름. folder cascade 삭제가 이제 document까지 확장.
- `src/lib/rbac.ts` — `requireRole`(EDITOR+ 변경, ADMIN+ 완전삭제).
- `src/db/schema.ts` — folder/folder_closure 존재. document 테이블 추가(TRD §3 DDL: saved_seq/is_deleted/is_trash_root).
- `src/app/api/folders/[id]/route.ts` — IDOR-safe 라우트 패턴(workspace_id 서버 재유도) analog.

### Established Patterns
- 서버 전용 RBAC(requireRole), zod 입력 검증, Drizzle `sql`/트랜잭션, DbClient 주입(테스트·트랜잭션 일관성).
- TDD(RED 먼저), CSS Modules + ui-kit 토큰(IBM Plex·accent #2563eb·lucide).
- Closure Table 고정 쿼리 수, 소프트삭제 closure 행 보존(복원=역연산).

### Integration Points
- `/api/documents` (POST create) · `/api/documents/[id]` (GET open / PUT autosave / DELETE soft) · `/api/documents/[id]/restore` · `/api/documents/[id]/permanent`(ADMIN) 또는 통합 trash 라우트.
- 3분할 라우트: `w/[wsId]/layout.tsx`(사이드바) + `d/[docId]/page.tsx`(문서). 트리에 문서 노드 + `w/[wsId]/trash`.
- 로컬 DB: Homebrew PG16 @ 5433, DATABASE_URL은 `.env.local`(main tree). worktree 미사용(순차 main tree 실행).
</code_context>

<specifics>
## Specific Ideas

- seq 가드가 이 phase의 정확성 핵심: 역순 도착 응답이 최신 상태를 덮으면 안 됨(서버 `WHERE saved_seq<:seq` + 클라 최신-seq-매칭). UAT SC3가 이걸 직접 검증.
- 성공 기준(ROADMAP): 3분할 동시 표시·트리에서 문서 열기 / 문서 CRUD+소프트삭제·휴지통 즉시 반영 / 1s 자동저장·상태바 전이·stale seq 무시 / 휴지통 cascade 복원+완전삭제(ADMIN).
</specifics>

<deferred>
## Deferred Ideas

- 임시저장/크래시 복구 draft(document_draft, FR-E10) → Phase 5.
- 이미지 업로드·툴바 폴리시·테마/레이아웃 전환·패널 리사이즈 → Phase 5.
- 태그·검색·export(document_tag) → Phase 6.
- Phase 3 defer된 DnD 시각 2건은 이 phase와 무관(끝에 UAT).
</deferred>
