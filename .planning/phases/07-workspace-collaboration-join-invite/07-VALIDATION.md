---
phase: 7
slug: workspace-collaboration-join-invite
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-09
---

# Phase 7 — Validation Strategy

> 실행 중 피드백 샘플링을 위한 phase별 검증 계약. (RESEARCH §Validation Architecture 기반 시드 — per-task map은 PLAN 생성 후 채워진다.)

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (단위·통합 — 토큰 encode/verify·timingSafeEqual·멤버십 편입 트랜잭션·join 승인/거절·회원검색·RBAC) + Playwright (E2E — 멤버 페이지·초대·참여신청·수락 링크) |
| **Config file** | `vitest.config.ts` (environment: node), Playwright config(기존 재사용) |
| **Quick run command** | `pnpm vitest run` |
| **Full suite command** | `pnpm vitest run && pnpm exec playwright test` |
| **Estimated runtime** | ~45초(vitest) + Playwright E2E |

> 핵심 seam(RESEARCH): 토큰 encode/verify는 순수 헬퍼(crypto HMAC·base64url·timingSafeEqual·epoch-ms 직렬화)로 단위 검증 — 위조·만료·재사용·wrong-user 각 거부. 멤버십 편입/승인은 단일 db.transaction 통합(중복 편입·used_at·status 가드). 회원검색 ILIKE, 권한 RBAC. accept 흐름은 RSC(acceptInvitation 직접) — Playwright로 링크 클릭→EDITOR 편입.

---

## Sampling Rate

- **After every task commit:** `pnpm vitest run`
- **After every plan wave:** `pnpm vitest run && pnpm exec playwright test`
- **Before `/gsd-verify-work`:** 전체 스위트 green
- **Max feedback latency:** ~45초(unit), E2E는 wave 경계

---

## Per-Task Verification Map

> PLAN 생성 후 채워진다. 시드 시점 예상 매핑:

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-xx | 01 | 0 | WS-05 | T-07-TOKEN | invitation/join_request 스키마 + 토큰 encode/verify(위조·만료·재사용 거부) | unit | `pnpm vitest run tests/invite` | ❌ W0 | ⬜ pending |
| 07-xx-xx | — | 1 | WS-05 | T-07-ADMIT | 초대 발송(ADMIN·회원검색) + accept 편입(EDITOR·트랜잭션·wrong-user) | integration | `pnpm vitest run tests/invite` | ❌ W0 | ⬜ pending |
| 07-xx-xx | — | 2 | WS-03/04 | T-07-RBAC | 참여 신청(회원) + 승인/거절(ADMIN·편입) | integration | `pnpm vitest run tests/join` | ❌ W0 | ⬜ pending |
| 07-xx-xx | — | 3 | WS-03/04/05 | — | 멤버 페이지·초대·승인·대시보드 신청·수락 링크 UI | e2e | `pnpm exec playwright test collaboration` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/db/schema.ts` — invitation + workspace_join_request 테이블(TRD §3 DDL) + drizzle-kit 마이그레이션
- [ ] `tests/invite/*.test.ts` — 토큰 encode/verify·편입 트랜잭션 실패 테스트 스텁(TDD red)
- [ ] `tests/join/*.test.ts` — 신청·승인/거절 실패 테스트 스텁

*기존 인프라(Vitest·Playwright·Drizzle·PG16@5433·Auth.js/AUTH_SECRET) 설치됨 — 신규 dep 불필요(crypto 내장·mailer 콘솔).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 초대 수락 링크 클릭 → EDITOR 편입 전체 흐름 | WS-05 | 콘솔 로그 링크를 실제로 클릭해 로그인·편입·리다이렉트를 사람이 확인 | ADMIN이 회원 초대 → 서버 콘솔 링크 복사 → 초대받은 계정으로 열기 → 워크스페이스 EDITOR 편입 |
| 멤버 페이지 권한별 노출(VIEWER vs ADMIN) | WS-04 | 역할별 섹션 노출/숨김 육안 | ADMIN은 초대·PENDING 승인 섹션 보임, VIEWER는 멤버 목록만 |

*나머지(토큰 crypto·편입 트랜잭션·신청/승인 로직·검색)는 Vitest 자동 검증.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
