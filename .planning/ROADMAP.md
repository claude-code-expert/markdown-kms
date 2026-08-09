# Roadmap: markdown-kms

## Overview

markdown-kms goes from an empty repo to a full workspace-based markdown KMS in eight phases, following the dependency graph validated by research rather than the spec's section order. Phase 1 lays the schema/auth/RBAC foundation every later phase reads from. Phase 2 builds the markdown pipeline and editor plugins as one user-facing capability (accurate, safe, fast preview) — functionally independent of auth, but sequenced second. Phase 3 adds the Closure Table folder tree. Phase 4 is where documents, autosave's seq guard, and the 3-pane screen converge — the first point at which a user can actually author and save a document end to end. Phases 5-7 layer R2 (P1) capability on top: editor polish, tags/search/export, and workspace collaboration. Phase 8 closes with the two P2 (R3) capabilities — presentation mode and Google sign-in — deliberately last per priority ordering.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Auth & Workspace Foundation** - Users can sign up, stay signed in, and land in a role-enforced default workspace (completed 2026-08-02)
- [x] **Phase 2: Markdown Rendering & Editor Formatting** - Users can format markdown and see an accurate, safe, 60ms live preview (completed 2026-08-08)
- [ ] **Phase 3: Folder Tree (Closure Table)** - Users can organize documents into a folder hierarchy with single-query subtree lookups
- [ ] **Phase 4: Documents, Autosave & 3-Pane Workspace** - Users can author documents in the full 3-pane screen with reliable, seq-guarded autosave and a recoverable trash
- [ ] **Phase 5: Editor Enhancements & Personalization** - Users get image upload, toolbar polish, crash-recovery drafts, and theme/layout switching
- [ ] **Phase 6: Tags, Search & Export** - Users can tag, search, and export their documents
- [ ] **Phase 7: Workspace Collaboration (Join & Invite)** - Owners/Admins can grow membership via join requests and email invitations
- [ ] **Phase 8: Presentation Mode & Google Sign-In** - Users can present a document fullscreen and sign in with Google

## Phase Details

### Phase 1: Auth & Workspace Foundation

**Goal**: Users can create an account, stay signed in, and land in a role-enforced workspace
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, WS-01, WS-02
**Success Criteria** (what must be TRUE):

  1. User can sign up with email+password and is immediately logged in.
  2. Login session persists across a browser refresh.
  3. New user is auto-joined to a default workspace as EDITOR and sees it in the sidebar.
  4. Any member can create a workspace and becomes its OWNER; only the OWNER can delete it.
  5. Server rejects an action outside the caller's role with 403, per the Owner/Admin/Editor/Viewer matrix.

**Plans**: 5/5 plans executed
**Wave 1**

- [x] 01-01-PLAN.md — Foundation: scaffold Next.js 15 + Drizzle/Postgres + schema + migrate + seed default workspace

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Auth tracer: signup + JWT session + minimal dashboard (walking skeleton end-to-end)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — Auth UI: login/signup/dashboard + ui-kit port (loading/error boundaries)
- [x] 01-04-PLAN.md — RBAC gate (requireRole 403) + workspace create/delete API + login rate-limit

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 01-05-PLAN.md — Workspace UI: create modal (E4) + delete dialog (E5) + /w/[wsId] placeholder

**UI hint**: yes

### Phase 2: Markdown Rendering & Editor Formatting

