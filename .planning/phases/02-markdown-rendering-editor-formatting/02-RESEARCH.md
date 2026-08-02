# Phase 2: Markdown Rendering & Editor Formatting - Research

**Researched:** 2026-08-02
**Domain:** unified/remark/rehype markdown pipeline + CodeMirror 6 editor plugin architecture
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-P2-01:** Editor+preview render at `app/(main)/w/[wsId]` as a **2-split** (editor left, preview right), replacing Phase 1's empty placeholder. Reversibility: costly — Phase 4 wraps this in a 3-pane layout (tree sidebar + status bar).
- **D-P2-02:** This screen is **non-persistent** — no document API yet (Phase 4), so editor content lives only in local component state. Refresh-loses-content is expected behavior. Autosave/seq-guard/status bar are all Phase 4.
- **D-P2-03:** Editor+preview must be an **assemblable pane component**, not a hardcoded fullscreen split — Phase 4 wraps the identical component with a sidebar + status bar without touching its internals. Reversibility: costly.
- **D-P2-04:** Toolbar = **functional lucide icon toolbar + basic hover tooltip**. Plugin metadata (TRD §6 `EditorPlugin.icon`, `tooltip`) already carries this — rendering it is nearly free.
- **D-P2-05:** Exactly two FR-E7 items deferred to Phase 5 (R2): (1) pressed click animation, (2) 300ms tooltip hover delay. Icon rendering, base tooltips, and button behavior are Phase 2. (Product-owner-approved R1/R2 boundary crossing.)
- **D-P2-06:** Formatting is **toggle-style**. Re-clicking an already-applied format removes the marker (bold ↔ unbold).
- **D-P2-07:** **Empty selection** click inserts a marker pair with cursor between them (e.g. `**|**`). **Heading** replaces the level (H1 line + H2 click → H2, no nesting). **Multi-line selection**: list/heading wrap per-line.
- **D-P2-08:** The above is the **TDD expected-output contract** for each plugin's `run(state)`. `tests/editor/*.test.ts` must assert empty-selection / partial-selection / duplicate-application (toggle-off) cases before implementation (TRD §10). **Planner must specify exact input/output strings per plugin.**
- **D-P2-09:** Insertion = **placeholder skeleton**, no dialogs — insert skeleton markdown with the editable part pre-selected: Link `[text](url)`, Image `![alt](url)`, Table = default GFM table skeleton. Never interrupts cursor flow.
- **D-P2-10:** Code Block inserts a **fence with empty language slot** (` ``` ` + newline). **Preview syntax highlighting is explicitly out of scope for Phase 2** — the pipeline passes the language info string through as a class only; no highlight.js/prism/etc. is introduced.

### Claude's Discretion

- Exact multi-line selection output strings for list/heading plugins — planner confirms against CodeMirror 6 selection API conventions (within the D-P2-08 contract).
- Toolbar button grouping/visual order — follows ui-kit tokens / UI-SPEC, otherwise planner/UI discretion.

### Deferred Ideas (OUT OF SCOPE)

- Preview syntax highlighting (code block language coloring) — no requirement ID, explicit scope-creep guard.
- Toolbar polish (pressed animation + 300ms tooltip delay) — Phase 5 (remainder of FR-E7).
- Image upload (cursor-position insert) — Phase 5 (EDIT-09/FR-E6). Phase 2's Image insert only goes to `![alt](url)` skeleton.
- Autosave/seq guard/save status bar — Phase 4 (EDIT-07). Phase 2 host screen is non-persistent.
- Theme/layout (split/editor-only/preview-only) switching — Phase 5 (FR-E11).
- Presentation mode/TOC — Phase 8 (FR-P), though the pipeline must already be shared by preview+presentation as a Phase 2 invariant.

None deferred outside these — discussion stayed within Phase 2 scope.

**Research flags surfaced during discuss-phase (addressed below):**
- rehype-sanitize@6.0.0's literal `defaultSchema` must be checked against the real installed export before locking the sanitize allow-list and XSS tests. → See Standard Stack / Package Legitimacy Audit / Common Pitfalls #1.
- CommonMark 0.31.2 `spec.json` (652 examples) fixture-sourcing method must be decided by the planner. → See Code Examples / Validation Architecture.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| EDIT-01 | Heading H1–H4/P formatting (ATX) via toolbar/syntax | CM6 `changeByRange` line-prefix replace pattern (Code Examples §1); heading dropdown UI already locked in UI-SPEC |
| EDIT-02 | Bold/Italic/Strikethrough/Inline Code on selection | Wrap/unwrap toggle pattern (Code Examples §2); `del` element confirmed allowed by rehype-sanitize defaultSchema without modification |
| EDIT-03 | Bullet/Ordered/Task list insertion | `mdast-util-gfm-task-list-item` parses `- [ ]`/`- [x]`; sanitize schema already permits `li[className=task-list-item]` + `input[type=checkbox][disabled]` |
| EDIT-04 | Blockquote/language-tagged Code Block/HR insertion | Line-prefix pattern for blockquote (`>`); fence skeleton insert (D-P2-10); `code[className=/^language-./]` confirmed allowed by default schema |
| EDIT-05 | Link/Image/Table(GFM) insertion | Skeleton insert UX (UI-SPEC Insert Contract); granular-GFM pipeline composition (Code Examples §3); table + `align` attribute confirmed allowed by default schema |
| EDIT-06 | 60ms p95 preview update, 10,000-char doc | TRD §5 budget table re-confirmed; Playwright measurement approach documented as a gap (Common Pitfalls #4, Open Question #4) — no off-the-shelf pattern exists |
| EDIT-08 | `<script>`/event-handler/`javascript:` never execute; GFM task checkbox renders | defaultSchema verified line-by-line (Standard Stack + Package Legitimacy) — `strip:['script']`, no event-handler attrs anywhere, protocol allowlist excludes `javascript:`, `input[type=checkbox][disabled]` already in tagNames/attributes/required |
</phase_requirements>

## Summary

This phase has two independent technical halves that share one invariant: a single markdown pipeline. Half one is the **unified/remark/rehype pipeline** (`lib/markdown/`), which must parse CommonMark 0.31.2 + exactly 3 GFM extensions (strikethrough/tasklist/table) and sanitize the output. Half two is **14 CodeMirror 6 formatting plugins**, each a pure `run(state): TransactionSpec` function with no DOM access, built on CM6's immutable state/transaction API.

The most important finding this session overturns two assumptions baked into TRD/CONTEXT.md. First, **rehype-sanitize's `defaultSchema` already permits `del`, `input[type=checkbox][disabled]`, `table`+subelements, and `code[className=/^language-./]`** — verified by installing `hast-util-sanitize@5.0.2` (rehype-sanitize@6's actual dependency) and reading `lib/schema.js` directly. No custom schema merge is needed to satisfy EDIT-08's checkbox-rendering requirement; the CONTEXT.md research flag asking to "extend" the schema is resolved as: **write the tests first against the untouched default — only merge if a specific test fails.**

Second, **`remark-gfm` cannot selectively enable only strikethrough/tasklist/table** — reading its installed source (`lib/index.js`) confirms it unconditionally bundles all 5 GFM features (autolink-literal, footnote, strikethrough, table, tasklist) with no per-feature option. This directly conflicts with the CLAUDE.md invariant "GFM은 취소선·태스크·표 3종만 활성" (only 3 GFM extensions active). The fix, verified via the actual dependency graphs of `micromark-extension-gfm` and `mdast-util-gfm`, is to bypass `remark-gfm` and compose the three granular per-feature packages (`micromark-extension-gfm-{strikethrough,table,task-list-item}` + `mdast-util-gfm-{strikethrough,table,task-list-item}`) directly via `unified().data()`.

**Primary recommendation:** Build `lib/markdown/pipeline.ts` with the granular-GFM composition shown in Code Examples §3, pass `rehype-sanitize` the **unmodified** `defaultSchema` first, and let the CommonMark spec-fixture + GFM + XSS test suites (written first, TDD) prove whether any schema extension is actually needed. For the editor, mount CodeMirror 6 exactly once (`useRef` + `useEffect` with empty deps), never push external `content` into the view mid-session, and build every plugin against `EditorState.changeByRange` — this is what makes plugins DOM-free and unit-testable per TRD §6.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 서식 툴바 버튼 클릭 → transaction dispatch | Browser / Client | — | `EditorView`/`EditorState` only exist client-side; `run(state)` executes on click/keystroke in the browser |
| 마크다운 파싱·sanitize·렌더 파이프라인 | Browser / Client | — | TRD §2: "미리보기 렌더링은 전부 클라이언트에서 수행한다" — no server round-trip fits inside the 60ms budget |
| 호스트 라우트 진입 가드 (workspace membership) | Frontend Server (SSR) | API / Backend | `app/(main)/w/[wsId]/page.tsx` is a Server Component calling `requireRole` (Phase 1's `lib/rbac.ts`) before rendering — reused, not rebuilt |
| 조립형 pane 레이아웃 (CSS Grid) | Browser / Client | — | Pure client-rendered React component; Phase 4 wraps it without touching internals (D-P2-03) |
| IME 조합(composition) 처리 | Browser / Client | — | Native `compositionstart`/`update`/`end` events handled inside `EditorView`; no server or SSR involvement |
| 60ms p95 measurement (test tooling) | Browser / Client (subject) | Playwright (test runner) | Timing is measured in the browser via injected `MutationObserver`, driven from Playwright's Node process |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| unified | 11.0.5 | Pipeline orchestrator | De facto standard processor for the remark/rehype ecosystem |
| remark-parse | 11.0.0 | CommonMark → mdast parser | Wraps micromark, the reference-quality CommonMark 0.31.2 tokenizer |
| remark-rehype | 11.1.2 | mdast → hast transform | `allowDangerousHtml: true` preserves raw HTML nodes for the sanitize stage to judge |
| rehype-raw | 7.0.0 | Re-parses raw HTML strings into real hast element nodes | Required before sanitize can inspect/strip individual raw HTML nodes |
| rehype-sanitize | 6.0.0 | XSS-safe allow-list filter | `defaultSchema` [VERIFIED: hast-util-sanitize@5.0.2 lib/schema.js, installed and read directly] already covers GFM del/task-checkbox/table — see Package Legitimacy Audit |
| rehype-react | 8.0.0 | hast → React element tree | Renders the sanitized tree directly as React elements for the preview pane |
| @codemirror/state | 6.7.1 | `EditorState`/`Transaction`/`EditorSelection` API | Source of the pure-function `run(state): TransactionSpec` contract (TRD §6) |
| @codemirror/view | 6.43.7 | `EditorView` (DOM mount) | Includes CM6's 6.5+ IME/composition-handling improvements [CITED: web search synthesis — see Common Pitfalls #3] |
| @codemirror/commands | 6.10.4 | `defaultKeymap`, `history()`, `historyKeymap` | Standard cursor movement + undo/redo — hand-rolling either reinvents CM6's own transaction log indexing |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| micromark-extension-gfm-strikethrough | 2.1.0 | Strikethrough tokenizer (micromark layer) | Always — one of the 3 permitted GFM extensions |
| micromark-extension-gfm-table | 2.1.1 | Table tokenizer (micromark layer) | Always |
| micromark-extension-gfm-task-list-item | 2.1.0 | Task-list-item tokenizer (micromark layer) | Always |
| mdast-util-gfm-strikethrough | 2.0.0 | mdast `delete` node from/to markdown | Always |
| mdast-util-gfm-table | 2.0.0 | mdast `table`/`tableRow`/`tableCell` from/to markdown | Always |
| mdast-util-gfm-task-list-item | 2.0.0 | mdast `listItem.checked` from/to markdown | Always |
| commonmark-spec | 0.31.2 | Parses official `spec.txt` into 652 `{markdown, html, section, number}` fixtures | Dev dependency, `tests/spec/commonmark.test.ts` only |
| lucide-react | ^1.28.0 (already installed) | Toolbar + preview icons | Already a project dependency, no new install |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Granular `micromark-extension-gfm-*` / `mdast-util-gfm-*` composition (3 packages each layer) | `remark-gfm` bundle as-is | Simpler install (1 package) but **violates the CLAUDE.md "GFM 3종만" invariant** — footnote syntax (`[^1]`) and autolink-literal would silently parse. Only acceptable if the team explicitly relaxes that invariant. |
| No `@codemirror/lang-markdown` (plain-text editor) | `@codemirror/lang-markdown` + `@codemirror/language` | Adds in-editor markdown syntax coloring. **Not required by any EDIT-* requirement or UI-SPEC** (editor shows raw markers, no WYSIWYG, and UI-SPEC never mentions colorized markers). Recommend omitting for MVP — see Open Question #3. |
| Merged/custom `rehype-sanitize` schema | `defaultSchema` unmodified | Default already covers the 3 GFM extras; a hand-written merge risks *accidentally weakening* the schema (e.g. dropping the `required: {input: {...}}` gate) for zero functional gain until a real test proves a gap. |

**Installation:**
```bash
pnpm add unified remark-parse remark-rehype rehype-raw rehype-sanitize rehype-react \
  micromark-extension-gfm-strikethrough micromark-extension-gfm-table micromark-extension-gfm-task-list-item \
  mdast-util-gfm-strikethrough mdast-util-gfm-table mdast-util-gfm-task-list-item \
  @codemirror/state @codemirror/view @codemirror/commands

pnpm add -D commonmark-spec
```

**Version verification:** All versions above were confirmed live against the npm registry this session via `npm view <pkg> version` (Aug 2, 2026), not training-data recall. `unified`, `remark-parse`, `remark-rehype`, `rehype-raw`, `rehype-sanitize`, `rehype-react` were additionally checked for legitimacy (`gsd-tools query package-legitimacy check`) — all `OK`. The `@codemirror/*` packages were flagged `SUS` by the legitimacy heuristic purely on a "too-new" publish-date signal (CM6 ships weekly point releases); see Package Legitimacy Audit for the full disposition.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|--------------|---------|-------------|
| unified | npm | ~9 yrs (first publish predates; latest 2024-06-19) | 45.4M/wk | github.com/unifiedjs/unified | OK | Approved |
| remark-parse | npm | latest 2023-09-18 | 45.8M/wk | github.com/remarkjs/remark | OK | Approved |
| remark-rehype | npm | latest 2025-04-02 | 38.6M/wk | github.com/remarkjs/remark-rehype | OK | Approved |
| rehype-raw | npm | latest 2023-08-26 | 14.3M/wk | github.com/rehypejs/rehype-raw | OK | Approved |
| rehype-sanitize | npm | latest 2023-08-26 | 8.5M/wk | github.com/rehypejs/rehype-sanitize | OK | Approved |
| rehype-react | npm | latest 2023-09-01 | 457K/wk | github.com/rehypejs/rehype-react | OK | Approved |
| @codemirror/state | npm | latest 2026-07-05 | 11.3M/wk | code.haverbeke.berlin/codemirror/state (mirrored to github.com/codemirror) | SUS (`too-new`) | Approved — false positive: 11M/wk downloads + legit maintainer (Marijn Haverbeke) repo. Flag is purely recency of a routine patch release. No `checkpoint:human-verify` needed. |
| @codemirror/view | npm | latest 2026-07-27 | 11.5M/wk | code.haverbeke.berlin/codemirror/view | SUS (`too-new`) | Approved — same false-positive reasoning as above |
| @codemirror/commands | npm | latest 2026-06-23 | 10.6M/wk | code.haverbeke.berlin/codemirror/commands | OK | Approved |
| micromark-extension-gfm-strikethrough | npm | latest 2024-07-05 | 34.8M/wk | github.com/micromark/micromark-extension-gfm-strikethrough | OK | Approved |
| micromark-extension-gfm-table | npm | latest 2025-01-20 | 36.9M/wk | github.com/micromark/micromark-extension-gfm-table | OK | Approved |
| micromark-extension-gfm-task-list-item | npm | latest 2024-07-05 | 34.8M/wk | github.com/micromark/micromark-extension-gfm-task-list-item | OK | Approved |
| mdast-util-gfm-strikethrough | npm | latest 2023-07-10 | 32.0M/wk | github.com/syntax-tree/mdast-util-gfm-strikethrough | OK | Approved |
| mdast-util-gfm-table | npm | latest 2023-07-10 | 32.4M/wk | github.com/syntax-tree/mdast-util-gfm-table | OK | Approved |
| mdast-util-gfm-task-list-item | npm | latest 2023-07-10 | 32.0M/wk | github.com/syntax-tree/mdast-util-gfm-task-list-item | OK | Approved |
| commonmark-spec | npm | latest 2024-01-28 | 10.1K/wk | github.com/commonmark/CommonMark | OK | Approved (lower weekly downloads than others, but backed by the official CommonMark org repo — dev-dependency only, no production surface) |

**Packages removed due to SLOP verdict:** none.
**Packages flagged as suspicious [SUS]:** `@codemirror/state`, `@codemirror/view` — both dispositioned as approved false positives above (huge download counts + verified legitimate maintainer repo). No `checkpoint:human-verify` gate needed for these two; the "too-new" signal is an artifact of CodeMirror's routine weekly release cadence, not a legitimacy risk.

*All package names above were discovered via training-data knowledge of the unified/remark/rehype/CodeMirror ecosystems, then confirmed via `npm view` (registry existence) and `gsd-tools package-legitimacy check`. Their exact API shapes (not just names) were additionally confirmed by installing each into a scratch directory and reading the installed source with the `Read` tool — see inline `[VERIFIED: ...]` tags throughout this document for which specific claims that covers.*

## Architecture Patterns

### System Architecture Diagram

```
Keystroke / toolbar click
        │
        ▼
┌─────────────────────────┐
│ CodeMirror 6 EditorView │  (mounted once, uncontrolled — see Pitfall #3)
│  dispatch(plugin.run(   │
│    view.state))         │◄── toolbar button click routes through the same
└───────────┬─────────────┘    index.ts registry as a keymap binding
            │ view state changes → updateListener fires
            ▼
   content string (view.state.doc.toString())
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│ lib/markdown/pipeline.ts  (single shared source, TRD §5)     │
│                                                               │
│  remark-parse ─▶ [strikethrough|table|task-list micromark]  │
│       ─▶ remark-rehype(allowDangerousHtml) ─▶ rehype-raw     │
│       ─▶ rehype-sanitize(defaultSchema) ─▶ rehype-react      │
└───────────────────────────┬───────────────────────────────────┘
                            │ React element tree
                            ▼
                  Preview pane (right split, D-P2-01)
```

Decision points: the sanitize stage is the only place unsafe content is ever dropped — everything upstream of it (parse/gfm/raw) is allowed to be "dangerous" by design (`allowDangerousHtml`), because the allow-list stage is what makes that safe (TRD §2 NFR-3.1).

### Recommended Project Structure

```
src/
├── lib/markdown/
│   ├── pipeline.ts          # unified() processor — single source, shared by preview + Phase 8 presentation
│   ├── schema.ts            # re-exports defaultSchema (or documents why/if extended)
│   └── remark-gfm-subset.ts # the granular-GFM unified plugin (Code Examples §3)
├── components/editor/
│   ├── plugins/
│   │   ├── types.ts         # EditorPlugin interface (already in TRD §6)
│   │   ├── index.ts         # registry: toolbar + keymap → dispatch(plugin.run(view.state))
│   │   ├── heading.ts / bold.ts / italic.ts / strikethrough.ts / inline-code.ts
│   │   ├── bullet-list.ts / ordered-list.ts / task-list.ts
│   │   ├── blockquote.ts / code-block.ts / hr.ts
│   │   └── link.ts / image.ts / table.ts
│   ├── EditorHost.tsx        # useRef + useEffect mount (Code Examples §4)
│   └── EditorHost.module.css
├── components/preview/
│   ├── PreviewPane.tsx        # feeds pipeline output through rehype-react
│   └── PreviewPane.module.css
└── components/layout/
    └── EditorPreviewLayout.tsx  # the assemblable 2-pane grid (D-P2-03)
tests/
├── editor/            # one file per plugin, TDD-first (TRD §10)
├── spec/               # commonmark.test.ts (652 fixtures) + gfm.test.ts (3-extension-only assertions)
└── markdown/
    └── sanitize.test.ts  # XSS + task-checkbox render assertions
e2e/
└── preview-perf.spec.ts  # Playwright 60ms p95 measurement (EDIT-06)
```

### Pattern 1: Selection-range transform via `changeByRange`

**What:** Every formatting plugin builds its `TransactionSpec` by calling `state.changeByRange(range => ({ changes, range: newRange }))`, which CM6 merges across all selection ranges (including multi-cursor) into one transaction.
**When to use:** Every one of the 14 plugins — this is the only sanctioned way to touch document + selection together without an `EditorView`.
**Example:**
```typescript
// components/editor/plugins/bold.ts
// API surface confirmed via WebFetch of https://codemirror.net/docs/ref/#state [CITED: codemirror.net/docs/ref]
import type { EditorState, TransactionSpec } from "@codemirror/state";
import type { EditorPlugin } from "./types";

const MARK = "**";

export const bold: EditorPlugin = {
  id: "bold",
  tooltip: "굵게",
  keymap: "Mod-b",
  run(state: EditorState): TransactionSpec {
    return state.changeByRange((range) => {
      const { from, to } = range;
      const selected = state.doc.sliceString(from, to);

      // Duplicate-application (toggle off): selection is exactly `**...**`
      const before = state.doc.sliceString(Math.max(0, from - MARK.length), from);
      const after = state.doc.sliceString(to, to + MARK.length);
      if (before === MARK && after === MARK) {
        return {
          changes: [
            { from: from - MARK.length, to: from, insert: "" },
            { from: to, to: to + MARK.length, insert: "" },
          ],
          range: range.map(
            state.changes([
              { from: from - MARK.length, to: from, insert: "" },
              { from: to, to: to + MARK.length, insert: "" },
            ])
          ),
        };
      }

      // Empty selection: insert marker pair, cursor between them (D-P2-07)
      if (from === to) {
        const insertText = `${MARK}${MARK}`;
        return {
          changes: { from, insert: insertText },
          range: { anchor: from + MARK.length },
        };
      }

      // Non-empty selection: wrap
      const insertText = `${MARK}${selected}${MARK}`;
      return {
        changes: { from, to, insert: insertText },
        range: { anchor: from + MARK.length, head: from + MARK.length + selected.length },
      };
    });
  },
};
```
> This exact before/after string logic (toggle-off detection, empty-selection insert, wrap) is the *shape* of the contract from D-P2-06/07/08 — the planner must still pin the literal expected fixture strings per plugin, per D-P2-08's requirement.

### Pattern 2: Granular GFM composition (bypass `remark-gfm`)

**What:** Register only the 3 permitted GFM micromark/mdast extensions directly on the unified processor's `data()`, instead of using the all-or-nothing `remark-gfm` plugin.
**When to use:** `lib/markdown/pipeline.ts`, always — this is what makes the CLAUDE.md "GFM 3종만" invariant true rather than aspirational.
**Example:**
```typescript
// lib/markdown/remark-gfm-subset.ts
// Export shapes confirmed by installing each package and reading its source with Read:
//   micromark-extension-gfm-strikethrough/lib/syntax.js -> `export function gfmStrikethrough(options)`
//   micromark-extension-gfm-table/lib/syntax.js          -> `export function gfmTable()`
//   micromark-extension-gfm-task-list-item/lib/syntax.js -> `export function gfmTaskListItem()`
//   mdast-util-gfm-strikethrough/lib/index.js  -> `gfmStrikethroughFromMarkdown()`, `gfmStrikethroughToMarkdown()`
//   mdast-util-gfm-table/lib/index.js          -> `gfmTableFromMarkdown()`, `gfmTableToMarkdown(options)`
//   mdast-util-gfm-task-list-item/lib/index.js -> `gfmTaskListItemFromMarkdown()`, `gfmTaskListItemToMarkdown()`
// [VERIFIED: npm package inspection, installed + read this session]
import { gfmStrikethrough } from "micromark-extension-gfm-strikethrough";
import { gfmTable } from "micromark-extension-gfm-table";
import { gfmTaskListItem } from "micromark-extension-gfm-task-list-item";
import {
  gfmStrikethroughFromMarkdown,
  gfmStrikethroughToMarkdown,
} from "mdast-util-gfm-strikethrough";
import { gfmTableFromMarkdown, gfmTableToMarkdown } from "mdast-util-gfm-table";
import {
  gfmTaskListItemFromMarkdown,
  gfmTaskListItemToMarkdown,
} from "mdast-util-gfm-task-list-item";
import type { Processor } from "unified";

// Deliberately NOT importing `remark-gfm` — it bundles footnote + autolink-literal
// with no way to disable them (verified by reading remark-gfm@4.0.1's lib/index.js).
export function remarkGfmSubset(this: Processor) {
  const data = this.data();
  const micromarkExtensions = (data.micromarkExtensions ??= []);
  const fromMarkdownExtensions = (data.fromMarkdownExtensions ??= []);
  const toMarkdownExtensions = (data.toMarkdownExtensions ??= []);

  micromarkExtensions.push(gfmStrikethrough(), gfmTable(), gfmTaskListItem());
  fromMarkdownExtensions.push(
    gfmStrikethroughFromMarkdown(),
    gfmTableFromMarkdown(),
    gfmTaskListItemFromMarkdown()
  );
  toMarkdownExtensions.push(
    gfmStrikethroughToMarkdown(),
    gfmTableToMarkdown(),
    gfmTaskListItemToMarkdown()
  );
}
```
```typescript
// lib/markdown/pipeline.ts
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize"; // [VERIFIED: rehype-sanitize@6.0.0 index.js re-exports defaultSchema from hast-util-sanitize]
import rehypeReact from "rehype-react";
import { remarkGfmSubset } from "./remark-gfm-subset";

export const markdownProcessor = unified()
  .use(remarkParse)
  .use(remarkGfmSubset)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeSanitize, defaultSchema) // unmodified — see Common Pitfalls #1
  .use(rehypeReact, { /* production runtime options */ });
