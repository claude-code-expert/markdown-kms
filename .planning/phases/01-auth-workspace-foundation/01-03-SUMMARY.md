---
phase: 01-auth-workspace-foundation
plan: 03
subsystem: ui
tags: [nextjs, css-modules, ui-kit, auth.js, zod, playwright, ibm-plex]

requires:
  - phase: 01-auth-workspace-foundation (plan 02)
    provides: "signIn/signOut/auth (src/auth.ts), signupSchema (src/lib/validation.ts), listMembershipsForUser (src/lib/db-membership.ts), working signup→session→dashboard tracer"
provides:
  - "Ported ui-kit Button/Card/Form/Input as CSS Modules (src/components/ui/) — the reusable component layer every later screen in this project builds on"
  - "IBM Plex Sans/Mono + ui-kit CSS-variable tokens (--bg/--surface/--border/--accent/--destructive) in globals.css + layout.tsx, replacing the create-next-app Geist scaffold defaults"
  - "E1 login screen (src/app/(auth)/login) — the first real UI for signIn(\"credentials\")"
  - "E2 signup screen polished to the UI-SPEC copy/state contract, replacing Plan 02's placeholder form"
  - "E3 dashboard completed with WorkspaceCard, loading.tsx skeleton, error.tsx retry boundary"
affects: [01-04, 01-05]

actuals:
  tokens: 7900
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Compound component pattern for Form: Form/FormField/FormLabel/FormError/FormSubmit as named exports from one Form.tsx, mirroring ui-kit's single .form-demo markup block rather than one component per ui-kit CSS class"
    - "Button's generic .btn padding (8px 16px) and Form's own .form-submit padding (9px 14px) are kept as two distinct literal values per UI-SPEC's explicit 'do not re-round/unify' note — FormSubmit does not reuse the Button component"
    - "Client-side zod validation before fetch: signup-form.tsx calls signupSchema.safeParse() locally before POSTing, using the exact same schema instance the server route imports — one source of truth, not a duplicated regex/rule set (Pitfall 5)"
    - "next/font/google IBM_Plex_Sans/IBM_Plex_Mono replace next/font/google Geist/Geist_Mono — no base64 font embedding needed even though docs/ui-kit.html itself embeds the fonts as data URIs for its standalone catalog page"

key-files:
  created:
    - src/components/ui/Button.tsx
    - src/components/ui/Button.module.css
    - src/components/ui/Card.tsx
    - src/components/ui/Card.module.css
    - src/components/ui/Form.tsx
    - src/components/ui/Form.module.css
    - src/components/ui/Input.tsx
    - src/components/ui/Input.module.css
    - src/app/(auth)/login/page.tsx
    - src/app/(auth)/login/page.module.css
    - src/app/(auth)/login/login-form.tsx
    - src/app/(auth)/signup/signup-form.tsx
    - src/app/(main)/dashboard/loading.tsx
    - src/app/(main)/dashboard/loading.module.css
    - src/app/(main)/dashboard/error.tsx
    - src/app/(main)/dashboard/error.module.css
    - src/components/workspace/WorkspaceCard.tsx
    - src/components/workspace/WorkspaceCard.module.css
    - e2e/login.spec.ts
    - e2e/dashboard.spec.ts
  modified:
    - src/app/globals.css
    - src/app/layout.tsx
    - src/app/(auth)/signup/page.tsx
    - src/app/(auth)/signup/page.module.css
    - src/app/(main)/dashboard/page.tsx
    - src/app/(main)/dashboard/page.module.css
    - vitest.config.ts

key-decisions:
  - "src/lib/validation.ts was NOT modified by this plan — Plan 03 only imports the existing signupSchema (read-only consumption for client/server parity). The wave-coordination note anticipated both Wave-3 plans touching this file; in practice only Plan 04 needs to add to it (a workspace-name schema), so it remains fully open/additive for that plan with zero merge risk."
  - "ui-kit's catalog 'card' (#5) is a product-card with image/price fields that don't apply to an auth card or a workspace tile — ported as a generic bordered/padded container (Card.tsx) carrying the same surface tokens (--bg/--border/8px radius) instead of the literal product-card markup."
  - "Dropped the create-next-app dark-mode media query (prefers-color-scheme swapping --background/--foreground) when replacing globals.css tokens — docs/ui-kit.html defines no dark variant and no requirement calls for one; can be added later against the real token set if ever needed."