**Goal**: Users can format markdown through the toolbar or syntax and see an accurate, safe, fast live preview
**Depends on**: Phase 1 (sequencing only — the markdown pipeline and editor plugins have no functional dependency on auth/schema and could build in parallel with Phase 1)
**Requirements**: EDIT-01, EDIT-02, EDIT-03, EDIT-04, EDIT-05, EDIT-06, EDIT-08
**Success Criteria** (what must be TRUE):

  1. User can apply heading (H1-H4/P), inline (bold/italic/strikethrough/code), list (bullet/ordered/task), block (blockquote/code block/hr), and insert (link/image/table) formatting via the toolbar interface or markdown syntax.
  2. Preview updates to match CommonMark 0.31.2 + GFM output within 60ms p95 for a 10,000-character document.
  3. `<script>` tags, event-handler attributes, and `javascript:` URLs never execute in the preview pane.
  4. GFM task-list checkboxes render correctly despite HTML sanitization (sanitize schema explicitly extended for input/del/table, not left at the sanitizer's stripped default).
  5. Typing Korean text via IME composes correctly without corruption or dropped characters — the editor runs uncontrolled (mounted once, mutated only via `dispatch()`) and never re-pushes external content mid-composition.

**Plans**: 6/6 plans executed

**Wave 1**

- [x] 02-01-PLAN.md — Install pipeline+CodeMirror packages; pipeline/GFM/sanitize failing tests (TDD red, EDIT-08)

**Wave 2** *(blocked on Wave 1)*

- [x] 02-02-PLAN.md — 14 editor-plugin failing tests + 60ms perf harness (TDD red, exact D-P2-08 fixtures)

**Wave 3** *(blocked on Wave 2)*

- [x] 02-03-PLAN.md — TRACER: bold end-to-end (shared pipeline + uncontrolled EditorHost + PreviewPane + assemblable 2-pane layout + toolbar + host route)

**Wave 4** *(blocked on Wave 3, parallel)*

- [x] 02-04-PLAN.md — Plugin expansion: remaining 13 plugins + full lucide toolbar + heading dropdown
- [x] 02-05-PLAN.md — EDIT-06 60ms p95 measurement (measure-first) + consolidated end-of-phase verification

**Gap Closure (Wave 5)** *(from 02-REVIEW.md / 02-VERIFICATION.md — 6 defects where pinned fixtures encoded output never rendered through the real pipeline)*

- [x] 02-06-PLAN.md — Plugin-output→pipeline→HTML integration gate + hr/table/code-block/heading/PreviewPane fixes (GAP-1..6)

**UI hint**: yes

### Phase 3: Folder Tree (Closure Table)

**Goal**: Users can organize documents into a folder hierarchy backed by an efficient tree store
**Depends on**: Phase 1
**Requirements**: TREE-01, TREE-02, TREE-03
**Success Criteria** (what must be TRUE):

  1. Sidebar shows the workspace > folder > child folder > document hierarchy.
  2. Folder subtree lookups run as a single query against a Closure Table, not recursive N+1 calls.
  3. Creating, renaming, moving, and soft-deleting a folder all work correctly.
  4. Moving a folder into one of its own descendants is rejected by a same-transaction ancestor/cycle check before any rewiring happens.

**Plans**: 5/5 plans executed

**Wave 1**

- [x] 03-01-PLAN.md — folder/folder_closure 스키마 + 마이그레이션 (one-way 게이트)

**Wave 2** *(blocked on Wave 1)*

- [x] 03-02-PLAN.md — TRACER: 새 폴더 생성 end-to-end (closure create + getWorkspaceFolders + POST route + 사이드바 트리 + 생성 입력)

**Wave 3** *(blocked on Wave 2)*

- [x] 03-03-PLAN.md — closure 연산 확장: getSubtree / moveFolder(사이클·크로스ws) / softDeleteFolder cascade

**Wave 4** *(blocked on Wave 3)*

- [x] 03-04-PLAN.md — 폴더 변경 라우트 + RBAC/IDOR: 이름변경·소프트삭제·이동 (EDITOR+, workspace_id 서버 재조회)

**Wave 5** *(blocked on Wave 4)*

- [x] 03-05-PLAN.md — 트리 UI: 컨텍스트 메뉴 + 인라인 이름변경 + 네이티브 DnD + 이동 모달 + 삭제 확인 + e2e

**UI hint**: yes

### Phase 4: Documents, Autosave & 3-Pane Workspace

**Goal**: Users can create, edit, and manage documents inside the full 3-pane workspace with reliable autosave and a recoverable trash
**Depends on**: Phase 2, Phase 3
**Requirements**: DOC-01, DOC-02, EDIT-07
**Success Criteria** (what must be TRUE):

  1. The workspace screen shows the folder sidebar, editor, live preview, and status bar together, and a document opened from the tree loads into the editor.
  2. User can create, edit, and soft-delete a document; a deleted document appears in the trash immediately.
  3. A 1-second pause in typing triggers autosave; the status bar cycles saving -> saved/failed(retry), and shows "저장됨" only for the response matching the latest sent seq — an out-of-order (stale) response is ignored and never overwrites a newer status.
  4. Trash supports cascade restore (to original location or root) and permanent delete, with permanent delete gated to ADMIN and above.

**Plans**: 5/5 plans executed

**Wave 1**

- [x] 04-01-PLAN.md — Foundation: document 스키마 + 마이그레이션(one-way 게이트) + lib/documents.ts 서비스 + seq-가드 통합 테스트

**Wave 2** *(blocked on Wave 1)*

- [x] 04-02-PLAN.md — TRACER: 새 문서 생성 → 3분할 열기 → 입력 → 자동저장(seq 가드) → 새로고침 복원 end-to-end

**Wave 3** *(blocked on Wave 2, parallel)*

- [x] 04-03-PLAN.md — 문서 소프트삭제 라우트(EDITOR·IDOR) + 트리 문서 노드 '삭제' 메뉴/확인 + 열람중 이탈
- [x] 04-04-PLAN.md — 휴지통 백엔드: 폴더 cascade + 복원(독립-트래시 보존·루트 재배치) + 완전삭제(FK 순서·ADMIN) + 통합 trash 라우트

**Wave 4** *(blocked on Wave 3)*

- [x] 04-05-PLAN.md — 휴지통 UI: 목록 RSC + 복원/완전삭제 + 루트 배너 + 권한 게이팅 + 사이드바 링크 + 왕복 e2e

**UI hint**: yes

### Phase 5: Editor Enhancements & Personalization

**Goal**: Users get a richer, safer, more personalized editing experience
**Depends on**: Phase 4
**Requirements**: EDIT-09, EDIT-10, EDIT-11, EDIT-12
**Success Criteria** (what must be TRUE):

  1. Uploading an image inserts its markdown at the cursor position once the upload completes.
  2. Toolbar buttons show lucide icons, a tooltip within 300ms of hover, and a pressed state on click.
  3. A 1-minute snapshot autosave lets the user recover unsaved work after a crash; re-entering a document with a newer snapshot prompts to restore it.
  4. User can switch between light/dark theme and split/editor-only/preview-only layout.

**Plans**: 7/7 plans executed

**Wave 1** *(parallel — zero file overlap)*

- [x] 05-01-PLAN.md — TRACER: 이미지 업로드 end-to-end (storage 매직바이트 + uploads 라우트 + getView 상위 노출 + useImageUpload 버튼 경로) [EDIT-09]
- [x] 05-03-PLAN.md — draft 백엔드 기반: 마이그레이션(one-way gate) + documentDraft 스키마 + upsert/get/delete 서비스 + draftBodySchema [EDIT-11]
- [x] 05-07-PLAN.md — 테마: 다크 토큰 override + @media 폴백 + RSC 쿠키 SSR + 테마 토글 + 툴바 pressed/300ms CSS [EDIT-12, EDIT-10]

**Wave 2** *(parallel — blocked on Wave 1)*

- [x] 05-02-PLAN.md — 이미지 업로드 UX 확장: 드롭존 오버레이 + 에러 배너 3종 [EDIT-09] *(depends: 05-01)*
- [x] 05-04-PLAN.md — draft 라우트(PUT/DELETE) + 자동저장 성공 게이트 draft 삭제(Pitfall 5) + 60초 순수 컨트롤러 [EDIT-11] *(depends: 05-03)*

**Wave 3** *(blocked on Wave 2)*

- [x] 05-08-PLAN.md — 레이아웃 모드(split/editor-only/preview-only) + 패널 리사이즈(20~80% 클램프) + 쿠키 영속 [EDIT-12] *(depends: 05-02)*

**Wave 4** *(blocked on Wave 3)*

- [x] 05-05-PLAN.md — draft 복구 다이얼로그 + RSC 최신 비교 + uncontrolled 에디터 적재 배선 [EDIT-11] *(depends: 05-01, 05-04, 05-08)*

**UI hint**: yes

### Phase 6: Tags, Search & Export

**Goal**: Users can categorize, find, and extract their documents
**Depends on**: Phase 4, Phase 3
**Requirements**: DOC-03, DOC-04, EXP-01, EXP-02
**Success Criteria** (what must be TRUE):

  1. A document accepts up to 3 tags; a 4th tag is rejected on both client and server.
  2. Searching by title, body, or tag returns matches, with input normalized to NFC before comparison so Korean pg_trgm search isn't broken by NFC/NFD mismatches.
  3. User can download a single document as a lossless `.md` file.
  4. User can download a folder's full subtree as a structure-preserving `.zip`.

**Plans**: 4/4 plans executed

**Wave 1**

- [x] 06-01-PLAN.md — Foundation: document_tag 스키마 + pg_trgm custom SQL 마이그레이션(one-way 게이트) + NFC 백필 + 저장 NFC 정규화 + tagsBodySchema + archiver 설치

**Wave 2** *(blocked on Wave 1)*

- [x] 06-02-PLAN.md — TRACER: 태그 end-to-end (replaceTags 트랜잭션 + PUT /tags(EDITOR·COUNT 400) + TagBar + 마운트 + RSC 초기값) [DOC-03]

**Wave 3** *(blocked on Wave 2)*

- [x] 06-03-PLAN.md — 검색: searchWorkspace(pg_trgm ILIKE·질의 NFC·파라미터 바인딩·VIEWER) + SearchBox(debounce·레이스 가드) + FolderTree 마운트 [DOC-04]

**Wave 4** *(blocked on Wave 3 — FolderTree.tsx 공유)*

- [x] 06-04-PLAN.md — Export: .md 원문(EXP-01) + 폴더 .zip archiver 스트리밍·zip-slip sanitize(EXP-02) + 컨텍스트 메뉴 항목 + 다운로드 트리거

**UI hint**: yes

### Phase 7: Workspace Collaboration (Join & Invite)

**Goal**: Owners and Admins can grow workspace membership through join requests and invitations
**Depends on**: Phase 1
**Requirements**: WS-03, WS-04, WS-05
**Success Criteria** (what must be TRUE):

  1. A member can submit a join request to a workspace.
  2. Owner or Admin can approve or reject a pending join request.
  3. Owner or Admin can search members and send an invite email; clicking the signed, one-time, expiring link admits the invitee as EDITOR.

**Plans**: 5/5 plans executed

**Wave 1**

- [x] 07-01-PLAN.md — Foundation: invitation/workspace_join_request 스키마 + 마이그레이션(one-way 게이트) + HMAC 토큰 encode/verify 순수 헬퍼

**Wave 2** *(blocked on Wave 1)*

- [x] 07-02-PLAN.md — TRACER: 초대 발급→콘솔 메일→수락→EDITOR 편입 스파인 (mailer + invitations.ts 5-상태 + POST 라우트 + accept RSC) [WS-05]

**Wave 3** *(blocked on Wave 2, parallel)*

- [x] 07-03-PLAN.md — 가입 신청 백엔드: join-requests.ts + POST(회원 신청) + PATCH(ADMIN 승인/거절 EDITOR 편입) [WS-03, WS-04]
- [x] 07-04-PLAN.md — 회원 검색/데이터: member-search.ts(ILIKE·isMember) + members.ts(멤버/PENDING 목록) + members/search 라우트 [WS-05]

**Wave 4** *(blocked on Wave 3)*

- [x] 07-05-PLAN.md — UI 통합: 멤버 페이지(승인/거절·초대) + 대시보드 참여 신청 + FolderTree 멤버 링크 [WS-03, WS-04, WS-05]

### Phase 8: Presentation Mode & Google Sign-In

**Goal**: Users can present a document fullscreen and sign in with Google
**Depends on**: Phase 2, Phase 1
**Requirements**: PRES-01, PRES-02, AUTH-04
**Success Criteria** (what must be TRUE):

  1. User can enter a fullscreen presentation mode from the editor.
  2. User can move between sections via the TOC navigation panel or keyboard (←/→, PgUp/PgDn).
  3. User can log in with a Google account via a provider added to the existing Auth.js configuration, with no changes to core auth logic.

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Auth & Workspace Foundation | 5/5 | Complete    | 2026-08-02 |
| 2. Markdown Rendering & Editor Formatting | 6/6 | Complete    | 2026-08-08 |
| 3. Folder Tree (Closure Table) | 5/5 | In Progress|  |
| 4. Documents, Autosave & 3-Pane Workspace | 5/5 | In Progress|  |
| 5. Editor Enhancements & Personalization | 7/7 | In Progress|  |
| 6. Tags, Search & Export | 4/4 | In Progress|  |
| 7. Workspace Collaboration (Join & Invite) | 5/5 | In Progress|  |
| 8. Presentation Mode & Google Sign-In | 0/TBD | Not started | - |
