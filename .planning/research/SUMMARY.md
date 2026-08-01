# Project Research Summary

**Project:** markdown-kms
**Domain:** Workspace-based markdown document management (Notion-lite / HackMD-class KMS)
**Researched:** 2026-08-01
**Confidence:** MEDIUM-HIGH

## Executive Summary

markdown-kms is a team workspace tool for authoring and organizing markdown documents — a Next.js 15 / React 19 monolith with CodeMirror 6 dual-pane editing, a shared unified (remark/rehype) markdown pipeline, Postgres 16 + Drizzle + Closure Table folder hierarchy, and server-enforced RBAC. Scope, stack, and architecture skeleton are already locked by docs/REQUIREMENT.md -> docs/PRD.md -> docs/TRD.md; this research validates those decisions against comparable products (Outline, HackMD, Notion, BookStack, Obsidian) and surfaces the concrete implementation traps a fixed spec doesn't spell out. Every research file converges on the same shape: a monolith is correct for this domain, not an outlier, and R1's feature set (auth, 3-pane editor, folders, trash, RBAC) matches what every comparable product treats as table stakes.

The recommended build order follows real dependency edges, not spec section order: schema first, then auth/RBAC and the (fully independent) markdown pipeline + editor plugins in parallel, then the folder Closure Table, then documents/autosave (which depend on folders), then the 3-pane integration screen, then R2 features layered on top. The single biggest risk cluster is "things that look done but aren't": CodeMirror 6 wired as a React-controlled component silently corrupts Korean IME composition, rehype-sanitize's default schema silently strips GFM task-list checkboxes, debounce-only autosave can show a stale "저장됨" under network jitter, and Closure Table folder moves can corrupt the tree if the cycle check is skipped. None of these fail loudly in local dev with English test data — each needs an explicit, named test baked into the phase that introduces the risk.

Mitigation is mostly "do the guard the spec already implies, but make it an explicit sub-task": seq-guard freshness must be checked client-side too, the Closure Table move needs a same-transaction ancestor check before rewiring, sanitize schema needs explicit input/del/table allow-listing plus URL-scheme restriction, and Korean text needs NFC normalization at write time. Stack version risk is concentrated in two places: Next.js 15.5.7 / React 19.2.1 are hard minimums due to an active Flight-protocol RCE, and Auth.js v5 has no stable tag — pin an exact beta, never latest/^5.

## Key Findings

### Recommended Stack

Core stack is TRD-locked (Next.js 15, React 19, Postgres 16, Drizzle, CodeMirror 6, unified/remark/rehype, CSS Modules) — research pins exact safe versions and fills gaps TRD left open (PG driver, Auth.js adapter, password hashing library).

**Core technologies:**
- Next.js 15.5.7 + React 19.2.1 — minimum patch versions fixing an active React Flight protocol RCE; do not pin lower
- Drizzle ORM (^0.45.x) + pg driver — schema-as-TS matching TRD 1:1; pg over postgres.js since deploy target is self-hosted Postgres
- Auth.js v5 (next-auth@5.0.0-beta.x, exact-pinned) + @auth/drizzle-adapter + bcryptjs — v5's provider architecture supports credentials-now/OAuth-later; bcryptjs avoids native-compile breakage vs bcrypt
- CodeMirror 6 raw packages (not @uiw/react-codemirror) — the wrapper fights the plugin architecture's direct dispatch()/TransactionSpec model
- unified/remark/rehype pipeline (remark-gfm 4.0.1, rehype-sanitize 6.0.0, rehype-raw 7.0.0) — default sanitize schema must be explicitly extended for GFM elements

### Expected Features

R1/R2/R3 scope is locked and verified complete against comparable products — no missing table stakes, no unjustified scope creep.

**Must have (table stakes, R1):** email auth + auto-join workspace, 3-pane editor+preview+status bar, full formatting toolbar, 1s-debounce seq-guarded autosave, folder CRUD via Closure Table, document CRUD + trash + restore, 4-role RBAC with server-side 403.

**Should have (R2):** image upload, tags + search (pg_trgm), export (.md/.zip), join-request/invite flow, crash-recovery draft, theme switching.

**Defer (R3 / explicitly out of scope):** presentation mode, Google OAuth (R3); real-time co-editing, comments, version history, wiki-links/backlinks, public share links, notifications, audit log — each has a documented reason (e.g. co-editing conflicts structurally with the seq-guard last-write-wins model). Comments are the most likely near-term user ask once R2 ships to real teams.