requirements-completed: [AUTH-01, AUTH-02, AUTH-03]

coverage:
  - id: D1
    description: "E1 login submits via signIn(\"credentials\") and shows the single generic failure message, never branching by cause (T-03-01)"
    requirement: AUTH-02
    verification:
      - kind: e2e
        ref: "e2e/login.spec.ts#logs in an existing user and lands on the dashboard"
        status: pass
      - kind: e2e
        ref: "e2e/login.spec.ts#shows the single generic error on a wrong password"
        status: pass
      - kind: human
        ref: "Checkpoint Task 3 — human confirmed the generic message with no field-specific hint"
        status: pass
    human_judgment: true
  - id: D2
    description: "E2 signup client-validates with the same signupSchema the server uses (min-8 password, same copy) before POSTing"
    requirement: AUTH-01
    verification:
      - kind: other
        ref: "src/app/(auth)/signup/signup-form.tsx imports signupSchema from src/lib/validation.ts and calls safeParse() before fetch — grep-verifiable import"
        status: pass
      - kind: e2e
        ref: "e2e/signup.spec.ts#signing up logs the user in and lands on the dashboard showing the default workspace (regression, still green against the polished form)"
        status: pass
      - kind: human
        ref: "Checkpoint Task 3 — human confirmed the 7-char password and duplicate-email copy"
        status: pass
    human_judgment: true
  - id: D3
    description: "E3 dashboard renders one WorkspaceCard per membership (always >=1, AUTH-03), with loading.tsx and error.tsx boundaries in place"
    requirement: AUTH-03
    verification:
      - kind: e2e
        ref: "e2e/dashboard.spec.ts#shows the default workspace card after signup"
        status: pass
      - kind: human
        ref: "Checkpoint Task 3 — human confirmed the card renders and error.tsx / loading.tsx exist as designed"
        status: pass
    human_judgment: true
  - id: D4
    description: "Workspace name truncates to one line with an ellipsis on overflow (ui-kit .kit-item-name pattern)"
    verification:
      - kind: other
        ref: "src/components/workspace/WorkspaceCard.module.css .name: white-space:nowrap; overflow:hidden; text-overflow:ellipsis — code inspection, no long-named workspace exists yet to exercise visually (workspace CRUD ships in Plan 04)"
        status: pass
    human_judgment: true
    rationale: "The CSS rule is in place and matches the ui-kit source pattern verbatim, but there is no UI yet to create a second, long-named workspace to visually confirm truncation — that becomes possible once Plan 04 ships workspace creation."
  - id: D5
    description: "A 100-character user name does not break the signup form/card layout (backstop)"
    verification:
      - kind: human
        ref: "Checkpoint Task 3 — human verification step 5 (100-char name backstop)"
        status: pass
    human_judgment: true

duration: ~50min
completed: 2026-08-02
status: complete
---

# Phase 01 Plan 03: Polished Auth UI (E1/E2/E3) Summary

**Ported ui-kit's Button/Card/Form/Input as CSS Modules with IBM Plex fonts and the full accent/surface token set, then built the real E1 login screen, replaced Plan 02's placeholder signup form with the E2 polished surface (shared-schema client validation, exact Korean copy, processing states), and completed the E3 card dashboard with a loading skeleton and an error-boundary retry — all against the working Plan-02 auth backend, human-verified end to end.**

## Performance

- **Duration:** ~50 min active execution
- **Tasks:** 2/2 code tasks + 1 human-verify checkpoint (approved, no rework)
- **Files modified:** 27 (14 in Task 1, 13 in Task 2)

