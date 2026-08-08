---
phase: 4
slug: documents-autosave-3-pane-workspace
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-08
---

# Phase 4 — Validation Strategy

> 실행 중 피드백 샘플링을 위한 phase별 검증 계약. (RESEARCH §Validation Architecture 기반 시드 — per-task map은 PLAN 생성 후 채워진다.)

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (단위·통합 — 자동저장 훅·seq 가드·document CRUD·trash cascade·RBAC) + Playwright (E2E — 3분할·문서 열기·자동저장 상태바·휴지통) |
| **Config file** | `vitest.config.ts` (environment: node), Playwright config(기존 재사용) |
| **Quick run command** | `pnpm vitest run` |
| **Full suite command** | `pnpm vitest run && pnpm exec playwright test` |
| **Estimated runtime** | ~35초(vitest) + Playwright E2E |

> 핵심 seam(RESEARCH): 자동저장 클라 훅은 **fake timers + mocked fetch**로 단위 검증(1s 디바운스·seq 단조증가·stale 응답 무시). 서버 seq 가드는 통합 테스트(늦게 도착한 옛 seq가 최신 내용 미덮음). 3분할·상태바 전이·휴지통은 Playwright.

---

## Sampling Rate

- **After every task commit:** `pnpm vitest run`
- **After every plan wave:** `pnpm vitest run && pnpm exec playwright test`
- **Before `/gsd-verify-work`:** 전체 스위트 green
- **Max feedback latency:** ~35초(unit), E2E는 wave 경계

---

## Per-Task Verification Map

> PLAN 생성 후 채워진다. 시드 시점 예상 매핑:

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-xx | 01 | 0 | DOC-01 | — | document 스키마·마이그레이션 | unit | `pnpm vitest run tests/document` | ❌ W0 | ⬜ pending |
| 04-xx-xx | — | 1 | DOC-01/EDIT-07 | T-04-IDOR | 자동저장 seq 가드(역순 무시)·상태바 전이 | integration | `pnpm vitest run tests/document/autosave.test.ts` | ❌ W0 | ⬜ pending |
| 04-xx-xx | — | 2 | DOC-02 | T-04-RBAC | 휴지통 cascade 복원·완전삭제(ADMIN) | integration | `pnpm vitest run tests/document/trash.test.ts` | ❌ W0 | ⬜ pending |
| 04-xx-xx | — | 3 | DOC-01 | — | 3분할·문서 열기·자동저장 UI | e2e | `pnpm exec playwright test documents` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/db/schema.ts` — document 테이블 추가(TRD §3 DDL: saved_seq/is_deleted/is_trash_root) + drizzle-kit 마이그레이션. document_tag/document_draft는 제외(Phase 6/5).
- [ ] `tests/document/*.test.ts` — 자동저장 seq 가드·CRUD·trash 실패 테스트 스텁(TDD red)
- [ ] 자동저장 훅 테스트 — fake timers + mocked fetch(stale 응답 무시 assert)

*기존 인프라(Vitest·Playwright·Drizzle·PG16@5433) 설치됨 — 신규 프레임워크 불필요.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 자동저장 상태바 전이 체감(저장 중→저장됨 깜빡임 없음) | EDIT-07 | 실시간 시각 전이·역순 응답 무깜빡임은 사람 눈 확인이 확실 | 실 브라우저서 빠르게 연속 입력→상태바가 저장 중/저장됨만, 옛 상태로 되돌아가는 깜빡임 없어야 |

*나머지는 Vitest(seq 로직)·Playwright(UI 흐름) 자동 검증.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 35s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
