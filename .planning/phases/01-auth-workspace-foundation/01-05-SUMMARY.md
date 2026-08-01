---
phase: 01-auth-workspace-foundation
plan: 05
subsystem: ui
tags: [nextjs, css-modules, ui-kit, modal, confirm-dialog, soft-delete]

requires:
  - phase: 01-auth-workspace-foundation (plan 03)
    provides: "Button/Card/Form/Input CSS Modules, WorkspaceCard, dashboard page.tsx, design tokens"
  - phase: 01-auth-workspace-foundation (plan 04)
    provides: "POST /api/workspaces (creator OWNER), DELETE /api/workspaces/:id (OWNER-only soft delete), workspaceSchema (name <=100)"
provides:
  - "Ported ui-kit Modal (#19) and Confirm Dialog (#33) as generic CSS-Module components (src/components/ui/) — Modal hosts arbitrary children, ConfirmDialog hosts an arbitrary body + typed confirm/cancel actions"
  - "E4 create modal (CreateWorkspaceModal + CreateWorkspaceButton) — single name field (D-13), shared-schema validation, navigates to /w/[newId] on success (D-14)"
  - "E5 delete dialog (DeleteWorkspaceDialog) — GitHub-style re-type-name confirm (D-15), OWNER-gated affordance on WorkspaceCard, copy accurate to the amended SOFT-delete contract"
  - "/w/[wsId] placeholder route — requireRole(wsId, VIEWER)-gated, D-14 minimal empty state, no persistent sidebar"
affects: []

actuals:
  tokens: 5937
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Modal/ConfirmDialog are backdrop+box shells taking `children` for body content, not fixed-shape components — DeleteWorkspaceDialog composes ConfirmDialog with an Input + inline error as children, matching the Form/FormField compound pattern established in Plan 03"
    - "WorkspaceCard became a client component (useState for dialog open + useRouter for refresh) purely to host the OWNER-gated delete affordance; the dashboard page itself stays a server component, unaffected by fetching (Server Component RSC re-fetch via router.refresh() after a successful delete, reusing the same loading.tsx/error.tsx boundaries from Plan 03 rather than duplicating list state client-side)"

key-files:
  created:
    - src/components/ui/Modal.tsx
    - src/components/ui/Modal.module.css
    - src/components/ui/ConfirmDialog.tsx
    - src/components/ui/ConfirmDialog.module.css
    - src/components/workspace/CreateWorkspaceModal.tsx
    - src/components/workspace/CreateWorkspaceButton.tsx
    - src/components/workspace/DeleteWorkspaceDialog.tsx
    - src/components/workspace/DeleteWorkspaceDialog.module.css
    - src/app/(main)/w/[wsId]/page.tsx
    - src/app/(main)/w/[wsId]/page.module.css
    - e2e/workspace-create.spec.ts
    - e2e/workspace-delete.spec.ts
  modified:
    - src/app/(main)/dashboard/page.tsx
    - src/app/(main)/dashboard/page.module.css
    - src/components/workspace/WorkspaceCard.tsx
    - src/components/workspace/WorkspaceCard.module.css

key-decisions:
  - "Delete-dialog body copy deviates from the UI-SPEC Copywriting Contract row (which reads '...영구적으로 사라지며 되돌릴 수 없습니다' / permanent, irreversible). That row predates the 2026-08-02 D-15 override (hard cascade -> soft delete, TRD SS3/PRD SS3, landed in Plan 04). This plan writes accurate soft-delete copy instead: \"'{이름}' 워크스페이스가 목록에서 사라지고 더 이상 접근할 수 없게 됩니다.\" The strong re-type-name confirm mechanism itself is unchanged (D-15's UX intent stands regardless of hard/soft semantics) — only the claim about permanence was corrected. Human-verified and confirmed correct at the Task 3 checkpoint."
  - "WorkspaceCard's delete affordance is gated on role === 'OWNER' alone, no separate is_default check needed — D-09 guarantees the seeded default workspace has no OWNER (all members are EDITOR), so the role check alone already excludes it."
  - "Card removal on delete uses router.refresh() (server re-fetch via listMembershipsForUser's existing is_deleted=false filter) rather than client-side optimistic list splicing — reuses the RSC/Suspense boundary pattern already established in Plan 03 (loading.tsx) instead of introducing duplicate client-side list state."

requirements-completed: [WS-02]

