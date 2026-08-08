---
phase: 05-editor-enhancements-personalization
plan: 07
subsystem: ui
tags: [css-custom-properties, next-headers, rsc, cookies, theming, lucide, vitest-oxc]

requires:
  - phase: 04-documents-trash
    provides: FolderTree.tsx sidebar with a fixed-height Trash footer row pattern (trashLink) that ThemeToggle reuses
provides:
  - "[data-theme=\"dark\"] 12-token override in globals.css (WCAG-verified slate/blue palette)"
  - "@media (prefers-color-scheme: dark) fallback for first visit (no theme cookie yet)"
  - "RootLayout (RSC) async cookies() read -> <html data-theme> (no-FOUC first render)"
  - "ThemeToggle client component (document.cookie write, no new API route) mounted in sidebar footer"
  - "Toolbar :active pressed state + 300ms hover-delay tooltip + dark-mode-safe tooltip background"
  - "vitest oxc jsx runtime override enabling .tsx component imports under vitest (project-wide test infra fix)"
affects: [05-editor-enhancements-personalization]

actuals:
  tokens: 2875
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Theme/layout-mode style persistence: RSC reads the cookie (await cookies()), client writes it (document.cookie) — no Server Action/Route Handler round trip for non-sensitive, client-owned UI settings"
    - "Dark mode via a single [data-theme=\"dark\"] CSS custom-property override block; components never branch on theme, they only ever read var(--token)"

key-files:
  created:
    - src/components/layout/ThemeToggle.tsx
    - src/components/layout/ThemeToggle.module.css
    - tests/theme/rsc-cookie.test.ts
  modified:
    - src/app/globals.css
    - src/app/layout.tsx
    - src/components/editor/Toolbar.module.css
    - src/components/tree/FolderTree.tsx
    - vitest.config.ts

key-decisions:
  - "vitest.config.ts oxc.jsx forced to { runtime: \"automatic\" } — Vite 8's default oxc transform otherwise inherits tsconfig.json's jsx:\"preserve\" (a Next.js-SWC-only setting) and leaves raw JSX in the output, which vite:import-analysis can't parse. Needed to import any .tsx file under vitest at all — first time this repo's test suite imports a component file directly."
  - "next/font/google mocked in the RSC cookie test (IBM_Plex_Sans/IBM_Plex_Mono return plain objects) — the real package relies on a Next.js build-time loader that isn't present in a bare vitest run."

patterns-established:
  - "RSC theme/settings cookie read + client cookie write, no API route, for non-sensitive client-owned settings (reusable for layout-mode/resize-ratio cookies still pending in this phase)"

requirements-completed: [EDIT-12, EDIT-10]

coverage:
  - id: D1
    description: "[data-theme=\"dark\"] 12-token override + @media prefers-color-scheme fallback in globals.css"
    requirement: EDIT-12
    verification:
      - kind: other
        ref: "node -e grep gate: [data-theme=.dark.] and prefers-color-scheme both present in globals.css"
        status: pass
    human_judgment: true
    rationale: "Grep gate proves the CSS blocks exist and use the right selectors, but visual dark-mode correctness (WCAG contrast as actually rendered, no residual light-only surfaces) requires a human to look at the running app."
  - id: D2
    description: "RSC RootLayout reads the theme cookie via cookies() and bakes <html data-theme> into the first server render (no-FOUC), 3 cookie states covered"
    requirement: EDIT-12
    verification:
      - kind: unit
        ref: "tests/theme/rsc-cookie.test.ts#RootLayout theme cookie -> data-theme (3 cases: absent/light/dark)"
        status: pass
    human_judgment: true
    rationale: "Unit test proves the RSC render logic is correct in isolation, but no-FOUC (no white flash on real reload) is a timing/visual property only observable in an actual browser reload."
  - id: D3
    description: "ThemeToggle in sidebar footer: document.cookie write + instant DOM data-theme update, Moon/Sun icon+copy per UI-SPEC, no new API route"
    requirement: EDIT-12
    verification:
      - kind: other
        ref: "node -e grep gate: document.cookie and dataset.theme both present in ThemeToggle.tsx"
        status: pass
    human_judgment: true
    rationale: "Grep gate proves the write path exists; actual click-to-see-it-flip behavior and hover/positioning below the Trash row needs a human in the running app."
  - id: D4
    description: "Toolbar .button:active pressed (accent-weak bg/accent text) + tooltip hide-immediate/show-300ms delay + tooltip background hardcoded for dark-mode legibility"
    requirement: EDIT-10
    verification:
      - kind: other
        ref: "node -e grep gate: :active and 300ms both present in Toolbar.module.css"
        status: pass
    human_judgment: true
    rationale: "Grep gate proves the CSS rules exist; the actual felt timing of the 300ms delay and press feedback is a human-observable interaction property."

