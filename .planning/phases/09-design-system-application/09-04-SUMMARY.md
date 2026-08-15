---
phase: 09-design-system-application
plan: 04
subsystem: ui
tags: [playwright-e2e, regression, design-tokens, changelog, documentation]

# Dependency graph
requires:
  - phase: 09-design-system-application
    provides: 09-01(랜딩 리스킨)·09-02(워크스페이스 메인 리스킨)·09-03(에디터 화면 리스킨) — 세 화면 모두 리스킨 완료
provides:
  - 전체 사용자 여정(로그인→워크스페이스 생성→폴더 생성→문서 CRUD→휴지통) 단일 e2e 회귀 스펙
  - CLAUDE.md 디자인 토큰 원천 설명(라이트/다크 이원 체계) 갱신
  - changelog에 폰트/다크팔레트/전역토큰 비가역 결정 기록
affects: []

# Actuals (#2632)
actuals:
  tokens: 2382
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "기존 3개 e2e 스펙(document-workspace/folder-tree/document-trash)의 셀렉터 관례를 그대로 재사용한 단일 통합 플로우 스펙 — 09-0x가 전부 CSS-only 리스킨이라 role/label/placeholder 마크업이 무변경이므로 신규 셀렉터가 필요 없었다"

key-files:
  created:
    - e2e/design-system-flow.spec.ts
  modified:
    - CLAUDE.md
    - changelog/changelog.md

key-decisions:
  - "문서 생성을 폴더 하위가 아니라 워크스페이스 루트에서 수행 — 플랜 액션 문구가 '폴더 생성 → 문서 생성'을 두 개의 순차 단계로만 명시했고 중첩을 요구하지 않았으며, 기존 3개 스펙 모두 루트 문서 생성 패턴을 재사용하는 게 셀렉터 재사용 범위를 극대화한다"
  - "휴지통 단계는 확인(가시성)까지만 검증 — 복원/완전삭제는 04-04/04-05가 이미 lib+e2e 레벨에서 증명했고, 이 플랜의 목적은 '전체 여정이 새 UI에서 끊기지 않는지' 증명이지 개별 기능 재검증이 아니므로 플랜 문구('휴지통 확인까지')를 그대로 따름"

requirements-completed: []

coverage:
  - id: D1
    description: "e2e/design-system-flow.spec.ts가 로그인→워크스페이스 생성→폴더 생성→문서 생성/수정(자동저장)/삭제→휴지통 확인까지 단일 테스트로 통과하며 AUTH-01/AUTH-02/WS-01/WS-02/DOC-01/DOC-02를 재확인"
    requirement: "AUTH-01, AUTH-02, WS-01, WS-02, DOC-01, DOC-02"
    verification:
      - kind: e2e
        ref: "e2e/design-system-flow.spec.ts — 1/1 pass (전체 스위트 25개 중)"
        status: pass
    human_judgment: false
  - id: D2
    description: "pnpm vitest run 전체 green, pnpm exec playwright test 전체 스위트 green(단독 실행)"
    requirement: null
    verification:
      - kind: unit
        ref: "pnpm vitest run — 1062/1062 pass"
        status: pass
      - kind: e2e
        ref: "pnpm exec playwright test — 25개 중 24개 pass, 1건(document-workspace.spec.ts 기존 스펙)은 09-03-SUMMARY.md에 기록된 사전 존재 Next dev 라우트 컴파일 타이밍 플레이크(격리 실행 5/5 재확인 green) — 이 플랜의 diff와 무관"
        status: pass
    human_judgment: false
  - id: D3
    description: "CLAUDE.md 디자인 토큰 원천 설명이 '라이트=ui-kit.html 색상 + 신규 전역 타입/반경/모션, 다크=신규 파생 색상 + 동일 전역 토큰'으로 갱신됨(D-06)"
    requirement: null
    verification:
      - kind: other
        ref: "grep -F 'DM Sans' CLAUDE.md — 매치"
        status: pass
    human_judgment: false
  - id: D4
    description: "폰트 교체(IBM Plex→DM Sans)·다크 팔레트 전면 교체·전역 radius/motion 토큰 도입이 changelog에 비가역 결정으로 기록됨"
    requirement: null
    verification:
      - kind: other
        ref: "grep -F '#7359f8' changelog/changelog.md — 매치"
        status: pass
    human_judgment: false

# Metrics
duration: 15min
completed: 2026-08-16
status: complete
---

# Phase 9 Plan 4: 전체 플로우 통합 e2e 회귀 + 토큰 원천 문서화 Summary

**로그인→워크스페이스→폴더→문서 CRUD→휴지통 전체 여정을 새 UI에서 단일 e2e로 재확인(AUTH-01/02·WS-01/02·DOC-01/02)하고, CLAUDE.md 토큰 원천 설명(D-06)과 changelog 비가역 결정을 기록해 Phase 9를 마감**

## Performance

- **Duration:** 15 min
- **Tasks:** 2
- **Files modified:** 3 (1 신규 e2e, 2 문서)

