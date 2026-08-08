---
phase: 02-markdown-rendering-editor-formatting
verified: 2026-08-02T15:40:00Z
status: passed
score: 4/5 truths verified
behavior_unverified: 1
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/5 truths verified
  gaps_closed:

    - "GAP-1 (Critical): hr.ts inserted \"\\n---\\n\" which rendered as a Setext <h2>, not a thematic break — fixed: blank line prepended when on-line content precedes the insertion point."
    - "GAP-2 (Critical): table.ts glued trailing same-line content onto the last row, silently dropped by GFM — fixed: symmetric trailing blank-line separator appended when not at line-end."
    - "GAP-3 (Warning, then re-opened as CR-01): code-block.ts unclosed-fence swallowed trailing document content — fixed in the selection-wrap branch by 02-06, then found INCOMPLETE for the caret (from===to) branch by re-review, then fixed there too (commits 20621dd/4a4590c)."
    - "GAP-4 (Warning, then extended as WR-02): heading.ts nested the marker in front of a conflicting list prefix instead of replacing it — fixed for list/blockquote prefixes by 02-06; re-review found level-5/6 ATX headings still nested, then ATX_RE widened to /^(#{1,6}) / to also strip those (commits 20621dd/4a4590c)."
    - "GAP-5 (Warning): hr.ts destroyed a non-empty selection instead of preserving it — fixed: rule now inserted after `to`, never replacing [from, to]."
    - "GAP-6 (Warning): PreviewPane.tsx swallowed render exceptions with no logging — fixed: catch block now console.error-logs before returning the unchanged fixed fallback."
  gaps_remaining: []
  regressions: []
gaps: []
deferred:

  - truth: "hr.ts inserts a superfluous leading blank line at absolute document/line start (WR-01)"
    addressed_in: "Not scheduled — deliberately deferred as cosmetic"
    evidence: "02-REVIEW.md Resolution: \"Zero rendered-output impact (a correct <hr> either way); the plan's own must_have sanctions one leading newline for empty on-line content. Not worth churning a GREEN fixture.\" Independently re-verified by CommonMark reasoning: doc \"\\n---\\n\" opens with a blank line, so \"---\" cannot be read as a Setext heading underline (no paragraph text immediately precedes it) — it always renders <hr> correctly; the only defect is a stray blank line, not broken output."

  - truth: "Checked task-list marker \"- [x]\" is not recognized by any of the 5 line-prefix plugins' shared regex shape, including heading.ts (IN-01)"
    addressed_in: "Not scheduled — pre-existing limitation across all 5 sibling plugins, out of phase-2 scope per 02-06's planning_notes"
    evidence: "02-REVIEW.md IN-01: \"pre-existing limitation shared identically across all five prefix-replacing plugins (not introduced by the 02-06 gap-closure diff)\"."

  - truth: "PreviewPane.tsx logs via a render-time side effect inside the component body, which can double-log under React StrictMode (IN-02)"
    addressed_in: "Not scheduled — explicitly required by the plan (GAP-6), StrictMode double-log is dev-only cosmetic"
    evidence: "02-REVIEW.md IN-02: \"Not a correctness issue for production output... low priority; not required for this phase.\""
behavior_unverified_items:

  - truth: "Typing Korean text via IME composes correctly without corruption or dropped characters (ROADMAP Success Criteria 5)"
    test: "Type '한글 조합 테스트' via a real Korean IME (not paste) into the editor at /w/[wsId], letting each syllable block compose naturally, then click Bold on part of the composed text."
    expected: "No dropped, duplicated, or reordered syllables at any point; the editor's final document content exactly matches what was typed (plus '**...**' wrap markers); the preview renders the same Korean text inside <strong>."
    why_human: "No authoritative headless-E2E recipe exists for driving real multi-keystroke jamo-assembly IME composition. Code-level support (EditorHost's uncontrolled mount-once useEffect, content read out only via updateListener) is verified present and wired; the behavioral guarantee itself is not exercised by any automated test. Unchanged by gap-closure — no plugin/EditorHost architecture code was touched."
