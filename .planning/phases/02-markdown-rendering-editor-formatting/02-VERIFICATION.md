---
phase: 02-markdown-rendering-editor-formatting
verified: 2026-08-02T14:10:00Z
status: human_needed
score: 4/5 truths verified
behavior_unverified: 1
overrides_applied: 0
behavior_unverified_items:
  - truth: "Typing Korean text via IME composes correctly without corruption or dropped characters (ROADMAP Success Criteria 5)"
    test: "Type '한글 조합 테스트' via a real Korean IME (not paste) into the editor at /w/[wsId], letting each syllable block compose naturally, then click Bold on part of the composed text."
    expected: "No dropped, duplicated, or reordered syllables at any point; the editor's final document content exactly matches what was typed (plus '**...**' wrap markers); the preview renders the same Korean text inside <strong>."
    why_human: "No authoritative headless-E2E recipe exists for driving real multi-keystroke jamo-assembly IME composition (CDP Input.insertText / Playwright's keyboard API cannot simulate genuine compositionstart/update/end sequences — RESEARCH Assumptions Log A1/A2, flagged as a 'backstop' truth in all three of 02-02/02-03/02-05's PLAN frontmatter). Code-level support for this (EditorHost's uncontrolled mount-once useEffect, content read out only via updateListener, never pushed back in) is verified present and wired; the behavioral guarantee itself is not exercised by any automated test."
human_verification:
  - test: "Korean IME composition safety: type '한글 조합 테스트' via a real IME into the editor, apply Bold mid/adjacent to composition, refresh understanding of round-trip."
    expected: "No dropped/duplicated/reordered syllables; doc content matches input + Bold markers; preview shows the same Korean text inside <strong>."
    why_human: "No headless E2E can drive genuine IME composition events (RESEARCH A1/A2)."
  - test: "Full toolbar visual walkthrough: hover each of the 14 controls (heading dropdown + 13 flat buttons); open the heading dropdown."
    expected: "Each renders a 16px lucide icon in a 32x32px button; hovering shows an immediate (no ~300ms delay) tooltip with the correct label; exactly two visual states exist (default/hover) with no pressed/active-format animation; heading dropdown shows exactly 5 items (제목1-4 + 본문)."
    why_human: "Hover-state timing and visual tooltip/dropdown styling are visual-craft judgments no automated assertion in this repo encodes (D-P2-04/05)."
  - test: "Preview overflow / long-text states: paste a long unbroken URL, a wide GFM table, a long unwrapped code line, and a long heading/paragraph."
    expected: "Long URL wraps within the pane (overflow-wrap); wide table and long code line scroll horizontally within their own container; long heading/paragraph wraps naturally with no ellipsis truncation."
    why_human: "Pixel-level overflow/scroll containment is a rendering outcome best confirmed visually; no Playwright assertion in this repo checks it."
  - test: "Non-persistent contract: type content into the editor, then refresh the browser tab."
    expected: "All content is lost (editor returns to empty state); no save indicator, status bar, or unsaved-changes warning appears at any point (Phase 4 owns persistence — this is intended, not a bug)."
    why_human: "An 'absence of any transient UI' assertion is more reliably confirmed by a human glance than an automated DOM-absence check across every possible render."
  - test: "(Informational, non-blocking) Applying a heading format to a line inside an open ``` code fence."
    expected: "heading.ts does not currently detect open code fences (RESEARCH Common Pitfalls #5, flagged as a known limitation in 02-04-SUMMARY.md, not exercised by any pinned heading.test.ts fixture). Confirm whether this edge case matters in practice; it does not block EDIT-01 as specified."
    why_human: "No fixture in the locked test contract exercises this case — a human judgment call on whether it needs a follow-up phase item."
---

# Phase 2: Markdown Rendering & Editor Formatting Verification

