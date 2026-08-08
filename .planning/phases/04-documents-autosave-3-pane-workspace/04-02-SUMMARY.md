---
phase: 04-documents-autosave-3-pane-workspace
plan: 02
subsystem: editor
tags: [nextjs, drizzle, zod, autosave, codemirror, tdd, tracer]

# Dependency graph
requires:
  - phase: 04-documents-autosave-3-pane-workspace/04-01
    provides: document table (TRD §3), lib/documents.ts service (getDocument/createDocument/autosaveDocument/resolveWorkspaceIdForDocument/getWorkspaceDocuments), server-side seq guard
provides:
  - POST /api/documents (create, EDITOR+, workspaceId server-derived from folderId)
  - PUT /api/documents/[id] (autosave, seq-guarded, EDITOR+, always 200)
  - w/[wsId]/layout.tsx (shared sidebar) + d/[docId]/page.tsx (document RSC, IDOR-guarded) route split
  - createAutosaveController — pure debounce+seq-guard client controller, zero dependencies
  - useAutosave/DocumentWorkspace/SaveStatusBar/EmptyState components
  - DocumentTreeLeaf + "새 문서" tree creation flow
  - end-to-end tracer proof (e2e/document-workspace.spec.ts): create → open → autosave → refresh restore
affects: [04-03, 04-04, 04-05]

# Actuals (#2632)
actuals:
  tokens: 16800
  tasks: 3
  commits: 6

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure controller + thin React hook split: all debounce/seq/stale-discard logic lives in autosave-controller.ts (zero React, testable with vi.useFakeTimers()); useAutosave.ts only owns useState(status) and the fetch-based send closure"
    - "key={docId} on DocumentWorkspace forces a full remount on document switch, resetting title/content local state and the memoized autosave controller in one move — simpler than manually diffing docId in every child's effect"
    - "RSC route split: layout.tsx owns requireRole+notFound+sidebar data (shared across index/d/[docId]/trash); d/[docId]/page.tsx calls lib/documents.getDocument directly, never fetches its own API route"
    - "EditorHost's initialContent is captured via useRef's lazy initializer (read once, mount-once effect deps stay [] — IME safety preserved, RESEARCH Pitfall 3)"

key-files:
  created:
    - src/app/api/documents/route.ts
    - src/app/api/documents/[id]/route.ts
    - src/app/(main)/w/[wsId]/layout.tsx
    - src/app/(main)/w/[wsId]/layout.module.css
    - src/app/(main)/w/[wsId]/d/[docId]/page.tsx
    - src/components/document/autosave-controller.ts
    - src/components/document/useAutosave.ts
    - src/components/document/SaveStatusBar.tsx
    - src/components/document/SaveStatusBar.module.css
    - src/components/document/EmptyState.tsx
    - src/components/document/EmptyState.module.css
    - src/components/document/DocumentWorkspace.tsx
    - src/components/document/DocumentWorkspace.module.css
    - src/components/tree/DocumentTreeLeaf.tsx
    - tests/documents/crud.test.ts
    - tests/documents/idor.test.ts
    - tests/documents/autosave-controller.test.ts
    - e2e/document-workspace.spec.ts
  modified:
    - src/app/(main)/w/[wsId]/page.tsx (shrunk to EmptyState only)
    - src/components/layout/EditorPreviewLayout.tsx (initialContent/onChange props)
    - src/components/editor/EditorHost.tsx (initialContent prop, captured via useRef lazy init)
    - src/components/tree/FolderTree.tsx (documents prop, documentsByFolderId Map, "새 문서" header button+inline creation)
    - src/components/tree/FolderTree.module.css (.headerActions)
    - src/components/tree/FolderTreeNode.tsx (documentsByFolderId ctx, document-only folders get a chevron)
    - src/components/tree/tree-utils.ts (DocumentRow type — buildTree itself untouched)

