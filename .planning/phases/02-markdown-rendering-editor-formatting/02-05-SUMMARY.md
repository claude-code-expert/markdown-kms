---
phase: 02-markdown-rendering-editor-formatting
plan: 05
subsystem: testing
tags: [playwright, e2e, perf, measure-first, markdown, preview]

# Dependency graph
requires:
  - phase: 02-markdown-rendering-editor-formatting
    provides: "02-03 real editor+preview tracer (EditorHost/PreviewPane/pipeline.ts) that this plan measures; 02-02 RED perf harness (e2e/preview-perf.spec.ts)"
provides:
  - "EDIT-06 proven GREEN: keystroke->preview-mutation p95 measured at 16.70ms and 23.90ms across two runs on a 10,000-code-unit document, well inside the 60ms budget, with no memoization added (measure-first honored)"
  - "PreviewPane.tsx's data-testid=\"preview-pane\" root-element contract, required by the perf harness but missing from 02-03's implementation"
  - "e2e/playwright.perf.config.ts — an isolated, perf-run-only Playwright config (port 3411) that avoids colliding with unrelated pnpm dev sessions on port 3000"
  - "The phase's consolidated end-of-phase manual-verification checklist (IME, toolbar visual, overflow/long-text, non-persistence)"
affects: ["end-of-phase /gsd-verify-work (runs the consolidated manual checklist below)", "Phase 8 presentation (shares lib/markdown/pipeline.ts, untouched here)"]

actuals:
  tokens: 1200
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Perf-only Playwright config colocated under e2e/ (not the shared root playwright.config.ts) for measurements that need an isolated port/webServer lifecycle distinct from the rest of the e2e suite"

key-files:
  created:
    - e2e/playwright.perf.config.ts
  modified:
    - src/components/preview/PreviewPane.tsx
    - e2e/preview-perf.spec.ts

key-decisions:
  - "Measure-first honored: measured p95 (16.70ms, 23.90ms) is far under the 60ms budget, so NO memoization was added to pipeline.ts or PreviewPane.tsx. The full-document re-parse + default React reconcile path from 02-03 stays as-is (TRD §5 / CLAUDE.md invariant)."
  - "PreviewPane.tsx's missing data-testid=\"preview-pane\" contract (pinned by the perf harness in 02-02, never added by 02-03) was added across all three render branches (empty-state, success, error-catch) — a Rule 3 blocking fix, not a plan file the RESEARCH anticipated needing a change, but required for the harness to observe the preview DOM at all."
  - "A dedicated e2e/playwright.perf.config.ts (port 3411) runs only e2e/preview-perf.spec.ts, isolated from the shared root playwright.config.ts (port 3000, unmodified, out of this plan's file scope). Root cause: port 3000 in this environment was occupied by an unrelated, user-owned pnpm dev session in the main checkout (confirmed via lsof cwd + tty attachment to an active terminal) — not a sibling worktree agent. The shared config's reuseExistingServer would have silently attached to that unrelated server and measured the wrong code."

patterns-established:
  - "Perf assertions log their measured p95 via console.log (not just pass/fail) so future runs have a comparable historical number in CI output, without turning the log into an assertion."

requirements-completed: [EDIT-06]

coverage:
  - id: D1
    description: "EDIT-06: keystroke->preview DOM update p95 <=60ms for a 10,000-code-unit document, harness self-sanity-validated first"
    requirement: "EDIT-06"
    verification:
      - kind: e2e
        ref: "e2e/preview-perf.spec.ts (self-sanity control + 10,000-code-unit p95 test, run via e2e/playwright.perf.config.ts)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Consolidated end-of-phase manual-verification checklist covering Korean IME safety, full toolbar visual walkthrough, preview overflow/long-text states, and the non-persistent contract"
    verification: []
    human_judgment: true
    rationale: "Korean IME composition correctness and visual toolbar/tooltip/overflow behavior require a human observing a real browser with a real input method — no authoritative headless recipe exists (RESEARCH A1/A2, 02-VALIDATION.md Manual-Only Verifications). This is the phase's designated end-of-phase human-check, not something this plan can auto-pass."

duration: ~15min
completed: 2026-08-02
status: complete
---

# Phase 2 Plan 05: EDIT-06 Perf Proof + End-of-Phase Manual Checklist Summary