```

### Pattern 3: Uncontrolled CM6 mount (React)

**What:** Mount `EditorView` exactly once; never feed external `content` back into it as a controlled prop.
**When to use:** `EditorHost.tsx`, the single mount point for the entire phase.
**Example:**
```typescript
// components/editor/EditorHost.tsx
// Mount pattern synthesized from community CM6+React guides [CITED: web search — no official
// React-integration guide exists from the CodeMirror project itself; see Common Pitfalls #3]
import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";

export function EditorHost({ onChange }: { onChange: (content: string) => void }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!parentRef.current) return;

    const state = EditorState.create({
      doc: "",
      extensions: [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChange(update.state.doc.toString());
        }),
      ],
    });

    const view = new EditorView({ state, parent: parentRef.current });
    viewRef.current = view;

    return () => view.destroy();
  }, []); // empty deps: mount once — never re-run on `onChange` identity change

  return <div ref={parentRef} />;
}
```
> `onChange` is intentionally excluded from the effect's dependency array (captured via a ref in a real implementation) to guarantee the effect body — and therefore the `EditorView` construction — runs exactly once per mount, which is what keeps IME composition safe (Common Pitfalls #3).

### Anti-Patterns to Avoid

- **Controlled `<Editor value={content} />` prop pattern:** Re-creating `EditorState` or calling `view.dispatch({changes: {...}})` from a `useEffect` that depends on a `content` prop will race with in-progress Korean/CJK IME composition. See Common Pitfalls #3.
- **Custom regex-based markdown parser:** CommonMark 0.31.2 has ~652 documented edge cases (verified this session — see Standard Stack). A hand-rolled parser will fail a meaningful fraction of them.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Markdown → HTML parsing | Custom regex parser | `unified` (`remark-parse` + `remark-rehype`) | CommonMark 0.31.2 spec has 652 documented edge cases [VERIFIED: `commonmark-spec@0.31.2`, installed and executed — `require('commonmark-spec').tests.length === 652`] |
| XSS-safe HTML allow-listing | Custom tag/attribute blacklist | `rehype-sanitize` with `defaultSchema` | Default already strips `<script>` entirely, allows no event-handler attributes anywhere, and restricts `href`/`src`/`cite`/`longDesc` protocols to `http`/`https`/`mailto`/`irc`/`ircs` — `javascript:` is excluded by omission [VERIFIED: `hast-util-sanitize@5.0.2` `lib/schema.js`, read directly] |
| Undo/redo history | Custom transaction stack | `@codemirror/commands` `history()` + `historyKeymap` | CM6 already logs every transaction; hand-rolling reinvents merge/collapse rules for consecutive edits |
| Selection-aware text wrap/replace | Manual substring + concat with offset math | `state.changeByRange` + `EditorSelection` | Handles multi-cursor and multi-line selection in one call; manual offset math is a proven source of off-by-one bugs |
| GFM task-list parsing | Regex for `- [ ]` / `- [x]` | `mdast-util-gfm-task-list-item` (already selected, granular) | Handles nested lists, uppercase `[X]`, and spacing edge cases already |
| Table-cell alignment tracking | Custom column-align state | `mdast-util-gfm-table` (produces `align` property, consumed by mdast-util-to-hast's built-in table handler) | [VERIFIED: `mdast-util-to-hast@13` `lib/handlers/table-row.js`, read directly — `properties.align = alignValue`, and `align` is in `hast-util-sanitize`'s wildcard `*` attribute list] |

**Key insight:** Every "problem" in this phase already has a battle-tested, verified-compatible solution already resolved by the unified/remark/rehype/CodeMirror ecosystem. The only real engineering risk this phase carries is *composition* (getting exactly 3 of 5 GFM extensions, keeping the editor uncontrolled) — not primitives.

## Common Pitfalls

### Pitfall 1: Assuming the sanitize schema needs a custom merge
**What goes wrong:** Time is spent writing `deepmerge(defaultSchema, { tagNames: [...defaultSchema.tagNames, 'del', 'input', ...] })` before checking whether it's needed.
**Why it happens:** CONTEXT.md's own research flag phrased this as "확정하고" (confirm and extend) — reading it as "extend" rather than "confirm first."
**How to avoid:** [VERIFIED this session] `del`, `input[type=checkbox][disabled]`, `table`/`thead`/`tbody`/`tr`/`th`/`td`, `align` (table alignment), and `code[className=/^language-./]` (code fence language) are **already** in `hast-util-sanitize@5.0.2`'s `defaultSchema` — the literal dependency of `rehype-sanitize@6.0.0`. Write `tests/markdown/sanitize.test.ts` against the unmodified `defaultSchema` first; only add a merge if a specific assertion fails.
**Warning signs:** A schema-merge PR with no failing test motivating it.

### Pitfall 2: `remark-gfm` silently re-enabling footnotes/autolinks
**What goes wrong:** `remark-gfm` is added because it's the "obvious" GFM package, and footnote syntax (`[^1]`) parses successfully in the preview despite the CLAUDE.md invariant saying it shouldn't.
**Why it happens:** `remark-gfm@4.0.1`'s `lib/index.js` [VERIFIED, read directly] pushes one bundled `gfm(settings)` micromark extension covering all 5 features — there is no `{footnote: false}`-style option.
**How to avoid:** Use the granular composition in Code Examples §2 instead of `remark-gfm`. Write `tests/spec/gfm.test.ts` to assert footnote syntax renders as **literal text** (not a footnote), not just that strikethrough/table/tasklist work.
**Warning signs:** `remark-gfm` appears in `package.json` dependencies at all.

### Pitfall 3: Controlled-component CM6 breaking Korean IME
**What goes wrong:** Passing `content` as a React prop and syncing it into the editor via `view.dispatch({changes: ...})` inside a `useEffect([content])` causes composed Korean characters (자모 조합 중) to be wiped or garbled mid-typing.
**Why it happens:** React's re-render triggers a synchronous `dispatch` that replaces the document range the browser's own IME composition buffer is still writing into — colliding with the uncommitted composition state. [CITED: community CM6+React integration guides — no official React-integration guide exists from the CodeMirror project]
**How to avoid:** Mount `EditorView` exactly once (Code Examples §4: `useEffect(() => {...}, [])`), read content out via `EditorView.updateListener` rather than pushing content in via props, and keep `@codemirror/view` at 6.5+ (installed: 6.43.7) for its IME-handling fixes.
**Warning signs:** Korean text loses trailing consonants/vowels or characters appear reordered specifically when typed quickly, but works fine when typed with English.

### Pitfall 4: Measuring (or skipping measurement of) the 60ms budget
**What goes wrong:** Either (a) block-level memoization is added preemptively "to be safe," violating the explicit CLAUDE.md/TRD rule against pre-measurement optimization, or (b) no measurement harness is built at all and EDIT-06 is marked done on faith.
**Why it happens:** No established Playwright pattern exists for keystroke-to-DOM-update p95 measurement — this session's research found no off-the-shelf recipe (WebSearch turned up general P95-latency-tracking advice, not a concrete MutationObserver+Playwright recipe). [ASSUMED — see Assumptions Log A2]
**How to avoid:** Build a small, purpose-specific harness: inject a `MutationObserver` on the preview pane root via `page.evaluate`, drive `page.keyboard.type()` for a 10,000-char seeded document, collect per-keystroke DOM-mutation timestamps into an array, and compute p95 in Node (`sorted[Math.floor(0.95 * n)]`). Treat the harness itself as needing a sanity check (e.g. assert it reports near-zero latency against a static, non-reactive page) before trusting its numbers against the real editor.
**Warning signs:** A memoization PR lands with no accompanying Playwright number in the commit message/PR description.

### Pitfall 5: Off-by-one line-prefix matching for ATX headings/blockquotes near code fences
**What goes wrong:** A heading/blockquote plugin's line-prefix regex naively matches `#`/`>` at the start of a line, including lines *inside* an already-open code fence, corrupting fenced code content when toggled.
**Why it happens:** `changeByRange` operates on raw document text — it has no built-in awareness of "am I inside a fenced code block" unless the plugin computes it.
**How to avoid:** This is left as an explicit open question for the planner (Open Question #1) — pin the exact algorithm and fixture strings per plugin as part of the plan, per D-P2-08's requirement that planner specifies exact input/output strings.
**Warning signs:** A heading toggle test passes for top-level text but a manual test inside a code fence corrupts the fence.

## Code Examples

See **Architecture Patterns** above (Patterns 1–3) for the full, verified code examples:
- Pattern 1 — `bold.ts` plugin skeleton (`changeByRange` toggle/wrap/empty-selection logic)
- Pattern 2 — `remark-gfm-subset.ts` + `pipeline.ts` (granular GFM composition + sanitize wiring)
- Pattern 3 — `EditorHost.tsx` (uncontrolled mount)

### CommonMark spec-fixture test runner skeleton
```typescript
// tests/spec/commonmark.test.ts
// [VERIFIED: commonmark-spec@0.31.2 installed and executed this session —
// require('commonmark-spec').tests is an array of 652 {markdown, html, section, number} objects]
import { describe, it, expect } from "vitest";
import { tests } from "commonmark-spec";
import { markdownProcessorPreSanitize } from "@/lib/markdown/pipeline"; // pre-sanitize variant per TRD §10 note

describe("CommonMark 0.31.2 conformance", () => {
  for (const example of tests) {
    it(`#${example.number} (${example.section})`, async () => {
      const file = await markdownProcessorPreSanitize.process(example.markdown);
      expect(String(file)).toBe(example.html);
    });
  }
});
```
> TRD §10 explicitly requires comparing against **pre-sanitize** output ("스펙은 raw HTML 보존을 기대하므로"), so the pipeline needs a variant/export point before the `rehype-sanitize` stage for this specific test file.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| CodeMirror 5 (mutable `Doc`/`cm.replaceRange()` imperative API) | CodeMirror 6 (immutable `EditorState` + `Transaction` functional core) | CM6 stable, 2020 | Formatting logic becomes pure `(state) => TransactionSpec` functions — exactly TRD §6's contract. CM5-style direct DOM mutation APIs don't exist in CM6, so there's no "shortcut" back to imperative editing. |
| `markdown-it`/`marked` (regex-driven, single-pass string → HTML) | `unified`/`remark` (AST pipeline: mdast → hast → output) | remark v13+ / unified v10+ (~2021 ecosystem shift) | Sanitization becomes a separate, composable AST-level pass (`rehype-sanitize`) instead of post-hoc string surgery (e.g. DOMPurify on an HTML string) |
| String-based HTML sanitization (DOMPurify-style) | Schema-based AST allow-list (`hast-util-sanitize`) | N/A — different architectural layer, not a version migration | Allow-list composes naturally inside the same pipeline that already built the tree; no second HTML parse needed |

**Deprecated/outdated:** None of the recommended packages are deprecated (`gsd-tools package-legitimacy check` confirmed `deprecated: false` for all 15 packages checked this session).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | `@codemirror/view` 6.5+ (installed: 6.43.7) adequately handles Korean IME composition out of the box | Standard Stack, Common Pitfalls #3 | If insufficient, Success Criterion 5 (IME correctness) fails silently until manually tested with real Korean input; mitigation would require an explicit composition-guard (checking `view.composing` before any programmatic `dispatch`) |
| A2 | No official/established Playwright pattern exists for keystroke→DOM-update p95 measurement; the harness in Common Pitfalls #4 is a synthesized recommendation, not a verified-working recipe | Common Pitfalls #4, Open Question #4 | The measurement harness itself could have systematic error (e.g. `MutationObserver` firing before React commit completes), silently producing an inaccurate p95 that either falsely passes or falsely fails EDIT-06 |
| A3 | `@codemirror/lang-markdown` is out of scope for Phase 2 (no requirement mandates in-editor syntax coloring) | Standard Stack / Alternatives Considered, Open Question #3 | Low risk — if UAT later wants colored markers, it's an additive dependency, not a rework |
| A4 | Pushing 3 uncombined extension objects directly into `data().micromarkExtensions`/`fromMarkdownExtensions` (rather than pre-combining via `micromark-util-combine-extensions`) works without an explicit combine step | Code Examples Pattern 2 | If wrong, one of the 3 GFM extensions could silently fail to register; mitigated immediately by `tests/spec/gfm.test.ts` (TDD, written before the pipeline implementation) which would fail loudly rather than passing silently |

## Open Questions

1. **Exact multi-line selection output strings for heading/list plugins**
   - What we know: The toggle/wrap/empty-selection *contract shape* is locked (D-P2-06/07/08).
   - What's unclear: The literal before/after fixture strings for multi-line selections (e.g. does a 3-line selection with heading toggle wrap each line independently, or only the first?).
   - Recommendation: Planner encodes exact literal fixtures per plugin directly in the plan (per D-P2-08's explicit requirement that planner specify these), following the `changeByRange` per-range pattern shown in Code Examples §1.

2. **Table insert skeleton — exact row/col count**
   - What we know: UI-SPEC explicitly leaves this "backstop" (held-out) — only guarantees "a valid GFM table renders, no dialog."
   - What's unclear: Exact cell count/placeholder text.
   - Recommendation: Smallest valid GFM table is 2 columns × 1 header row × 1 separator row × 1 data row (a 1-column table isn't meaningfully a "table" UX-wise). Planner should pick literal placeholder cell text (e.g. `제목1`/`제목2`/`내용`/`내용`).

3. **Whether to include `@codemirror/lang-markdown`**
   - What we know: No EDIT-* requirement or UI-SPEC line mentions in-editor colorized markdown syntax.
   - What's unclear: Whether omitting it will feel unpolished in manual QA (plain monochrome text with visible `**`/`#` markers).
   - Recommendation: Omit for MVP (ponytail: YAGNI — nothing requires it); revisit only if manual verification in `/gsd-verify-work` flags it.

