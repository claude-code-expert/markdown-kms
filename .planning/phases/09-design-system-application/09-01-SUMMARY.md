---
phase: 09-design-system-application
plan: 01
subsystem: ui
tags: [css-custom-properties, next-font-local, design-tokens, dracula-theme, dm-sans, playwright]

# Dependency graph
requires:
  - phase: 05-editor-enhancements
    provides: 다크 테마 [data-theme] 배선(cookie 기반 no-FOUC), CSS Modules var(--token) 컴포넌트 패턴
provides:
  - DM Sans/Mono 자체호스팅 폰트 배선(next/font/local, public/fonts)
  - 전역 radius(--radius-sm/md/lg)/motion(--duration-*, --ease-*) CSS 커스텀 프로퍼티
  - Dracula 파생 다크 팔레트([data-theme="dark"] + @media prefers-color-scheme 전면 교체)
  - 6개 UI 프리미티브(Button/Card/Modal/ConfirmDialog/Input/Form)의 토큰 소비 + press 피드백 + squircle 폴백
  - 로그인/회원가입 화면 리스킨 + Google 계속하기 disabled placeholder
affects: [09-02-workspace-main, 09-03-editor-screen]

# Actuals (#2632)
actuals:
  tokens: 4073
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "next/font/local로 자체호스팅 폰트를 배선하되 CSS 변수명(--font-ibm-plex-sans/mono)은 유지 — 소스 폰트만 교체해 09-01 파일 스코프 밖 CSS Modules(PreviewPane/EditorHost)를 건드리지 않음"
    - "라이트 :root 토큰은 무변경, [data-theme=\"dark\"] + @media prefers-color-scheme 이중 블록만 전면 교체 — 05-07의 이중 관리 관례 유지"
    - "@supports (corner-shape: squircle) 점진 향상 — 폴백이 항상 적용되는 표준 border-radius라 미지원 브라우저에 시각 회귀 없음"

key-files:
  created:
    - public/fonts/dm-sans-400.woff2
    - public/fonts/dm-sans-500.woff2
    - public/fonts/dm-sans-600.woff2
    - public/fonts/dm-sans-700.woff2
    - public/fonts/dm-mono-400.woff2
  modified:
    - src/app/globals.css
    - src/app/layout.tsx
    - src/components/ui/Button.module.css
    - src/components/ui/Card.module.css
    - src/components/ui/Modal.module.css
    - src/components/ui/ConfirmDialog.module.css
    - src/components/ui/Input.module.css
    - src/components/ui/Form.module.css
    - src/app/(auth)/login/login-form.tsx
    - src/app/(auth)/login/page.module.css
    - src/app/(auth)/signup/signup-form.tsx
    - src/app/(auth)/signup/page.module.css
    - tests/theme/rsc-cookie.test.ts

key-decisions:
  - "layout.tsx의 폰트 로더를 next/font/google -> next/font/local로 교체하면서 CSS 변수명은 --font-ibm-plex-sans/--font-ibm-plex-mono 그대로 유지(body 참조 및 다른 화면 CSS Modules와 일치 필요, 계획의 재량 조항)"
  - "인증 카드 타이틀 20px -> 16px(Heading), footer 13px -> 14px(Body)로 UI-SPEC Typography 4사이즈 상한에 정렬(계획엔 명시 안 됐지만 UI-SPEC 체커 상한 준수 위해 흡수)"
  - "Google 계속하기 버튼은 Form.module.css의 .submit을 재사용하지 않고 login/signup 각 page.module.css에 .googleButton 신규 클래스로 분리 — Form.module.css는 09-01 파일 스코프(Task 2)에 없어 무수정 유지"

requirements-completed: [AUTH-01, AUTH-02]

