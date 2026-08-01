# Pitfalls Research

**Domain:** Workspace markdown KMS (CodeMirror 6 dual-view editor, Korean users, Next.js/PostgreSQL)
**Researched:** 2026-08-01
**Confidence:** MEDIUM (web-sourced, cross-checked across official docs + multiple independent community reports; no single-source claims presented as certain)

## Critical Pitfalls

### Pitfall 1: CodeMirror 6 treated as a React controlled component breaks Korean IME composition

**What goes wrong:**
Korean input assembles jamo (ㄱ+ㅏ+ㄴ) into a syllable block (간) over several `compositionupdate` events before `compositionend` commits it. If the app pattern is `value={content}` + `onChange={setContent}` + re-injecting `content` back into the editor on every keystroke (as is idiomatic for a "controlled" React input), the forced state re-sync fires mid-composition, the browser's composing buffer gets clobbered, and users see dropped or duplicated jamo, or the cursor jumps and breaks the composition entirely. This is materially worse for Korean/Japanese/Chinese than for Latin-script typing because every syllable is itself a multi-event transaction — a single dropped update corrupts a whole character, not just a keystroke.

**Why it happens:**
CodeMirror 6 already owns document state via its own transaction system; wiring it up as a React-controlled `<input>`-style component (push external state in on every render) fights the editor's internal state machine. `Transaction.isUserEvent('input.type.compose')` is not a reliable signal for "composition has ended" — developers reach for it expecting Vue-`v-model`-like semantics and get inconsistent results.

**How to avoid:**
- Run CodeMirror 6 **uncontrolled**: create the `EditorView` once, mutate it only through `view.dispatch()`, and treat React state as a *read model* updated from `EditorView.updateListener.of(update => ...)` — never re-push external `content` into `view.setState()`/`dispatch` on a normal render cycle.
- Only synchronize app state (autosave buffer, preview source) at the point `update.docChanged` is true and let the browser own the DOM during active composition — do not intercept `compositionstart`/`compositionupdate` to trigger app-level side effects.
- Write an explicit Korean IME test early: type a full sentence with 2-3 syllable words via a simulated composition sequence (Playwright can dispatch `compositionstart`/`compositionupdate`/`compositionend` + `input` events) and assert the final buffer matches, not just the visual DOM.

**Warning signs:**
- Manual QA "feels fine" in English but Korean beta testers report missing or duplicated characters, especially typing fast or with autocomplete/predictive keyboards.
- Any code path that calls `view.dispatch({ changes: {..., insert: content} })` reactively from a `useEffect` keyed on external `content` state.

**Phase to address:**
Editor core phase (R1, before other 13 plugins are layered on) — the uncontrolled-CM6 wiring is foundational; retrofitting it after plugins assume controlled semantics is expensive.

---

### Pitfall 2: rehype-sanitize's default (GitHub) schema silently strips GFM task-list checkboxes

**What goes wrong:**
`remark-gfm`'s task-list extension renders `- [ ] todo` as `<input type="checkbox" disabled>` in the hast tree. `rehype-sanitize`'s `defaultSchema` (GitHub-style) does not allow `<input>` at all. Sanitize then silently drops the checkbox — the list item renders as plain text with no visual indication anything was removed. This directly hits R1's "GFM 3종" requirement (strikethrough, tasklist, table) since tasklist is one of only three GFM features this project enables.

**Why it happens:**
`rehype-sanitize`'s allow-list philosophy is "everything not explicitly listed is removed" — correct for XSS defense (NFR-3.1) but easy to under-scope when the allow-list is copied verbatim without checking it against every GFM element actually enabled upstream.

**How to avoid:**
- Import `defaultSchema` from `rehype-sanitize` and deep-merge in explicit support for `input` (`tagNames: [...defaultSchema.tagNames, 'input']`, `attributes: { input: ['type', 'checked', 'disabled'] }`), plus verify `del` (strikethrough) and the full `table`/`thead`/`tbody`/`tr`/`th`/`td` set are present — don't assume they are.
- Put the sanitize schema in `lib/markdown/` (already planned as single source per TRD §5) and unit test it directly: render each of the 3 enabled GFM extensions through the full pipeline and assert the expected tag survives, in the same test file as the XSS negative tests (NFR-5.1 already requires XSS tests — extend that same suite to positive-case allow-list coverage, not just negative-case blocking).
- Never assume "sanitize" == "GFM output preserved" — the two are opposed by default and must be reconciled explicitly per element.

