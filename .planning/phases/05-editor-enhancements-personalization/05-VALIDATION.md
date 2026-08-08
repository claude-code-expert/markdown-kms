---
phase: 5
slug: editor-enhancements-personalization
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-08
---

# Phase 5 — Validation Strategy

> 실행 중 피드백 샘플링을 위한 phase별 검증 계약. (RESEARCH §Validation Architecture 기반 시드 — per-task map은 PLAN 생성 후 채워진다.)

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (단위·통합 — magic-byte 스니핑·업로드 검증·draft 1분 컨트롤러·쿠키 헬퍼·복구 비교) + Playwright (E2E — 이미지 업로드 삽입·테마 토글·레이아웃 모드·패널 리사이즈·복구 다이얼로그) |
| **Config file** | `vitest.config.ts` (environment: node), Playwright config(기존 재사용) |
| **Quick run command** | `pnpm vitest run` |
| **Full suite command** | `pnpm vitest run && pnpm exec playwright test` |
| **Estimated runtime** | ~40초(vitest) + Playwright E2E |

> 핵심 seam(RESEARCH): magic-byte 스니핑은 고정 바이트 픽스처로 단위 검증(png/jpeg/gif/webp 통과, 위장 content-type 거부). draft 1분 타이머는 **fake timers**로 단위 검증(입력 있을 때만 발사·upsert). 복구 판단(draft.updated_at>document.updated_at)은 통합. 테마/레이아웃 no-FOUC·리사이즈·업로드 삽입은 Playwright.

---

## Sampling Rate

- **After every task commit:** `pnpm vitest run`
- **After every plan wave:** `pnpm vitest run && pnpm exec playwright test`
- **Before `/gsd-verify-work`:** 전체 스위트 green
- **Max feedback latency:** ~40초(unit), E2E는 wave 경계

---

## Per-Task Verification Map

> PLAN 생성 후 채워진다. 시드 시점 예상 매핑:

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-xx | 01 | 0 | EDIT-11 | — | document_draft 스키마·마이그레이션 | unit | `pnpm vitest run tests/draft` | ❌ W0 | ⬜ pending |
| 05-xx-xx | — | 1 | EDIT-09 | T-05-UPLOAD | 이미지 업로드 magic-byte·크기·EDITOR 게이트·uuid 파일명 | integration | `pnpm vitest run tests/upload` | ❌ W0 | ⬜ pending |
| 05-xx-xx | — | 2 | EDIT-11 | — | draft 1분 upsert·복구 다이얼로그·정식저장 시 삭제 | integration | `pnpm vitest run tests/draft` | ❌ W0 | ⬜ pending |
| 05-xx-xx | — | 3 | EDIT-10/12 | — | 툴바 pressed/300ms·테마/레이아웃/리사이즈 no-FOUC | e2e | `pnpm exec playwright test editor-enhancements` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/db/schema.ts` — document_draft 테이블 추가(TRD §3 DDL: document_id PK, content, updated_at) + drizzle-kit 마이그레이션
- [ ] `tests/upload/*.test.ts` — magic-byte 스니핑·크기·타입 검증 실패 테스트 스텁(TDD red)
- [ ] `tests/draft/*.test.ts` — draft 1분 컨트롤러(fake timers)·복구 비교 실패 테스트 스텁
- [ ] `public/uploads/` 디렉터리 + `.gitignore` 엔트리

*기존 인프라(Vitest·Playwright·Drizzle·PG16@5433) 설치됨 — 신규 프레임워크·의존성 불필요(magic-byte 자체구현).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 다크 테마 첫 로드 no-FOUC(라이트→다크 깜빡임 없음) | EDIT-12 | SSR 하이드레이션 깜빡임은 실 브라우저 육안이 확실 | 다크 설정 후 새로고침 → 흰 화면 플래시 없이 바로 다크 |
| 이미지 업로드 중 placeholder→실제 이미지 전환 체감 | EDIT-09 | 업로드 중 시각 전환은 실제 파일로 확인 | 큰 이미지 업로드 → placeholder 표시 → 완료 시 실제 이미지로 치환 |
| 패널 드래그 리사이즈 부드러움 | EDIT-12 | 드래그 인터랙션은 육안 | split에서 경계 드래그 → 비율 변경·새로고침 유지 |

*나머지(magic-byte·draft 타이머·복구 로직)는 Vitest 자동 검증.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 40s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