key-decisions:
  - "autosave-controller's constructor signature dropped the docId param from RESEARCH's reference code — the pure debounce/seq logic never uses it (only useAutosave's useMemo([docId]) dependency needs it, to decide when to recreate the controller instance); keeping it would have been an unused destructured field"
  - "DocumentWorkspace is rendered with key={doc.id} in d/[docId]/page.tsx — the primary fix for RESEARCH Pitfall 2 (stale document's pending save firing against a new doc). The controller's own reset()/dispose() is defense-in-depth on top of this, not the sole mechanism"
  - "layout.tsx's getWorkspaceDocuments call and FolderTree's documents prop were deferred from Task 2 (route split) to Task 3 (tree extension) — Task 2's own commit only threads folders through, avoiding a half-typed FolderTree signature change split awkwardly across two commits"
  - "page.module.css deleted (not left empty) — page.tsx no longer owns any layout styling (moved to layout.module.css) and EmptyState owns its own centering (deletion over addition, ponytail)"
  - "'새 문서' creation is the one flow that both router.refresh()s (so the tree reflects the new leaf) AND router.push()s (opens the document) — folder creation only refreshes, per UI-SPEC's explicit single exception"

requirements-completed: [EDIT-07]  # DOC-01 stays open — its full text requires delete+trash surfacing, which is 04-03's scope (matches the 04-01 precedent of not closing a requirement until its full text is delivered)

coverage:
  - id: D1
    description: "POST /api/documents creates a document (EDITOR+), re-deriving workspaceId server-side from folderId — a client-supplied workspaceId that disagrees is rejected 400, never trusted for authorization"
    requirement: "DOC-01"
    verification:
      - kind: integration
        ref: "tests/documents/crud.test.ts#POST /api/documents (create, EDITOR+)"
        status: pass
    human_judgment: false
  - id: D2
    description: "PUT /api/documents/[id] enforces the TRD §7 seq guard end-to-end through the route layer — a stale/tied seq returns 200 with the server's newest content untouched, never an error"
    requirement: "EDIT-07"
    verification:
      - kind: integration
        ref: "tests/documents/crud.test.ts#PUT /api/documents/[id] (autosave, seq-guarded, EDITOR+) — stale seq case"
        status: pass
    human_judgment: false
  - id: D3
    description: "PUT /api/documents/[id] is workspace-scoped IDOR-guarded — a foreign-workspace document id, a malformed id, and an already-trashed document id are all rejected before any write"
    requirement: "DOC-01"
    verification:
      - kind: integration
        ref: "tests/documents/idor.test.ts#cross-workspace IDOR — PUT /api/documents/[id]"
        status: pass
    human_judgment: false
  - id: D4
    description: "createAutosaveController proves the EDIT-07 correctness core in isolation: 1s debounce (last call wins), a stale response never overwrites a newer status, reset() re-bases seq on document switch, retry() re-sends with a fresh seq, dispose() prevents a post-unmount fire — all without AbortController/fetch signal (NFR-1.2)"
    requirement: "EDIT-07"
    verification:
      - kind: unit
        ref: "tests/documents/autosave-controller.test.ts — 8 tests (debounce, stale-discard x2, reset x2, retry, dispose)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The full tracer path works end-to-end in a real browser: create via tree header button → 3-pane document workspace opens at d/[docId] → typing triggers the 1s-debounced autosave → status bar transitions 저장 중→저장됨 → page refresh restores title+content from the server"
    requirement: "EDIT-07"
    verification:
      - kind: e2e
        ref: "e2e/document-workspace.spec.ts#creates a document, autosaves seq-guarded edits, and restores them after a refresh"
        status: pass
    human_judgment: false
  - id: D6
    description: "Document tree leaves render under their folder (or at root), folders-before-documents, and clicking one navigates to the open document — proven independent of the post-create redirect"
    requirement: "DOC-01"
    verification:
      - kind: e2e
        ref: "e2e/document-workspace.spec.ts#shows the document as a leaf in the tree, indented under folders, opening on click"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-08-08