coverage:
  - id: D1
    description: "DM Sans/Mono가 public/fonts 자체호스팅으로 로드되고 폰트 404 없음, 전역 radius/motion 8토큰이 globals.css :root에 정의됨"
    requirement: null
    verification:
      - kind: automated_ui
        ref: "pnpm build (fonts resolved, no 404) + grep --radius-sm/--duration-fast/--ease-fluid globals.css"
        status: pass
    human_judgment: false
  - id: D2
    description: "라이트 :root 색상 12개 무변경, 다크 팔레트가 Dracula 파생(#7359f8/#0e0d11)으로 전면 교체되고 구 blue-accent(#3b82f6) 제거"
    requirement: null
    verification:
      - kind: other
        ref: "grep -Fc '#3b82f6' src/app/globals.css == 0; grep -Fc '#7359f8'/'#0e0d11' >= 1"
        status: pass
    human_judgment: false
  - id: D3
    description: "6개 UI 프리미티브가 var(--radius-*) 참조로 전환, Button :active press 피드백(scale(0.98) translateY(1px)), Card/Modal squircle @supports 폴백, 컴포넌트 .tsx 무수정"
    requirement: null
    verification:
      - kind: unit
        ref: "pnpm vitest run (1057/1057 pass, 무회귀)"
        status: pass
      - kind: other
        ref: "grep -REc 'border-radius:[[:space:]]*(4|6|8|10|12)px' src/components/ui/*.module.css == 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "AUTH-01/AUTH-02 회귀 없음 — 가입 즉시 로그인, 새로고침 세션 유지가 리스킨 후에도 동작"
    requirement: "AUTH-01, AUTH-02"
    verification:
      - kind: e2e
        ref: "e2e/login.spec.ts, e2e/signup.spec.ts, e2e/session-persistence.spec.ts — 4/4 pass"
        status: pass
    human_judgment: false
  - id: D5
    description: "Google 계속하기 placeholder가 disabled로 렌더되고 onClick/OAuth 배선 없음, 마케팅 카피 미유입"
    requirement: null
    verification:
      - kind: other
        ref: "grep -REc 'signIn(\"google\"' src/app == 0; grep -REc '400\\+ apps' src/app == 0"
        status: pass
    human_judgment: false
  - id: D6
    description: "시각(타이포·색·반경·모션이 실제로 화면에 의도대로 보이는지) 최종 확인은 브라우저 육안 검증 필요 — 전체 phase 몰아 UAT 방침(prefers-build-all-then-test)에 따라 09-04 이후로 defer"
    verification: []
    human_judgment: true
    rationale: "grep/vitest/e2e는 토큰 배선과 동작 회귀를 증명하지만 실제 다크 대비·squircle 렌더·press 피드백 체감은 육안 확인 필요 — 사용자 지시(2026-08-08)에 따라 전 phase 구현 후 /gsd-verify-work 9로 몰아 검증"

# Metrics
duration: 40min
completed: 2026-08-16
status: complete
---

# Phase 9 Plan 1: Design Token Foundation + Landing Reskin Summary

**DM Sans/Mono 자체호스팅 + 전역 radius/motion 토큰 + Dracula 파생 다크 팔레트를 로그인/회원가입 화면에서 end-to-end 증명(6개 UI 프리미티브 토큰 소비 + AUTH-01/02 무회귀 e2e)**

## Performance

- **Duration:** 40 min
- **Started:** 2026-08-16T00:10:00+09:00
- **Completed:** 2026-08-16T00:19:03+09:00
- **Tasks:** 3
- **Files modified:** 18 (5 신규 폰트 파일 포함)

## Accomplishments
- `docs/design_system/fonts` 5개 woff2를 `public/fonts`로 이식하고 `next/font/local`로 배선(변수명 `--font-ibm-plex-sans/mono` 유지, 소스만 DM Sans/Mono로 교체)
- `globals.css` `:root`에 `--radius-sm/md/lg`, `--duration-fast/standard/slow`, `--ease-fluid/--ease-elastic` 8개 전역 토큰 추가, 라이트 색상/spacing은 무변경
- `[data-theme="dark"]` + `@media prefers-color-scheme` 이중 블록을 Dracula 파생 팔레트(`--accent #7359f8`, `--bg #0e0d11` 등)로 전면 교체, 구 blue-accent(`#3b82f6`) 완전 제거
- Button/Card/Modal/ConfirmDialog/Input/Form 6개 프리미티브의 하드코딩 `border-radius`를 `var(--radius-sm|md)`로 치환, Button `:active`에 `scale(0.98) translateY(1px)` press 피드백, Card/Modal에 `@supports (corner-shape: squircle)` 점진 향상 추가 — 컴포넌트 `.tsx` 무수정
- 로그인/회원가입 폼에 "Google로 계속하기" disabled placeholder 추가(onClick/OAuth 미배선), 기존 `LOGIN_ERROR`/`GENERIC_ERROR` 카피와 `handleSubmit`/`signIn("credentials")` 흐름 100% 유지, AUTH-01/AUTH-02 e2e 4/4 green

## Task Commits

Each task was committed atomically:

1. **Task 1: 폰트 자체호스팅 이식 + globals.css 전역 토큰 + layout.tsx 폰트 스왑 (tracer)** - `1cd3cc3` (feat)
2. **Task 2: 6개 UI 프리미티브 CSS 토큰 스왑 + press 피드백 + squircle 폴백** - `1b076c1` (feat)
3. **Task 3: 랜딩(로그인/회원가입) 화면 리스킨 + Google 계속하기 placeholder + 회귀** - `85d059a` (feat)