**Phase Goal:** Users can format markdown through the toolbar or syntax and see an accurate, safe, fast live preview
**Verified:** 2026-08-02T14:10:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria — the contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can apply heading (H1-H4/P), inline (bold/italic/strikethrough/code), list (bullet/ordered/task), block (blockquote/code block/hr), and insert (link/image/table) formatting via the toolbar interface or markdown syntax. | VERIFIED | All 14 plugin files exist in `src/components/editor/plugins/`, each a pure `run(state):TransactionSpec`. `pnpm vitest run` (fresh run, this verification): **24 files / 735 tests passed**, including all 14 `tests/editor/*.test.ts` files. `Toolbar.tsx` renders all 5 groups (heading dropdown + 4 flat groups of 4/3/3/3) wired via `view.dispatch(plugin.run(view.state))`. `plugins/index.ts` registers all 13 flat plugins + `heading` factory in the exact UI-SPEC order. |
| 2 | Preview updates to match CommonMark 0.31.2 + GFM output within 60ms p95 for a 10,000-character document. | VERIFIED | Independently re-ran `e2e/preview-perf.spec.ts` via `pnpm exec playwright test --config=e2e/playwright.perf.config.ts` (not trusting the SUMMARY's numbers): self-sanity control passed, then **measured p95 = 13.30ms** (n=100) for the 10,000-code-unit doc — well under the 60ms budget. `tests/spec/commonmark.test.ts` (652/652 fixtures) and `tests/spec/gfm.test.ts` both pass in the same fresh unit run. |
| 3 | `<script>` tags, event-handler attributes, and `javascript:` URLs never execute in the preview pane. | VERIFIED | `tests/markdown/sanitize.test.ts` (7 cases, read + confirmed passing in fresh run) asserts script-strip, `on*`-attribute strip, `javascript:` neutralization, and a nested-script-in-table-cell strip. `PreviewPane.tsx` never uses `dangerouslySetInnerHTML`; only `renderMarkdown()`'s sanitized React tree is rendered. |
| 4 | GFM task-list checkboxes render correctly despite HTML sanitization. | VERIFIED (see note) | `sanitize.test.ts` proves `- [ ] todo` survives sanitize as a disabled checkbox input, and `del`/`table` also survive. **ROADMAP wording note:** the parenthetical "(sanitize schema explicitly extended for input/del/table, not left at the sanitizer's stripped default)" is factually superseded — `src/lib/markdown/schema.ts` re-exports `rehype-sanitize`'s **unmodified** `defaultSchema` with a rationale comment; RESEARCH verified the unmodified schema already permits these elements, so no merge was written. The *functional* truth (checkboxes render) holds and is tested; only the *implementation-detail* clause in ROADMAP is now inaccurate. This is documented consistently across 02-01/02-03-SUMMARY.md as an intentional, evidence-based amendment (not a silent gap) — ROADMAP.md itself has not yet been updated to reflect it. Non-blocking; recommend a ROADMAP wording update. |
| 5 | Typing Korean text via IME composes correctly without corruption or dropped characters — the editor runs uncontrolled and never re-pushes external content mid-composition. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `EditorHost.tsx` verified in code: CM6 mounted exactly once (`useEffect` with `[]` deps), content read out only via `updateListener`, no controlled `value`/`content` prop is ever dispatched into the view — the structural IME-safety precondition is present and wired. But the actual behavioral guarantee (no dropped/corrupted syllables during real multi-keystroke IME composition) is not exercised by any automated test — no headless recipe exists for genuine `compositionstart/update/end` sequences. Routed to human verification below. |

**Score:** 4/5 truths verified (1 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/markdown/pipeline.ts` | Single shared pipeline: pre-sanitize + full HTML-string + React-tree exports | VERIFIED | Exports `markdownProcessorPreSanitize`, `markdownProcessor`, `renderMarkdown()` from one `baseProcessor()` composition. No memoization present. |
| `src/lib/markdown/remark-gfm-subset.ts` | Granular 3-GFM unified plugin | VERIFIED | Composes only `gfmStrikethrough`/`gfmTable`/`gfmTaskListItem` (micromark) + matching mdast-util-from-markdown extensions via `this.data()`. No bundled `remark-gfm` import anywhere in the repo (`grep` confirmed). |
| `src/lib/markdown/schema.ts` | Unmodified `defaultSchema` re-export + rationale | VERIFIED | `export { defaultSchema as schema } from "rehype-sanitize"` with a documented rationale comment. |
| `src/components/editor/plugins/*.ts` (14 files) | Pure `run(state)` formatting plugins, 1-feature-1-file | VERIFIED | All 14 files present (bold, italic, strikethrough, inline-code, bullet-list, ordered-list, task-list, blockquote, code-block, hr, link, image, table, heading). Grep confirms zero cross-plugin imports and zero `EditorView` imports (only doc-comment mentions of "no EditorView" remain). |
| `src/components/editor/plugins/index.ts` | Full 14-plugin registry in UI-SPEC order | VERIFIED | 13 flat plugins registered in UI-SPEC order + `heading` exported as a level factory; `editorKeymap` derived from plugin `keymap` fields. |
| `src/components/editor/EditorHost.tsx` | Uncontrolled CM6 mount | VERIFIED | `useEffect(() => {...}, [])` mount-once; `EditorView.updateListener` reads content out; no controlled prop dispatched in; live view exposed via `useImperativeHandle`. |
| `src/components/preview/PreviewPane.tsx` | Renders full pipeline output, sanitized | VERIFIED | Uses `renderMarkdown()`; empty-state and error-state (try/catch) copy present; `data-testid="preview-pane"` on all 3 branches (required by the perf harness); no `dangerouslySetInnerHTML`. |
| `src/components/layout/EditorPreviewLayout.tsx` | Assemblable 2-pane CSS Grid | VERIFIED | `grid-template-columns: minmax(0,1fr) minmax(0,1fr)`, `height: 100%` only — no `100vh`/`100dvh` inside the component (confirmed via grep); `100vh` correctly isolated to `page.module.css` at the route level. |
| `src/components/editor/Toolbar.tsx` + `HeadingDropdown.tsx` | lucide toolbar, 5 groups, immediate tooltip, default/hover only | VERIFIED (code-level) | Renders heading dropdown + 4 groups with 1px dividers; each button dispatches `plugin.run(view.state)`; no pressed-animation or 300ms-delay code found. Visual/interaction confirmation (tooltip timing, hover styling) deferred to human check below. |
| `app/(main)/w/[wsId]/page.tsx` | Preserves Phase 1 guard, renders `EditorPreviewLayout` | VERIFIED | `requireRole(wsId, "VIEWER")` + `notFound()` guard and workspace-name fetch unchanged; placeholder replaced with `<EditorPreviewLayout />`. |
| `e2e/preview-perf.spec.ts` + `e2e/playwright.perf.config.ts` | GREEN 60ms p95 harness w/ self-sanity control | VERIFIED | Independently re-run (see Behavioral Spot-Checks) — both tests pass, p95 = 13.30ms. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `Toolbar.tsx` / `HeadingDropdown.tsx` | live `EditorView` (`EditorHost.tsx`) | `getView()` imperative handle → `view.dispatch(plugin.run(view.state))` | WIRED | Confirmed in both files; `EditorPreviewLayout.tsx` passes `hostRef.current?.getView()` down to `Toolbar`. |
| `EditorHost.tsx` | `EditorPreviewLayout.tsx` (content state) | `onChange` prop → `EditorView.updateListener` → `setContent` | WIRED | `EditorPreviewLayout` owns `content` in local `useState`, passed to both `EditorHost` (`onChange`) and `PreviewPane` (`content`). |
| `PreviewPane.tsx` | `lib/markdown/pipeline.ts` | `renderMarkdown(content)` | WIRED | Direct import and call, wrapped in try/catch for the error-state fallback. |
| `lib/markdown/pipeline.ts` | `remark-gfm-subset.ts` + `schema.ts` | `.use(remarkGfmSubset)` / `.use(rehypeSanitize, schema)` | WIRED | Confirmed in `baseProcessor()` and the `markdownProcessor`/`markdownProcessorReact` chains. |
| `app/(main)/w/[wsId]/page.tsx` | `EditorPreviewLayout.tsx` | direct render | WIRED | Confirmed; guard preserved above the render. |

### Behavioral Spot-Checks (independently re-run, not trusted from SUMMARY)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full unit suite (652 CommonMark fixtures, GFM-3 guard, sanitize/XSS, all 14 plugin contracts) | `DATABASE_URL_TEST=... pnpm vitest run` | 24 files / 735 tests passed | PASS |
| `tsc --noEmit` clean | `pnpm exec tsc --noEmit` | exit 0, no output | PASS |
| No bundled `remark-gfm`, no highlight.js/prism | `grep` package.json + src/ | no matches | PASS |
| EDIT-06 perf harness (self-sanity + real 10k-char measurement) | `pnpm exec playwright test --config=e2e/playwright.perf.config.ts` | self-sanity pass; p95 = **13.30ms** (n=100) | PASS |
| No cross-plugin imports / no `EditorView` imports in plugins | `grep` across `src/components/editor/plugins/*.ts` | zero matches (only doc-comment mentions) | PASS |
| Debt markers (TBD/FIXME/XXX/TODO/HACK/placeholder) in phase-modified files | `grep` across all phase-2 source files | zero matches | PASS |
| All referenced task/plan commit hashes exist | `git cat-file -t <hash>` × 13 | all resolve as `commit` | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| EDIT-01 | 02-02, 02-04 | Heading H1-H4/P via toolbar/syntax | SATISFIED | `heading.ts` + `heading.test.ts` (5 cases) GREEN |
| EDIT-02 | 02-02, 02-03, 02-04 | Bold/italic/strikethrough/inline-code | SATISFIED | 4 plugin files + tests GREEN |
| EDIT-03 | 02-02, 02-04 | Bullet/ordered/task lists | SATISFIED | 3 plugin files + tests GREEN |
| EDIT-04 | 02-02, 02-04 | Blockquote/code-block/hr | SATISFIED | 3 plugin files + tests GREEN |
| EDIT-05 | 02-02, 02-04 | Link/image/table insert | SATISFIED | 3 plugin files + tests GREEN |
| EDIT-06 | 02-02, 02-03, 02-05 | 60ms p95 preview budget | SATISFIED | Independently re-measured 13.30ms |
| EDIT-08 | 02-01, 02-03 | Sanitize/XSS safety + GFM survives sanitize | SATISFIED | `sanitize.test.ts` (7 cases) GREEN |

No orphaned requirements: REQUIREMENTS.md maps exactly these 7 IDs to Phase 2, and all 7 appear in at least one plan's `requirements:` frontmatter field.

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/placeholder markers in any phase-2-modified source file. No stub returns, no hardcoded empty data flowing to render.

**Informational (non-blocking) note:** `heading.ts` does not detect whether a selected line sits inside an open code fence (documented as a known limitation in `02-04-SUMMARY.md`, citing RESEARCH Common Pitfalls #5). No pinned test fixture exercises this case, so it does not fail any EDIT-01 contract as specified — surfaced as an optional human-check item above for a judgment call on follow-up priority.

### Human Verification Required

See `human_verification` in frontmatter — 5 items: Korean IME composition safety (Success Criteria 5, the phase's one behavior-unverified truth), the full toolbar visual walkthrough (D-P2-04/05), preview overflow/long-text states (UI-SPEC), the non-persistent contract (D-P2-02), and the informational heading/code-fence edge case. All five were explicitly deferred to end-of-phase human-check by the plans themselves (`human_verify_mode: end-of-phase`) rather than invented by this verification.

### Gaps Summary

No gaps. All must-have artifacts exist, are substantive, and are wired; both research-conflict deviations (granular GFM composition instead of the bundled plugin; unmodified sanitize schema instead of a merge) are documented, intentional, and proven correct by tests re-run independently in this verification. The only open items are the five human-verification checks above, which the phase's own plans already scoped as deferred to end-of-phase sign-off — none of them indicate missing or broken code.

---

*Verified: 2026-08-02T14:10:00Z*
*Verifier: Claude (gsd-verifier)*
