---
phase: 02
slug: markdown-rendering-editor-formatting
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-08
---

# Phase 02 — Security

> phase별 보안 계약: 위협 레지스터, 수용 위험, 감사 이력. 6개 PLAN의 `<threat_model>` 블록에서 레지스터를 구성(`register_authored_at_plan_time: true`)했고, ASVS L1·block_on=high 기준으로 검증했다. 고위험 3건(mitigation)의 mitigation이 코드에 실재함을 L1 grep-depth로 확인 → auditor 생략(short-circuit).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| user-authored markdown → preview render (client) | 공격자 제어 마크다운(script 태그, on* 속성, javascript: URL)이 미리보기가 렌더하는 DOM으로 넘어오는 지점. 이 phase의 1차 신뢰 경계. | 사용자 입력 마크다운(비신뢰) |
| npm registry → local build | 서드파티 패키지가 빌드로 유입(supply-chain 표면). | 패키지 tarball |
| host route entry → render | `app/(main)/w/[wsId]`가 렌더 전 Phase 1 `requireRole` 멤버십 검증으로 게이트됨. | wsId 경로 파라미터 |
| caught render exception → PreviewPane DOM | 렌더 예외 로깅(GAP-6). 예외는 console(dev)로만 가고 DOM으로는 절대 안 감. | 예외 객체(dev 전용) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-02-01 | Tampering / Elevation | markdown → preview XSS (EDIT-08) | high | mitigate | `rehype-sanitize(defaultSchema)`가 파이프라인 종단 스테이지(`src/lib/markdown/pipeline.ts:112,117`). `tests/markdown/sanitize.test.ts`가 script strip·on* 제거·javascript: 무력화 증명(javascript:/onerror/script 12건 assert). PreviewPane은 sanitized React 트리만 렌더(no dangerouslySetInnerHTML). | closed |
| T-02-SC | Tampering | pnpm installs (supply chain) | high | mitigate | RESEARCH §Package Legitimacy Audit가 15개 패키지 검증(OK 또는 11M+ 다운로드 검증 리포지토리). 이후 `remark-breaks@4` 신규 추가(remarkjs 공식·수백만 다운로드 정식 패키지, audit trail 기록). | closed |
| T-02-06 | Elevation of Privilege | host route를 멤버십 없이 렌더 | high | mitigate | `page.tsx:24`가 `requireRole(wsId,"VIEWER")` + notFound() 유지(Phase 1 게이트 재사용). 새 접근제어 표면 없음. | closed |
| T-02-06-02 | Tampering / Elevation (XSS) | gap 수정(02-06)의 markdown → preview 경로 | medium | mitigate | gap 수정은 에디터 플러그인 텍스트 splicing과 catch 로그 1줄만 변경. `src/lib/markdown/schema.ts`(미변경 defaultSchema)·rehype-sanitize 스테이지 미접촉. `tests/markdown/plugin-render.test.ts`가 각 플러그인 출력을 전체 sanitizing 파이프라인에 통과시켜 회귀 시 실패. | closed |
| T-02-05 | Information Disclosure | error fallback이 stripped 내용 유출 | low | mitigate | PreviewPane catch가 고정 error-state 카피 렌더. sanitize-stripped 내용은 조용히 폐기, 사용자에게 재노출 안 함. | closed |
| T-02-06-01 | Information Disclosure | PreviewPane catch-block 로깅 (GAP-6) | low | mitigate | caught error는 `console.error`(dev 진단)로만(`PreviewPane.tsx:35`). 반환 fallback JSX는 고정 일반 메시지, 예외·offending 마크다운·unsanitized 내용을 DOM에 절대 보간 안 함(dangerouslySetInnerHTML=0). | closed |
| T-02-02 | Tampering | 공격자 id/name 통한 DOM clobbering | medium | accept | hast-util-sanitize가 `clobberPrefix: user-content-` 기본 적용(미변경 스키마 커버). 추가 통제 없음. | closed |
| T-02-03 | Denial of Service | 중첩 emphasis 마크다운 통한 ReDoS | low | accept | micromark 토크나이저는 linear-time. 커스텀 regex 파서 hand-roll 금지라 위험 미존재. | closed |
| T-02-04 | Tampering | 플러그인이 raw script/on* 문자열을 doc에 방출 | low | accept | 플러그인은 사용자 텍스트 주위에 마크다운 마커만 방출. 위험 내용은 렌더 시 rehype-sanitize가 strip(T-02-01). 파이프라인 우회 플러그인 없음. | closed |
| T-02-07 | Denial of Service | 병적 10,000자 입력이 60ms 예산 초과 | low | accept | micromark linear-time. 측정된 p95 게이트가 통제. 초과 시 측정 기반 최적화로 대응(선제 아님). | closed |
| T-02-06-03 | Tampering | 플러그인 출력을 파이프라인에 넣는 신규 통합 테스트 | low | accept | 테스트 전용 경로(`tests/markdown/plugin-render.test.ts`). sanitized HTML만 assert, 프로덕션 미실행, 신규 의존성 없음. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-02-01 | T-02-02 | DOM clobbering은 미변경 defaultSchema의 `user-content-` prefix로 이미 커버. 추가 통제 불필요. | product owner | 2026-08-08 |
| R-02-02 | T-02-03, T-02-07 | ReDoS·병적 입력 DoS는 micromark linear-time 특성으로 완화됨. 커스텀 파서 금지 불변식이 위험을 봉쇄. | product owner | 2026-08-08 |
| R-02-03 | T-02-04 | 플러그인은 마크다운 마커만 방출하고 모든 출력이 sanitizing 파이프라인을 통과. 우회 경로 없음. | product owner | 2026-08-08 |
| R-02-04 | T-02-06-03 | 테스트 전용 경로로 프로덕션에 실리지 않음. | product owner | 2026-08-08 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-08 | 11 | 11 | 0 | gsd-secure-phase (short-circuit, L1 grep-verified) |

- 고위험 3건(T-02-01·T-02-SC·T-02-06) mitigation을 코드에서 직접 확인: rehype-sanitize 종단 스테이지 + sanitize.test.ts, `requireRole(wsId,"VIEWER")` page.tsx:24, no dangerouslySetInnerHTML.
- post-plan 의존성 추가 `remark-breaks@4`(단일 개행→`<br>`, changelog 2026-08-02 기록): remarkjs 공식 org 패키지·수백만 다운로드 → supply-chain low, block_on=high 미달로 비차단.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-08
