---
status: testing
phase: 02-markdown-rendering-editor-formatting
source: [02-VERIFICATION.md]
started: 2026-08-02T04:55:06Z
updated: 2026-08-02T04:55:06Z
---

## Current Test

number: 1
name: Korean IME composition safety
expected: |
  Type '한글 조합 테스트' via a real IME into the editor, apply Bold mid/adjacent to
  composition. No dropped/duplicated/reordered syllables; doc content matches input +
  Bold markers; preview shows the same Korean text inside <strong>.
awaiting: user response

## Tests

### 1. Korean IME composition safety
expected: Type '한글 조합 테스트' via a real IME, apply Bold mid/adjacent to composition — no dropped/duplicated/reordered syllables; doc matches input + Bold markers; preview shows the Korean text inside <strong>.
result: [pending]

### 2. Full toolbar visual walkthrough
expected: Hover each of the 14 controls (heading dropdown + 13 flat buttons) and open the dropdown. Each renders a 16px lucide icon in a 32×32px button; hover shows an immediate (no ~300ms delay) tooltip with the correct label; exactly two visual states (default/hover), no pressed/active-format animation; heading dropdown shows exactly 5 items (제목1–4 + 본문).
result: [pending]

### 3. Preview overflow / long-text states
expected: Paste a long unbroken URL, a wide GFM table, a long unwrapped code line, and a long heading/paragraph. Long URL wraps within the pane; wide table and long code line scroll horizontally within their own container; long heading/paragraph wraps naturally with no ellipsis truncation.
result: [pending]

### 4. Non-persistent contract
expected: Type content, then refresh the browser tab. All content is lost (editor returns to empty); no save indicator, status bar, or unsaved-changes warning appears at any point (Phase 4 owns persistence — intended, not a bug).
result: [pending]

### 5. (Informational, non-blocking) Heading on a line inside an open code fence
expected: heading.ts does not currently detect open ``` code fences (RESEARCH Pitfall #5, flagged in 02-04-SUMMARY.md, not exercised by any pinned fixture). Confirm whether this edge matters in practice; it does not block EDIT-01 as specified.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