## Files Created/Modified
- `public/fonts/dm-sans-{400,500,600,700}.woff2`, `dm-mono-400.woff2` - 자체호스팅 폰트 자산
- `src/app/layout.tsx` - next/font/local 배선(DM Sans/Mono)
- `src/app/globals.css` - 전역 radius/motion 토큰 8개 + 다크 팔레트 전면 교체 + body font-size 14px
- `src/components/ui/{Button,Card,Modal,ConfirmDialog,Input,Form}.module.css` - 토큰 소비 + press 피드백 + squircle 폴백
- `src/app/(auth)/login/login-form.tsx`, `signup/signup-form.tsx` - Google placeholder 버튼 추가
- `src/app/(auth)/login/page.module.css`, `signup/page.module.css` - `.googleButton` 스타일, 타이포 4사이즈 정렬
- `tests/theme/rsc-cookie.test.ts` - `next/font/google` -> `next/font/local` 목 교체

## Decisions Made
- `layout.tsx`의 CSS 변수명(`--font-ibm-plex-sans/mono`)을 그대로 유지한 채 폰트 소스만 DM Sans/Mono로 교체 — `PreviewPane.module.css`/`EditorHost.module.css`(09-01 파일 스코프 밖, 09-03 대상)를 건드리지 않으면서 body 참조 일치 요구를 충족
- 인증 카드 타이틀(20px)과 footer(13px)를 UI-SPEC Typography 4사이즈 상한(Body 14/Label 12/Heading 16/Display 24)에 맞춰 각각 16px(Heading)/14px(Body)로 흡수 — 계획 텍스트에 명시되진 않았으나 체커가 승인한 4사이즈 상한을 위반하지 않기 위한 자연스러운 귀결
- Google 계속하기 버튼 스타일은 `Form.module.css`(Task 2 스코프)를 건드리지 않고 각 화면의 `page.module.css`에 `.googleButton`으로 분리 — Task 3 파일 스코프 준수

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `tests/theme/rsc-cookie.test.ts`의 `next/font/google` mock을 `next/font/local`로 교체**
- **Found during:** Task 1 (layout.tsx 폰트 로더 전환)
- **Issue:** layout.tsx가 `next/font/google`의 `IBM_Plex_Sans/IBM_Plex_Mono`에서 `next/font/local`의 default export(`localFont`)로 바뀌면서, 기존 테스트의 `vi.mock("next/font/google", ...)`가 더 이상 매칭되지 않아 `TypeError: default is not a function`로 4개 테스트가 실패
- **Fix:** mock 대상을 `next/font/local`로 바꾸고 `default: (opts) => ({ variable: opts.variable })`로 재구현
- **Files modified:** tests/theme/rsc-cookie.test.ts
- **Verification:** `pnpm vitest run tests/theme/rsc-cookie.test.ts` 4/4 pass, 전체 스위트 1057/1057 pass
- **Committed in:** 1cd3cc3 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** 계획된 아키텍처 전환(next/font/google → next/font/local)의 필연적 후속 수정. 스코프 확장 없음.

## Issues Encountered
- Task 3 초기 e2e 실행에서 login/signup/session-persistence 4개 테스트가 모두 `/signup?`에 멈춰 실패했다 — 원인은 이전 세션에서 남아있던 좀비 `next-server` 프로세스(2시간 49분 경과, `playwright.config.ts`의 `reuseExistingServer`가 이를 재사용)로, 이번 phase 코드 변경과 무관한 환경 문제였다. 해당 프로세스를 종료하고 `pnpm dev`를 새로 기동해 재실행하니 4/4 green — 코드 수정 없이 환경 재기동만으로 해소.

## Next Phase Readiness
- 토큰 아키텍처(폰트/색/반경/모션)가 랜딩 화면에서 end-to-end 증명됨 — 09-02(워크스페이스 메인)/09-03(에디터)은 동일 전역 토큰을 소비만 하면 됨, 신규 토큰 정의 불필요
- `--heading-text` 다크 토큰은 이번 plan에서 정의는 했으나 어떤 컴포넌트도 아직 참조하지 않음(선택 적용, UI-SPEC 명시 "미적용 시 회귀 아님") — 09-02/09-03에서 heading 요소에 적용할지는 각 plan 재량
- 시각(다크 대비·squircle 렌더·press 피드백 체감) 최종 확인은 `prefers-build-all-then-test` 방침에 따라 전체 phase 완료 후 `/gsd-verify-work 9`로 몰아 검증 예정 — 이번 plan의 자동 검증(vitest/e2e/grep/build)은 전부 green

---
*Phase: 09-design-system-application*
*Completed: 2026-08-16*

## Self-Check: PASSED

- All 9 sampled key files (5 fonts + globals.css + layout.tsx + login-form.tsx + signup-form.tsx) confirmed present on disk.
- All 3 task commit hashes (1cd3cc3, 1b076c1, 85d059a) confirmed present in `git log --oneline --all`.