4. **60ms measurement harness validity**
   - What we know: The measurement *target* (10,000 chars, p95, keystroke→DOM) is locked by EDIT-06/TRD §5.
   - What's unclear: Whether the MutationObserver-based harness itself (Common Pitfalls #4) measures what it claims to measure, since no verified precedent exists.
   - Recommendation: Treat harness construction as its own small spike/task with a sanity check (assert near-zero latency on a static control page) before trusting its output against the real editor.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build/test execution | ✓ | v24.2.0 | — |
| pnpm | Fixed package manager (CLAUDE.md) | ✓ | 10.18.3 | — |
| Playwright CLI/browsers | EDIT-06 60ms p95 E2E measurement | ✓ | 1.62.1 | — |
| PostgreSQL test DB (localhost:5433) | Vitest `globalSetup` runs a migrate+seed against `DATABASE_URL_TEST` before **any** test file in the suite, including pure-function editor/pipeline tests | ✓ (accepting connections) | Homebrew PG16, confirmed via `pg_isready` | — |
| npm registry access | Installing ~15 new packages this phase | ✓ | — | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none — all required tooling is present.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (`environment: "node"` — no JSDOM, matching TRD §6's "test without EditorView/DOM" requirement) |
| Config file | `vitest.config.ts` |
| Quick run command | `pnpm vitest run tests/editor/bold.test.ts` |
| Full suite command | `pnpm vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|--------------------|--------------|
| EDIT-01 | Heading toggle/replace (H1–H4/P) | unit | `pnpm vitest run tests/editor/heading.test.ts` | ❌ Wave 0 |
| EDIT-02 | Bold/Italic/Strikethrough/Inline-code toggle-wrap | unit | `pnpm vitest run tests/editor/{bold,italic,strikethrough,inline-code}.test.ts` | ❌ Wave 0 |
| EDIT-03 | Bullet/Ordered/Task list insert | unit | `pnpm vitest run tests/editor/{bullet-list,ordered-list,task-list}.test.ts` | ❌ Wave 0 |
| EDIT-04 | Blockquote/CodeBlock/HR insert | unit | `pnpm vitest run tests/editor/{blockquote,code-block,hr}.test.ts` | ❌ Wave 0 |
| EDIT-05 | Link/Image/Table skeleton insert | unit | `pnpm vitest run tests/editor/{link,image,table}.test.ts` | ❌ Wave 0 |
| EDIT-06 | 60ms p95 preview update, 10,000 chars | e2e (perf) | `pnpm exec playwright test e2e/preview-perf.spec.ts` | ❌ Wave 0 |
| EDIT-08 | CommonMark 0.31.2 conformance (652 fixtures) | unit | `pnpm vitest run tests/spec/commonmark.test.ts` | ❌ Wave 0 |
| EDIT-08 | GFM 3-extension-only assertion (footnote/autolink must NOT parse) | unit | `pnpm vitest run tests/spec/gfm.test.ts` | ❌ Wave 0 |
| EDIT-08 | XSS payloads (`<script>`, `onerror`, `javascript:`) stripped; task checkbox renders | unit | `pnpm vitest run tests/markdown/sanitize.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** targeted `pnpm vitest run <file>` for the plugin/pipeline file just touched
- **Per wave merge:** `pnpm vitest run` (full suite)
- **Phase gate:** Full Vitest suite + `pnpm exec playwright test e2e/preview-perf.spec.ts` green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/editor/*.test.ts` × 14 (one per plugin) — covers EDIT-01..05
- [ ] `tests/editor/test-utils.ts` — shared `EditorState`-construction helper (doc + selection in, transaction-applied doc + selection out) to avoid repeating boilerplate across 14 plugin test files; this is a test utility, not a "plugin," so it doesn't violate the 1-plugin-1-file/no-cross-import rule
- [ ] `tests/spec/commonmark.test.ts` — covers EDIT-08 (CommonMark conformance), consumes `commonmark-spec` package
- [ ] `tests/spec/gfm.test.ts` — covers EDIT-08 (exactly-3-extensions assertion, including a negative test that footnote syntax renders literally)
- [ ] `tests/markdown/sanitize.test.ts` — covers EDIT-08 (XSS + task checkbox)
- [ ] `e2e/preview-perf.spec.ts` — covers EDIT-06, framework install: none needed (Playwright already configured)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | Not touched this phase — no new auth surface |
| V3 Session Management | No | Not touched this phase |
| V4 Access Control | Yes (reused, not new) | `requireRole(wsId, "VIEWER")` already gates `app/(main)/w/[wsId]/page.tsx` (Phase 1's `lib/rbac.ts`) — Phase 2 adds no new API routes, so no new access-control surface to design |
| V5 Input Validation / Output Encoding | Yes | `rehype-sanitize` with `defaultSchema` — AST-level allow-list, verified this session to strip `<script>`, block all event-handler attributes, and restrict URL protocols against `javascript:` |
| V6 Cryptography | No | Not applicable this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Stored XSS via `<script>`, `onerror=`, or `javascript:` URL embedded in markdown content | Tampering / Elevation of Privilege | `rehype-sanitize` `defaultSchema`: `strip: ['script']` removes the entire subtree; no event-handler attribute (`on*`) appears anywhere in the schema's attribute lists; `protocols` restricts `href`/`src`/`cite`/`longDesc` to `http`/`https`/`mailto`/`irc`/`ircs` only [VERIFIED this session] |
| DOM clobbering via attacker-controlled `id`/`name`/`aria-*` colliding with app-global JS identifiers | Tampering | `hast-util-sanitize`'s `clobberPrefix: 'user-content-'` auto-prefixes `id`/`name`/`ariaDescribedBy`/`ariaLabelledBy` [VERIFIED this session] |
| Catastrophic-backtracking ReDoS via crafted nested-emphasis markdown | Denial of Service | Not applicable when using `micromark`'s linear-time state-machine tokenizer (used by `unified`/`remark-parse`) — would only become a risk if a custom regex-based parser were hand-rolled instead (see Don't Hand-Roll) |

## Sources

### Primary (HIGH confidence)
- `hast-util-sanitize@5.0.2` `lib/schema.js` — installed via `npm install` and read directly with `Read` this session
- `remark-gfm@4.0.1` `lib/index.js` — installed and read directly; confirms all-5-bundled behavior
- `micromark-extension-gfm@3` / `mdast-util-gfm@3` `package.json` dependency graphs — installed and read directly
- `commonmark-spec@0.31.2` `index.js` — installed and executed directly (`require('commonmark-spec').tests.length === 652`)
- `mdast-util-to-hast@13` `lib/handlers/{table,table-row,table-cell,delete,list-item}.js` — installed and read directly
- `micromark-extension-gfm-{strikethrough,table,task-list-item}` / `mdast-util-gfm-{strikethrough,table,task-list-item}` — installed and read directly for exact export shapes
- `rehype-sanitize@6.0.0` `index.js` / `lib/index.js` — installed and read directly (confirms `defaultSchema` re-export and `.use(rehypeSanitize, schema)` call shape)
- npm registry `npm view <pkg> version` — live registry check, all 15 packages, run this session (2026-08-02)
- `gsd-tools query package-legitimacy check` — run this session for all 15 packages

### Secondary (MEDIUM confidence)
- `codemirror.net/docs/ref/#state` (official CodeMirror 6 docs, via WebFetch) — `EditorState.changeByRange`, `EditorSelection`, `TransactionSpec` shape

### Tertiary (LOW confidence)
- WebSearch synthesis on CM6+React uncontrolled-mount pattern and Korean IME composition handling — no official CodeMirror React-integration guide exists; sourced from community blog posts (adamcollier.co.uk, codiga.io, fixdevs.com)
- WebSearch synthesis on Playwright keystroke-latency p95 measurement — no established precedent found; the harness in Common Pitfalls #4 is a recommended construction, not a verified-working recipe

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every version live-checked against the npm registry; sanitize schema and GFM composition claims verified by installing and reading actual package source, not summarized/assumed
- Architecture: HIGH for the markdown pipeline (verified sources); MEDIUM for the CM6+React mount pattern (community-sourced, no official guide)
- Pitfalls: HIGH for sanitize/GFM-composition pitfalls (directly verified); MEDIUM for IME and 60ms-measurement pitfalls (community synthesis, no authoritative precedent)

**Research date:** 2026-08-02
**Valid until:** 2026-09-01 (30 days — package APIs here are stable; re-check `npm view` versions if planning starts after this window, since CodeMirror packages release weekly)