coverage:
  - id: D1
    description: "E4 create modal: single name field (D-13), shared workspaceSchema validation (100-char cap, O2), loading/error states, navigates to /w/[newId] on success (D-14)"
    requirement: WS-02
    verification:
      - kind: e2e
        ref: "e2e/workspace-create.spec.ts#creates a workspace via the modal and it reappears on the dashboard"
        status: pass
      - kind: human
        ref: "Checkpoint Task 3 — human confirmed create modal states and navigation"
        status: pass
    human_judgment: true
  - id: D2
    description: "E5 delete dialog: re-type-name confirm keeps the destructive button disabled until exact match (D-15), OWNER-only affordance, inline failure copy keeps dialog open, success removes the card immediately"
    requirement: WS-02
    verification:
      - kind: e2e
        ref: "e2e/workspace-delete.spec.ts#OWNER creates then deletes a workspace via the re-type dialog"
        status: pass
      - kind: human
        ref: "Checkpoint Task 3 — human confirmed the re-type gate, OWNER-only visibility, and the soft-delete-accurate copy"
        status: pass
    human_judgment: true
  - id: D3
    description: "Default workspace never shows a delete affordance (D-09/no OWNER); server DELETE still enforces OWNER via requireRole for any attempt that bypasses the hidden UI (T-05-01)"
    requirement: WS-01
    verification:
      - kind: e2e
        ref: "e2e/workspace-delete.spec.ts#... — asserts zero delete buttons for the default workspace card"
        status: pass
      - kind: human
        ref: "Checkpoint Task 3 step 5 — human confirmed a non-owner DELETE attempt returns 403 '이 작업을 수행할 권한이 없습니다.'"
        status: pass
    human_judgment: true
  - id: D4
    description: "/w/[wsId] renders a minimal placeholder (name + empty state) for a freshly created workspace, gated to members only via requireRole(wsId, VIEWER) -> notFound()"
    requirement: WS-02
    verification:
      - kind: e2e
        ref: "e2e/workspace-delete.spec.ts — asserts the placeholder heading renders immediately after create-navigate"
        status: pass
    human_judgment: false
  - id: D5
    description: "A 100-character workspace name renders and submits without breaking the modal or the resulting card layout (E4 long-text backstop)"
    verification:
      - kind: human
        ref: "Checkpoint Task 3 step 6 (100-char name backstop)"
        status: pass
    human_judgment: true
    rationale: "Visual/layout backstop — not practical to assert via automated DOM text-overflow measurement, confirmed by direct human observation of the rendered card."

duration: ~16min
completed: 2026-08-02
status: complete
---

# Phase 01 Plan 05: Workspace Create/Delete UI (E4/E5) + /w/[wsId] Placeholder Summary

**Ported ui-kit Modal and Confirm Dialog as generic CSS-Module shells, then built the E4 create-workspace modal and E5 GitHub-style re-type-name delete dialog on top of them — wiring both to the Plan-04 create/delete API routes — plus a minimal /w/[wsId] placeholder screen; completes Phase 1's five plans end to end, human-verified.**

## Performance

- **Duration:** ~16 min active execution
- **Tasks:** 2/2 code tasks + 1 human-verify checkpoint (approved, no rework)
- **Files modified:** 16 (9 created + 3 CSS-module-paired created in Task 1/2, 4 modified)