duration: 6min
completed: 2026-08-08
status: complete
---

# Phase 5 Plan 07: Theme (Light/Dark) + Toolbar Interaction Polish Summary

**Dark theme via a single 12-token `[data-theme="dark"]` CSS override (no component rewrites), RSC `cookies()` read for no-FOUC first paint, client-side `document.cookie` toggle with zero new API routes, and toolbar `:active` pressed state + 300ms tooltip delay.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-08T17:25:32+09:00
- **Completed:** 2026-08-08T17:31:00+09:00
- **Tasks:** 3
- **Files modified:** 8 (3 created, 5 modified)

## Accomplishments

- `globals.css` gained a `[data-theme="dark"]` block re-declaring the 12 existing CSS custom properties with UI-SPEC's WCAG-verified slate/blue dark values, plus an `@media (prefers-color-scheme: dark)` fallback scoped to `:root:not([data-theme])` for first-visit OS-following before any cookie exists.
- `src/app/layout.tsx`'s `RootLayout` is now an async Server Component that `await cookies()`s the `theme` cookie and stamps `<html data-theme={theme}>` on the very first HTML response — no white-flash-then-dark flicker. Covered by `tests/theme/rsc-cookie.test.ts` (absent/light/dark cases, TDD RED→GREEN).
- New `ThemeToggle` client component in the sidebar footer (directly below the Trash row, same 40px/border-top row styling) flips theme instantly via `document.cookie` write + `document.documentElement.dataset.theme` DOM update — deliberately no Server Action or Route Handler, since theme is a non-sensitive, client-owned setting (RESEARCH Pattern 6).
- `Toolbar.module.css` picked up the `:active` pressed rule (`accent-weak` background, `accent` text — momentary only, no persistent "this format is active" tracking) and split the tooltip's `opacity` transition into hide-immediate / show-after-300ms so hover-out never leaves a stray lingering tooltip. The tooltip's background was also unhooked from `var(--text)` (which goes near-white in dark mode) and hardcoded to `#0f172a` since it's meant to always be a dark bubble regardless of theme.

## Task Commits

Each task was committed atomically:

1. **Task 1: dark token override + @media fallback + toolbar pressed/300ms CSS** - `b69f401` (feat)
2. **Task 2: RSC cookies() -> data-theme (FOUC prevention)** - `b056855` (test, RED) + `da007d5` (feat, GREEN)
3. **Task 3: ThemeToggle component + sidebar placement** - `5e5bfa6` (feat)

_Note: Task 2 is TDD (`tdd="true"`) — test committed first and confirmed failing (RED) before the implementation commit (GREEN)._

## Files Created/Modified

- `src/app/globals.css` - `[data-theme="dark"]` 12-token override + `@media (prefers-color-scheme: dark)` fallback
- `src/components/editor/Toolbar.module.css` - `.button:active` pressed rule, split tooltip transition-delay, hardcoded tooltip background
- `src/app/layout.tsx` - `RootLayout` made `async`, reads `theme` cookie via `next/headers` `cookies()`, sets `<html data-theme>`
- `src/components/layout/ThemeToggle.tsx` - client toggle: `document.cookie` write, `dataset.theme` DOM update, Moon/Sun + Korean copy per UI-SPEC
- `src/components/layout/ThemeToggle.module.css` - 40px sidebar footer row styling matching `.trashLink`
- `src/components/tree/FolderTree.tsx` - mounts `<ThemeToggle />` immediately below the Trash link
- `tests/theme/rsc-cookie.test.ts` - 3-case RSC render test (theme cookie absent/light/dark → `data-theme` attribute)
- `vitest.config.ts` - `oxc.jsx: { runtime: "automatic" }` so `.tsx` files can be imported under vitest (see Deviations)

