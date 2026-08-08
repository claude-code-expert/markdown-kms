---
phase: 06-tags-search-export
plan: 04
subsystem: api
tags: [nextjs, archiver, drizzle, streaming, rbac, zod, lucide]

requires:
  - phase: 06-tags-search-export (06-01/06-02/06-03)
    provides: document_tag schema + NFC normalization, replaceTags/getTags + PUT tags route, searchWorkspace + GET search route, archiver dependency already installed
provides:
  - GET /api/documents/[id]/export — document.content byte-for-byte .md download (no lib/markdown pipeline)
  - GET /api/folders/[id]/export — archiver-streamed structure-preserving .zip download
  - src/lib/export.ts (sanitizeZipSegment, buildZipEntries) — archiver-free, unit-testable
  - Document/folder context-menu export items + downloadExport trigger + destructive failure banner
affects: [phase-7-collaboration, any-future-export-format-work]

actuals:
  tokens: 7945
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "archiver 8.0.0 pure-ESM class API (ZipArchive) instead of the archiver(format,opts) factory function older majors exposed"
    - "buildZipEntries kept archiver-free so folder-hierarchy/collision/zip-slip logic is DB-only unit-testable, the actual stream only lives in the route"

key-files:
  created:
    - src/app/api/documents/[id]/export/route.ts
    - src/app/api/folders/[id]/export/route.ts
    - src/lib/export.ts
    - src/components/tree/download-export.ts
    - tests/export/helpers.ts
    - tests/export/md-export.test.ts
    - tests/export/zip-export.test.ts
    - tests/export/zip-slip.test.ts
  modified:
    - src/components/tree/FolderTree.tsx
    - src/components/tree/FolderTree.module.css

key-decisions:
  - "archiver 8.0.0 dropped the factory function RESEARCH/PATTERNS assumed — switched to `new ZipArchive(...)` (Rule 1 auto-fix, verified against the installed package's actual exports/types, not the docs' assumed API)"
  - "Root folder name becomes the zip's single top-level directory (RESEARCH Open Question 1 recommendation adopted) — unzipping doesn't scatter files loose"
  - "Export failure banner is fully destructive (border+icon+text all var(--destructive)) per UI-SPEC, unlike RestoreRootBanner/UploadErrorBanner which only tint the icon/text — a small, spec-driven divergence from the closest existing analogs"

patterns-established:
  - "Pure DB-only zip-entry builder (no archiver import) separate from the streaming route — keeps zip-slip/collision/hierarchy logic testable without spinning up real zip I/O"

requirements-completed: [EXP-01, EXP-02]

coverage:
  - id: D1
    description: "GET /api/documents/:id/export returns document.content byte-for-byte with RFC 5987 Korean-safe filename headers, gated VIEWER+ with IDOR-safe workspace resolution"
    requirement: "EXP-01"
    verification:
      - kind: unit
        ref: "tests/export/md-export.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "GET /api/folders/:id/export streams an archiver zip preserving folder hierarchy, with zip-slip-safe entry names and -1/-2 collision suffixes, gated VIEWER+"
    requirement: "EXP-02"
    verification:
      - kind: unit
        ref: "tests/export/zip-slip.test.ts"
        status: pass
      - kind: integration
        ref: "tests/export/zip-export.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Document/folder context-menu export items trigger a real browser download via fetch->blob->hidden <a download>; a failed export shows a destructive sidebar banner in both light and dark themes"
    verification: []
    human_judgment: true
    rationale: "Real browser download behavior, context-menu click flow, and dark/light banner rendering require a human eyeballing an actual browser session — vitest runs in a Node environment with no DOM/download surface to assert against."

duration: ~15min
completed: 2026-08-08
status: complete
---

# Phase 6 Plan 4: Export (.md verbatim / .zip structure-preserving) Summary

**GET /api/documents/[id]/export streams document.content byte-for-byte, GET /api/folders/[id]/export streams an archiver-built zip preserving folder hierarchy with zip-slip-safe entry names, both wired into the document/folder context menus via a hidden-`<a download>` trigger.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-08T19:37:00+09:00 (approx.)
- **Completed:** 2026-08-08T19:42:01+09:00
- **Tasks:** 3
- **Files modified:** 10 (8 created, 2 modified)