human_verification:

  - test: "Korean IME composition safety: type '한글 조합 테스트' via a real IME into the editor, apply Bold mid/adjacent to composition."
    expected: "No dropped/duplicated/reordered syllables; doc content matches input + Bold markers; preview shows the same Korean text inside <strong>."
    why_human: "No headless E2E can drive genuine IME composition events."

  - test: "Full toolbar visual walkthrough: hover each of the 14 controls (heading dropdown + 13 flat buttons); open the heading dropdown."
    expected: "Each renders a 16px lucide icon in a 32x32px button; hovering shows an immediate (no ~300ms delay) tooltip with the correct label; exactly two visual states exist (default/hover) with no pressed/active-format animation; heading dropdown shows exactly 5 items (제목1-4 + 본문)."
    why_human: "Hover-state timing and visual tooltip/dropdown styling are visual-craft judgments no automated assertion in this repo encodes."

  - test: "Preview overflow / long-text states: paste a long unbroken URL, a wide GFM table, a long unwrapped code line, and a long heading/paragraph."
    expected: "Long URL wraps within the pane (overflow-wrap); wide table and long code line scroll horizontally within their own container; long heading/paragraph wraps naturally with no ellipsis truncation."
    why_human: "Pixel-level overflow/scroll containment is a rendering outcome best confirmed visually."

  - test: "Non-persistent contract: type content into the editor, then refresh the browser tab."
    expected: "All content is lost (editor returns to empty state); no save indicator, status bar, or unsaved-changes warning appears at any point (Phase 4 owns persistence — this is intended, not a bug)."
    why_human: "An 'absence of any transient UI' assertion is more reliably confirmed by a human glance."

  - test: "(Informational, non-blocking) Applying a heading format to a line inside an open \\`\\`\\` code fence."
    expected: "heading.ts does not detect open code fences (known, documented limitation). Confirm whether this edge case matters in practice; it does not block EDIT-01 as specified."
    why_human: "No fixture in the locked test contract exercises this case — a human judgment call on follow-up priority."
---

# Phase 2: Markdown Rendering & Editor Formatting Verification (Re-Verification)

**Phase Goal:** Users can format markdown through the toolbar or syntax and see an accurate, safe, fast live preview
**Verified:** 2026-08-02T15:40:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (plan 02-06) and a subsequent re-review + inline fix cycle

## Summary