## Decisions Made

- RSC reads `theme` cookie / client writes `theme` cookie is the persistence pattern for every personalization setting in this phase (theme now; layout-mode and resize-ratio will reuse it in later 05-xx plans) — no Server Action or API route needed since none of these values are security- or server-validation-relevant.
- Dark palette lives entirely in one CSS custom-property override block; zero component files needed to change beyond the two (`globals.css`, `Toolbar.module.css`) that either declare tokens or had a literal non-token color to fix.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vitest couldn't transform/import `.tsx` files — added `oxc.jsx` override to `vitest.config.ts`**
- **Found during:** Task 2 (writing `tests/theme/rsc-cookie.test.ts`, which is the first test in this repo to `import` an actual React component file rather than a `.ts` lib/route module)
- **Issue:** `tsconfig.json` sets `"jsx": "preserve"` (intentional — Next.js's own SWC compiler handles JSX transform at build time). Vite 8's default `oxc` transform inherits that setting from the project tsconfig, leaves raw JSX untransformed in its output, and `vite:import-analysis` then fails to parse it (`Failed to parse source for import analysis... content contains invalid JS syntax`).
- **Fix:** Added `oxc: { jsx: { runtime: "automatic" } }` to `vitest.config.ts`, explicitly overriding the inherited tsconfig setting for the test-transform pipeline only (production builds still use Next's own SWC/`jsx:"preserve"` path, untouched).
- **Files modified:** `vitest.config.ts`
- **Verification:** `pnpm vitest run` — full suite (43 files / 904 tests) green after the change, confirming no regression to any existing test.
- **Committed in:** `b056855` (Task 2 RED commit, bundled with the test file since the config fix was required just to make the test *runnable*, not part of the feature implementation itself)

**2. [Rule 3 - Blocking] `next/font/google` isn't callable under vitest — mocked in the RSC test**
- **Found during:** Task 2, same test file, immediately after fixing the JSX transform issue above
- **Issue:** `IBM_Plex_Sans`/`IBM_Plex_Mono` from `next/font/google` rely on a Next.js build-time loader (webpack/SWC macro) that doesn't exist outside `next build`/`next dev` — calling them directly under vitest threw `TypeError: IBM_Plex_Sans is not a function`.
- **Fix:** Added `vi.mock("next/font/google", ...)` stubbing both exports as plain functions returning `{ variable: "--font-..." }`, matching the shape `RootLayout` actually consumes (`.variable` for the `className` string).
- **Files modified:** `tests/theme/rsc-cookie.test.ts`
- **Verification:** All 3 RSC cookie test cases pass.
- **Committed in:** `b056855` (Task 2 RED commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking test-infrastructure issues, both scoped to test tooling, neither touches production code paths).
**Impact on plan:** Both fixes were prerequisites for Task 2's TDD test to even execute, not scope creep — the plan's acceptance criteria ("쿠키 없음/light/dark 3케이스... 테스트가 assert") was unreachable without them. `oxc.jsx` override is a one-time repo-wide test-infra fix that benefits any future test importing a `.tsx` file.

## Issues Encountered

None beyond the two deviations above (both resolved within Task 2, no open issues carried forward).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Theme (EDIT-12 theme axis) and toolbar interaction policy (EDIT-10) are complete and reusable: the RSC-cookie-read / client-cookie-write pattern established here is the template for this phase's still-pending layout-mode and resize-ratio persistence (separate 05-xx plans, not this one).
- `vitest.config.ts`'s `oxc.jsx` fix unblocks any future plan that needs to unit-test a `.tsx` component's render output directly (not just its extracted pure logic).
- Manual no-FOUC visual verification (reload with dark cookie set, confirm no white flash) is deferred to this project's bulk end-of-phase `/gsd-verify-work 5` pass per the 2026-08-08 user instruction already governing Phases 3/4 (see STATE.md "Deferred Verification").

---
*Phase: 05-editor-enhancements-personalization*
*Completed: 2026-08-08*

## Self-Check: PASSED