status: complete
---

# Phase 4 Plan 2: Document Create/Open/Autosave Tracer + 3-Pane Route Split Summary

**End-to-end tracer proving the seq-guarded autosave architecture on a real 3-pane screen: POST/PUT document routes, a zero-dependency pure autosave controller (debounce + stale-response discard), the `w/[wsId]` route split into `layout.tsx`+`d/[docId]/page.tsx`, and a tree "새 문서" creation flow — all verified by a passing Playwright run of create→type→autosave→refresh.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-08T14:18:00+09:00 (context load)
- **Completed:** 2026-08-08T14:35:00+09:00
- **Tasks:** 3 (2 TDD, 1 auto)
- **Files modified:** 26 (17 created, 9 modified)

## Accomplishments
- `POST /api/documents` (create, EDITOR+) and `PUT /api/documents/[id]` (autosave, seq-guarded via `lib/documents.autosaveDocument`, always 200) — both mirror `folders/route.ts`'s server-side workspaceId re-derivation, never trusting a client-supplied value
- `createAutosaveController` — a pure, React-less debounce+seq-guard controller with zero new dependencies. Proven by 8 unit tests that a stale response (out-of-order arrival) never overwrites a newer "saved"/"saving" status, without ever using `AbortController`/fetch `signal` (NFR-1.2)
- `w/[wsId]` route split: `layout.tsx` (shared sidebar + membership gate) / `page.tsx` (empty-state placeholder) / `d/[docId]/page.tsx` (RSC document load, workspace-scoped IDOR guard via `getDocument(docId, wsId)`, never fetches its own API route)
- `DocumentWorkspace` (title input + `EditorPreviewLayout` + `SaveStatusBar`, rendered with `key={docId}`) wires `useAutosave` into both title and body onChange handlers
- Tree extension: `DocumentTreeLeaf` (no draggable, click-to-open via `next/link`, current-document highlight), "새 문서" header button + inline creation that both refreshes the tree and navigates to the new document
- `e2e/document-workspace.spec.ts` proves the whole path end-to-end in a real browser, twice (creation flow, tree-leaf-as-entry-point)

## Task Commits

Each task was committed atomically:

1. **Task 1: 문서 API — POST 생성 + PUT 자동저장(seq 가드) 라우트 (TDD)**
   - RED: `0e9aa0a` (test)
   - GREEN: `8be2567` (feat)
2. **Task 2: 3분할 라우트 리팩터 + DocumentWorkspace + 자동저장 훅/상태바 (TDD 컨트롤러)**
   - RED: `26b528d` (test)
   - GREEN (controller): `8ea3392` (feat)
   - GREEN (route split + DocumentWorkspace): `b43186c` (feat)
3. **Task 3: 트리 문서 노드 + '새 문서' 생성·이동 + tracer e2e** - `3d8aadc` (feat)

_Note: Tasks 1 and 2 are TDD (test → feat); Task 2's controller and route-split work landed as two separate feat commits since only the controller was the TDD-gated deliverable._