## Accomplishments
- `.md` export: verbatim `document.content` (no `lib/markdown` pipeline), `Content-Disposition` with both ASCII-fallback `filename` and RFC 5987 `filename*` for Korean titles, VIEWER+ with IDOR-safe workspace re-derivation
- `.zip` export: `archiver`-streamed download preserving folder hierarchy (root folder = zip's top directory), `sanitizeZipSegment` neutralizing `/`, `\`, `..`, and control characters in every path segment (zip-slip defense), `-1`/`-2` suffixing for same-directory title collisions, soft-deleted documents excluded
- `src/lib/export.ts` (`sanitizeZipSegment`, `buildZipEntries`) deliberately imports no `archiver` — folder-hierarchy/collision/zip-slip logic is a pure DB-only unit under test, independent of the actual zip stream
- Context menu: ".md 내보내기" (Download icon) before "삭제" on document nodes, ".zip 내보내기" (FolderDown icon) after "이동..." before "삭제" on folder nodes — destructive items stay array-last
- `downloadExport` pure fetch→blob→hidden-`<a download>` function (mirrors `discardDraft`'s style); export failure surfaces a destructive sidebar banner (no auto-dismiss, matches `RestoreRootBanner`/`UploadErrorBanner` structure)

## Task Commits

Each task was committed atomically (Task 1/2 are `tdd="true"` — RED then GREEN):

1. **Task 1: .md export route** — `5eec0c1` (test, RED) → `57ba8dd` (feat, GREEN)
2. **Task 2: zip export (sanitizeZipSegment + buildZipEntries + route)** — `a9a6f67` (test, RED) → `2ba8d36` (feat, GREEN — includes the archiver 8.0.0 API auto-fix)
3. **Task 3: context-menu export items + download trigger + failure banner** — `c4a7610` (feat)

_Task 1/2 TDD gate compliance: `test(...)` commit exists before each `feat(...)` commit — RED confirmed via a failing import before the GREEN implementation landed (verified inline, see below)._

## Files Created/Modified
- `src/app/api/documents/[id]/export/route.ts` - GET, verbatim `.md` download, VIEWER+, IDOR-safe
- `src/app/api/folders/[id]/export/route.ts` - GET, `archiver`-streamed `.zip`, VIEWER+, IDOR-safe
- `src/lib/export.ts` - `sanitizeZipSegment`, `buildZipEntries` (archiver-free, pure)
- `src/components/tree/download-export.ts` - `downloadExport` pure fetch→blob→download trigger
- `src/components/tree/FolderTree.tsx` - export menu items + failure banner state/render
- `src/components/tree/FolderTree.module.css` - `.exportError*` banner styles
- `tests/export/helpers.ts`, `tests/export/md-export.test.ts`, `tests/export/zip-export.test.ts`, `tests/export/zip-slip.test.ts` - RED-first test coverage

## Decisions Made
- Root folder name becomes the zip's top-level directory rather than being flattened away (RESEARCH Open Question 1 recommendation) — unzipping produces one named folder, not scattered loose files.
- Export failure banner uses fully-destructive coloring (border+icon+text) instead of the muted-icon-only style of its closest analogs (`RestoreRootBanner`/`UploadErrorBanner`), because UI-SPEC's Export Menu Contract explicitly specifies destructive on all three elements.
- Collision counters for zip entries are scoped per-directory, not globally, so identically-titled documents in different subfolders don't affect each other's `-1`/`-2` numbering.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] archiver 8.0.0 has no factory function — switched to the `ZipArchive` class**
- **Found during:** Task 2 (zip export route implementation)
- **Issue:** RESEARCH/06-PATTERNS assumed `import archiver from "archiver"; archiver("zip", {...})` (an older major's factory-function API). The installed `archiver@8.0.0` is pure ESM and only exports the `Archiver`/`ZipArchive`/`TarArchive`/`JsonArchive` classes — no default export, no factory. Calling the assumed API threw `TypeError: default is not a function` at test time.
- **Fix:** `import { ZipArchive } from "archiver"; new ZipArchive({ zlib: { level: 9 } })`. Verified against the installed package's actual `index.js` exports and `@types/archiver`'s `.d.ts` (which only declares the classes, confirming this isn't a typing gap).
- **Files modified:** `src/app/api/folders/[id]/export/route.ts`
- **Verification:** `tests/export/zip-export.test.ts`'s route-level test asserts real "PK" zip magic bytes in the response body (catches a 0-byte/corrupt-stream regression, not just a 200 status)
- **Committed in:** `2ba8d36` (Task 2 GREEN commit)

**2. [Rule 1 - Bug] Over-broad "no archiver import" RED test assertion**
- **Found during:** Task 2, immediately after the archiver fix above
- **Issue:** The RED test for "`src/lib/export.ts` doesn't import archiver" matched the literal substring `archiver` anywhere in the file, including a code comment describing where the real archiver stream lives — a false positive unrelated to the actual import-free guarantee being tested.
- **Fix:** Tightened the assertion to check for an actual `import ... from "archiver"` / `require("archiver")` statement instead of any mention of the word.
- **Files modified:** `tests/export/zip-export.test.ts`
- **Verification:** `pnpm vitest run tests/export` — 20/20 pass
- **Committed in:** `2ba8d36` (bundled with the Task 2 GREEN commit, same root cause)

---

**Total deviations:** 2 auto-fixed (both Rule 1, both surfaced by the same archiver API mismatch)
**Impact on plan:** Necessary correctness fixes — the plan's assumed archiver API doesn't exist in the installed version. No scope creep; zip export behavior (hierarchy, sanitize, collision suffix) is unchanged from what was planned.

## Issues Encountered
None beyond the archiver API deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 6 (tags, search, export) is now fully implemented across all 4 plans (06-01 through 06-04). `pnpm vitest run` is green at 977/977 tests, `pnpm exec tsc --noEmit` is clean.
- Remaining before phase close-out: the plan's `<human-check>` item (browser-verify actual `.md`/`.zip` downloads, unzip and confirm hierarchy, Korean filenames, and the failure banner in both light/dark themes) — this is D3 in the coverage block above and is expected to be exercised by `/gsd-verify-work`.
- No blockers for Phase 7 (collaboration) — this plan didn't touch workspace membership/invite surfaces.

---
*Phase: 06-tags-search-export*
*Completed: 2026-08-08*

## Self-Check: PASSED

All 10 created/modified files and 5 commit hashes (5eec0c1, 57ba8dd, a9a6f67, 2ba8d36, c4a7610) verified present on disk / in git log.