**Warning signs:**
- Task-list checkboxes render as plain `[ ] todo` text or vanish entirely in preview while raw source clearly has `- [ ]`.
- Sanitize test suite only tests *rejection* (script tags, event handlers) and has zero tests asserting GFM elements *survive*.

**Phase to address:**
Markdown pipeline phase (R1) — must be caught before the CommonMark/GFM conformance test suite (TRD §10) is declared passing, since the spec tests compare pre-sanitize output and can pass while sanitize still strips GFM elements post-hoc.

---

### Pitfall 3: Debounce alone does not guarantee autosave correctness — the seq guard must be enforced on both ends

**What goes wrong:**
The TRD already specifies a server-side seq guard (`WHERE saved_seq < :seq`), which correctly prevents an out-of-order *older* request from overwriting a newer save. The pitfall is in what's *not* specified: client-side handling when a request is in flight and a newer edit fires before the response returns. If the debounce timer resets on every keystroke but the in-flight request isn't tracked, two `PUT` requests can be inflight simultaneously; if the network reorders them (older request's TCP/HTTP response completes after the newer one due to a slow retry), the client's UI state ("저장됨"/"저장 실패") can display success from a stale response for content the user has since changed further — the *server* stays correct (idempotent because of the guard) but the *UI status bar* can lie about what's actually persisted if the client doesn't also key its "저장됨" toast off the seq of the response it received versus the seq it most recently sent.

**Why it happens:**
Debouncing controls request *frequency*, not response *ordering* or in-flight *cancellation*. It's easy to build the debounce → fetch → setState("저장됨") chain without checking `response.seq === latestSentSeq` before updating the status bar, because it works correctly in the common case (no network reordering) during development and only fails under real-world latency variance.

**How to avoid:**
- Client tracks `latestSeqSent`. On response, only update the status bar to "저장됨" if the response corresponds to `latestSeqSent` (either the API echoes back the seq it applied, or the client discards responses for any seq older than the latest it has sent).
- On `beforeunload`/route change with unsaved changes (debounce timer pending or a save in flight), warn the user (`beforeunload` + `returnValue`) — but do not rely on `beforeunload` to *complete* the async save (browsers do not reliably wait for `fetch`). If "don't lose the last few keystrokes" matters, flush the pending debounced save synchronously via `navigator.sendBeacon` (or a fire-and-forget best-effort `fetch(..., {keepalive: true})`) on unmount/navigation, understanding it's still best-effort — the source of truth for "saved" is the seq guard response, not the beacon firing.
- Retry-with-new-seq (already specified in TRD §7) must generate a genuinely new/incremented seq, not resend the old one — resending the same seq after a failed request risks the guard rejecting the retry if a stale duplicate of the original request lands after it.

**Warning signs:**
- Status bar shows "저장됨" immediately after a burst of typing, but the persisted `document.content` in the DB (checked directly) lags behind what's on screen.
- E2E test flakiness specifically under artificial network delay/jitter (a strong signal the happy-path-only implementation is response-order-dependent).

**Phase to address:**
Autosave protocol phase (R1) — the plan already covers the server-side seq guard; explicitly scope client-side response-freshness checking and the `beforeunload` flush into the same phase's UAT criteria, not left implicit.

---

### Pitfall 4: Closure Table move omits the self-descendant cycle check

**What goes wrong:**
Moving folder A to become a child of folder B, where B is currently a descendant of A, creates a cycle (A is now its own ancestor transitively). The closure-table delete/reinsert SQL pattern described in TRD §4 (delete crossing links, then cross-join-insert new ancestor × descendant pairs) does not self-protect against this — it will happily execute and produce a corrupted closure table (the subtree becomes disconnected from the root, or worse, self-referential rows accumulate under repeated attempts), because the SQL only knows how to rewire links, not that the rewiring is topologically invalid.

**Why it happens:**
The cycle check is a separate query from the move itself, easy to omit when implementing "move" as directly translating the TRD's SQL description without adding the pre-flight guard, since the happy path (moving a folder to an unrelated destination) works perfectly without it.

**How to avoid:**
- Before executing the delete/reinsert, run (in the same transaction, same connection, so no TOCTOU gap): `SELECT 1 FROM folder_closure WHERE ancestor_id = :movingFolderId AND descendant_id = :targetParentId` — if this returns a row, reject the move with a 400 (target is inside the subtree being moved, including the degenerate case of moving a folder into itself, since `depth=0` self-rows are already in the closure table per TRD §3).
- Wrap the check + delete + insert in a single DB transaction so no concurrent move can slip between the check and the mutation.
- Unit test explicitly: (a) move folder into direct child — rejected, (b) move folder into itself — rejected, (c) move folder into unrelated folder — succeeds, (d) move folder to workspace root (`parent_id = NULL`) — succeeds and closure rows correctly drop to depth-from-root.

**Warning signs:**
- No test case in the folder-move test suite that asserts a 400/rejection — only happy-path moves are tested.
- Manual repro: create nested folders A > B > C, attempt to move A under C via the UI, and check whether the tree renders correctly afterward or silently disappears/duplicates.

**Phase to address:**
Folder tree CRUD phase (R1) — this is called out directly in TRD §4 prose but not yet reflected as an explicit guard clause or test; the roadmap phase implementing folder move must treat the cycle check as a required sub-task, not an implementation detail.

---

### Pitfall 5: Soft-delete cascade + restore has no unique-constraint collision handling

**What goes wrong:**
The schema has no unique constraint on `folder.name` or `document.title` scoped within a parent (nothing in TRD §3 enforces sibling name uniqueness), so this specific project may be safe from the classic "restore fails because a new active row already claimed the unique value" bug — **but** if a future phase (or a differently-scoped implementation) adds a uniqueness constraint on `(folder_id, name)` for user-facing "no duplicate names in the same folder" UX, the interaction with soft delete becomes a real trap: a plain unique index blocks creating a new folder/document with the same name as a soft-deleted one in the same location, and even a partial index (`WHERE is_deleted = false`) doesn't fully solve it — restoring the trashed one can then collide with a same-named active one created in the meantime.

**Why it happens:**
Soft delete is usually bolted on after the schema is designed for hard delete; uniqueness constraints written with only the "active" case in mind don't anticipate that a trashed row and a fresh row can coexist and later collide on restore.

**How to avoid:**
- If/when sibling-name-uniqueness is added, scope the unique index with a partial `WHERE is_deleted = false` predicate (never a bare unique index on `name` — that's already avoided by not existing today, keep it that way).
- Design the restore endpoint to detect the post-hoc collision explicitly (query for an active sibling with the same name before flipping `is_deleted`) and either auto-rename (`이름 (1)`) or surface a conflict to the user rather than letting the DB throw an unhandled constraint violation mid-transaction.
- This pitfall is currently latent (no uniqueness constraint exists yet) — flag it as a design constraint if any future requirement adds "no duplicate folder names" so it isn't implemented naively.

**Warning signs:**
- A future PR adds `CREATE UNIQUE INDEX ... ON folder(parent_id, name)` without a `WHERE is_deleted = false` clause.
- Restore endpoint has no pre-check query and relies solely on catching a DB constraint-violation exception.

**Phase to address:**
Not scheduled in R1-R3 as currently scoped (no uniqueness requirement exists) — flag as a pre-emptive constraint for whichever future phase introduces name-collision UX, so it isn't discovered as a production bug.

---

### Pitfall 6: pg_trgm Korean search under-matches on short queries and can miss NFC/NFD-mismatched text

**What goes wrong:**
Two independent, compounding issues for the FR-D4 trigram search over Korean content:
1. **Short-query recall**: Korean search terms are frequently 1-3 characters (Korean words average shorter than English), and trigram similarity needs 3+ character windows to be discriminating. A 2-character Korean query padded to trigrams (` X`, `XY`, `Y `) produces very few trigrams, so default similarity thresholds (`pg_trgm.similarity_threshold` = 0.3, `word_similarity_threshold` = 0.5) can under-match or return nothing for exactly the short, common queries Korean users will type most.
2. **Normalization mismatch**: Hangul syllables have two canonically-equivalent Unicode encodings — NFC (single composed code point, e.g. U+AC00) and NFD (decomposed jamo sequence). Content typed on some platforms/input paths (notably historically macOS-originated text, or text pasted from sources using NFD) can land in the DB in a different normalization form than the search query, and since trigram/ILIKE matching is byte-level, visually-identical text silently fails to match.

**Why it happens:**
pg_trgm has no linguistic model of Korean — it's a pure character n-gram matcher, so it inherits both English-biased default thresholds and no built-in Unicode normalization step. Both issues are invisible until tested with real Korean short queries and mixed-source paste content.

**How to avoid:**
- Normalize all text to NFC at the boundary: on write (before `INSERT`/`UPDATE` of `title`/`content`), run `.normalize('NFC')` in the API layer before it reaches Postgres, and normalize the incoming search query the same way before the `ILIKE`/`%` comparison. This is a one-line fix applied consistently at two chokepoints (document save handler, search handler) — cheap insurance against an intermittent, hard-to-repro bug class.
- For short-query recall, prefer `word_similarity`/`%>` operators (designed for substring/partial matches) over plain `similarity`/`%` for the title/content search, and empirically tune `pg_trgm.word_similarity_threshold` downward if 2-character Korean queries under-match in testing — verify with real Korean test fixtures (not Lorem Ipsum) before shipping.
- Confirm the Postgres instance's `LC_CTYPE`/collation is not `C` — trigram word-character classification degrades for non-ASCII scripts under the `C` locale; use a UTF-8-aware locale (this is a deployment/infra check, not application code).

**Warning signs:**
- Search-by-title returns zero results for a 2-syllable Korean query that's a true substring of an existing document title.
- Search misses a document whose title was pasted from an external source (e.g., a macOS Finder-originated filename) even though visually the query text matches exactly.

**Phase to address:**
Search phase (R2, FR-D4 pg_trgm) — normalize-on-write should actually be added earlier (document create/save phase in R1) since retrofitting normalization onto already-stored mixed-form data requires a backfill migration; the search-tuning half (thresholds, operators) belongs in the R2 search phase itself.

---

### Pitfall 7: Next.js App Router SSR crash and hydration mismatch with CodeMirror 6

**What goes wrong:**
CodeMirror 6 touches `window`/`navigator`/`document` during `EditorView` construction. In App Router, components render on the server by default; importing/instantiating CodeMirror in a Server Component (or a Client Component that isn't properly code-split) throws `ReferenceError: window is not defined` at build/request time, or — if guarded with only a `typeof window !== 'undefined'` check inside a component that still renders during SSR — produces a hydration mismatch because the server renders an empty/placeholder editor shell while the client renders the real editor.

**Why it happens:**
`ssr: false` in `next/dynamic` is disallowed directly inside a Server Component file in App Router (this restriction did not exist in the Pages Router, so guidance/examples found online for older Next.js versions are misleading if copied verbatim). The fix requires an extra indirection layer that's easy to skip under time pressure.

**How to avoid:**
- Create a dedicated `'use client'` wrapper module whose only job is `const Editor = dynamic(() => import('./Editor'), { ssr: false })` — the `dynamic()` call must live inside a file marked `'use client'`, never directly inside a Server Component (`app/(main)/w/[wsId]/...` page files stay Server Components and only import the client wrapper).
- Keep all CodeMirror-touching imports (the editor component itself, its 14 plugins, extensions) inside that client-only module tree so nothing browser-dependent is evaluated during the server render pass.
- Since the pure `run(state): TransactionSpec` plugin functions (TRD §6) don't touch the DOM, they can safely live in shared/isomorphic files and be unit-tested without JSDOM — only the `EditorView` instantiation and `index.ts` registry wiring need the client-only boundary.

**Warning signs:**
- Build succeeds but the dev server logs `ReferenceError: window is not defined` on any route rendering the editor.
- Console warning "Hydration failed because the initial UI does not match what was rendered on the server" specifically around the editor mount point.

**Phase to address:**
Editor scaffolding phase (R1, before the 14 plugins are built on top) — get the client/server boundary right once at the editor's entry point rather than discovering it mid-plugin-development.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Full document re-parse on every keystroke (no memoization) | Simpler mental model, faster to ship R1 | Risks blowing the 60ms p95 budget as documents approach 10k chars with complex nesting; TRD §5 already anticipates this and defers memoization until measured | Acceptable per TRD's own plan — but only if the Playwright p95 measurement (§10) actually gates the "done" decision, not skipped |
| Client-side XSS test coverage only on negative cases (blocked payloads) | Faster to write, satisfies NFR-3.1 literally | Misses Pitfall 2 (GFM elements silently stripped) — sanitize schema regressions ship undetected | Never — always pair negative (blocked) with positive (allowed-elements-survive) assertions in the same suite |
| `beforeunload` as the sole "don't lose edits" guard | Zero extra code, browser-native | False sense of safety — doesn't guarantee async save completes, and some browsers restrict custom messaging | Acceptable as a *warning* UX, never as the actual data-durability mechanism (draft snapshot + seq guard are the real safety net per TRD §7) |
| Skipping NFC normalization on write | One less line per save handler | Silent search misses for a subset of users whose input path produces NFD text; very hard to reproduce/debug later since it "usually" works | Never — it's a one-line fix, cheapest to add at the same time as the search phase is built |

## Integration Gotchas

Common mistakes when connecting to external services/libraries used in this stack.

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| CodeMirror 6 + React | Treating `EditorView` as a controlled component driven by React state on every render | Uncontrolled editor instance; React reads from `updateListener`, never force-pushes content back in mid-session |
| rehype-sanitize + remark-gfm | Using `defaultSchema` unmodified and assuming "sanitized" implies "GFM output intact" | Explicitly extend `defaultSchema` for every enabled GFM element (`input`, `del`, table family) and test each survives |
| Next.js App Router + CodeMirror | Calling `dynamic(..., { ssr: false })` directly inside a Server Component page file | Isolate in a `'use client'` wrapper module; page files stay Server Components importing the wrapper |
| Drizzle ORM + Closure Table bulk ops | Writing closure inserts/deletes via Drizzle's query builder (which doesn't map cleanly to Cartesian-join inserts) | Use raw `sql` template literals for closure bulk operations, as TRD §1 already specifies — don't fight the ORM for this one operation class |
| Auth.js v5 credentials provider | Assuming session role checks in middleware are sufficient authorization | `requireRole` must run server-side per-request on every mutating route handler (TRD §2) — middleware/session presence is authentication, not authorization |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|------------------|
| Full hast tree → React element re-creation on every keystroke without memoization | p95 preview latency creeps above 60ms as document approaches 10k chars, especially with many block-level elements | Add block-level `memo` keyed by node hash only after Playwright measurement shows the budget is actually exceeded (TRD §5's own plan) — don't pre-optimize | Documents nearing 10,000 chars with deeply nested lists/tables/code blocks |
| Recursive folder queries instead of Closure Table joins | Sidebar tree load time grows with folder depth, not O(1) | Always use the two-query Closure Table pattern (TRD §4) — never write a recursive CTE or N+1 loop "just this once" for a special case | Any workspace with folder depth > ~5, though correctness (not just perf) is also at risk with recursive approaches |
| pg_trgm GIN index without partial `WHERE is_deleted = false` clause | Search index bloats with trashed content, slower scans, deleted docs surfacing in results | TRD §3 already specifies the partial index — verify migrations don't drop the `WHERE` clause during future schema changes | Once trash accumulates meaningfully (weeks of active deletion) |
| Storing every autosave as a new row instead of upsert | Document table/history grows unbounded | TRD already specifies single-row overwrite (`saved_seq` on the same row) and single-row draft upsert — don't accidentally introduce an append-only autosave log later without an archival strategy | N/A given current design, but flag if requirements change |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Relying on remark/rehype's `allowDangerousHtml` + rehype-raw without rehype-sanitize actually running in the same pipeline instance used for preview | Full XSS — raw `<script>`/`onerror=`/`javascript:` payloads render as-is | Sanitize must be a mandatory, non-bypassable step in the *single shared* pipeline function (TRD §5 already centralizes this in `lib/markdown/`) — never let presentation-mode or export code paths construct an alternate pipeline that skips sanitize |
| Sanitize schema allow-listing `href`/`src` without restricting URL schemes | `javascript:`, `data:` URIs in links/images bypass tag-level filtering even with safe tags | Explicitly configure `protocols` in the sanitize schema for `href`/`src` to allow only `http`/`https`(/`mailto` for links) — verify with a dedicated test payload (`javascript:alert(1)`, `data:text/html,...`) beyond just `<script>` tag tests |
| UI-only role checks (hiding buttons for Viewer role) mistaken for authorization | Any user can call the API directly and bypass client-side hiding | `requireRole` server-side on every mutating route handler, already correctly identified as mandatory in TRD §2 — this is a discipline risk (a future route handler added without going through the shared `requireRole` helper), not a design gap |
| Invitation token validation checking signature but not `expires_at`/`used_at` atomically | Replay of a valid-signature token after expiry or reuse after first acceptance | TRD §9 already specifies all three checks (signature, expiry, used_at) — ensure `used_at` is set in the same transaction as granting membership to avoid a race where two near-simultaneous accept requests both pass the `used_at IS NULL` check |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Preview scroll position resets to top on every content re-render | Disorienting when editing mid-document; user loses their place constantly | Preserve/restore scroll position (or percentage-based sync) across re-renders — an explicit requirement to design in, not an afterthought |
| "저장 중" state flickers or shows stale "저장됨" from a superseded response | User can't trust the save indicator, may re-check by leaving/returning (worsening the race in Pitfall 3) | Status bar only reflects the response matching the latest sent seq (see Pitfall 3) |
| Draft recovery dialog appears even when the draft is identical to the saved content (no real recovery needed) | Annoying, trains users to reflexively dismiss recovery dialogs, defeating their purpose for the time it matters | Compare draft content to document content before prompting — only show the dialog if they actually differ, not just if `draft.updated_at > document.updated_at` |
| Image upload inserts a blob-URL placeholder but never cleans it up or handles upload failure | Broken image icon persists after a failed upload with no retry affordance; memory leak from un-revoked blob URLs on repeated uploads | Insert blob URL placeholder, replace in-place with the real URL string (not a full content reset) on success, revoke the blob URL, and on failure show an inline error state at the image's markdown position rather than silently leaving a dead reference |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **CommonMark/GFM conformance suite green**: Verify it's comparing *pre-sanitize* output as TRD §10 specifies — a suite comparing *post-sanitize* output can pass while GFM elements (task-list checkboxes, TRD-required) are silently stripped (Pitfall 2). Add a separate positive-case sanitize test.
- [ ] **Autosave "works" in manual testing**: Verify it survives artificial network latency/jitter (Chrome DevTools throttling) and rapid burst typing followed by immediate navigation — the common failure mode (Pitfall 3) only surfaces under realistic network conditions, not on localhost.
- [ ] **Folder move "works" for the tested case**: Verify the cycle-rejection path (moving a folder into its own descendant) is explicitly tested, not just the happy-path move (Pitfall 4) — a folder tree with no cycle guard can look completely functional until someone actually tries the invalid move.
- [ ] **Korean search "works"**: Verify with real short Korean queries (1-3 syllables) and with content pasted from at least one NFD-producing source, not just typed English test fixtures (Pitfall 6) — an English-only test suite will never catch either issue.
- [ ] **Editor "works" in dev**: Verify a Korean IME composition test exists (simulated compositionstart/update/end sequence), not just manual English typing (Pitfall 1) — this is invisible in a Latin-script-only manual QA pass.
- [ ] **SSR "works"**: Verify a production build (`next build && next start`), not just `next dev`, since some SSR/hydration issues only surface in production mode rendering (Pitfall 7).

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|----------------|------------------|
| GFM checkboxes stripped in production | LOW | Extend sanitize schema, redeploy — no data loss since `document.content` (raw markdown) was never touched, only the rendered view was wrong |
| NFC/NFD search mismatch discovered post-launch | MEDIUM | Backfill migration: `UPDATE document SET title = normalize(title, NFC), content = normalize(content, NFC)`, rebuild trigram GIN indexes; add normalize-on-write going forward |
| Closure table cycle corruption from a shipped-without-guard move | HIGH | Requires manual data repair — rebuild closure table from a known-good `parent_id` adjacency snapshot if one exists, or reconstruct from audit/backup; this is why the guard belongs in R1, not patched later |
| Autosave data loss from a shipped race condition | MEDIUM | Add client-side seq freshness check and deploy; historical lost edits are unrecoverable (no version history per Out of Scope) but the draft snapshot (1-min, TRD §7) limits exposure to at most ~1 minute of loss going forward |
| Korean IME corruption discovered post-launch | LOW-MEDIUM | Fix the controlled/uncontrolled wiring; no server-side data corruption since bad composition only corrupts the client-side buffer before save — but any already-saved corrupted content needs manual user correction, not automatically recoverable |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| CM6 controlled-component IME breakage | Editor core/scaffolding (R1) | Playwright test simulating compositionstart/update/end for a multi-syllable Korean word; assert final buffer and no dropped jamo |
| rehype-sanitize strips GFM task-list checkboxes | Markdown pipeline (R1) | Positive-case unit test: each of the 3 enabled GFM elements (strikethrough, tasklist, table) survives the full pipeline including sanitize |
| Autosave out-of-order/race | Autosave protocol (R1) | E2E test under simulated network latency/jitter; status bar only reflects response matching latest sent seq |
| Closure Table move-into-descendant cycle | Folder tree CRUD (R1) | Unit test: move into self, move into direct child, move into unrelated folder — first two rejected, third succeeds |
| Soft-delete + future uniqueness collision | Not yet scheduled (latent) | Flag as design constraint if any future phase adds name-uniqueness; require partial index + restore pre-check in that phase's plan |
| Korean pg_trgm short-query/NFC mismatch | Document save (R1, normalize-on-write) + Search (R2, threshold tuning) | Search test fixtures include real 1-3 syllable Korean queries and at least one NFD-sourced paste; assert both match |
| Next.js SSR crash with CodeMirror | Editor scaffolding (R1) | Production build (`next build && next start`) renders the editor route without SSR error or hydration warning |

## Sources

- [ProseMirror Korean IME issue #1484](https://github.com/ProseMirror/prosemirror/issues/1484) — adjacent editor framework, same composition-event class of bug
- [CodeMirror dev IME composition-end detection issue #1069](https://github.com/codemirror/dev/issues/1069)
- [CodeMirror discuss: composition issue when compositionend registered outside](https://discuss.codemirror.net/t/composition-issues-when-compositionend-registered-outside/6065)
- [CodeMirror discuss: how to listen to changes with IME support](https://discuss.codemirror.net/t/how-to-listen-to-changes-with-ime-support/5737)
- [rehype-sanitize GitHub repo + readme](https://github.com/rehypejs/rehype-sanitize) — defaultSchema behavior
- [hast-util-sanitize on unifiedjs.com](https://unifiedjs.com/explore/package/hast-util-sanitize/)
- [React Query autosave race conditions](https://www.pz.com.au/avoiding-race-conditions-and-data-loss-when-autosaving-in-react-query)
- [Race conditions in React — TypeScript guard pattern](http://wanago.io/2020/03/02/race-conditions-in-react-and-beyond-a-race-condition-guard-with-typescript/)
- [Percona: Moving Subtrees in Closure Table Hierarchies](https://www.percona.com/blog/moving-subtrees-in-closure-table/) (Bill Karwin pattern)
- [Advanced Unique Index Patterns for Soft Deletes (PHP Architect)](https://www.phparch.com/2026/02/advanced-unique-index-patterns-for-soft-deletes-mysql-and-postgresql/)
- [PostgreSQL official docs: pg_trgm](https://www.postgresql.org/docs/current/pgtrgm.html) — trigram padding, similarity thresholds, LC_CTYPE=C limitation
- [Unicode UAX #15: Normalization Forms](https://unicode.org/reports/tr15/) — NFC/NFD canonical equivalence for Hangul
- [Next.js window is not defined / dynamic ssr:false App Router caveat](https://medium.com/@eric.burel/how-to-get-rid-of-window-is-not-defined-and-hydration-mismatch-errors-in-next-js-567cc51b4a17)
- [Fixing navigator is not defined with CodeMirror + Next.js](https://dev.to/glowtoad123/using-codemirror-in-nextjs-without-the-navigator-error-opi)
- [remarkjs/react-markdown large-document performance discussion](https://github.com/orgs/remarkjs/discussions/1027)
- Project TRD.md (`/Users/codevillain/Claude-Code-Expert/markdown-kms/docs/TRD.md`) — stack, schema, and protocol decisions these pitfalls are scoped against

---
*Pitfalls research for: workspace markdown KMS (markdown-kms)*
*Researched: 2026-08-01*