**Measured (not assumed) keystroke->preview p95 of 16.70ms/23.90ms on a 10,000-character document against the real 02-03 editor+preview tracer — well under the 60ms budget, so no memoization was added — plus the phase's Korean IME/toolbar/overflow manual checks consolidated into one end-of-phase human-check.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- Ran `e2e/preview-perf.spec.ts` (authored RED in 02-02) against the real `/w/[wsId]` tracer (02-03): the self-sanity control passed (near-zero latency on a static contenteditable probe), proving the harness itself is trustworthy before trusting its numbers against the app.
- Measured the 10,000-code-unit keystroke->preview-mutation p95 twice: **16.70ms** and **23.90ms** — both comfortably under the 60ms budget (TRD §5 / EDIT-06 / NFR-1.1). Per measure-first discipline (CLAUDE.md invariant, this plan's `must_haves.prohibitions`), **no block memoization or other optimization was added** to `pipeline.ts` or `PreviewPane.tsx` — the render path stays full-document re-parse + default React reconcile, exactly as 02-03 left it.
- Fixed a genuine blocking gap discovered while running the harness: `PreviewPane.tsx` never carried the `data-testid="preview-pane"` root-element contract the perf harness requires (pinned in 02-02, silently missed by 02-03). Added it to all three render branches (empty-state, success, sanitize-exception catch) so the harness — and any future E2E spec — can locate the preview root.
- Discovered and worked around a port-3000 collision: an unrelated, user-owned `pnpm dev` session was already running from the main checkout (not a sibling worktree agent — confirmed via `lsof` cwd + active-tty check), which the shared root `playwright.config.ts`'s `reuseExistingServer: true` would have silently reused, measuring the wrong worktree's code entirely. Added `e2e/playwright.perf.config.ts`, an isolated perf-only config bound to port 3411, leaving the shared root config untouched (out of this plan's file scope).
- Confirmed `pnpm build`, `pnpm exec tsc --noEmit`, and the full `pnpm vitest run` suite are clean/green apart from the 13 plugin test files that are 02-04's scope (not yet present in this worktree — expected, matches 02-03's own SUMMARY note on the same pending imports).
- Assembled the phase's consolidated end-of-phase manual-verification checklist (below), covering all four areas the phase's automated tooling cannot reach.

## Task Commits

Each task was committed atomically:

1. **Task 1: Measure 60ms p95; optimize only if the measurement demands it** - `45fd005` (feat)
2. **Task 2: Consolidated end-of-phase verification (IME + toolbar/overflow visual)** - recorded in this SUMMARY; no source files changed (see below)

**Plan metadata:** commit for this SUMMARY (below)

## Files Created/Modified

- `e2e/playwright.perf.config.ts` - perf-run-only Playwright config (port 3411), avoids the port-3000 collision with an unrelated dev session
- `e2e/preview-perf.spec.ts` - added a `console.log` of the measured p95 for future regression comparison (informational, not an assertion)
- `src/components/preview/PreviewPane.tsx` - added `data-testid="preview-pane"` to all three render branches

## Decisions Made

- **Measure-first honored, no optimization committed.** Both measured p95 runs (16.70ms, 23.90ms) are well under the 60ms budget — the plan's own prohibition against unmotivated memoization applies, and no change was made to `pipeline.ts`/`PreviewPane.tsx`'s render path beyond the `data-testid` fix.
- **`data-testid="preview-pane"` added to `PreviewPane.tsx`** — a Rule 3 (blocking) fix. This selector was pinned as PreviewPane's required contract by the perf harness (02-02) but never actually added when `PreviewPane.tsx` was built in 02-03; without it the harness cannot observe the preview DOM at all.
- **`e2e/playwright.perf.config.ts` added instead of modifying the shared root `playwright.config.ts`.** The root config is out of this plan's file scope (`parallel_execution` restricts writable files to `pipeline.ts`, `PreviewPane.tsx`, and e2e/ perf spec adjustments), and modifying it would risk affecting other e2e specs/worktrees sharing the same conceptual config shape. A dedicated, narrowly-scoped config under `e2e/` — matched only to `preview-perf.spec.ts`, bound to port 3411 — sidesteps the port collision without touching shared state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `PreviewPane.tsx` missing the `data-testid="preview-pane"` contract required by the perf harness**
- **Found during:** Task 1 (first run of `e2e/preview-perf.spec.ts` against the real app)
- **Issue:** `e2e/preview-perf.spec.ts` (authored in 02-02) waits for `[data-testid="preview-pane"]` before measuring, and uses it as the MutationObserver target — this is PreviewPane's pinned root-element contract per the plan's own comments in the spec file. `src/components/preview/PreviewPane.tsx` (built in 02-03) never added this attribute to any of its three render branches, so the harness's `page.waitForSelector` timed out (5s) before any measurement could run.
- **Fix:** Added `data-testid="preview-pane"` to the empty-state, success, and sanitize-exception-catch render branches of `PreviewPane.tsx`.
- **Files modified:** `src/components/preview/PreviewPane.tsx`
- **Verification:** `e2e/preview-perf.spec.ts` locates and observes the preview root; both tests pass.
- **Committed in:** `45fd005` (Task 1 commit)

**2. [Rule 3 - Blocking] Port 3000 occupied by an unrelated, user-owned `pnpm dev` session**
- **Found during:** Task 1 (running the perf spec's second test, which navigates a real signup->workspace-create->host-route flow)
- **Issue:** The shared root `playwright.config.ts`'s `webServer` config (`url: http://localhost:3000`, `reuseExistingServer: !CI`) found an already-listening server on port 3000 and treated it as "the app" without starting its own. That server's process (`pid 3653`/`3659`) had `cwd` in the **main checkout** (`/Users/codevillain/Claude-Code-Expert/markdown-kms`, not any worktree) and was attached to an active terminal tty (`ttys006`, elapsed ~2h42m) — i.e., the user's own manual dev session, not a sibling parallel-executor worktree (the sibling agent's `pnpm dev` was independently confirmed running on port 3001, its own free port). Measuring against the main checkout's server would have silently proven (or disproven) EDIT-06 against code that isn't this plan's tracer at all.
- **Fix:** Did not touch the user's process. Added `e2e/playwright.perf.config.ts`, a perf-run-only config scoped to `preview-perf.spec.ts` only, binding both `baseURL` and `webServer` to port 3411 (`reuseExistingServer: false`, so it always starts its own fresh `next dev` from this worktree). Ran the spec via `pnpm exec playwright test --config=e2e/playwright.perf.config.ts`. The shared root `playwright.config.ts` (used by all other e2e specs, including the two workspace/auth specs from Phase 1) was left completely unmodified.
- **Files modified:** `e2e/playwright.perf.config.ts` (new)
- **Verification:** Perf server on 3411 started and tore down cleanly (confirmed via `lsof -i :3411` after each run — no leftover process); both perf-spec tests pass consistently against it.
- **Committed in:** `45fd005` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking: a missing test contract, and a local port collision with an unrelated process)
**Impact on plan:** Both fixes were necessary to actually run the plan's own locked verification (`e2e/preview-perf.spec.ts`) against the correct code. Neither touches `pipeline.ts`'s render logic or adds any optimization — measure-first discipline is fully intact. No scope creep: `PreviewPane.tsx`'s change is additive (an attribute), and the new Playwright config is additive and isolated (does not alter the shared root config any other spec/worktree relies on).