The prior verification cycle (2026-08-02T14:10:00Z) found `status: gaps_found` — 6 real functional
defects in the gap-closure REVIEW, where GAP-1 (Critical, hr renders as Setext heading not `<hr>`),
GAP-2 (Critical, table drops trailing same-line content), GAP-3/4/5/6 (Warning) had shipped GREEN
because no test ever fed plugin output through the real rendering pipeline. Gap-closure plan 02-06
then built that missing integration gate (`tests/markdown/plugin-render.test.ts`) and fixed all 6.
A subsequent re-review (`02-REVIEW.md`, standard depth) ran the fixes back through the SAME
real-pipeline method and found the fix was incomplete in two spots — GAP-3's line-boundary guard
never reached code-block's caret-only branch (CR-01), and heading's list-prefix strip never
recognized an existing level-5/6 ATX heading (WR-02) — plus three cosmetic/deferred items
(WR-01, IN-01, IN-02). CR-01 and WR-02 were fixed inline (commits `20621dd` RED, `4a4590c` fix).
This re-verification independently re-derives every one of these claims against the CURRENT
codebase — not the historical report — and confirms all 6 original gaps plus the 2 re-review
findings are genuinely closed, with no regressions.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria — the contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can apply heading (H1-H4/P), inline (bold/italic/strikethrough/code), list (bullet/ordered/task), block (blockquote/code block/hr), and insert (link/image/table) formatting via the toolbar interface or markdown syntax. | VERIFIED | All 14 plugin files present, pure `run(state):TransactionSpec`, zero cross-plugin imports, zero real `EditorView` imports (confirmed by `grep -n "^import.*EditorView"` — no hits). This time the truth is backed by genuine end-to-end evidence, not just unit fixtures: `tests/markdown/plugin-render.test.ts` (7 cases) feeds each of hr/table/code-block/heading's actual `run()` output through the real `markdownProcessor` and asserts on the rendered HTML. Independently re-ran: `pnpm vitest run` → **25 files / 748 tests passed** (matches the documented known-good baseline exactly). |
| 2 | Preview updates to match CommonMark 0.31.2 + GFM output within 60ms p95 for a 10,000-character document. | VERIFIED (unaffected by this cycle) | No file under `e2e/` or `src/lib/markdown/pipeline.ts` was touched by 02-06 or the re-review fixes (`git diff --stat 78da262..HEAD -- e2e/ src/lib/markdown/pipeline.ts` is empty) — the previously independently-measured 13.30ms p95 stands; nothing in this delta could regress it (PreviewPane's only change is a `console.error` call inside an existing catch, no new work per render). |
| 3 | `<script>` tags, event-handler attributes, and `javascript:` URLs never execute in the preview pane. | VERIFIED | `src/lib/markdown/schema.ts` confirmed byte-identical since before gap-closure (`git diff --quiet 78da262 -- src/lib/markdown/schema.ts` → unchanged). `tests/markdown/sanitize.test.ts` still passes in the fresh full-suite run. `PreviewPane.tsx` confirmed to still never use `dangerouslySetInnerHTML` (`grep -c` → 0); the plan's own prohibition against weakening the sanitize schema was enforced and independently re-confirmed. |
| 4 | GFM task-list checkboxes render correctly despite HTML sanitization. | VERIFIED (see note, unchanged) | Same as prior verification — functional truth holds and is tested; the ROADMAP wording nuance (schema is unmodified `defaultSchema`, not "explicitly extended") remains a documented, non-blocking doc-wording note, not a gap. |
| 5 | Typing Korean text via IME composes correctly without corruption or dropped characters — the editor runs uncontrolled and never re-pushes external content mid-composition. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Unchanged from prior verification. No file in `EditorHost.tsx` or the editor mount architecture was touched by this gap-closure cycle. The structural precondition (uncontrolled CM6 mount, content read out only via `updateListener`) remains present and wired; the behavioral guarantee is still not exercised by any automated test. Routed to human verification below (seeded in `02-UAT.md`, `result: [pending]`). |

**Score:** 4/5 truths verified (1 present, behavior-unverified) — unchanged count from the prior
cycle, but Truth #1 is now VERIFIED on genuinely correct grounds (the new integration gate),
closing the false-positive the prior initial verification had before code review caught it.

### Requirements Coverage (re-checked against current code)

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|-----------------|--------------|--------|----------|
| EDIT-01 | 02-02, 02-04, 02-06 | Heading H1-H4/P via toolbar/syntax | SATISFIED | `heading.ts` traced by hand against its own fixtures: `"- item"` + `heading(1)` → `ANY_LIST_PREFIX_RE` strips `"- "` (len 2) → `"# item"` (was `"# - item"`, the GAP-4 defect). `"##### x"` + `heading(2)` → widened `ATX_RE=/^(#{1,6}) /` strips `"##### "` (len 6) → `"## x"` (was nesting, WR-02). Both confirmed via `tests/markdown/plugin-render.test.ts` HTML assertions (`<h1>item</h1>`, `<h2>x</h2>`) AND matching `tests/editor/heading.test.ts` doc-string fixtures — both pass in the fresh run. |
| EDIT-02 | 02-02, 02-03, 02-04 | Bold/italic/strikethrough/inline-code | SATISFIED | Unchanged by this cycle; 4 plugin files + tests GREEN in the fresh 748-test run. |
| EDIT-03 | 02-02, 02-04 | Bullet/ordered/task lists | SATISFIED | Unchanged by this cycle; 3 plugin files + tests GREEN. |
| EDIT-04 | 02-02, 02-04, 02-06 | Blockquote/code-block/hr | SATISFIED | `hr.ts` traced: doc `"x"`, cursor at 1 → `before="x"` non-empty → `"\n\n---\n"` inserted → doc `"x\n\n---\n"` (thematic break, not Setext — GAP-1 fixed); non-empty selection `[0,5)` in `"hello world"` → insert happens at `to` only, selection text survives → `"hello\n\n---\n world"` (GAP-5 fixed). `code-block.ts` traced for BOTH branches: selection-wrap `"x hello"` select `[0,1)` → closer lands on own line → `"```\nx\n```\n hello"`; caret-only `"abc hello"` at offset 3 → opener AND closer both guarded (this was the CR-01 re-review finding) → `"abc\n```\n\n```\n hello"` — trailing `"hello"` renders outside `</pre>` in both cases, confirmed by the plugin-render integration test's index-comparison assertion. All traces match the pinned fixtures exactly and the full suite passes. |
| EDIT-05 | 02-02, 02-04, 02-06 | Link/image/table insert | SATISFIED | `table.ts` traced: doc `"hello"`, cursor at 0 (line-start, trailing content) → `atLineStart=true` (no leading pad), `atLineEnd=false` (trailing `"\n\n"` pad) → doc `SKELETON + "\n\nhello"` — `"hello"` becomes its own paragraph, no longer glued/dropped (GAP-2 fixed). Link/image unchanged, still GREEN. |
| EDIT-06 | 02-02, 02-03, 02-05 | 60ms p95 preview budget | SATISFIED | Unaffected — no perf-relevant file touched this cycle (see Truth #2 evidence). |
| EDIT-08 | 02-01, 02-03 | Sanitize/XSS safety + GFM survives sanitize | SATISFIED | `schema.ts` confirmed byte-identical; `sanitize.test.ts` GREEN in the fresh run. |

No orphaned requirements: all 7 IDs (EDIT-01, 02, 03, 04, 05, 06, 08) mapped to Phase 2 in
`REQUIREMENTS.md` appear in at least one plan's `requirements:` frontmatter field (02-01
through 02-06 collectively), confirmed by grep across all 6 `*-PLAN.md` files.

### Gap Closure Verification (this cycle's primary focus)

| Gap | Severity | Claimed fix (02-06 / re-review) | Independently re-verified | Status |
|-----|----------|----------------------------------|---------------------------|--------|
| GAP-1 | Critical | `hr.ts`: blank line prepended before `---` when on-line content is non-empty | Hand-traced algorithm on doc `"x"` → `"x\n\n---\n"`; `tests/markdown/plugin-render.test.ts` HTML assertion `toContain("<hr")` / `.not.toContain("<h2")` passes in fresh run | ✓ CLOSED |
| GAP-2 | Critical | `table.ts`: trailing blank-line separator appended when not at line-end | Hand-traced on doc `"hello"` → `SKELETON+"\n\nhello"`; integration test asserts `<table` present AND `"hello"` present in rendered HTML — passes | ✓ CLOSED |
| GAP-3 | Warning → escalated by re-review to incomplete (CR-01) | Selection-wrap branch fixed by 02-06; **caret-only branch found still broken by re-review**, then fixed in commit `4a4590c` | Read current `code-block.ts` source directly: the `from === to` branch now computes `atLineStart`/`atLineEnd` and builds `opener`/`closer` identically to the wrap branch (lines 33-46) — the exact CR-01 defect (caret branch skipping the guard) is gone. Both plugin-render.test.ts cases (selection AND caret) pass; hand-traced caret case on `"abc hello"` matches the pinned fixture exactly. | ✓ CLOSED |
| GAP-4 | Warning → extended by re-review (WR-02) | List/blockquote prefix strip fixed by 02-06; **level-5/6 ATX heading still nested, found by re-review**, then `ATX_RE` widened to `/^(#{1,6}) /` in commit `4a4590c` | Read current `heading.ts` source: `ATX_RE = /^(#{1,6}) /` (was `{1,4}`), comment explicitly documents the widening is for stripping only, `allSameLevel` logic unaffected since 5/6-length never equals a 1-4 target. Hand-traced `"##### x"` + level 2 → `"## x"`. Both plugin-render cases (list-prefix, level-5) pass. | ✓ CLOSED |
| GAP-5 | Warning | `hr.ts`: rule inserted after selection (`to`), never replacing `[from,to]` | Hand-traced non-empty selection case `"hello world"` select `[0,5)` → `"hello\n\n---\n world"` — `"hello"` survives; matches pinned fixture and passes | ✓ CLOSED |
| GAP-6 | Warning | `PreviewPane.tsx`: catch block logs via `console.error` before returning the unchanged fallback | Read current source: `catch (error) { console.error("PreviewPane render failed:", error); return <fixed fallback>; }` — confirmed no interpolation of the caught error/content into JSX, `dangerouslySetInnerHTML` count still 0 | ✓ CLOSED |

### Deferred Items (cosmetic/pre-existing, not gaps — independently assessed as non-blocking)

| # | Item | Assessment |
|---|------|------------|
| WR-01 | hr inserts one superfluous leading `\n` at absolute doc/line start | Independently re-derived via CommonMark semantics: a leading blank line before `---` means there is no paragraph text directly above it, so it can never be misread as a Setext heading underline — the rendered output is a correct `<hr>` either way. Purely a cosmetic extra blank line, zero functional impact. Confirmed non-blocking. |
| IN-01 | `- [x]` (checked task marker) not recognized by `ANY_LIST_PREFIX_RE` in any of 5 sibling prefix plugins | Confirmed pre-existing across `heading.ts`, `bullet-list.ts`, `ordered-list.ts`, `blockquote.ts`, `task-list.ts` — not introduced or worsened by this cycle. Correctly out of phase-2 scope. |
| IN-02 | `console.error` runs inside PreviewPane's render body (StrictMode double-log) | The logging was itself required by GAP-6; StrictMode double-invocation is a known, harmless dev-only React behavior, not a production defect. |

### Regression Check (previously-passing items — quick sanity re-confirmation)

| Area | Check | Result |
|------|-------|--------|
| Full test suite | `pnpm vitest run` (with DB env loaded) | 25 files / 748 tests passed — matches documented baseline exactly |
| TypeScript | `pnpm exec tsc --noEmit` | Clean, no output |
| Sanitize schema | `git diff --quiet 78da262 -- src/lib/markdown/schema.ts` | Unchanged |
| No cross-plugin imports | `grep "^import.*from \"\./"` across all 14 plugin files (excluding `types.ts`) | Only `./types` imports found |
| No EditorView imports | `grep -n "^import.*EditorView"` across all 14 plugin files | Zero matches |
| No debt markers | `grep -iE "TBD\|FIXME\|XXX\|TODO\|HACK\|placeholder\|not yet implemented"` across the 6 gap-closure-modified files | Zero real hits (one benign doc-comment mention of "placeholder cells" describing the table skeleton's literal text, not a stub marker) |
| Executed plans immutable | `git log 78da262..HEAD -- .planning/.../02-0[1-5]-PLAN.md .../02-0[1-5]-SUMMARY.md` | No hits — only 02-06 and doc/review files changed |
| Only declared files touched | `git diff --stat 78da262..HEAD -- src/ tests/` | Exactly the 5 source files + 4 unit test files + 1 new integration test file (matches 02-06's `files_modified` plus the CR-01/WR-02 re-review delta to the same files) |

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/placeholder-marker debt in any file modified by
gap-closure or the re-review fix. No stub returns, no silently-swallowed exceptions remain
(GAP-6 closed that). No memoization was added to the preview path (checked — none present).

### Human Verification Required

Unchanged from the prior verification cycle — these 5 items were never code gaps; they were
deferred to end-of-phase human check by the executing plans themselves and are already seeded
in `02-UAT.md` with `status: testing`, all 5 still `result: [pending]`. See frontmatter
`human_verification` for full detail. None of the gap-closure or re-review commits touched
`EditorHost.tsx`, `Toolbar.tsx`/`HeadingDropdown.tsx`, `PreviewPane.module.css`, or any
persistence-related code, so nothing in this cycle could have resolved or regressed them:

1. Korean IME composition safety (the phase's one behavior-unverified truth)
2. Full toolbar visual walkthrough (hover/tooltip timing, pressed-state absence)
3. Preview overflow / long-text states
4. Non-persistent contract (refresh clears content, no false save UI)
5. (Informational) heading-inside-open-code-fence edge case

### Gaps Summary

**No gaps remain.** All 6 code-review-identified gaps (GAP-1 through GAP-6) plus the 2
additional defects found by the post-closure re-review (CR-01: code-block caret path missed
the GAP-3 guard; WR-02: heading didn't strip an existing level-5/6 ATX marker) are independently
confirmed closed against the CURRENT source — not merely by trusting SUMMARY.md or REVIEW.md
claims, but by hand-tracing each fixed plugin's algorithm against its exact pinned fixture, by
reading the actual current file contents, and by an independent fresh run of the full test
suite (`pnpm vitest run` → 748/748 passing) and `tsc --noEmit` (clean). The 3 remaining
REVIEW.md findings (WR-01, IN-01, IN-02) were independently assessed as correctly deferred —
cosmetic or pre-existing, not functional regressions. Status is `human_needed` solely because
of the 5 pre-existing, already-seeded human-verification items (one of which is the Korean IME
behavior-unverified truth) — none of which this gap-closure cycle could resolve since none of
its changes touched the relevant code paths. Phase 2 is ready to proceed to
`/gsd-verify-work` for final human sign-off before Phase 3.

---

*Verified: 2026-08-02T15:40:00Z*
*Verifier: Claude (gsd-verifier)*