## Files Created/Modified
- `src/app/api/documents/route.ts` - POST create, folderId→workspaceId re-derivation (IDOR)
- `src/app/api/documents/[id]/route.ts` - PUT autosave via `autosaveDocument`, always 200
- `src/app/(main)/w/[wsId]/layout.tsx` + `layout.module.css` - shared sidebar, requireRole+notFound+getWorkspaceFolders+getWorkspaceDocuments
- `src/app/(main)/w/[wsId]/page.tsx` - shrunk to `<EmptyState>`; `page.module.css` deleted (styles moved to layout.module.css/EmptyState.module.css)
- `src/app/(main)/w/[wsId]/d/[docId]/page.tsx` - document RSC, `getDocument(docId, wsId)` direct call
- `src/components/document/autosave-controller.ts` - pure debounce+seq-guard controller
- `src/components/document/useAutosave.ts` - thin React wrapper (status state + fetch send)
- `src/components/document/DocumentWorkspace.tsx` + `.module.css` - 3-row title/editor/status-bar
- `src/components/document/SaveStatusBar.tsx` + `.module.css` - 저장 중/저장됨/저장 실패+재시도
- `src/components/document/EmptyState.tsx` + `.module.css` - reusable centered placeholder
- `src/components/editor/EditorHost.tsx` - `initialContent` prop (mount-once injection)
- `src/components/layout/EditorPreviewLayout.tsx` - `initialContent`/`onChange` props threaded to EditorHost
- `src/components/tree/DocumentTreeLeaf.tsx` - document leaf (no draggable, Link-to-open)
- `src/components/tree/FolderTree.tsx` + `.module.css` - `documents` prop, `documentsByFolderId` Map, "새 문서" header button + inline creation
- `src/components/tree/FolderTreeNode.tsx` - renders `DocumentTreeLeaf`s after folder children, document-only folders get a chevron
- `src/components/tree/tree-utils.ts` - `DocumentRow` type (buildTree itself unchanged)
- `tests/documents/crud.test.ts`, `idor.test.ts`, `autosave-controller.test.ts` - 21 tests total
- `e2e/document-workspace.spec.ts` - 2 tracer tests

## Decisions Made
- `autosave-controller`'s constructor dropped the `docId` param present in RESEARCH's reference sketch — the pure debounce/seq algorithm never reads it; only `useAutosave`'s `useMemo([docId])` needs it to decide when to recreate the controller. Keeping an unused field would have been dead weight (ponytail: skip unrequested params).
- `DocumentWorkspace` is rendered with `key={doc.id}` — this is the primary fix for RESEARCH Pitfall 2 (a stale document's pending autosave firing against a newly-opened document). A full remount resets title/content local state and creates a fresh controller in one move; the controller's own `reset()`/`dispose()` are defense-in-depth, not the sole mechanism.
- Deferred `layout.tsx`'s `getWorkspaceDocuments` call and `FolderTree`'s `documents` prop from Task 2 to Task 3's commit — Task 2's own `pnpm tsc --noEmit` gate would otherwise have needed a half-wired `FolderTree` prop signature change landing awkwardly split across two commits. By the end of Task 3, the plan's full acceptance criteria hold.
- `page.module.css` deleted rather than left with dead rules (page.tsx no longer owns any layout CSS after the split) — deletion over addition.
- Document creation is the one flow that both `router.refresh()`s (tree reflects the new leaf) and `router.push()`s (opens the new document) — the single deliberate exception to "creation never navigates" that folder creation follows.

## Deviations from Plan

None — plan executed as written, aside from the Task 2/Task 3 boundary resequencing noted above (functionally identical end state, just a different intra-plan commit split, not an architectural change).

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The tracer path (create→open→autosave→reopen) is proven end-to-end; 04-03/04-04/04-05 can extend this verified slice for soft-delete/trash/restore/permanent-delete without re-proving the autosave/route architecture.
- `GET`/`DELETE` on `/api/documents/[id]` are deliberately absent — 04-03 owns soft-delete (`DELETE`); no RSC needs `GET` (all internal reads go through `lib/documents.ts` directly).
- `createAutosaveController`'s `reset()`/`retry()`/`dispose()` are all already implemented and unit-tested — 04-03's trash/restore UI can reuse `useAutosave`'s pattern without touching the controller.
- No blockers.

---
*Phase: 04-documents-autosave-3-pane-workspace*
*Completed: 2026-08-08*

## Self-Check: PASSED

All created files found on disk (verified below). All 6 task commits (`0e9aa0a`, `8be2567`, `26b528d`, `8ea3392`, `b43186c`, `3d8aadc`) confirmed present in git log.
