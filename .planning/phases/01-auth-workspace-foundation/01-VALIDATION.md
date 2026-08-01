---
phase: 1
slug: auth-workspace-foundation
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-01
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `01-RESEARCH.md` § Validation Architecture. Task IDs are filled by `/gsd-validate-phase` after plans exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 (unit/integration) + Playwright 1.62.1 (E2E) — TRD §1/§10 locked |
| **Config file** | none yet — greenfield; Wave 0 adds `vitest.config.ts` + `playwright.config.ts` |
| **Quick run command** | `pnpm vitest run tests/rbac/matrix.test.ts` (single file, per CLAUDE.md pattern) |
| **Full suite command** | `pnpm vitest run && pnpm exec playwright test` |
| **Estimated runtime** | ~30 seconds (quick) / longer once Playwright E2E lands |

---

## Sampling Rate

- **After every task commit:** Run the single relevant Vitest file for the route/module just touched (e.g. `pnpm vitest run tests/auth/signup.test.ts`)
- **After every plan wave:** Run `pnpm vitest run` (full unit/integration suite)
- **Before `/gsd-verify-work`:** `pnpm vitest run && pnpm exec playwright test` must be green
- **Max feedback latency:** 30 seconds (quick single-file run)

---

## Per-Task Verification Map

> Task IDs are `TBD` until `/gsd-plan-phase` writes the plans; `/gsd-validate-phase` binds each row to a real task. Rows below are requirement-anchored from research.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 1 | AUTH-01 | — | Signup returns session cookie; user immediately authenticated | integration | `pnpm vitest run tests/auth/signup.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | AUTH-01 | — | Full signup → lands on dashboard | e2e | `pnpm exec playwright test e2e/signup.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | AUTH-02 | T-session | Session survives a browser refresh (still authenticated) | e2e | `pnpm exec playwright test e2e/session-persistence.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | AUTH-03 | — | New user auto-joined to default workspace as EDITOR, shown on dashboard | integration + e2e | `pnpm vitest run tests/auth/signup.test.ts -t "default workspace membership"` + `playwright test e2e/dashboard.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | WS-01 | T-privesc | Out-of-role mutation rejected with 403 per matrix | integration | `pnpm vitest run tests/rbac/matrix.test.ts` (4 roles × Phase-1-actionable routes) | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | WS-02 | — | Any member creates a workspace, becomes OWNER | integration | `pnpm vitest run tests/workspace/create.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | WS-02 | T-privesc | Only OWNER can delete (ADMIN/EDITOR/VIEWER → 403) | integration | `pnpm vitest run tests/workspace/delete.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | — (data integrity) | T-orphan | Default-workspace seed is idempotent across repeated runs | unit | `pnpm vitest run tests/db/seed.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | — (data integrity) | T-orphan | Signup transaction atomic (partial failure → no orphan user) | unit | `pnpm vitest run tests/auth/signup-atomicity.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — no test framework config exists yet (greenfield)
- [ ] `playwright.config.ts` — same
- [ ] `tests/rbac/matrix.test.ts` — WS-01 role×route matrix test, committed **before** `lib/rbac.ts` (TRD §10 TDD mandate)
- [ ] `tests/auth/signup.test.ts` — committed **before** the signup route (same mandate)
- [ ] Test-DB strategy — a disposable schema / `DATABASE_URL_TEST` or per-test transactional rollback; decided once in Wave 0, not per-test (every integration test hits Postgres directly). Blocked on local Postgres availability (see research Environment Audit: no local Postgres/Docker; Homebrew fallback `brew install postgresql@16`).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dependency legitimacy sign-off (`next`/`react`/`react-dom`/`typescript`/`next-auth` flagged SUS by too-new heuristic — likely false positive) | — (supply chain) | Package-legitimacy verdict needs human judgement; not a runtime test | Confirm each flagged package resolves to its canonical org repo with expected download volume before install; approve the plan's `checkpoint:human-verify` |

*All functional Phase-1 behaviors have automated verification; the only manual gate is the supply-chain sign-off above.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
