# Architecture Research

**Domain:** Workspace-based markdown document management (KMS/wiki), Next.js App Router monolith
**Researched:** 2026-08-01
**Confidence:** HIGH (architecture is a TRD-fixed skeleton — this file validates boundaries/build order against comparable products, does not redesign)

## Standard Architecture

TRD §2 already fixes the skeleton: single Next.js deployment, all preview rendering client-side, all RBAC server-side, Drizzle → PostgreSQL. This matches how comparable single-team-tier KMS/wiki products (Outline, Notion-likes) are built: one full-stack monolith, not a split frontend/API. Outline's own architecture doc confirms the same shape at larger scale (React frontend + Node backend, single repo, document hierarchy + permissions layered over a relational-ish store) — validating that a monolith is the right call here, not an outlier choice for this domain. Source: [outline/docs/ARCHITECTURE.md](https://github.com/outline/outline/blob/main/docs/ARCHITECTURE.md).

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser                                                             │
│  ┌───────────┐  ┌────────────────────┐  ┌────────────────────────┐ │
│  │ Tree pane │  │ Editor (CodeMirror)│  │ Preview (unified render)│ │
│  │ (client)  │  │ (client-only)      │  │ (client-only)           │ │
│  └─────┬─────┘  └──────────┬─────────┘  └────────────┬─────────────┘ │
│        │                   │  seq-guarded PUT          │ shared pipeline│
├────────┴───────────────────┴────────────────────────────┴───────────┤
│  Next.js App Router (server)                                         │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Route Handlers /api/* — zod validation → requireRole → Drizzle │   │
│  └──────────────────────────────────────────────────────────────┘   │
│  RSC layer: initial tree/document fetch for first paint only         │
├────────────────────────────────────────────────────────────────────┤
│  lib/closure.ts (tree ops)   lib/rbac.ts (requireRole)               │
│  lib/markdown/ (shared parse pipeline — used by both preview & R3    │
│                 presentation, and by nothing else)                   │
├────────────────────────────────────────────────────────────────────┤
│  PostgreSQL 16: user / workspace / workspace_member / folder /       │
│  folder_closure / document / document_tag / document_draft /         │
│  workspace_join_request / invitation                                 │
└────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Tree sidebar | Render/interact with folder+document hierarchy, CRUD triggers | Client component, fetches `/api/workspaces/:id/tree` (2-query response per TRD §4), optimistic local state |
| Editor | Text input, plugin toolbar, selection ops, seq-guarded autosave dispatch | CodeMirror 6, client-only (cannot SSR — see App Router Integration below) |
| Preview | Render current editor content as sanitized HTML | Client component, calls shared `lib/markdown/` pipeline directly (no network round-trip — this is the 60ms budget) |
| Route Handlers | Auth check, input validation, DB mutation, RBAC enforcement | `app/api/**/route.ts`, `requireRole()` first line of every mutating handler |
| `lib/rbac.ts` | Single `requireRole(workspaceId, minRole)` gate | Session → `workspace_member.role` lookup → 403 if below threshold. Every mutating endpoint imports this — never re-implemented per-route |
| `lib/closure.ts` | Folder tree operations as fixed-query-count SQL | Encapsulates Closure Table INSERT/DELETE/CROSS JOIN patterns from TRD §4 — the only place that touches `folder_closure` |
| `lib/markdown/` | Single parse+sanitize pipeline | unified chain (remark → rehype → sanitize → react), shared verbatim by preview and R3 presentation mode — TRD is explicit that a second renderer would double the conformance-test surface |
| `components/editor/plugins/*` | One markdown formatting action each | Pure `run(state): TransactionSpec` functions, zero DOM, zero cross-plugin imports — this is also the TDD unit boundary |
| Drizzle schema (`db/schema.ts`) | Canonical DB shape | TS source of truth; TRD §3 DDL is the spec it must match 1:1 |

## Recommended Project Structure

TRD §11 already fixes this — restated here only to annotate build-order and boundary implications:

```
src/
  app/(auth)/login, signup          # depends on: auth only
  app/(main)/w/[wsId]/...           # 3-pane screen — depends on: tree API + editor + preview + markdown pipeline
  app/api/...                       # depends on: rbac.ts, closure.ts, schema.ts, markdown/ (per-route)
  db/schema.ts                      # depends on: nothing (foundation)
  lib/markdown/                     # depends on: nothing (pure function, no DB, no auth) — independently buildable/testable
  lib/rbac.ts                       # depends on: schema.ts + Auth.js session
  lib/closure.ts                    # depends on: schema.ts only
  components/editor/plugins/        # depends on: nothing but CodeMirror + types.ts — independently buildable/testable
  components/tree/, preview/        # tree depends on tree API; preview depends on lib/markdown/ only
```

### Structure Rationale

- **`lib/markdown/` has zero project dependencies** (no DB, no auth, no route handlers) — it is the single most parallelizable, most foundational piece. It should exist before the preview pane or the presentation mode, but has no dependency on auth/workspace/tree work.
- **`components/editor/plugins/`** are pure functions against `EditorState` — no DOM, no server. TRD's own TDD mandate (test-before-plugin, one file per feature) makes this a natural parallel track: 14 plugin files, each independently assignable/testable, none blocking the others.
- **`lib/rbac.ts` and `lib/closure.ts` both gate on `db/schema.ts`** existing first — schema is the actual foundation, not auth or tree individually.
- **The 3-pane screen (`app/(main)/w/[wsId]/...`) is the integration point**, not a buildable unit on its own — it cannot be meaningfully built (or tested end-to-end) until tree API, editor, and preview all exist in some form.

## Architectural Patterns

### Pattern 1: Server-only permission gate, client-only render gate

**What:** Two orthogonal boundaries drawn in opposite directions — RBAC is enforced *only* server-side (`requireRole` in every route handler), markdown rendering happens *only* client-side (no round trip for preview).
**When to use:** Any time a security boundary and a latency boundary land on the same feature — do not let one leak into the other's layer. UI hiding a button is not a security boundary; a server round-trip in the preview path is not acceptable latency.
**Trade-offs:** Requires discipline to never add a "convenience" client-side permission check that could be mistaken for real enforcement, and never add a "just this once" server preview render for e.g. export.

**Example (already fixed by TRD §2, §5):**
```ts
// every mutating route handler
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { workspaceId } = await requireRole(params.id, 'EDITOR') // throws/403 server-side
  const body = documentPatchSchema.parse(await req.json())       // zod
  // ... Drizzle mutation
}
```

### Pattern 2: Single shared pure pipeline, multiple consumers

**What:** One `lib/markdown/` function is called by preview (R1) and presentation mode (R3) — never forked.
**When to use:** Whenever two features render "the same thing" in different chrome. Forking the renderer means forking the conformance test suite (CommonMark spec.json, XSS sanitize tests) — TRD flags this explicitly.
**Trade-offs:** Presentation mode (R3) cannot diverge in markdown semantics from preview without a real product decision to un-share the pipeline. This is a deliberate constraint, not a limitation to work around.

### Pattern 3: Plugin-as-pure-function for editor commands

**What:** Every formatting action is `run(state: EditorState): TransactionSpec` — no DOM, no `EditorView`, no cross-plugin import. A registry (`plugins/index.ts`) wires them into the toolbar/keymap.
**When to use:** Any editor command surface where you want TDD without a browser/JSDOM, and want features addable/removable without touching sibling features.
**Trade-offs:** Anything that genuinely needs cross-plugin coordination (e.g., a future "smart list continuation" that needs to know about two plugins at once) has nowhere clean to live under this rule — TRD accepts that cost for the 14 current plugins, which are independent by nature (bold does not need to know about tables).

## Data Flow

### Autosave flow (TRD §7)

```
keystroke → CodeMirror state → 1s debounce → seq++ → PUT /api/documents/:id {content,title,seq}
                                                              ↓
                                          requireRole(EDITOR) → zod validate
                                                              ↓
                              UPDATE document SET ... WHERE id=:id AND saved_seq < :seq
                                                              ↓
                              affected_rows=0 → silently ignored (stale, out-of-order)
                              affected_rows=1 → status bar → "저장됨"
```
Out-of-order network arrival cannot corrupt state because the guard is a DB-level WHERE clause, not client-side cancellation — this flow has no server round trip in the render path, only in the persistence path.

### Preview flow (TRD §5, the 60ms-budget path)

```
CodeMirror onChange → content string (client memory only)
                    → lib/markdown/pipeline(content)   [remark→rehype→sanitize→react]
                    → React reconcile/commit → DOM update
```
Zero network calls. This is why preview must be 100% client-side per TRD — any server hop breaks the 60ms budget structurally, not just empirically.

### Tree flow (TRD §4)

```
GET /api/workspaces/:id/tree
   → requireRole(VIEWER)
   → SELECT folder JOIN folder_closure WHERE ancestor_id=:root  (query 1)
   → SELECT document WHERE folder_id = ANY(folder ids)          (query 2)
   → assembled tree JSON → client renders sidebar
```
Fixed 2-query cost regardless of depth — this is the property that makes the tree independently load-testable without seeding deep hierarchies to find N+1 regressions.

### Key Data Flows

1. **Auth → Workspace membership:** Signup creates `user` + auto-joins default `workspace` as EDITOR (TRD §8) — this is the only flow every other flow depends on transitively (no `workspace_member` row, no `requireRole` pass, ever).
2. **Draft vs. document (TRD §7):** `document_draft` is a parallel, lower-durability store (1/min, upsert, 1 row/doc) that never touches `saved_seq` — it's a recovery path, not part of the autosave guard logic. Keep these two write paths structurally separate; do not let draft writes touch `document.saved_seq`.

## Build Order

Derived from the dependency edges above (TRD is the source; this is the ordering implication for phasing):

1. **`db/schema.ts` + migrations** — everything else references tables that must exist first.
2. **Auth + workspace (signup, default workspace auto-join, `requireRole`)** — every RBAC-gated route and every UI screen requires a session and a workspace membership row to test against. This must exist before tree or documents, because "logged in, in a workspace" is the precondition for both.
3. **In parallel with (2), fully independent of it:**
   - `lib/markdown/` pipeline (pure function, no DB/auth) — can be built and CommonMark-conformance-tested from day one.
   - `components/editor/plugins/*` (pure functions against `EditorState`) — can be built and unit-tested from day one, in parallel across all 14 files.
4. **Folder tree (`lib/closure.ts` + tree API + tree UI)** — depends on (1) schema and (2) RBAC, but not on documents or the editor. Buildable/testable in isolation once workspace membership exists (create a folder, assert closure rows).
5. **Documents (CRUD, autosave seq guard, soft delete/trash cascade)** — depends on (4) folder (documents reference `folder_id`) and (2) RBAC. This is where the editor plugins (3), the markdown pipeline (3), and the tree (4) all converge into the 3-pane screen.
6. **3-pane integration screen** — the first point where tree + editor + preview + autosave are wired together; cannot be meaningfully built before (3), (4), (5) each exist in isolation.
7. **R2 features (tags, search, export, drafts, invitations)** layer on top of (5)/(4) independently of each other — tags/search/export/drafts touch `document`, invitations touch `workspace_member`; none of the four block each other.

### What can run in parallel (feeds phase/wave parallelization)

| Track | Depends on | Independent of |
|-------|-----------|-----------------|
| `lib/markdown/` pipeline + CommonMark/GFM/XSS test suite | nothing | auth, tree, editor, DB |
| Editor plugins (14 files) | `types.ts` only | each other, DB, auth, tree |
| DB schema + Closure Table SQL (`lib/closure.ts`) | nothing | auth UI, editor, markdown pipeline |
| Auth/workspace/RBAC | schema | editor, markdown pipeline |

These four tracks can be built and unit-tested concurrently by separate workstreams; they only need to converge at the tree API (needs schema+rbac), the document API (needs schema+rbac+closure), and the 3-pane screen (needs tree+editor+preview+document API).

## Anti-Patterns

### Anti-Pattern 1: Client-side permission checks treated as enforcement

**What people do:** Hide a "Delete" button when `role !== 'EDITOR'` and stop there.
**Why it's wrong:** NFR-3.2 requires server-side enforcement; a hidden button is trivially bypassed via direct API call. TRD is explicit that UI hiding is "convenience, not a security boundary."
**Do this instead:** UI hiding is allowed for UX polish, but every mutating route handler must independently call `requireRole` — never assume the client already filtered.

### Anti-Pattern 2: Server round-trip in the preview path

**What people do:** Render markdown server-side (e.g., in a Route Handler or Server Action) "for consistency" or SEO, then ship HTML to the client on each keystroke.
**Why it's wrong:** Breaks the 60ms budget structurally — network latency alone likely exceeds the entire budget. TRD fixes preview as 100% client-side for exactly this reason.
**Do this instead:** Client calls the shared `lib/markdown/` function directly in-browser; server only ever sees `document.content` at save time, never at render time.

### Anti-Pattern 3: Forking the markdown renderer for presentation mode (R3)

**What people do:** Build a second, "presentation-optimized" markdown-to-HTML path when R3 lands, because the presentation UI wants different chrome.
**Why it's wrong:** Two renderers means the CommonMark/GFM/XSS conformance suite (TRD §10) must pass against two implementations, and they can silently drift.
**Do this instead:** Presentation mode wraps the same `lib/markdown/` output in different chrome/CSS; it does not reparse or re-sanitize with a different pipeline.

### Anti-Pattern 4: Recursive/depth-proportional folder queries

**What people do:** Walk `parent_id` recursively in application code (or a recursive CTE) to build a subtree, "because it's simpler than closure tables."
**Why it's wrong:** NFR-1.3 explicitly forbids depth-proportional query cost; recursive walks degrade with nesting depth and reintroduce N+1 patterns the Closure Table was chosen to avoid.
**Do this instead:** All four tree operations (subtree read, create, move, delete) go through `lib/closure.ts` and its fixed-query-count patterns from TRD §4 — never touch `folder.parent_id` directly for tree traversal.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| PostgreSQL 16 | Drizzle ORM, `sql` template for Closure Table bulk ops | Single DB, no read replica needed at this scale |
| SMTP (invitations) | nodemailer, env-var configured | Dev env falls back to console output (TRD §9) — do not stub this differently per environment beyond that |
| Local disk `/uploads` (R2 images) | Single storage module boundary | TRD explicitly isolates this behind one module so S3 migration later is a function swap, not a rewrite — do not scatter `fs` calls for uploads across route handlers |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Editor (client) ↔ Preview (client) | Direct function call to `lib/markdown/`, same render tick — no API | This is the boundary the 60ms budget lives on |
| Editor (client) ↔ Document persistence (server) | HTTP PUT with `seq`, debounced, fire-and-forget from UI's perspective | Never block keystrokes on this call; status bar reflects async result only |
| Route Handlers ↔ `lib/rbac.ts` | Direct import/call, first line of handler | Never route around this — no handler should query `workspace_member` itself |
| Route Handlers ↔ `lib/closure.ts` | Direct import/call for all folder tree mutation/read | Never inline Closure Table SQL in a route handler — keeps the fixed-query-count guarantee in one place |
| Editor plugins ↔ toolbar/keymap registry | `plugins/index.ts` composes `EditorPlugin[]`, dispatches `run(state)` results | Plugins never import each other or the registry — only `types.ts` |

## App Router Integration Notes (Next.js 15)

This section is specific to this milestone_context ask — where server/client component boundaries fall for the 3-pane screen, and where CodeMirror must be isolated.

- **CodeMirror is unconditionally client-only.** It touches `window`/`document` at module load. The verified pattern (matches official Next.js docs) is: wrap it in a `'use client'` file and load via `next/dynamic(() => import(...), { ssr: false })` — `ssr: false` is only legal inside a Client Component, not inside a Server Component directly. Recommendation: bake the `dynamic(..., { ssr: false })` call into the editor component's own export (e.g. `components/editor/Editor.tsx` exports the dynamic-wrapped component), so every consumer of `Editor` just imports it normally and never has to remember the SSR caveat. Source: [Next.js Lazy Loading guide](https://nextjs.org/docs/app/guides/lazy-loading), confirmed against community write-ups on the `ssr: false` Server-Component restriction.
- **`app/(main)/w/[wsId]/page.tsx` should be a Server Component** that does the initial authenticated fetch (session check, initial tree, initial document if deep-linked) and passes serializable props down — this gets first paint without a client-side loading spinner for the tree.
- **The 3-pane layout itself (tree + editor + preview) is a Client Component subtree** below that page — it needs interactivity (selection state, editor state, autosave debounce timers) that Server Components cannot hold. Split as: Server Component page → passes initial tree/document data as props → Client Component `WorkspaceShell` owns tree selection state, renders `Editor` (dynamic, client-only) and `Preview` (client, pure function call) as siblings.
- **Preview does not need `next/dynamic`** — it has no DOM-only dependency at import time (unified/remark/rehype run fine in either environment), but it must still be marked `'use client'` if it lives in the same file/tree as editor state, since it re-renders on every keystroke from client-only state. Do not attempt to run it as a Server Component "for consistency" — see Anti-Pattern 2.
- **Route Handlers (`app/api/**/route.ts`) are the only place Drizzle should be imported outside of scripts/migrations.** Do not call Drizzle from Server Components for anything that also needs `requireRole` — keep one code path (the API) so RBAC is never accidentally bypassed by a direct-from-RSC query. (Read-only, already-authorized-by-page-load data, like the initial tree fetch in the Server Component page, is the one exception TRD's own diagram allows — but it should still call the same `requireRole`-gated helper, not raw Drizzle, so the check is never duplicated/forked.)
- **Auth.js v5 session access** works in both Server Components (via `auth()`) and Route Handlers — no special App Router friction here; this is a non-issue relative to CodeMirror's DOM dependency.

## Sources

- TRD.md (`/Users/codevillain/Claude-Code-Expert/markdown-kms/docs/TRD.md`) — primary source, HIGH confidence (project-authored, decided architecture)
- [Next.js — Guides: Lazy Loading](https://nextjs.org/docs/app/guides/lazy-loading) — HIGH confidence, official docs, confirms `dynamic(..., { ssr: false })` client-component wrapper pattern
- [outline/docs/ARCHITECTURE.md](https://github.com/outline/outline/blob/main/docs/ARCHITECTURE.md) — MEDIUM confidence, comparable-product validation that monolith + shared component tree is standard for this domain at larger scale than this project's v1
- Community write-ups on `ssr: false` Server Component restriction (Medium/dev.to, cross-referenced against official docs) — MEDIUM confidence, used only to confirm the wrapper pattern, not as a primary source

---
*Architecture research for: markdown-kms (workspace-based markdown document management)*
*Researched: 2026-08-01*
