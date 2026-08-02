---
phase: 02-markdown-rendering-editor-formatting
plan: 02
subsystem: testing
tags: [codemirror, editor-plugins, vitest, playwright, tdd, perf, transactionspec]

# Dependency graph
requires:
  - phase: 02-markdown-rendering-editor-formatting
    provides: "02-01 pinned CodeMirror 6 core deps + Vitest infra"
provides:
  - "RED contract test suite for all 14 editor formatting plugins, one file per plugin, with the exact D-P2-06/07/08 empty-selection / wrap / toggle-off input→output strings pinned"
  - "Pure EditorState apply-and-read helper (tests/editor/test-utils.ts) — no EditorView/DOM, honoring the 1-plugin-1-file / no-DOM invariant (TRD §6)"
  - "e2e/preview-perf.spec.ts — the EDIT-06 60ms p95 keystroke→preview harness with a self-sanity control, ready to run against the real editor in 02-05"
  - "Fixed plugin API contract (run(state) → TransactionSpec) that 02-03 (bold) and 02-04 (13 remaining) must satisfy"
affects: ["02-03 (tracer: bold plugin)", "02-04 (remaining 13 plugins)", "02-05 (perf proof)", "02-markdown-rendering-editor-formatting verification"]

actuals:
  tokens: 4200
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "TDD wave-0: 14 plugin test files + perf harness committed before any plugin implementation exists (RED by design)"
    - "Pure EditorState transform testing — apply a plugin's run(state) TransactionSpec to a doc+selection and read back doc+selection, with zero EditorView/JSDOM, keeping plugin tests DOM-independent (TRD §6)"
    - "Perf harness self-sanity control — assert near-zero latency against a static non-reactive page before trusting real keystroke→preview numbers"

key-files:
  created:
    - tests/editor/test-utils.ts
    - tests/editor/heading.test.ts
    - tests/editor/bold.test.ts
    - tests/editor/italic.test.ts
    - tests/editor/strikethrough.test.ts
    - tests/editor/inline-code.test.ts
    - tests/editor/bullet-list.test.ts
    - tests/editor/ordered-list.test.ts
    - tests/editor/task-list.test.ts
    - tests/editor/blockquote.test.ts
    - tests/editor/code-block.test.ts
    - tests/editor/hr.test.ts
    - tests/editor/link.test.ts
    - tests/editor/image.test.ts
    - tests/editor/table.test.ts
    - e2e/preview-perf.spec.ts
  modified: []

key-decisions:
  - "test-utils.ts is a pure EditorState helper that imports NO plugin and constructs NO EditorView — it applies run(state) TransactionSpec and reads the resulting doc/selection, so the shared helper cannot violate the 1-plugin-1-file / no-cross-import / no-DOM invariant (TRD §6)"
  - "Every plugin test pins the LITERAL D-P2-06/07/08 input→output strings (empty-selection insert, non-empty wrap, duplicate-application toggle-off) so 02-03/02-04 implement to a fixed target with no interpretation"
  - "Perf harness measures the 10,000-char seed in JS String length (UTF-16 code units), documents that unit, and guards against empty/single-char docs (no divide-by-zero in p95)"
  - "Korean IME mid-composition safety and nested-emphasis/code-fence-escalation edges are asserted where deterministic and otherwise flagged as planner-assumption backstops pending the end-of-phase manual human-check (RESEARCH A1/A2, VALIDATION Manual-Only)"

patterns-established:
  - "One RED test file per plugin (14) enforcing the cross-plugin import ban at the test layer too — no plugin test imports another plugin"
  - "Playwright perf spec with injected MutationObserver timing + self-sanity control as the EDIT-06 measurement contract"

requirements-completed: []  # EDIT-01..06 NOT complete — this plan only lays down RED tests; GREEN lands in 02-04 (plugins) and 02-05 (perf proof)

coverage: []  # RED test scaffolding by design, not a shippable deliverable — verify-work should not UAT-prompt on failing wave-0 tests

duration: 11min
completed: 2026-08-02
status: complete
---

# Phase 2 Plan 02: Editor-Plugin Test Suite + 60ms Perf Harness (TDD Wave-0) Summary

**14 RED per-plugin contract test files (one per formatting plugin) with the exact empty-selection / wrap / toggle-off strings pinned, a pure EditorState apply-and-read helper with no DOM, and the EDIT-06 60ms p95 preview perf harness with a self-sanity control — all failing by design ahead of the plugin implementations in 02-04/02-05.**