## Issues Encountered

- One flaky run of the perf spec's second test (workspace-creation flow stayed on `/dashboard` instead of redirecting to `/w/[wsId]`) was observed on a cold-started dev server, consistent with 02-02's own comment in `playwright.config.ts` about "Next's on-demand route compilation under concurrent first-hits pushing default assertion timeouts." Not reproducible on the next two runs (which both measured p95 successfully); not a defect in this plan's files, and out of scope to fix (the workspace-creation flow itself belongs to Phase 1).

## User Setup Required

None - no external service configuration required.

## Manual Verification Checklist (End-of-Phase Human-Check)

This is the phase's single consolidated manual-verification script, assembled per Task 2 from `02-VALIDATION.md` §Manual-Only Verifications, `02-UI-SPEC.md` §Toolbar Contract / §UI Considerations, and the ROADMAP Phase 2 Success Criteria. It runs against `pnpm dev` at `/w/[wsId]` and is the authoritative sign-off gate for `/gsd-verify-work` — none of it is auto-passable.

### A. Korean IME composition safety (Success Criteria 5)

1. Open a document at `/w/[wsId]`, click into the editor.
2. Using a real Korean IME (not paste), type `한글 조합 테스트` character by character, letting each syllable block compose naturally (`compositionstart`/`compositionupdate`/`compositionend`).
3. Select part of the composed text and click **Bold** mid-composition-adjacent-editing.
4. **Pass condition:** no dropped, duplicated, or reordered syllables at any point; the editor's final document content exactly matches what was typed (plus the `**...**` wrap markers from Bold); the preview renders the same Korean text inside `<strong>`.
5. Why manual: no authoritative headless E2E recipe exists for driving real multi-keystroke IME composition (RESEARCH Assumptions Log A1/A2; CDP `Input.insertText` and Playwright's keyboard API cannot simulate genuine jamo-assembly composition events).

### B. Full toolbar visual walkthrough (D-P2-04/05, UI-SPEC §Toolbar Contract)

1. With the toolbar visible, hover each of the 14 controls in turn (heading dropdown, Bold/Italic/Strikethrough/Inline-code, Bullet/Ordered/Task list, Blockquote/Code-block/HR, Link/Image/Table).
2. **Pass condition, per control:** renders a lucide icon (16px) inside a 32x32px button; hovering shows a tooltip **immediately** (no ~300ms delay) with the correct label, tooltip styled per UI-SPEC (`background: var(--text)`, white text, 11px, `border-radius: 4px`); exactly two visual states exist — default and hover (background `var(--surface-2)`) — with **no pressed/active-format-indicator state** (explicitly out of Phase 2 scope per D-P2-05).
3. Click the heading dropdown trigger; confirm the menu shows exactly 5 items (제목1-4 + 본문), each `padding: 8px 12px`, `font-size: 13px`, with `border`/`box-shadow` matching the ui-kit dropdown pattern.
4. Why manual: hover-state timing, visual tooltip styling, and "exactly 2 states / no pressed animation" are visual-craft judgments no automated assertion in this repo currently encodes.

### C. Preview overflow / long-text states (UI-SPEC §UI Considerations: overflow, long-text)

1. Paste a long unbroken URL (no spaces) into the editor as a Markdown link or bare text; confirm in the preview it wraps within the pane (`overflow-wrap: break-word`) and never causes horizontal pane overflow.
2. Insert a GFM table wider than the pane and a code block with one long unwrapped line; confirm both scroll horizontally within their own container (`overflow-x: auto`) without pushing the rest of the layout.
3. Type a long heading and a long paragraph (multiple lines' worth of text); confirm both wrap naturally with **no ellipsis truncation** (intentionally different from Phase 1's card-title ellipsis convention — preview content is read content, not a label).
4. Why manual: overflow-wrap/scroll behavior is a rendering/visual outcome best confirmed by eye across real browser viewport widths; no Playwright assertion in this repo currently checks pixel-level overflow containment.

### D. Non-persistent contract (D-P2-02)

1. Type any content into the editor, then refresh the browser tab.
2. **Pass condition:** all content is lost (editor returns to empty state); no save indicator, status bar, or "unsaved changes" warning appears anywhere on the page at any point before or during the refresh — this is intended behavior (Phase 4 owns persistence), not a bug.
3. Why manual: a "the UI shows nothing" assertion is checkable by a human glance far more reliably than an automated absence-of-DOM-node check across every possible transient render.

## Next Phase Readiness

- EDIT-06 is proven with real numbers (16.70ms / 23.90ms p95, both under the 60ms budget) against the actual tracer editor+preview — no speculative optimization sits in `pipeline.ts`/`PreviewPane.tsx` for a future phase to have to reason about or undo.
- `PreviewPane.tsx`'s `data-testid="preview-pane"` contract is now in place for any future E2E spec (e.g. Phase 8 presentation reuses `lib/markdown/pipeline.ts`, unaffected by this plan) that needs to locate the preview root.
- The phase's full manual-verification surface (IME, toolbar visual, overflow/long-text, non-persistence) is consolidated into the single checklist above — `/gsd-verify-work` should run all four sections together as one end-of-phase human-check once 02-04's remaining 13 plugins land and the full toolbar is live.
- `e2e/playwright.perf.config.ts` is available for any future perf-only re-run without needing to coordinate over port 3000 with whatever else might be running locally.

---
*Phase: 02-markdown-rendering-editor-formatting*
*Completed: 2026-08-02*

## Self-Check: PASSED

All files created/modified this plan verified present on disk (`e2e/playwright.perf.config.ts`, `src/components/preview/PreviewPane.tsx`, this SUMMARY); task commit hash (`45fd005`) verified present in git log.
