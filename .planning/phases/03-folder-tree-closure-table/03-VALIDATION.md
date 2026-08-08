---
phase: 3
slug: folder-tree-closure-table
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-08
---

# Phase 3 — Validation Strategy

> 실행 중 피드백 샘플링을 위한 phase별 검증 계약. (RESEARCH §Validation Architecture 기반 시드 — per-task map은 PLAN 생성 후 채워진다.)

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (단위·통합 — closure 연산·RBAC·이름 검증) + Playwright (E2E — 트리 렌더·DnD·인라인 이름변경) |
| **Config file** | `vitest.config.ts` (environment: node), Playwright config (기존 Phase 2 설정 재사용) |
| **Quick run command** | `pnpm vitest run` |
| **Full suite command** | `pnpm vitest run && pnpm exec playwright test` |
| **Estimated runtime** | ~30초 (vitest) + Playwright E2E |

> 핵심 seam(RESEARCH): vitest는 `environment: node`라 jsdom/testing-library 없음 → **트리 렌더·DnD는 Playwright**로 검증, closure SQL 연산·RBAC·검증 로직은 Vitest 통합 테스트. 쿼리 수(재귀 없음·고정 쿼리)는 `postgres` 드라이버 `debug` 콜백으로 SQL statement를 세어 assert.

---

## Sampling Rate

- **After every task commit:** `pnpm vitest run`
- **After every plan wave:** `pnpm vitest run && pnpm exec playwright test`
- **Before `/gsd-verify-work`:** 전체 스위트 green
- **Max feedback latency:** ~30초 (unit), E2E는 wave 경계

---

## Per-Task Verification Map

> PLAN 생성 후 채워진다(각 task의 `<verify><automated>`에서 리프트). 시드 시점 예상 매핑:

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-xx | 01 | 0 | TREE-01/02/03 | — | folder/folder_closure 스키마·마이그레이션 | unit | `pnpm vitest run tests/folder` | ❌ W0 | ⬜ pending |
| 03-xx-xx | — | 1 | TREE-02 | T-03-IDOR | 서브트리/트리 로드 고정 쿼리 수(N+1 없음) | integration | `pnpm vitest run tests/folder/subtree.test.ts` | ❌ W0 | ⬜ pending |
| 03-xx-xx | — | 1 | TREE-03 | — | 사이클(자기 자손 이동) 동일 트랜잭션 거부 | integration | `pnpm vitest run tests/folder/move.test.ts` | ❌ W0 | ⬜ pending |
| 03-xx-xx | — | 2 | TREE-01 | — | 사이드바 트리 렌더·인라인 이름변경·DnD | e2e | `pnpm exec playwright test folder-tree` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/db/schema.ts` — folder + folder_closure 테이블 추가(TRD §3 DDL) + drizzle-kit 마이그레이션
- [ ] `tests/folder/*.test.ts` — closure 연산(생성/이동/삭제 cascade/서브트리) 실패 테스트 스텁(TDD red)
- [ ] 쿼리 수 카운트 헬퍼 — `postgres` 드라이버 `debug` 콜백 기반 (재귀 없음 assert용)

*기존 인프라(Vitest·Playwright·Drizzle·PG16@5433)는 설치돼 있음 — 신규 프레임워크 불필요.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| DnD 드래그 중 유효/거부 드롭 타깃 시각 피드백(accent 아웃라인 vs 금지 커서) | TREE-03 | 시각·커서 상태는 자동 스냅샷보다 사람 눈이 확실 | 폴더를 자기 자손 위로 드래그 → 커서 '금지', 유효 타깃 위 → accent 아웃라인 |

*나머지 트리 동작은 Playwright E2E로 자동 검증.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
