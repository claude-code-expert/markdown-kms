# Roadmap: markdown-kms

## Overview

markdown-kms goes from an empty repo to a full workspace-based markdown KMS in eight phases, following the dependency graph validated by research rather than the spec's section order. Phase 1 lays the schema/auth/RBAC foundation every later phase reads from. Phase 2 builds the markdown pipeline and editor plugins as one user-facing capability (accurate, safe, fast preview) — functionally independent of auth, but sequenced second. Phase 3 adds the Closure Table folder tree. Phase 4 is where documents, autosave's seq guard, and the 3-pane screen converge — the first point at which a user can actually author and save a document end to end. Phases 5-7 layer R2 (P1) capability on top: editor polish, tags/search/export, and workspace collaboration. Phase 8 closes with the two P2 (R3) capabilities — presentation mode and Google sign-in — deliberately last per priority ordering.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Auth & Workspace Foundation** - Users can sign up, stay signed in, and land in a role-enforced default workspace
- [ ] **Phase 2: Markdown Rendering & Editor Formatting** - Users can format markdown and see an accurate, safe, 60ms live preview
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

**Plans**: 4/5 plans executed
**Wave 1**

- [x] 01-01-PLAN.md — Foundation: scaffold Next.js 15 + Drizzle/Postgres + schema + migrate + seed default workspace

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Auth tracer: signup + JWT session + minimal dashboard (walking skeleton end-to-end)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — Auth UI: login/signup/dashboard + ui-kit port (loading/error boundaries)
- [x] 01-04-PLAN.md — RBAC gate (requireRole 403) + workspace create/delete API + login rate-limit

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 01-05-PLAN.md — Workspace UI: create modal (E4) + delete dialog (E5) + /w/[wsId] placeholder

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

**Plans**: TBD
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

**Plans**: TBD
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

**Plans**: TBD
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

**Plans**: TBD
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

**Plans**: TBD

### Phase 7: Workspace Collaboration (Join & Invite)

**Goal**: Owners and Admins can grow workspace membership through join requests and invitations
**Depends on**: Phase 1
**Requirements**: WS-03, WS-04, WS-05
**Success Criteria** (what must be TRUE):

  1. A member can submit a join request to a workspace.
  2. Owner or Admin can approve or reject a pending join request.
  3. Owner or Admin can search members and send an invite email; clicking the signed, one-time, expiring link admits the invitee as EDITOR.

**Plans**: TBD

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
| 1. Auth & Workspace Foundation | 4/5 | In Progress|  |
| 2. Markdown Rendering & Editor Formatting | 0/TBD | Not started | - |
| 3. Folder Tree (Closure Table) | 0/TBD | Not started | - |
| 4. Documents, Autosave & 3-Pane Workspace | 0/TBD | Not started | - |
| 5. Editor Enhancements & Personalization | 0/TBD | Not started | - |
| 6. Tags, Search & Export | 0/TBD | Not started | - |
| 7. Workspace Collaboration (Join & Invite) | 0/TBD | Not started | - |
| 8. Presentation Mode & Google Sign-In | 0/TBD | Not started | - |