### Architecture Approach

Single Next.js App Router monolith (validated against Outline's comparable-scale architecture): server-only RBAC enforcement, client-only markdown rendering (structurally required for the 60ms preview budget), one shared lib/markdown/ pipeline consumed by both preview and future presentation mode, and Closure Table as the only path for folder tree operations.

**Major components:**
1. db/schema.ts — canonical DB shape, the actual dependency root
2. lib/rbac.ts (requireRole) — single server-side permission gate, imported by every mutating route handler
3. lib/closure.ts — the only code touching folder_closure, fixed-query-count tree ops
4. lib/markdown/ — pure function, zero DB/auth dependency, shared by preview (R1) and presentation mode (R3)
5. components/editor/plugins/* — 14 independent pure run(state): TransactionSpec functions, the natural TDD/parallelization boundary

### Critical Pitfalls

1. **CodeMirror 6 as a React-controlled component breaks Korean IME composition** — run it uncontrolled (create EditorView once, mutate only via dispatch()); never re-push external content mid-session.
2. **rehype-sanitize's default GitHub schema silently strips GFM task-list checkboxes** — explicitly extend defaultSchema for input/del/table elements, add positive-case tests.
3. **Debounce alone doesn't guarantee autosave correctness** — client must track latestSeqSent and only show "저장됨" for the matching response; server WHERE-guard alone protects the DB but not UI truthfulness under network reordering.
4. **Closure Table folder move omits the self-descendant cycle check** — check in the same transaction whether the target is inside the moving subtree before delete/reinsert.
5. **Next.js App Router SSR crash / hydration mismatch with CodeMirror** — dynamic(..., { ssr: false }) must live inside a dedicated 'use client' wrapper module.

Secondary: Korean pg_trgm search under-matches short queries and can miss NFC/NFD-mismatched pasted text — normalize to NFC at write time starting in R1.

## Implications for Roadmap

All four research files converge on the same dependency graph. Suggested phase structure:

### Phase 1: Schema + Auth/Workspace foundation
**Rationale:** Every other phase references tables and requires a session + workspace-membership row to test against — the only true root dependency.
**Delivers:** db/schema.ts + migrations, signup/login, auto-join default workspace as EDITOR, requireRole() gate.
**Addresses:** FR-A1 (email auth), workspace auto-join (PRD §8).

### Phase 2a: Markdown pipeline (parallel track)
**Rationale:** lib/markdown/ has zero DB/auth dependency — the most independently buildable piece; starts day one alongside Phase 1.
**Delivers:** unified/remark/rehype pipeline, CommonMark/GFM conformance suite, sanitize schema extended for GFM elements + URL-scheme restriction.
**Avoids:** Pitfall 2 (GFM checkbox stripping) — positive-case sanitize tests scoped into this phase's done-criteria.

### Phase 2b: Editor core + plugins (parallel track)
**Rationale:** Pure run(state): TransactionSpec functions, independent of DB/auth/tree/each other — buildable and unit-testable from day one.
**Delivers:** CodeMirror EditorView wiring (uncontrolled), client-only App Router boundary, 14 formatting plugins, toolbar/keymap registry.
**Avoids:** Pitfall 1 (Korean IME breakage) and Pitfall 7 (SSR crash/hydration mismatch) — foundational wiring, expensive to retrofit after plugins exist.

### Phase 3: Folder tree (Closure Table)
**Rationale:** Depends on schema + RBAC (Phase 1) but not documents/editor; must land before any cascade-delete work.
**Delivers:** lib/closure.ts, tree API (2-query fixed cost), tree UI (disclosure triangles, inline rename, move-via-picker).
**Avoids:** Pitfall 4 (cycle-check omission) — move-into-descendant rejection is an explicit unit test.

### Phase 4: Documents — CRUD, autosave seq guard, trash/restore
**Rationale:** Depends on folders (Phase 3) and RBAC (Phase 1); this is where editor (2b), markdown pipeline (2a), and tree (3) converge.
**Delivers:** Document CRUD, 1s-debounce autosave with server + client seq guard, soft delete + cascade restore, NFC normalization on write.
**Avoids:** Pitfall 3 (autosave race/stale-status) — client-side freshness check and beforeunload/flush behavior are explicit UAT criteria.

### Phase 5: 3-pane integration screen
**Rationale:** The integration point, not independently buildable — needs tree, editor, preview, and document API to each exist first.
**Delivers:** Server Component page (initial tree/doc fetch) -> Client Component WorkspaceShell (tree selection state, editor, preview siblings).

### Phase 6/7: RBAC roles + R2 layer (tags/search/export/invitations, parallel sub-tracks)
**Rationale:** RBAC role enum must exist server-side before invite/join-request UI; R2 features touch either document or workspace_member independently — none block the others once Phase 4/5 exist.
**Delivers:** Full RBAC matrix, image upload (single storage-module boundary), pg_trgm search (NFC-aware, tuned thresholds), export .md/.zip, invite-link + join-request flows.
**Avoids:** Pitfall 6 (Korean search under-match) — test with real 1-3 syllable queries and NFD-sourced paste content.

### Phase Ordering Rationale

- Schema is the true dependency root — every phase after Phase 1 assumes tables exist.
- Markdown pipeline and editor plugins are the two fully parallel, zero-cross-dependency tracks — schedule as concurrent workstreams alongside Phase 1.
- Closure Table before documents is a hard dependency; folder cascade delete requires closure rows to exist.
- Autosave's seq guard is infrastructure bundled into the autosave phase, not a separate phase — shipping autosave without client-side freshness reproduces the "field says saved but content lost" bug.
- RBAC role enum before invite/join-request UI — both assume Owner/Admin/Editor/Viewer already resolved server-side.

### Research Flags

Needs research during planning (--research-phase):
- **Phase 2a (markdown pipeline):** sanitize schema exact behavior should be re-verified against the literal installed rehype-sanitize@6.0.0 defaultSchema export.
- **Phase 6/7 (search):** Korean pg_trgm threshold tuning requires empirical testing with real Korean fixtures.

Standard patterns (skip research-phase):
- **Phase 1 (schema/auth):** Auth.js v5 + Drizzle adapter is a documented, official integration path.
- **Phase 2b (editor core):** uncontrolled-CM6 + App Router client-boundary pattern is fully specified with concrete code patterns.
- **Phase 3 (folder tree):** Closure Table SQL pattern and cycle-check guard fully specified in TRD §4.
- **Phase 5 (3-pane integration):** Server/Client Component split fully specified in App Router Integration Notes.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Versions cross-checked against npm registry + official docs via web search (Context7 unavailable); one explicit gap on rehype-sanitize's literal default schema |
| Features | MEDIUM-HIGH | Scope fixed by REQUIREMENT/PRD; validated against 5 comparable products via web-search-verified sources |
| Architecture | HIGH | TRD-fixed skeleton; validated against Outline's public architecture doc at larger scale |
| Pitfalls | MEDIUM | Web-sourced, cross-checked across official docs + multiple independent community reports |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **rehype-sanitize's exact current default schema** was not directly fetched from source — re-verify against the literal installed version's defaultSchema export before Phase 2a's sanitize test suite.
- **Korean pg_trgm short-query threshold tuning** — no empirical number given; tune against real Korean test fixtures during Phase 6/7.
- **Soft-delete + future uniqueness collision** (Pitfall 5) is currently latent — no action needed now, but flag as a design constraint for whoever adds sibling-name-uniqueness UX in any future phase.

## Sources

### Primary (HIGH confidence)
- docs/TRD.md, docs/PRD.md, docs/REQUIREMENT.md, .planning/PROJECT.md
- nextjs.org official upgrade/release + lazy-loading docs
- orm.drizzle.team getting-started/PostgreSQL docs
- zod.dev v4 release notes
- GitHub security advisory data (React Flight RCE fixed-version list)
- outline/docs/ARCHITECTURE.md (https://github.com/outline/outline/blob/main/docs/ARCHITECTURE.md)
- PostgreSQL official docs: pg_trgm; Unicode UAX #15 (NFC/NFD)

### Secondary (MEDIUM confidence)
- npm registry package pages (web search, Context7 unavailable this session)
- authjs.dev migration/adapter docs + community discussions on beta-channel status
- CodeMirror discuss threads + ProseMirror issue #1484 (IME composition, adjacent-framework corroboration)
- rehype-sanitize / hast-util-sanitize repo + unifiedjs.com docs
- Comparable-product feature comparisons: BookStack/HackMD/Outline/Wiki.js
- Percona: Moving Subtrees in Closure Table Hierarchies (Bill Karwin pattern)
- Next.js App Router ssr:false restriction write-ups (cross-referenced against official docs)

### Tertiary (LOW confidence)
- None flagged — all sourced claims cross-checked against at least one independent source.

---
*Research completed: 2026-08-01*
*Ready for roadmap: yes*
