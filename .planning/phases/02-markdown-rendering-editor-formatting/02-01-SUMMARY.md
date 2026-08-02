---
phase: 02-markdown-rendering-editor-formatting
plan: 01
subsystem: testing
tags: [unified, remark, rehype, rehype-sanitize, commonmark, gfm, codemirror, vitest, tdd]

# Dependency graph
requires:
  - phase: 01-auth-workspace-foundation
    provides: "Vitest test infra (global-setup.ts, vitest.config.ts, @/ path alias)"
provides:
  - "Pinned Phase 2 dependency set (unified/remark/rehype pipeline + granular GFM-3 packages + CodeMirror 6 core)"
  - "RED test suite encoding the CommonMark 0.31.2 conformance contract, GFM-3-only invariant, and XSS/sanitize safety contract"
  - "Exact pipeline export contract (markdownProcessorPreSanitize, markdownProcessor) that 02-03's lib/markdown/pipeline.ts must satisfy"
  - "Success-Criteria-4 amendment flag: defaultSchema already permits GFM output, no schema merge needed unless a test proves a gap"
affects: ["02-03 (pipeline tracer plan)", "02-markdown-rendering-editor-formatting verification"]

actuals:
  tokens: 2814
  tasks: 3
  commits: 3

tech-stack:
  added:
    - "unified@11.0.5, remark-parse@11.0.0, remark-rehype@11.1.2, rehype-raw@7.0.0, rehype-sanitize@6.0.0, rehype-react@8.0.0"
    - "@codemirror/state@6.7.1, @codemirror/view@6.43.7, @codemirror/commands@6.10.4"
    - "micromark-extension-gfm-{strikethrough,table,task-list-item} + mdast-util-gfm-{strikethrough,table,task-list-item} (granular GFM-3 composition, NOT the bundled remark-gfm)"
    - "commonmark-spec@0.31.2 (dev, 652 fixtures)"
  patterns:
    - "TDD wave-0: test files committed before any implementation exists (RED by design)"
    - "Granular GFM extension composition to enforce the 'GFM 3종만' invariant instead of the all-5-bundled remark-gfm plugin"

key-files:
  created:
    - tests/spec/commonmark.test.ts
    - tests/spec/gfm.test.ts
    - tests/spec/commonmark-spec.d.ts
    - tests/markdown/sanitize.test.ts
  modified:
    - package.json
    - pnpm-lock.yaml

key-decisions:
  - "Pipeline export contract fixed as markdownProcessorPreSanitize (pre-sanitize, HTML-string, for CommonMark spec comparison) and markdownProcessor (full pipeline incl. rehype-sanitize with unmodified defaultSchema, HTML-string, for GFM + XSS assertions) — 02-03 must provide both under these exact names"
  - "Sanitize tests import ONLY the unmodified rehype-sanitize defaultSchema — no schema merge is written; a merge is added later only if a specific assertion fails"
  - "GFM composition tests assert footnote ([^1]) and autolink-literal (bare URL) render as literal text — guards against the bundled remark-gfm plugin silently re-enabling all 5 GFM features"

patterns-established:
  - "Pipeline test-only HTML-string export separate from any production rehype-react DOM-rendering export, since Vitest runs in a DOM-less 'node' environment"

requirements-completed: []  # EDIT-08 not yet complete — this plan only lays down RED tests; GREEN lands in 02-03

coverage: []  # No deliverables to classify yet — this plan produces failing tests by design, not a shippable feature. verify-work should not UAT-prompt on RED test scaffolding.

duration: 4min
completed: 2026-08-02
status: complete
---

# Phase 2 Plan 01: Markdown Pipeline Dependencies + TDD Wave-0 Test Scaffold Summary

**Pinned unified/remark/rehype + CodeMirror 6 dependency set installed via pnpm, plus three RED test files (652-fixture CommonMark conformance, GFM-3-only guard, and XSS/sanitize safety) that encode the pipeline contract 02-03 must satisfy.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-08-02T03:35:24Z
- **Completed:** 2026-08-02T03:39:10Z
- **Tasks:** 3
- **Files modified:** 6 (package.json, pnpm-lock.yaml, tests/spec/commonmark.test.ts, tests/spec/gfm.test.ts, tests/spec/commonmark-spec.d.ts, tests/markdown/sanitize.test.ts)

