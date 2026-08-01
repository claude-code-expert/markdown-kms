# Feature Research

**Domain:** Workspace-based markdown document management (Notion-lite / HackMD / Obsidian-web class)
**Researched:** 2026-08-01
**Confidence:** MEDIUM-HIGH (scope is fixed by REQUIREMENT.md/PRD.md; research validates against comparable products and specifies expected UX behavior, not new scope)

Scope note: R1/R2/R3 are already locked by `docs/REQUIREMENT.md` and `docs/PRD.md`. This file does not propose adding or removing features — it (1) confirms nothing "expected by default" in the comparable-product category is missing from R1/R2, and (2) pins down the expected behavior of each scoped feature so implementers don't reinvent conventions.

## Feature Landscape

### Table Stakes (Users Expect These)

Cross-checked against HackMD (realtime markdown notes), Notion (workspace docs), Outline (self-hosted Notion-like wiki), BookStack (Book>Chapter>Page wiki), Obsidian (local-first markdown + web publish).

| Feature | Why Expected | Complexity | Scoped? |
|---------|--------------|------------|---------|
| Dual-pane editor + live preview | Core value prop of every markdown tool (HackMD, StackEdit, Obsidian) | MEDIUM | R1 (FR-E8) |
| Standard markdown toolbar (headings, bold/italic, lists, quote, code, link, image, table) | Users coming from any of the 5 comparables expect a toolbar, not raw-syntax-only | MEDIUM | R1 (FR-E1-E5) |
| Autosave (no manual Save button) | Notion, Google Docs, HackMD all removed explicit save; a Save button now reads as legacy/broken | LOW-MEDIUM | R1 (FR-E9) |
| Visible save-state indicator | Users need confidence their work persisted, especially without a Save button | LOW | R1 (FR-E9 + NFR-4.2) |
| Folder/document hierarchy | BookStack's Book>Chapter>Page, Notion's nested pages, Obsidian's folder tree — flat lists don't scale past ~20 docs | MEDIUM-HIGH | R1 (FR-T1-T3) |
| Trash + restore (not permanent-on-delete) | Notion, Google Drive, virtually every doc tool moves deletes to Trash first; permanent-on-click is the #1 source of angry support tickets | MEDIUM | R1 (FR-D1, D2) |
| Role-based access (multi-tier, not just owner/member) | Any workspace tool with more than 1 collaborator needs read vs. write vs. admin distinction (Notion, Outline, BookStack all ship RBAC) | MEDIUM-HIGH | R1 (FR-W1, W2) |
| Search (title + body, not just filename) | BookStack, Outline, Notion all index full document body; filename-only search reads as broken | MEDIUM | R2 (FR-D4) |
| Image upload inline | Every comparable product supports drag/paste-to-upload images; markdown-only `![]()` typing is a power-user-only affordance | MEDIUM | R2 (FR-E6) |
| Light/dark theme | Table stakes across all 5 comparables in 2026; a documentation tool without dark mode reads as unmaintained | LOW | R2 (FR-E11) |
| Export to plain files | Users must be able to leave without lock-in — HackMD, Obsidian, BookStack all offer .md export | LOW-MEDIUM | R2 (FR-X1, X2) |
| Tagging | Notion (properties), HackMD (tags), Obsidian (#tags) all offer lightweight categorization beyond folders | LOW | R2 (FR-D3) |

**Verdict on scope completeness:** Nothing in R1/R2 is missing relative to the comparable set for a *team workspace document tool* (as opposed to a public wiki or a local-first PKM tool). Two categories are commonly table-stakes elsewhere but are explicitly and correctly out of scope per REQUIREMENT §7 given this product's positioning as a structured team doc tool rather than a public wiki (Outline/BookStack) or networked-notes tool (Obsidian):
- **Backlinks / wiki-links** — expected in Obsidian/Outline (graph-style KM), not in HackMD-style structured doc tools. Correctly excluded.
- **Comments / inline discussion** — expected in Notion/Outline for collaborative review, absent in HackMD's simpler model. Correctly excluded per REQUIREMENT §7 — flag as a likely v2 request once real users onboard (see Gaps).

### Differentiators (Value-Add, Not Required for Baseline Parity)

| Feature | Value Proposition | Complexity | Scoped? |
|---------|-------------------|------------|---------|
| 60ms p95 preview latency (explicit, measured) | Most competitors don't publish a latency SLA; CodeMirror 6 + debounced render at this budget is a genuine "feels instant" differentiator vs. HackMD's occasionally laggy preview | HIGH | R1 (FR-E8, NFR-1.1) |
| Presentation mode with TOC navigation | Turns a doc tool into a lightweight Keynote/reveal.js substitute — HackMD has slide mode, Notion/Outline/BookStack do not | MEDIUM | R3 (FR-P1, P2) |
| Closure-Table folder queries (single-query subtree) | Not user-visible, but enables instant folder operations at scale where naive recursive-CTE implementations lag on deep trees | MEDIUM-HIGH | R1 (FR-T2) |
| Seq-guarded autosave (no lost-update from stale responses) | Prevents the "my edit vanished" bug common in naive debounce-only autosave implementations (a known HackMD/Notion complaint under flaky networks) | LOW-MEDIUM | R1 (NFR-1.2, PRD §2-8) |
| Join-request + invite-link hybrid onboarding | Combines Slack-style invite links with Notion-style admin-approved join requests — most tools pick only one | MEDIUM | R2 (FR-W3-W5) |

### Anti-Features (Deliberately Not Building)

Per REQUIREMENT §7 / PROJECT.md Out of Scope, with the "why" made explicit for roadmap defense:

| Feature | Why It Looks Attractive | Why Problematic Here | Alternative Taken |
|---------|--------------------------|------------------------|--------------------|
| Real-time co-editing (CRDT/OT) | HackMD's headline feature; "everyone expects Google-Docs-style co-presence" | CRDT/OT is a multi-week subsystem (conflict resolution, presence cursors, awareness protocol) for a v1 whose core value is single-author authoring speed, not concurrent editing | Last-write-wins + seq guard (single-session ordering only), explicitly documented as a v1 limitation |
| Comments/inline discussion | Notion/Outline reviewers expect margin comments | Requires a threading data model, notification/read-state, and UI real estate competing with the 3-pane layout that IS the differentiator | None in v1 — defer to v2 if requested post-launch |
| Version history / diffing | Google Docs/Notion users assume "I can always go back" | Full version history requires storage strategy (diff vs. snapshot), a UI surface, and retention policy — disproportionate for a v1 whose autosave+trash already covers "don't lose work" | Trash (30-day-style recoverability via soft delete) + 1-minute crash-recovery draft cover the loss-prevention need without the version-browsing UI |
| Wiki-links / backlinks | Obsidian/Outline users expect `[[note]]` auto-linking | Requires link-graph indexing, orphan/broken-link detection UI, and rename-cascade logic — a knowledge-graph feature, not a document-management one | Folder hierarchy + tags + search cover findability without the graph complexity |
| Public share links (no-auth) | "Share like a Google Doc link" is a common ask | Every public link is a permanent, unrevoked security surface — conflicts directly with the RBAC-first design (NFR-3.2) and audit-log-less scope | Export .md/.zip is the "get it out of the system" escape hatch instead |
| Notifications / activity feed | "Tell me when someone edits my doc" | Needs an event bus + read/unread state model that doesn't exist yet; premature for a product not yet validated | None — status bar covers only the user's own save state |
| Audit log | Compliance-minded teams ask for it early | No regulatory requirement stated; audit logging is infrastructure users don't value until an incident happens | None in v1 |

## Feature Dependencies

```
Autosave (FR-E9, seq guard)
    └──requires──> Editor core (CodeMirror instance + debounce)

Trash restore (FR-D2)
    └──requires──> Soft delete (FR-D1)
                       └──requires──> Folder cascade rule (PRD §2-2: delete cascades to children)

Folder cascade delete/restore
    └──requires──> Closure Table (FR-T2)

Search by tag (FR-D4)
    └──requires──> Tagging (FR-D3)

Presentation mode TOC (FR-P2)
    └──requires──> Heading parser (already built for FR-E1/preview)

Invite-link join (FR-W5)
    └──requires──> RBAC roles (FR-W1) + signed token infra (NFR-3.3)

Join-request approval (FR-W3, W4)
    └──requires──> RBAC roles (FR-W1) — approver must be Owner/Admin

Crash recovery (FR-E10)
    └──enhances──> Autosave (FR-E9) — draft snapshot is a fallback, not a replacement

Google OAuth (FR-A2)
    └──requires──> Auth.js structure from FR-A1 built provider-extensible (PRD §4 R3 acceptance test)

Real-time co-editing ──conflicts──> Seq-guard last-write-wins model
    (co-editing needs CRDT merge; seq-guard assumes single active writer per doc — this is WHY co-editing is out of scope, not an oversight)
```

### Dependency Notes for Roadmap Ordering

- **Closure Table must land before any cascade-delete work.** FR-T2 (Closure Table) is a phase-ordering hard dependency for FR-D1's cascade rule (PRD §2-2) — build folder infrastructure before trash/restore logic that touches folders.
- **RBAC role enum must exist before invite/join-request UI.** Both FR-W3-W5 assume Owner/Admin/Editor/Viewer already resolved server-side; don't build invite UI in the same phase as the RBAC matrix unless RBAC is stubbed with hardcoded roles first.
- **Seq guard is infrastructure, not a feature — bundle it into the autosave phase, not a separate phase.** It has no independent UI; shipping autosave without it reproduces the "field says saved but content lost on flaky network" bug.
- **Tag input UI and search share no hard dependency but share priority (both P1/R2)** — natural to build in the same phase since search must include tags from day one (FR-D4 explicitly lists tags as a search target).

## MVP Definition

(Already fixed as R1 by PRD §4 — restated here as feature groupings for roadmap phase mapping, not re-derived.)

### Launch With (R1 — product-viability floor)

- [ ] Email auth + auto-join default workspace as EDITOR — without this nothing else is reachable
- [ ] 3-pane layout (tree + editor + preview + status bar) — the product's entire visual identity
- [ ] Full formatting toolbar + 60ms preview — the stated Core Value in PROJECT.md; everything else is secondary if this breaks
- [ ] 1s-debounce autosave with seq guard — "don't lose my work" is non-negotiable baseline trust
- [ ] Folder CRUD via Closure Table — documents need a home or the tree sidebar (screen structure) has nothing to show
- [ ] Document CRUD + trash + restore + permanent delete — matches every comparable product's delete-safety-net expectation
- [ ] RBAC 4 roles + server-side 403 — multi-user workspace has no meaning without enforced roles

### Add After Validation (R2 — collaboration & retention polish)

- [ ] Image upload — high user-visible value, but text-first workflows are viable without it for early validation
- [ ] Toolbar polish (lucide icons, tooltips, pressed states) — functional toolbar ships in R1; visual polish is additive
- [ ] Crash recovery draft snapshot — protects against edge-case loss once real usage patterns (and real crashes) are observed
- [ ] Theme/layout switching — a comfort feature, not a blocker to first value
- [ ] Tags + search — becomes necessary once document count grows past what a folder tree alone can navigate
- [ ] Export (.md/.zip) — matters once users have content worth taking out, not before
- [ ] Join-request/invite flow — matters once the default single-workspace model needs to scale to real teams beyond the founding user

### Future Consideration (R3 — polish/reach, correctly deferred)

- [ ] Presentation mode — nice-to-have once the authoring core is trusted; zero dependency risk to earlier phases
- [ ] Google OAuth — pure auth-provider addition, deliberately deferred until the extensible auth structure (FR-A1) is proven

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority (per PRD) |
|---------|------------|---------------------|----------|
| Dual-pane editor + 60ms preview | HIGH | HIGH | P1 (R1) |
| Autosave + seq guard | HIGH | MEDIUM | P1 (R1) |
| Folder tree (Closure Table) | HIGH | HIGH | P1 (R1) |
| Trash/restore | HIGH | MEDIUM | P1 (R1) |
| RBAC 4-role | HIGH | MEDIUM-HIGH | P1 (R1) |
| Image upload | MEDIUM | MEDIUM | P2 (R2) |
| Tags + search | MEDIUM | MEDIUM | P2 (R2) |
| Export .md/.zip | MEDIUM | LOW-MEDIUM | P2 (R2) |
| Join-request/invite | MEDIUM | MEDIUM | P2 (R2) |
| Crash recovery draft | LOW-MEDIUM | LOW | P2 (R2) |
| Theme/layout | LOW | LOW | P2 (R2) |
| Presentation mode | LOW-MEDIUM | MEDIUM | P3 (R3) |
| Google OAuth | LOW | LOW | P3 (R3) |

**Priority key (mapped to PRD release gates):** P1 = R1 must-have for viability. P2 = R2 should-have for collaboration/retention. P3 = R3 nice-to-have reach.

## Expected Behavior Specs (Feeds Requirements Definition)

These are the UX conventions comparable products converge on. Use these as the default behavior unless REQUIREMENT/PRD/TRD specify otherwise — they fill in "how exactly" for features whose "what" is already locked.

### Autosave status bar (FR-E9, NFR-4.2)
- Three states only: **저장 중** (saving, shown immediately on debounce fire) → **저장됨** (saved, shown on server 2xx) → **저장 실패** (failed, shown on error/timeout, with a retry affordance — a clickable "다시 시도" link/button, not just a passive icon).
- No blocking modal for save state, ever — it is a passive corner/bar indicator (Google Docs/Notion convention). A modal on every 1s save cycle would be intrusive to the point of unusable.
- On save failure, do NOT silently keep retrying forever without user-visible feedback — surface the failed state distinctly (e.g., red text/icon) so the user knows local edits haven't reached the server yet, matching NFR-4.2's "재시도 수단을 제공" requirement.
- The seq guard (server rejects stale saves via `WHERE saved_seq < :seq`) is invisible to the user — it only prevents a regressed "저장됨" state from a late-arriving stale response. Do not surface seq numbers in UI.

### Trash / restore (FR-D1, D2, PRD §2-2, §2-3)
- Deletion is single-click-to-trash (no confirmation dialog needed — reversible, matches Notion/Google Drive convention where soft-delete is low-friction).
- Permanent delete from trash DOES require a confirmation dialog (irreversible — matches GitLab/industry pattern of escalating confirmation severity for the second, unrecoverable delete stage).
- Folder delete cascades silently to all descendants (PRD §2-2) but trash UI shows only the top-level deleted item ("휴지통에는 직접 삭제한 항목만 노출"), not each cascaded child — matches user mental model of "I deleted one thing" rather than a flooded trash list.
- Restore of a folder restores all cascaded children atomically; if the original parent folder was itself deleted, restore target falls back to workspace root with an on-screen notice (PRD §2-3) — do not silently restore to a now-nonexistent path.
- Trashed items must be excluded from active search/tree/folder queries everywhere consistently — a well-known UX failure mode is when search still surfaces trashed docs while the tree hides them, which reads as a bug.

### Tag input (FR-D3, US-6)
- Chip/pill-style input: type text + Enter (or comma) commits a tag chip; Backspace on empty input removes the last chip; explicit "x" on each chip for mouse-driven removal.
- Enforce max-3 both client-side (disable input / show inline message at 3) and server-side (reject 4th on API call per US-6 acceptance criteria) — client-only enforcement is a stated anti-pattern here per NFR-3.2's broader "UI hiding a button is not access control" principle, and the same logic applies to any client-only validation.
- No tag autocomplete/suggestion-from-existing-tags is specified in scope — do not add it speculatively; it's a natural R2.x add-after-validation item (see Gaps), not required for the 3-tag-cap acceptance criteria to pass.

### Folder tree (FR-T1-T3, US-3)
- Standard disclosure-triangle expand/collapse per folder node, matching every file-tree UI convention (VS Code, Finder, Notion sidebar).
- Folder rename is inline (click-to-edit the label in place), not a separate modal — matches the "fast, low-friction" expectation the toolbar UX (NFR-4.1) sets elsewhere in the product.
- REQUIREMENT/PRD do not specify drag-and-drop for folder moves — only "이동" (move) as a capability (FR-T3). Do not assume drag-and-drop is required; a simple "move to..." picker/menu action satisfies FR-T3 without the drag-and-drop complexity (hit-testing, reordering, illegal-drop prevention) that's typically bundled with tree UIs but not requested here. If a future phase wants DnD, treat it as a UX enhancement layered on the same move-API, not a new capability.

### Export (FR-X1, X2, NFR-5.2)
- Document export filename: use the document title, sanitized for filesystem safety (strip/replace `/ \ : * ? " < > |`), with `.md` extension — do not slugify to kebab-case by default since NFR-5.2 requires the *content* to be lossless, and users expect the filename to visually match the title they see in the UI (Notion/Obsidian both export using the literal title, not a slug).
- Folder export: zip preserves the folder hierarchy exactly as directory structure (FR-X2's "구조 그대로"), with each document as a `.md` file at its corresponding path. Trashed items are excluded from export (only active hierarchy).
- Export is synchronous-triggered but should show a loading/progress state on the button itself for folder-zip export, since zipping a large subtree may take longer than typical instant-click affordance users expect from a "download" action.

### RBAC (FR-W1, W2, PRD §3)
- Permission-denied UI should hide/disable actions the current role can't perform (good UX for Viewers not seeing a "새 문서" button they'd get a 403 for) — but per NFR-3.2, this is convenience only, not access control. The server 403 is what's tested, not the button's visibility.
- Role changes and their effects should be visible immediately without requiring re-login — matches Notion/Outline's live permission model.

## Gaps to Address (Post-R1 Signals, Not v1 Scope Changes)

These are NOT recommendations to expand current scope — REQUIREMENT/PRD are locked. They're flagged for the team to watch for once real usage starts, matching the standard pattern where comparable products (Notion, Outline) added these after initial launch:

- **Comments/inline review** — explicitly out of scope now, but the single most common "when will we get X" request pattern in team doc tools once >3 people share a workspace. Expect this ask within weeks of R2 shipping to real teams.
- **Tag autocomplete from existing tags** — not specified, not built in R1/R2, but a natural low-cost addition once the tag data model exists; watch for user friction with typo'd/duplicate tags (e.g., "Design" vs "design") as a signal to add normalization or autocomplete.
- **Version history** — deliberately deferred; the 1-minute draft snapshot (FR-E10) provides crash recovery but not "what did this doc look like last week" — if teams start asking for it, that's the R2→R3+ escalation signal REQUIREMENT anticipated but didn't scope.

## Sources

- Notion, HackMD, Outline, BookStack, Obsidian — direct product knowledge cross-checked against comparison sources (MEDIUM confidence, web-search verified 2026-08-01): [BookStack vs HackMD vs Outline Comparison](https://sourceforge.net/software/compare/BookStack-vs-HackMD-vs-Outline/), [Wiki.js vs BookStack vs Outline](https://www.pistack.xyz/posts/wiki-js-vs-bookstack-vs-outline/)
- Autosave status UX pattern (Google Docs / general SaaS convention): [Does Google Docs Autosave? – Nerd Techy](https://nerdtechy.com/does-google-docs-autosave), [Auto saving dashboard layout — Redash discuss](https://discuss.redash.io/t/auto-saving-dashboard-layout/3506)
- Trash/restore two-stage delete pattern: [Delete Button UI: Best Practices — DesignMonks](https://www.designmonks.co/blog/delete-button-ui), [UX for reversible actions — LogRocket](https://blog.logrocket.com/ux-design/ux-reversible-actions-framework/), [Soft deletes vs hard deletes — koder.ai](https://koder.ai/blog/soft-deletes-vs-hard-deletes)
- Tag chip input conventions: general chip/autocomplete component pattern survey (2026-08-01 web search), [Obsidian tag autocomplete forum discussion](https://forum.obsidian.md/t/autocomplete-tags-in-yaml-front-matter/12751)
- Project scope of record: `docs/REQUIREMENT.md` v1.0.0, `docs/PRD.md` v1.0.0, `.planning/PROJECT.md`

---
*Feature research for: workspace markdown document management (team KMS)*
*Researched: 2026-08-01*