## Accomplishments
- Ported ui-kit Modal (#19) and Confirm Dialog (#33) into `src/components/ui/` as generic CSS-Module shells — `Modal` takes a `title` + arbitrary `children`; `ConfirmDialog` takes `title` + arbitrary `children` (body) + typed confirm/cancel actions, so both are reused as-is by E4 and E5 rather than duplicated per screen. Titles use the UI-SPEC's unified 16px/600 Heading token rather than ui-kit's literal 700, matching the Typography contract's explicit 2-weight rule.
- Built `CreateWorkspaceModal` (E4): single name field (D-13), client-validates with the exact `workspaceSchema` the server re-validates (100-char cap, O2 — same Pitfall-5 parity pattern as `SignupForm`), confirm button "만들기" → "만드는 중…" disabled while pending, inline create-fail copy on non-2xx (dialog stays open), `router.push("/w/{newId}")` on success (D-14). `CreateWorkspaceButton` owns the open/close state and renders the dashboard header CTA.
- Added the dashboard header row (title + right-aligned "워크스페이스 만들기" CTA) per the UI-SPEC Visual Hierarchy contract, keeping the Plan-03 card grid untouched below it.
- Built `DeleteWorkspaceDialog` (E5) on `ConfirmDialog`: title "워크스페이스를 삭제할까요?", a body paragraph + `Input` re-type field, destructive "삭제" button disabled until the typed value exactly matches the workspace name (D-15), "삭제" → "삭제하는 중…" while deleting, inline destructive failure copy on non-2xx (dialog stays open), `router.refresh()` + close on success.
- `WorkspaceCard` gained a trash-icon delete affordance rendered only when `role === "OWNER"` — UX convenience only; the real gate is the server's `requireRole` on `DELETE /api/workspaces/:id` (Plan 04, T-05-01). No separate `is_default` check was needed: D-09 guarantees the seeded default workspace has no OWNER member, so the role check alone excludes it.
- Built `/w/[wsId]/page.tsx`: a minimal D-14 placeholder (workspace name + "아직 문서가 없습니다." empty state, no sidebar). Reuses `requireRole(wsId, "VIEWER")` from Plan 04 as the membership gate — any non-member (or non-existent/soft-deleted workspace ID, since there is no membership row) hits `ForbiddenError` and is routed to Next's `notFound()`.
- `e2e/workspace-create.spec.ts` and `e2e/workspace-delete.spec.ts` cover the full create→land-on-placeholder→reappear-on-dashboard flow and the create→OWNER-delete→card-gone flow, including an assertion that the default workspace never exposes a delete button.

## Task Commits

Each task was committed atomically:

1. **Task 1: Port ui-kit Modal + Confirm Dialog; E4 create modal wired to POST** - `292653d` (feat)
2. **Task 2: E5 delete dialog (re-type confirm) + /w/[wsId] placeholder** - `ade3af1` (feat)
3. **Task 3: Visual + functional verification of E4/E5 and full Phase-1 flow (checkpoint)** - human-verified, approved with no code changes required

**Plan metadata:** committed separately as part of this SUMMARY.

## Files Created/Modified
- `src/components/ui/Modal.{tsx,module.css}` — generic backdrop+box+title+close-icon shell (ESC/backdrop-click close), ported from ui-kit id:'modal'
- `src/components/ui/ConfirmDialog.{tsx,module.css}` — generic backdrop+box+title+children+cancel/confirm shell (destructive variant), ported from ui-kit id:'confirm'
- `src/components/workspace/CreateWorkspaceModal.tsx` — E4, wraps `Modal` with a `Form`/`Input` bound to `workspaceSchema` and `POST /api/workspaces`
- `src/components/workspace/CreateWorkspaceButton.tsx` — dashboard header CTA, owns modal open/close state
- `src/components/workspace/DeleteWorkspaceDialog.{tsx,module.css}` — E5, wraps `ConfirmDialog` with the re-type-name `Input` and `DELETE /api/workspaces/:id`
- `src/components/workspace/WorkspaceCard.{tsx,module.css}` — now a client component: `id`/`role` props, OWNER-gated trash-icon button opening `DeleteWorkspaceDialog`, `router.refresh()` on delete
- `src/app/(main)/dashboard/{page.tsx,page.module.css}` — header row (title + `CreateWorkspaceButton`), passes `id`/`role` to `WorkspaceCard`
- `src/app/(main)/w/[wsId]/{page.tsx,page.module.css}` — D-14 placeholder, `requireRole(wsId, "VIEWER")`-gated
- `e2e/workspace-create.spec.ts`, `e2e/workspace-delete.spec.ts` — WS-02 UI E2E

## Decisions Made
- **Delete-dialog copy corrected for the soft-delete amendment (flagged deviation, human-confirmed):** the UI-SPEC's Copywriting Contract row for the delete dialog body predates the 2026-08-02 D-15 override (hard cascade → soft delete, landed in Plan 04) and still reads "...영구적으로 사라지며 되돌릴 수 없습니다" (permanently disappears, cannot be undone). That claim is now false — a soft-deleted workspace's row and memberships are preserved and the Phase-4 trash will eventually restore it. This plan writes accurate copy instead: "'{이름}' 워크스페이스가 목록에서 사라지고 더 이상 접근할 수 없게 됩니다. 계속하려면 워크스페이스 이름을 정확히 입력하세요." The GitHub-style re-type-exact-name confirm mechanism itself is unchanged — D-15's strong-confirm UX intent holds regardless of hard/soft semantics; only the permanence claim was corrected. Confirmed correct by the human at the Task 3 checkpoint.
- **No `is_default` check needed on the delete affordance:** gating on `role === "OWNER"` alone is sufficient because D-09 (all default-workspace members are EDITOR, no OWNER exists) already excludes the default workspace from ever satisfying that condition — adding a redundant `isDefault` prop/check would duplicate a guarantee the schema/seed already provides.
- **`router.refresh()` over client-side list splicing:** on successful delete, `WorkspaceCard` calls `router.refresh()` rather than maintaining a duplicate client-side copy of the membership list. This re-runs the dashboard's existing server-side `listMembershipsForUser` query (already filtered `is_deleted=false` since Plan 04), reusing the RSC/Suspense pattern Plan 03 established rather than introducing new client state to keep in sync.

## Deviations from Plan

### Auto-fixed Issues

**1. [Deviation — Copy correction] Delete-dialog body copy rewritten for the amended soft-delete contract**
- **Found during:** Task 2, reading `01-CONTEXT.md`'s amended D-15 note against the UI-SPEC's stale Copywriting Contract row
- **Issue:** The plan's `<interfaces>` section and the UI-SPEC both carry the pre-amendment delete-dialog copy ("영구적으로 사라지며 되돌릴 수 없습니다" — permanent, irreversible), written before the 2026-08-02 product-owner override that changed workspace delete from hard cascade to soft delete (TRD §3/PRD §3, Plan 04). Shipping the literal plan copy would make a false claim to users.
- **Fix:** Wrote copy consistent with the amended soft-delete semantics (see Decisions Made above), keeping the D-15 re-type-name confirm mechanism intact.
- **Files modified:** `src/components/workspace/DeleteWorkspaceDialog.tsx`
- **Verification:** Flagged explicitly at the Task 3 checkpoint; human confirmed the copy reads correctly and should be kept as-is.
- **Committed in:** `ade3af1`

---

**Total deviations:** 1 (copy-accuracy correction, explicitly flagged and human-approved at the checkpoint — not a silent auto-fix)
**Impact on plan:** No functional/structural change; the D-15 re-type-confirm mechanism, OWNER-only gating, and server-side enforcement are exactly as planned. Only the dialog's body copy was corrected to stay truthful about the already-amended (Plan 04) soft-delete contract.

## Issues Encountered
- Playwright strict-mode collision: an early `workspace-delete.spec.ts` draft asserted `page.getByText(workspaceName)` was not visible after delete, but the same substring also matched inside the (already-closing) `DeleteWorkspaceDialog`'s body paragraph, causing a strict-mode multi-match error. Fixed by asserting `{ exact: true }`, which only matches the card's own `<span>` text. Caught and fixed during this plan's own test-writing, not a pre-existing issue.

## User Setup Required
None — dev server, DB, and env were already provisioned by Plans 01/02/04.

## Checkpoint Verification

Task 3 (`checkpoint:human-verify`, `gate="blocking"`) was reached after Tasks 1-2 committed (dev server started in the background at `http://localhost:3000` against the seeded dev DB). The human walked the full Phase-1 flow — signup → dashboard → reload-persists → create workspace → land on `/w/[newId]` placeholder → card appears as OWNER → delete via re-type dialog → card disappears → default workspace has no delete affordance → non-owner `DELETE` returns 403 → 100-char name backstop — and responded **"approved — E4 create modal, E5 delete dialog (re-type confirm, soft-accurate copy), /w/[wsId] placeholder, and the default-workspace protection (OWNER-gated affordance + server 403) all verified. The soft-delete copy deviation you flagged is confirmed correct — keep it."** No rework was required.

## Known Stubs
None.

## Next Phase Readiness
- Phase 1 is now complete: all 5 plans executed, all 5 ROADMAP success criteria demonstrated end to end at the Task 3 checkpoint.
- `/w/[wsId]` is a deliberate placeholder (D-14) — Phase 4's 3-pane workspace screen will replace its contents; the route itself, its `requireRole(wsId, "VIEWER")` gate, and the URL-param "active workspace" pattern (TRD §11) are the load-bearing parts and do not need to change.
- `Modal`/`ConfirmDialog` are generic and ready for reuse by any future destructive/blocking-decision UI (e.g., folder/document delete confirms in Phase 4) without new component work.
- No blockers. `pnpm build`, `pnpm vitest run` (29/29), and `pnpm exec playwright test` (7/7, full suite) all green.

---
*Phase: 01-auth-workspace-foundation*
*Completed: 2026-08-02*

## Self-Check: PASSED

All 16 created/modified files and both commit hashes (`292653d`, `ade3af1`) verified present on disk / in `git log`.