## Accomplishments

- Installed the exact RESEARCH §Standard Stack package set via pnpm: unified/remark/rehype pipeline, granular GFM-3 extensions (not the bundled all-5 `remark-gfm`), CodeMirror 6 core, and `commonmark-spec` (652 fixtures) as a dev dependency
- Wrote `tests/spec/commonmark.test.ts` — iterates all 652 CommonMark 0.31.2 spec fixtures against a pre-sanitize pipeline export
- Wrote `tests/spec/gfm.test.ts` — asserts strikethrough/table/task-list parse AND that footnote/autolink-literal syntax render as literal text (conflict #2 guard)
- Wrote `tests/markdown/sanitize.test.ts` — asserts script strip, on* attribute strip, `javascript:` neutralization, task-checkbox/del/table survival, nested-script strip, empty-input safety, and idempotence, all against the **unmodified** `rehype-sanitize` defaultSchema (conflict #1)
- All three files are RED for the correct reason (`Cannot find package '@/lib/markdown/pipeline'`) — verified via `pnpm vitest run`

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Phase 2 pipeline + CodeMirror packages** - `2a0d4de` (chore)
2. **Task 2: CommonMark + GFM-3-only conformance tests (RED)** - `acb8057` (test)
3. **Task 3: Sanitize/XSS + task-checkbox tests against unmodified defaultSchema (RED)** - `e9cad68` (test)

**Plan metadata:** commit for this SUMMARY (below)

## Files Created/Modified

- `package.json` - Pinned Phase 2 dependency set added (runtime + 1 dev dependency)
- `pnpm-lock.yaml` - Lockfile updated by pnpm (no package-lock.json/yarn.lock created)
- `tests/spec/commonmark.test.ts` - CommonMark 0.31.2 conformance runner (652 fixtures, pre-sanitize output comparison)
- `tests/spec/gfm.test.ts` - GFM-3-only assertions + footnote/autolink-literal literal-render guards
- `tests/spec/commonmark-spec.d.ts` - Ambient module declaration for `commonmark-spec` (ships no types)
- `tests/markdown/sanitize.test.ts` - XSS/sanitize + task-checkbox/del/table survival + empty/idempotence assertions against unmodified `defaultSchema`

## Decisions Made

- **Pipeline export contract locked as `markdownProcessorPreSanitize` + `markdownProcessor`, both HTML-string outputs.** Vitest runs in a DOM-less `node` environment, so the full pipeline used by these tests must expose an HTML-string stringify variant distinct from any `rehype-react`-based production DOM-rendering export. Documented in header comments of all three test files for 02-03.
- **No sanitize schema merge is written.** Per RESEARCH conflict #1, `defaultSchema` already permits `del`, `input[type=checkbox][disabled]`, `table`+subelements — the test file imports only the unmodified schema and will only motivate a merge if an assertion actually fails once 02-03 builds the pipeline.
- **Success Criteria 4 amendment flag recorded** (must_haves backstop truth): the ROADMAP wording "sanitize schema explicitly extended" is factually superseded by RESEARCH's verification of the real installed `hast-util-sanitize@5.0.2` defaultSchema. This plan does not silently rewrite ROADMAP — the flag is here for the eventual TRD/ROADMAP update.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] DATABASE_URL_TEST missing in this worktree, causing Vitest global-setup to fail against the wrong PostgreSQL instance**
- **Found during:** Task 2 (verifying RED state of commonmark/gfm tests via `pnpm vitest run`)
- **Issue:** This git worktree has no `.env.local` (gitignored, not copied into worktrees), so `DATABASE_URL_TEST` was unset. Vitest's `globalSetup` (`tests/global-setup.ts`) ran `migrate()` against `postgres()` with no connection string, which fell through to a default connection that hit the wrong local Postgres instance (a password-protected instance) and failed with `password authentication failed for user "codevillain"` — reproducible even on pre-existing, unrelated test files (`tests/auth/rate-limit.test.ts`), confirming this is a worktree environment gap, not something introduced by this plan's changes.
- **Fix:** Confirmed the correct target via `pg_isready -h localhost -p 5433` (accepting connections, satisfying this task's `<precondition>`) and `psql -h localhost -p 5433 -U codevillain -l` (lists `markdown_kms_test`, no password required). Supplied `DATABASE_URL_TEST=postgres://codevillain@localhost:5433/markdown_kms_test` inline as an env var to the `pnpm vitest run` invocations used for verification — no `.env.local` was read or written (both are permission-denied paths in this environment; `protect-paths.sh` and the tool permission system block Edit/Write/Read on `.env*`).
- **Files modified:** None (inline env var only, no file changes)
- **Verification:** `DATABASE_URL_TEST=postgres://codevillain@localhost:5433/markdown_kms_test pnpm vitest run tests/spec/commonmark.test.ts tests/spec/gfm.test.ts tests/markdown/sanitize.test.ts` — global setup succeeds, all three files fail cleanly with `Cannot find package '@/lib/markdown/pipeline'` (expected RED)
- **Committed in:** N/A (no file change; verification-only workaround) — **the next agent/session in this worktree will need to supply `DATABASE_URL_TEST` the same way (or restore `.env.local`) to run any Vitest suite**, this is a pre-existing worktree gap outside this plan's scope to permanently fix

**2. [Rule 3 - Blocking] commonmark-spec ships no type declarations**
- **Found during:** Task 2 (running `tsc --noEmit` to check for stray typecheck errors before committing)
- **Issue:** `commonmark-spec@0.31.2` has no `@types/commonmark-spec` package on the registry and bundles no `.d.ts` file, producing `TS7016: Could not find a declaration file for module 'commonmark-spec'` under this repo's `strict: true` tsconfig — a real typecheck failure that would trip the `typecheck-on-stop.sh` hook.
- **Fix:** Added `tests/spec/commonmark-spec.d.ts` — a minimal ambient module declaration for the single export (`tests: {markdown, html, section, number}[]`) this suite consumes.
- **Files modified:** `tests/spec/commonmark-spec.d.ts` (new)
- **Verification:** `pnpm exec tsc --noEmit` — the only remaining errors are the expected RED-state `Cannot find module '@/lib/markdown/pipeline'` (3 occurrences, one per test file); no other TS errors
- **Committed in:** `e9cad68` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking — Rule 3)
**Impact on plan:** Both were necessary to complete verification of this plan's own RED-state acceptance criteria (running `pnpm vitest run` / `tsc --noEmit` cleanly). No scope creep — no production code, schema, or pipeline logic was touched. The DB-connectivity workaround is documented as a carry-forward note for whoever executes 02-03 in this same worktree.

## Issues Encountered

- This worktree lacks `.env.local` (gitignored, not present in the worktree checkout) — any future Vitest invocation in this exact worktree will need `DATABASE_URL_TEST` supplied inline (as shown above) or the file restored from the main checkout. Not fixed here because `.env*` paths are permission-denied for Read/Write/Edit in this environment (`protect-paths.sh` + tool permission system) and this is outside this plan's file scope (`package.json`, `tests/spec/*`, `tests/markdown/*`).

## Next Phase Readiness

- `package.json` has the full pinned Phase 2 dependency set; `pnpm ls` confirms every RESEARCH §Standard Stack package resolves, and the bundled all-5-GFM `remark-gfm` plugin is absent.
- Three RED test files are committed and fail for the single correct reason (missing `@/lib/markdown/pipeline`), ready for 02-03 to turn GREEN.
- 02-03 must export exactly `markdownProcessorPreSanitize` and `markdownProcessor` (both HTML-string, not React-element, outputs) from `lib/markdown/pipeline.ts`, and compose GFM via the granular 3-extension approach (`lib/markdown/remark-gfm-subset.ts`), never `remark-gfm`.
- Carry-forward note for 02-03 (or any plan running Vitest in this worktree): supply `DATABASE_URL_TEST=postgres://codevillain@localhost:5433/markdown_kms_test` inline if `.env.local` is still absent.

---
*Phase: 02-markdown-rendering-editor-formatting*
*Completed: 2026-08-02*