## Accomplishments
- Ported four ui-kit components (Button #4, Card #5, Form #12, Input #15) into `src/components/ui/` as CSS Modules, carrying over the exact ui-kit `:root` tokens (`--bg`/`--surface`/`--surface-2`/`--border`/`--accent`/`--accent-strong`/`--destructive`) and both distinct button-padding literals (`.btn` 8px 16px vs. `.form-submit` 9px 14px) without re-rounding either
- Replaced the create-next-app Geist font scaffold with `next/font/google` IBM Plex Sans/Mono per the UI-SPEC Design System row
- Built E1 (`/login`): centered auth card, `signIn("credentials")`, single generic failure copy "이메일 또는 비밀번호가 올바르지 않습니다." that never branches by cause (T-03-01), CTA relabels to "로그인하는 중…" and disables while submitting
- Polished E2 (`/signup`): identical card position/width to login, client validates with the exact same `signupSchema` the server imports (Pitfall 5 parity — no duplicated validation rules), all three UI-SPEC error copies wired (password<8, duplicate email 409, generic 500/network)
- Completed E3 (`/dashboard`): `WorkspaceCard` with one-line ellipsis truncation (ui-kit `.kit-item-name` pattern), `loading.tsx` Suspense skeleton, `error.tsx` client boundary with a `reset()`-wired "다시 시도" button
- Fixed a pre-existing Vitest/Playwright collision: `vitest.config.ts` had no `exclude` for `e2e/**`, so Vitest's default include glob was matching Plan 02's Playwright specs by extension and crashing on `test.describe()` from `@playwright/test` — `pnpm vitest run` had never gone green since Plan 02 introduced e2e specs

## Task Commits

Each task was committed atomically:

1. **Task 1: Port ui-kit Button/Card/Form/Input (CSS Modules) + E1 login screen** - `fceef16` (feat)
2. **Task 2: E2 signup polish + E3 dashboard with loading/error boundaries** - `5330561` (feat)
3. **Task 3: Visual + functional verification of E1/E2/E3 (checkpoint)** - human-verified, approved with no issues, no code changes required

**Plan metadata:** committed separately as part of this SUMMARY.

## Files Created/Modified
- `src/components/ui/{Button,Card,Form,Input}.tsx` + `.module.css` — ported ui-kit components; `Form.tsx` is a compound export (`Form`/`FormField`/`FormLabel`/`FormError`/`FormSubmit`) mirroring ui-kit's single form-demo markup block
- `src/app/globals.css` — full ui-kit `:root` token set + the UI-SPEC 4-multiple spacing scale (`--space-xs`..`--space-3xl`) + IBM Plex Sans applied to `body`
- `src/app/layout.tsx` — `next/font/google` `IBM_Plex_Sans`/`IBM_Plex_Mono`, `lang="ko"`
- `src/app/(auth)/login/{page.tsx,page.module.css,login-form.tsx}` — E1
- `src/app/(auth)/signup/{page.tsx,page.module.css,signup-form.tsx}` — E2, `signup-form.tsx` replaces Plan 02's inline placeholder form
- `src/app/(main)/dashboard/{page.tsx,page.module.css}` — E3, now maps memberships to `WorkspaceCard`
- `src/app/(main)/dashboard/{loading.tsx,loading.module.css}` — Suspense skeleton (flat fill, no shimmer/gradient — anti-ai-slop)
- `src/app/(main)/dashboard/{error.tsx,error.module.css}` — client error boundary, `reset()` wired to a secondary `Button`
- `src/components/workspace/WorkspaceCard.tsx` + `.module.css` — one-line ellipsis card
- `e2e/login.spec.ts` — successful login → `/dashboard`, wrong password → generic error
- `e2e/dashboard.spec.ts` — default workspace card visible after signup
- `vitest.config.ts` — added `exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"]`

## Decisions Made
- **`src/lib/validation.ts` untouched by this plan:** Plan 03 only consumes `signupSchema` (import + `safeParse`), it adds no new schema. The Wave-3 coordination note assumed both plans would edit this file; in practice only Plan 04 (workspace-name schema) needs to, so the file is fully open for Plan 04 with zero merge risk.
- **`Card` generalized, not literally ported:** ui-kit's `#5 card` catalog entry is a product-card (image/price fields); the auth card and workspace tile have neither, so `Card.tsx` carries only the shared surface tokens (border/radius/padding/background), not the literal product-card markup.
- **Dark-mode media query dropped:** the create-next-app scaffold's `prefers-color-scheme` swap was removed when replacing `globals.css`'s placeholder tokens with the real ui-kit token set — no dark variant exists in `docs/ui-kit.html` and no requirement calls for one; add later against the real tokens if needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `pnpm vitest run` was crashing on Playwright's `e2e/*.spec.ts` files**
- **Found during:** Task 2, running the full regression pass (`pnpm vitest run`) before commit
- **Issue:** `vitest.config.ts` had no `exclude` entry, so Vitest's default test-file glob (`**/*.{test,spec}.?(c|m)[jt]s?(x)`) matched `e2e/*.spec.ts` by extension alone and tried to execute Playwright's `test`/`test.describe` outside a Playwright runner, throwing `"Playwright Test did not expect test() to be called here"`. This pre-existed since Plan 02 introduced `e2e/signup.spec.ts` and `e2e/session-persistence.spec.ts`, but this plan's own acceptance criteria required `pnpm vitest run` green, and adding two more e2e specs (`login.spec.ts`, `dashboard.spec.ts`) made the failure unavoidable to ignore.
- **Fix:** Added `exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"]` to `vitest.config.ts`'s `test` block.
- **Files modified:** `vitest.config.ts`
- **Verification:** `pnpm vitest run` — 3 test files, 5 tests, all pass; `pnpm exec playwright test` — 5/5 e2e specs still pass unaffected (separate runner, separate config).
- **Committed in:** `5330561`

---

**Total deviations:** 1 auto-fixed (blocking test-runner misconfiguration that pre-dated this plan)
**Impact on plan:** Necessary for this plan's own stated acceptance criteria (`pnpm vitest run` green) to hold; no scope creep beyond the one-line config fix.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None — dev server, DB, and env were already provisioned by Plans 01/02.

## Checkpoint Verification

Task 3 (`checkpoint:human-verify`, `gate="blocking"`) was reached after Tasks 1-2 committed. The human verified all six checklist items against the running app (dev server started in the background for this checkpoint) and responded **"approved — E1/E2/E3 screens verified (screens serve 200 with correct copy, server-side auth gate confirmed, accent token + loading/error boundaries present, E2E 5/5 green). No issues."** No rework was required.

## Known Stubs
None. The one open coverage item (D4 — ellipsis truncation) is verified by code inspection, not a stub: the CSS rule is correct and in place, but there is no long-named workspace to visually exercise it against yet, since workspace creation ships in Plan 04. This is not a gap in Plan 03's own scope — the dashboard always has exactly the seeded default workspace at this point in the roadmap.

## Next Phase Readiness
- Plan 04 (RBAC + workspace CRUD) can extend `src/lib/validation.ts` with a workspace-name schema with zero conflict — Plan 03 never touched that file.
- Plan 04's workspace-creation UI can reuse `Button`/`Card`/`Form`/`Input` from `src/components/ui/` and the `Card`-based `WorkspaceCard` pattern; creating a workspace with a long name will be the first real exercise of the ellipsis truncation CSS (D4).
- Plan 05 (Modal/Confirm Dialog) ports the remaining two ui-kit components (`#19`/`#33`) on top of the same token set established here — no new token work needed.
- No blockers. `pnpm vitest run` is green project-wide again (was broken since Plan 02, fixed here as a necessary deviation).

---
*Phase: 01-auth-workspace-foundation*
*Completed: 2026-08-02*

## Self-Check: PASSED

All 20 claimed files (ported ui-kit components, E1 login route, E2 signup form, E3 dashboard loading/error boundaries, WorkspaceCard, both new e2e specs, this SUMMARY) and both commit hashes (`fceef16`, `5330561`) verified present on disk / in `git log`.
