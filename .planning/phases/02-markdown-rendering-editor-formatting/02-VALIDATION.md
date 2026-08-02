---
phase: 2
slug: markdown-rendering-editor-formatting
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-02
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `02-RESEARCH.md` §Validation Architecture. Per-task rows are filled once gsd-planner assigns task IDs.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 (`environment: "node"` — no JSDOM; matches TRD §6 "test editor plugins without EditorView/DOM") |
| **Config file** | `vitest.config.ts` (Wave 0 installs — not present until scaffold) |
| **Quick run command** | `pnpm vitest run tests/editor/bold.test.ts` |
| **Full suite command** | `pnpm vitest run` |
| **E2E / perf command** | `pnpm exec playwright test e2e/preview-perf.spec.ts` |
| **Estimated runtime** | ~5s unit · ~15s e2e perf |

---

## Sampling Rate

- **After every task commit:** targeted `pnpm vitest run <file>` for the plugin/pipeline file just touched
- **After every plan wave:** `pnpm vitest run` (full suite)
- **Before `/gsd-verify-work`:** Full Vitest suite **and** `pnpm exec playwright test e2e/preview-perf.spec.ts` must be green
- **Max feedback latency:** ~5 seconds (unit)

---

## Per-Task Verification Map

*Task IDs assigned by gsd-planner. Requirement → test-type mapping below is lifted from RESEARCH §Validation Architecture; the executor/validate-phase binds each to a concrete `{N}-PP-TT` task ID.*

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| EDIT-01 | Heading toggle/replace (H1–H4/P) | unit | `pnpm vitest run tests/editor/heading.test.ts` | ❌ W0 | ⬜ pending |
| EDIT-02 | Bold/Italic/Strikethrough/Inline-code toggle-wrap | unit | `pnpm vitest run tests/editor/{bold,italic,strikethrough,inline-code}.test.ts` | ❌ W0 | ⬜ pending |
| EDIT-03 | Bullet/Ordered/Task list insert | unit | `pnpm vitest run tests/editor/{bullet-list,ordered-list,task-list}.test.ts` | ❌ W0 | ⬜ pending |
| EDIT-04 | Blockquote/CodeBlock/HR insert | unit | `pnpm vitest run tests/editor/{blockquote,code-block,hr}.test.ts` | ❌ W0 | ⬜ pending |
| EDIT-05 | Link/Image/Table skeleton insert | unit | `pnpm vitest run tests/editor/{link,image,table}.test.ts` | ❌ W0 | ⬜ pending |
| EDIT-06 | 60ms p95 preview update, 10,000 chars | e2e (perf) | `pnpm exec playwright test e2e/preview-perf.spec.ts` | ❌ W0 | ⬜ pending |
| EDIT-08 | CommonMark 0.31.2 conformance (652 fixtures) | unit | `pnpm vitest run tests/spec/commonmark.test.ts` | ❌ W0 | ⬜ pending |
| EDIT-08 | GFM 3-extension-only (footnote/autolink must NOT parse) | unit | `pnpm vitest run tests/spec/gfm.test.ts` | ❌ W0 | ⬜ pending |
| EDIT-08 | XSS (`<script>`/`onerror`/`javascript:`) stripped; task checkbox renders | unit | `pnpm vitest run tests/markdown/sanitize.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/editor/*.test.ts` × 14 (one per plugin) — covers EDIT-01..05
- [ ] `tests/editor/test-utils.ts` — shared `EditorState`-construction helper (doc + selection in → transaction-applied doc + selection out). A test utility, not a plugin — does not violate the 1-plugin-1-file / no-cross-import invariant.
- [ ] `tests/spec/commonmark.test.ts` — EDIT-08 CommonMark conformance; consumes `commonmark-spec` package (652 fixtures)
- [ ] `tests/spec/gfm.test.ts` — EDIT-08 exactly-3-extensions assertion, incl. negative test that footnote syntax renders literally
- [ ] `tests/markdown/sanitize.test.ts` — EDIT-08 XSS + task checkbox
- [ ] `e2e/preview-perf.spec.ts` — EDIT-06; Playwright already configured, no framework install
- [ ] `vitest.config.ts` — `environment: "node"`; Wave 0 installs Vitest if scaffold hasn't

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Korean IME composition (Success Criteria 5) — no dropped/corrupted chars mid-composition | EDIT-01..05 (uncontrolled editor) | No authoritative automated recipe found (RESEARCH `[ASSUMED]`); `compositionstart`/`compositionend` are hard to drive deterministically in headless E2E | Type "한글 조합 테스트" into the editor via a real IME; confirm no duplicated/dropped syllables and the doc matches input after composition ends |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
