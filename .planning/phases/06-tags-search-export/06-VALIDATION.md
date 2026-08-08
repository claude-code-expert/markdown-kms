---
phase: 6
slug: tags-search-export
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-08
---

# Phase 6 — Validation Strategy

> 실행 중 피드백 샘플링을 위한 phase별 검증 계약. (RESEARCH §Validation Architecture 기반 시드 — per-task map은 PLAN 생성 후 채워진다.)

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (단위·통합 — 태그 3제한 트랜잭션·NFC 정규화·검색 쿼리·zip 엔트리 sanitize·export 원문) + Playwright (E2E — 태그 입력·검색·다운로드) |
| **Config file** | `vitest.config.ts` (environment: node), Playwright config(기존 재사용) |
| **Quick run command** | `pnpm vitest run` |
| **Full suite command** | `pnpm vitest run && pnpm exec playwright test` |
| **Estimated runtime** | ~45초(vitest) + Playwright E2E |

> 핵심 seam(RESEARCH): 태그 3제한은 단일 db.transaction(DELETE→INSERT→COUNT→throw) 통합 검증. NFC는 순수 헬퍼(normalize NFC)로 단위 검증 + 저장/질의 양쪽 적용. 검색은 pg_trgm ILIKE 통합(한국어 NFC/NFD 매칭). export 원문은 파이프라인 미경유 바이트 동일 assert. zip 엔트리명 sanitize(zip-slip) 순수 단위.

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
| 06-01-xx | 01 | 0 | DOC-03/04 | — | document_tag + pg_trgm custom 마이그레이션 + NFD 백필 | unit | `pnpm vitest run tests/tags` | ❌ W0 | ⬜ pending |
| 06-xx-xx | — | 1 | DOC-03 | T-06-TAGCAP | 태그 3제한 단일 트랜잭션(4번째 400)·EDITOR | integration | `pnpm vitest run tests/tags/replace.test.ts` | ❌ W0 | ⬜ pending |
| 06-xx-xx | — | 2 | DOC-04 | T-06-SQLI | 검색 NFC·pg_trgm ILIKE·파라미터 바인딩·VIEWER | integration | `pnpm vitest run tests/search` | ❌ W0 | ⬜ pending |
| 06-xx-xx | — | 3 | EXP-01/02 | T-06-ZIPSLIP | md 원문 그대로·zip 구조보존·엔트리 sanitize | integration | `pnpm vitest run tests/export` | ❌ W0 | ⬜ pending |
| 06-xx-xx | — | 4 | DOC-03/04 | — | 태그 입력·검색·export UI | e2e | `pnpm exec playwright test tags-search-export` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/db/schema.ts` — document_tag 테이블(TRD §3: document_id+tag PK) + **custom SQL 마이그레이션**(CREATE EXTENSION pg_trgm + GIN gin_trgm_ops 인덱스 — drizzle-kit `--custom`, 손검증) + 기존 행 NFC 백필 UPDATE
- [ ] `tests/tags/*.test.ts` — 3제한 트랜잭션 실패 테스트 스텁(TDD red)
- [ ] `tests/search/*.test.ts` — NFC 정규화·pg_trgm 매칭 실패 테스트 스텁
- [ ] `tests/export/*.test.ts` — 원문 동일·zip 구조·sanitize 실패 테스트 스텁
- [ ] `pnpm add archiver` + `pnpm add -D @types/archiver` (TRD 잠금 신규 dep, 검증 OK)

*기존 인프라(Vitest·Playwright·Drizzle·PG16@5433) 설치됨.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 한국어 검색 실체감(NFC/NFD 입력 모두 매칭) | DOC-04 | 실제 IME 조합(NFC)과 붙여넣기(NFD 가능) 입력을 사람이 확인 | IME로 '한글' 태그·본문 → 검색창에 '한글' → 결과 나옴 |
| 폴더 .zip 다운로드 구조 확인 | EXP-02 | 실제 다운로드·압축 해제 후 폴더 계층 육안 | 폴더 .zip 내보내기 → 압축 해제 → 하위 폴더/문서 구조 보존 |

*나머지(3제한·원문·sanitize·쿼리)는 Vitest 자동 검증.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