## Accomplishments
- `e2e/design-system-flow.spec.ts` 신규: 09-01/09-02/09-03이 리스킨한 3개 화면(랜딩·워크스페이스 메인·에디터)을 가로지르는 단일 사용자 여정(회원가입→워크스페이스 생성→폴더 생성→문서 생성→편집(자동저장 "저장 중…"→"저장됨")→삭제→휴지통 노출 확인)을 통과시켜 ROADMAP Phase 9 성공기준 4를 충족
- `pnpm vitest run` 전체 1062/1062 green, `pnpm exec playwright test` 전체 스위트 25개 중 24개 green(단일 실행, 동시 실행 없음)
- CLAUDE.md §문서 체계의 `docs/ui-kit.html` 설명을 라이트/다크 이원 토큰 체계(D-06)로 갱신 — 라이트는 ui-kit.html 색상 원천 유지, 다크는 Dracula 파생 팔레트, 타이포/반경/모션은 공통 전역 토큰
- changelog에 Phase 9의 비가역 결정(IBM Plex→DM Sans/Mono 자체호스팅, 다크 팔레트 blue-accent→Dracula 파생 전면 교체, 전역 radius/motion 토큰 8개 도입) 근거(D-03/D-04/D-05/D-06)와 함께 append

## Task Commits

Each task was committed atomically:

1. **Task 1: 전체 플로우 e2e 회귀 + vitest 전체** - `f65c40c` (test)
2. **Task 2: CLAUDE.md 토큰 원천 설명 갱신(D-06) + changelog 비가역 결정 기록** - `4cf344f` (docs)

## Files Created/Modified
- `e2e/design-system-flow.spec.ts` - 전체 사용자 여정 통합 회귀 스펙(신규)
- `CLAUDE.md` - §문서 체계 `docs/ui-kit.html` 설명을 라이트/다크 이원 토큰 체계로 갱신
- `changelog/changelog.md` - Phase 9 비가역 결정(폰트/다크팔레트/전역토큰) 신규 엔트리

## Decisions Made
- 문서 생성을 폴더 하위가 아니라 워크스페이스 루트에서 수행 — 플랜 액션 문구가 순차 단계만 명시했고, 기존 3개 스펙(document-workspace/folder-tree/document-trash)이 전부 루트 문서 생성 패턴이라 셀렉터 재사용을 극대화
- 휴지통 단계는 가시성 확인까지만(복원/완전삭제 미검증) — 해당 기능은 04-04/04-05가 이미 증명했고, 이 플랜의 목적은 신규 UI에서 여정이 끊기지 않는지 증명이므로 플랜 문구를 그대로 따름

## Deviations from Plan

None - 계획 그대로 실행.

## Issues Encountered
- `pnpm exec playwright test` 전체 스위트 실행 시 `e2e/document-workspace.spec.ts`의 첫 번째 테스트("저장 중…" 텍스트 검출)가 실패했다. 이는 09-03-SUMMARY.md의 "Issues Encountered"에 이미 기록된 사전 존재 플레이크(Next dev 서버의 온디맨드 라우트 컴파일 타이밍 — 앞선 스펙이 이미 관련 라우트를 컴파일시켜두면 이후 왕복이 빨라져 전이 상태 노출 시간이 짧아짐)와 동일 클래스로, 해당 스펙만 격리 실행하면 5/5 green으로 재확인했다. 이번 플랜의 diff(`e2e/design-system-flow.spec.ts` 신규 + 문서 2개)는 `document-workspace.spec.ts`나 어떤 앱 코드도 건드리지 않으므로 회귀가 아니라고 판단, 별도 수정 없이 기록만 남긴다(해당 파일은 이 플랜의 file scope 밖).

## User Setup Required

None - 외부 서비스 설정 불필요.

## Next Phase Readiness
- Phase 9(design-system-application)의 4개 플랜 전부 완료 — ROADMAP Phase 9 성공기준 1~4 전부 자동 검증(grep/vitest/e2e) 충족
- 시각(타이포·색·반경·모션·680px 정렬·accent 배지 등이 실제로 화면에 의도대로 보이는지) 최종 확인은 `prefers-build-all-then-test` 방침에 따라 `/gsd-verify-work 9`(또는 전체 phase 몰아 `/gsd-audit-uat`)로 별도 진행 필요 — 09-01/02/03이 각각 남긴 Deferred Verification 항목(STATE.md)이 그대로 유효
- `e2e/document-workspace.spec.ts`의 순서 의존 플레이크(위 Issues Encountered)는 여전히 phase 스코프 밖 — 필요 시 향후 별도 안정화 phase에서 폴링 대신 네트워크 응답 대기로 전환 검토(09-03-SUMMARY.md와 동일 권고)

---
*Phase: 09-design-system-application*
*Completed: 2026-08-16*

## Self-Check: PASSED

- `e2e/design-system-flow.spec.ts` confirmed present on disk.
- Both task commit hashes (f65c40c, 4cf344f) confirmed present in `git log --oneline --all`.