## Accomplishments

- Wrote `tests/editor/test-utils.ts` — a pure helper that takes a doc string + selection, applies a plugin's `run(state)` TransactionSpec, and returns the resulting doc + selection, with NO `EditorView`/DOM/JSDOM (Vitest node env, TRD §6)
- Wrote 14 RED plugin contract tests (heading, bold, italic, strikethrough, inline-code, bullet-list, ordered-list, task-list, blockquote, code-block, hr, link, image, table), each pinning the literal D-P2-06/07/08 empty-selection insert, non-empty wrap, and duplicate-application toggle-off input/output strings — including bold round-trip idempotency, empty-selection `****` caret placement, heading level replace/toggle, list re-numbering, blockquote prefix removal, and link `[x](url)` with `url` selected
- Wrote `e2e/preview-perf.spec.ts` — seeds a 10,000-code-unit document, drives keystrokes, records keystroke→preview-DOM-mutation timestamps via an injected `MutationObserver`, computes p95, and asserts a self-sanity control (near-zero latency on a static page) before trusting real numbers
- Verified the intended RED state via `pnpm vitest run`: 17 failed (14 new editor tests + 3 pipeline tests from 02-01, both awaiting implementation), 7 passed, with no regressions in prior suites

## Task Commits

Each task was committed atomically:

1. **Task 1: test-utils helper + heading/inline plugin tests (RED)** - `72e459e` (test)
2. **Task 2: list/block/insert plugin tests (RED)** - `a999667` (test)
3. **Task 3: 60ms p95 preview perf harness with self-sanity control (RED)** - `e8e6d62` (test)

**Plan metadata:** commit for this SUMMARY (below)

## Decisions Made

- **`test-utils.ts` stays a pure `EditorState` transform helper** — imports no plugin, builds no `EditorView` — so the one shared test utility cannot become a backdoor around the 1-plugin-1-file / no-DOM invariant (TRD §6).
- **Every plugin test pins literal input→output strings** for the three D-P2 contract cases, so 02-03 (bold tracer) and 02-04 (remaining 13) implement to a fixed target with zero interpretation.
- **Perf seed unit fixed as JS String length (UTF-16 code units)** and documented in the spec; the p95 computation guards against empty/single-character documents (no divide-by-zero).
- **Manual-only edges flagged, not faked** — Korean IME mid-composition safety has no authoritative headless-E2E recipe (RESEARCH A1/A2), so it is deferred to the end-of-phase human-check rather than asserted with a brittle automated proxy.

## Deviations from Plan

### Recovery note (orchestrator)

- The executor sub-agent completed all three RED test commits (`72e459e`, `a999667`, `e8e6d62`) and verified the RED state, then its API connection dropped ("Connection closed mid-response") immediately before it wrote this SUMMARY. The orchestrator authored and committed this SUMMARY from the verified worktree state (all 16 files present and committed, working tree clean, commit hashes confirmed in git log). No code was changed during recovery — only this metadata file was added.

### Carry-forward

- Same worktree `.env.local` gap as 02-01: this worktree has no `.env.local`, so any Vitest invocation here needs `DATABASE_URL_TEST=postgres://codevillain@localhost:5433/markdown_kms_test` supplied inline (or the file restored). Pre-existing worktree environment gap, outside this plan's file scope.

## Issues Encountered

- None in the test authoring itself. The 14 plugin tests and perf harness are RED for the single correct reason (plugin modules `src/components/editor/plugins/*` and the rendered editor do not exist yet), exactly the intended wave-0 state.

## Next Phase Readiness

- 02-03 must provide `src/components/editor/plugins/bold.ts` exporting `run(state): TransactionSpec` and wire the tracer path so `bold.test.ts` turns GREEN.
- 02-04 must implement the remaining 13 plugins to their pinned test fixtures and register all 14 in `plugins/index.ts`.
- 02-05 runs `e2e/preview-perf.spec.ts` against the real editor+preview to prove EDIT-06 p95 ≤ 60ms, validating the self-sanity control first.

---
*Phase: 02-markdown-rendering-editor-formatting*
*Completed: 2026-08-02*

## Self-Check: PASSED

All 16 created test files verified present and committed in the worktree tree; all three task commit hashes verified present in git log; working tree clean before SUMMARY commit.
