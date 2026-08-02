# Phase 2: Markdown Rendering & Editor Formatting - Pattern Map

**Mapped:** 2026-08-02
**Files analyzed:** 24 (from RESEARCH.md "Recommended Project Structure")
**Analogs found:** 6 strong / 18 no-close-analog (new subsystem — see "No Analog Found")

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/app/(main)/w/[wsId]/page.tsx` (MODIFIED) | route/page (Server Component) | request-response | itself (Phase 1 placeholder, same file) | exact — modify in place |
| `src/lib/markdown/pipeline.ts` | service (transform) | transform | none in `src/lib/` (all existing lib files are validation/auth utils, not AST pipelines) | no analog — use RESEARCH Pattern 2 |
| `src/lib/markdown/schema.ts` | config | transform | none | no analog — use RESEARCH Pitfall 1 |
| `src/lib/markdown/remark-gfm-subset.ts` | utility (unified plugin) | transform | none | no analog — use RESEARCH Pattern 2 |
| `src/components/editor/plugins/types.ts` | model (interface) | n/a | `src/lib/validation.ts` (shared type export via zod `z.infer`, same "single source of truth" shape) | partial-match — pattern of exporting one interface + type is analogous, content is not |
| `src/components/editor/plugins/index.ts` | service (registry) | event-driven | none — no existing plugin-registry pattern in Phase 1 | no analog — use RESEARCH Architecture Diagram |
| `src/components/editor/plugins/{heading,bold,italic,strikethrough,inline-code,bullet-list,ordered-list,task-list,blockquote,code-block,hr,link,image,table}.ts` (14 files) | utility (pure transform fn) | transform | `src/lib/validation.ts` (pure, framework-free, single-purpose exported function/schema per concern) | role-match — same "pure function, no side effects, one concern per export" shape; data flow (CM6 TransactionSpec) has no Phase 1 analog |
| `src/components/editor/EditorHost.tsx` | component (client, uncontrolled mount) | event-driven | `src/components/workspace/WorkspaceCard.tsx` (`"use client"`, `useState`/local interaction, CSS Module import convention) | role-match — client component shape matches; DOM-mount-once pattern has no Phase 1 analog |
| `src/components/editor/EditorHost.module.css` | config (styles) | n/a | `src/components/workspace/WorkspaceCard.module.css` | role-match |
| `src/components/preview/PreviewPane.tsx` | component (render pipeline output) | transform | `src/app/(main)/w/[wsId]/page.tsx` (Server Component reading `db` then rendering — same "fetch/derive then render" shape, though PreviewPane is client-side deriving from pipeline not db) | partial-match |
| `src/components/preview/PreviewPane.module.css` | config (styles) | n/a | `src/app/(main)/w/[wsId]/page.module.css` | role-match |
| `src/components/layout/EditorPreviewLayout.tsx` | component (assemblable layout/grid) | n/a | `src/app/(main)/dashboard/page.tsx` + `.module.css` (grid/list layout composing child components, CSS Grid convention) | role-match |
| `tests/editor/*.test.ts` (14 files + `test-utils.ts`) | test | n/a | none (Phase 1 has no `tests/` unit dir shown; only `src/db/seed.ts` and app code) — treat RESEARCH Code Examples Pattern 1 as the reference | no analog |
| `tests/spec/commonmark.test.ts`, `tests/spec/gfm.test.ts` | test | n/a | none | no analog — use RESEARCH "CommonMark spec-fixture test runner skeleton" |
| `tests/markdown/sanitize.test.ts` | test | n/a | none | no analog |
| `e2e/preview-perf.spec.ts` | test (perf) | n/a | none | no analog — use RESEARCH Common Pitfalls #4 |

## Pattern Assignments

### `src/app/(main)/w/[wsId]/page.tsx` (route, request-response) — MODIFY IN PLACE

**Analog:** itself (Phase 1 version, read above in full)

**Auth/guard pattern to keep unchanged** (lines 20-25):
```typescript
try {
  await requireRole(wsId, "VIEWER");
} catch (err) {
  if (err instanceof ForbiddenError) notFound();
  throw err;
}
```
This is the ONLY server-side gate this phase needs (RESEARCH: "Architectural Responsibility Map" — `requireRole` reused, not rebuilt). Keep the `notFound()` + membership-check flow exactly as-is; only replace the body below the `<h1>` (currently `<p className={styles.empty}>아직 문서가 없습니다.</p>`) with `<EditorPreviewLayout />`. Do not touch the `db.select(...)` workspace-name fetch or the import block — same imports (`notFound`, `eq`, `db`, `workspace`, `requireRole`/`ForbiddenError`) stay.

**Imports pattern** (lines 1-6): keep verbatim, add one new import for the layout component.

---

### `src/components/editor/plugins/*.ts` (14 pure-function plugins) — role: utility, data flow: transform

**Analog:** `src/lib/validation.ts` (closest role-match for "single-purpose exported pure function/schema, no framework coupling, no side effects")

**Pattern to copy — file-level doc comment tying decision ID to implementation** (validation.ts lines 3-9, 11-13, 26-27):
```typescript
// WR-07: shared by signup (schema below) and login (src/auth.ts) so both sides of the
// unique-email constraint agree on the same normalized form. ...
export function normalizeEmail(email: string): string { ... }

// D-01: length-first (NIST 800-63B) — 8+ chars, no composition rules.
// Shared client+server so there is exactly one source of truth (Pitfall 5).
export const signupSchema = z.object({ ... });
```
Apply the same convention to each plugin file: a leading comment citing the CONTEXT.md decision ID (D-P2-06/07/08) that the toggle/wrap/empty-selection behavior implements, followed by one exported pure function. **No existing Phase 1 file demonstrates the actual `changeByRange`/`TransactionSpec` shape** — for the core pattern itself, use RESEARCH.md Architecture Patterns → Pattern 1 (`bold.ts` full skeleton, already written, lines 218-277 of RESEARCH.md) verbatim as the copy source, not a Phase 1 file. This is by design: CLAUDE.md's plugin invariant (pure function, no DOM, no cross-plugin import) has no analog in Phase 1's React-heavy codebase — nothing in `src/components/` is a pure non-React function today.

**Naming/typing convention to copy** (`src/components/editor/plugins/types.ts` should mirror `validation.ts`'s type-export idiom):
```typescript
export type SignupInput = z.infer<typeof signupSchema>;
```
→ becomes, per TRD §6's `EditorPlugin` interface: one `types.ts` exporting the `EditorPlugin` interface and nothing else (no logic), same "types file is pure declarations" role `validation.ts` plays for zod schemas.

---

### `src/components/editor/EditorHost.tsx` (component, event-driven) — role: component

**Analog:** `src/components/workspace/WorkspaceCard.tsx`

**Client component + CSS module import convention** (WorkspaceCard.tsx lines 1-8):
```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { DeleteWorkspaceDialog } from "./DeleteWorkspaceDialog";
import styles from "./WorkspaceCard.module.css";
```
Copy this import ordering (external → next → lucide-react → project components → sibling → styles) for `EditorHost.tsx` and `PreviewPane.tsx`. Copy the `"use client"` directive placement (line 1, blank line after).

**Local-state + ref pattern** (WorkspaceCard.tsx line 25: `const [deleteOpen, setDeleteOpen] = useState(false);`) is the closest Phase 1 precedent for "component owns transient UI state locally, no global store" — same spirit as EditorHost owning `viewRef`/`parentRef` via `useRef`, though the actual CM6 mount-once effect has no Phase 1 precedent (use RESEARCH Pattern 3 verbatim: `EditorHost.tsx` skeleton, RESEARCH.md lines 348-389).

**Comment convention linking code to decision IDs** (WorkspaceCard.tsx lines 16-22):
```typescript
// E3/E5 — one card per membership. Title truncates to one line with an ellipsis
// (ui-kit .kit-item-name pattern); active/emphasis is weight/lightness, never color
// (UI-SPEC Color — accent is not spent here).
```
Apply same style: cite the UI-SPEC section/decision ID directly above the component, e.g. `// D-P2-03 — assemblable pane, height:100% only, no hardcoded 100vh (UI-SPEC Layout Contract)`.

---

### `src/components/layout/EditorPreviewLayout.tsx` (component, assemblable grid) — role: component

**Analog:** `src/app/(main)/dashboard/page.tsx` + `page.module.css` (grid-composing layout of child components)

Read for the CSS Grid + child-composition idiom (list/grid page rendering `WorkspaceCard` children) — apply the same "parent owns grid-template, children are self-contained" separation for `EditorPreviewLayout` wrapping `EditorHost` + `PreviewPane`. Per UI-SPEC Layout Contract, grid must be `grid-template-columns: minmax(0,1fr) minmax(0,1fr)` and the component must use `height: 100%` only (never `100vh`) so Phase 4 can wrap it without rework (D-P2-03).

---

### `lib/markdown/pipeline.ts`, `remark-gfm-subset.ts`, `schema.ts` — role: service/config, data flow: transform

**No Phase 1 analog exists.** Nothing in `src/lib/` or `src/db/` performs AST transformation or external-library pipeline composition — Phase 1's `lib/` files (`rbac.ts`, `validation.ts`, `password.ts`, `rate-limit.ts`, `db-membership.ts`) are all request-scoped auth/validation helpers, not data-transform pipelines. **Use RESEARCH.md Architecture Patterns → Pattern 2 verbatim** (`remark-gfm-subset.ts` + `pipeline.ts`, RESEARCH.md lines 279-346) as the primary implementation source. Key constraint already verified in RESEARCH: do NOT import `remark-gfm` (bundles 5 GFM features); compose the 3 granular packages directly via `unified().data()`.

---

## Shared Patterns

### Server-side authorization gate (reused, not rebuilt)
**Source:** `src/lib/rbac.ts` (`requireRole`), already wired into `src/app/(main)/w/[wsId]/page.tsx` lines 20-25.
**Apply to:** No new call sites needed this phase — Phase 2 adds zero new API routes/mutations. The existing gate in the one modified route file is the entire access-control surface for this phase (RESEARCH.md "Architectural Responsibility Map": `requireRole` reused, not rebuilt).

### CSS Modules + design-token reuse
**Source:** `src/app/globals.css` (spacing/color tokens already defined — UI-SPEC confirms Phase 2 reuses these verbatim, no re-porting).
**Apply to:** `EditorHost.module.css`, `PreviewPane.module.css`, `EditorPreviewLayout.module.css`, any toolbar/dropdown CSS — every new `.module.css` file references `var(--bg)`, `var(--surface)`, `var(--border)`, `var(--accent)` etc. from `globals.css` rather than redefining values (matches `Button.module.css`/`WorkspaceCard.module.css` convention of consuming global CSS vars, not hardcoding hex).

### Decision-ID doc-comments above exports
**Source:** `src/lib/validation.ts` (lines 3-9, 11), `src/components/workspace/WorkspaceCard.tsx` (lines 16-22).
**Apply to:** Every plugin file, `EditorHost.tsx`, `EditorPreviewLayout.tsx`, `pipeline.ts` — a one-to-three-line comment citing the specific `D-P2-XX` / `EDIT-XX` / TRD section the code implements, placed directly above the export it justifies.

### Pure-function-first, framework-free core logic
**Source:** `src/lib/validation.ts` — no React/Next import anywhere in the file, only `zod`.
**Apply to:** All 14 plugin files and `remark-gfm-subset.ts`/`pipeline.ts` — CLAUDE.md's invariant that plugins have zero DOM/EditorView access maps directly onto this existing codebase habit of keeping `lib/` files framework-free and independently unit-testable.

## No Analog Found

Files with no close match in the Phase 1 codebase — planner should use RESEARCH.md Code Examples / Patterns 1-3 instead:

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/lib/markdown/pipeline.ts` | service | transform | No AST/unified-pipeline precedent in `src/lib/` — use RESEARCH Pattern 2 |
| `src/lib/markdown/remark-gfm-subset.ts` | utility | transform | Same — novel unified-plugin composition, no analog |
| `src/lib/markdown/schema.ts` | config | transform | No sanitize-schema precedent — use RESEARCH Pitfall 1 guidance (ship `defaultSchema` unmodified first) |
| `src/components/editor/plugins/index.ts` | service (registry) | event-driven | No toolbar/keymap-registry precedent in Phase 1 — use RESEARCH Architecture Diagram |
| `src/components/editor/plugins/*.ts` (14 files, core `changeByRange` logic) | utility | transform | CM6 `TransactionSpec` logic has no Phase 1 precedent — use RESEARCH Pattern 1 (`bold.ts`) as literal starting point per plugin |
| `src/components/editor/EditorHost.tsx` (mount-once effect body) | component | event-driven | Uncontrolled CM6 mount pattern has no Phase 1 precedent — use RESEARCH Pattern 3 verbatim |
| `tests/editor/*.test.ts`, `tests/spec/*.test.ts`, `tests/markdown/*.test.ts`, `e2e/preview-perf.spec.ts` | test | n/a | Phase 1 has no visible `tests/`/`e2e/` unit-test files to pattern-match against (only `src/db/seed.ts` as a script); use RESEARCH.md "CommonMark spec-fixture test runner skeleton" and Common Pitfalls #4 harness sketch |

## Metadata

**Analog search scope:** `src/app/`, `src/components/`, `src/lib/`, `src/db/` (entire `src/` tree, 24 existing files enumerated via `find src -type f`)
**Files scanned:** 24 existing + 4 read in full (`w/[wsId]/page.tsx`, `lib/validation.ts`, `components/ui/Button.tsx`, `components/workspace/WorkspaceCard.tsx`)
**Pattern extraction date:** 2026-08-02
