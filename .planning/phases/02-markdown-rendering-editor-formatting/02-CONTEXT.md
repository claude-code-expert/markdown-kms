# Phase 2: Markdown Rendering & Editor Formatting - Context

**Gathered:** 2026-08-02
**Status:** Ready for planning

<domain>
## Phase Boundary

마크다운 저작 능력 자체를 만든다: 서식 플러그인 14종(툴바+문법), 단일 unified 파이프라인(CommonMark 0.31.2 + GFM 3종 정합), 안전한 sanitize, keystroke→미리보기 60ms 라이브 렌더. auth/트리/문서와 **기능적으로 독립**이며 실행 순서상 Phase 1 다음일 뿐이다. 이 Phase는 HOW(서식 동작·삽입 UX·툴바 완성도·호스트 화면)를 명확히 하되 새 기능을 붙이지 않는다.

**In scope:** EDIT-01(헤딩 H1~H4·P, ATX), EDIT-02(Bold·Italic·Strikethrough·Inline Code), EDIT-03(Bullet·Ordered·Task 목록), EDIT-04(Blockquote·언어 지정 Code Block·HR), EDIT-05(Link·Image·Table GFM), EDIT-06(60ms 미리보기 p95, 10,000자), EDIT-08(sanitize XSS 방어 + GFM 태스크 체크박스 렌더). 플러그인 14종 `run(state)` 순수함수, `lib/markdown/` 단일 파이프라인, 기능형 lucide 툴바, `w/[wsId]`의 비영속 2분할 호스트 화면.

**Out of scope (다른 Phase):** 자동저장 seq 가드·상태 바(EDIT-07 = Phase 4), 이미지 업로드(EDIT-09/FR-E6 = Phase 5), 툴바 폴리시 pressed 애니메이션·툴팁 300ms 지연(FR-E7 나머지 = Phase 5), 테마·레이아웃 전환(FR-E11 = Phase 5), 프레젠테이션·TOC(FR-P = Phase 8), 3분할 통합(트리 사이드바+상태 바 = Phase 4), 문서 로드/저장·persistence(Phase 4).

</domain>

<decisions>
## Implementation Decisions

### 호스트 화면 (Phase 2 에디터를 어디에 띄우나)
- **D-P2-01:** Phase 2 에디터+미리보기는 `app/(main)/w/[wsId]` 라우트에 **2분할**(왼쪽 에디터, 오른쪽 미리보기)로 띄운다. Phase 1이 남긴 빈 플레이스홀더(D-14)를 대체한다. — **Reversibility:** costly — Phase 4가 이 자리에 트리 사이드바+하단 상태 바를 둘러 3분할로 확장한다. 되돌리면 Phase 4 레이아웃 통합 지점이 바뀐다.
- **D-P2-02:** 이 화면은 **비영속**이다 — 문서 API가 없으므로(Phase 4) 에디터 내용은 로컬 컴포넌트 상태에만 있고 저장·문서 바인딩은 없다. 새로고침 시 내용 소실이 정상 동작이다. 자동저장·seq 가드·상태 바는 전부 Phase 4.
- **D-P2-03:** 에디터·미리보기는 "풀스크린 2분할"이 아니라 **감쌀 수 있는 조립형 pane 컴포넌트**로 구현한다. Phase 4가 동일 컴포넌트를 트리 사이드바+상태 바로 감싸 3분할화할 수 있어야 재작업이 없다. — **Reversibility:** costly — 레이아웃을 하드코딩하면 Phase 4에서 에디터/미리보기 컴포넌트를 뜯어야 한다.

### 툴바 범위 (P0 동작 vs R2 폴리시 경계)
- **D-P2-04:** Phase 2 툴바 = **기능형 lucide 아이콘 툴바 + 기본 hover 툴팁**. 플러그인 메타(TRD §6 `EditorPlugin.icon: LucideIcon`, `tooltip`)가 이미 아이콘·툴팁을 들고 있어 렌더는 사실상 공짜다. — **Reversibility:** reversible.
- **D-P2-05:** FR-E7 중 **Phase 5(R2)로 미루는 것은 정확히 두 가지뿐**: (1) 클릭 시 pressed 시각 효과(애니메이션), (2) 툴팁의 300ms hover 지연 타이밍. 아이콘 렌더·기본 툴팁·버튼 동작은 Phase 2. — **Reversibility:** reversible. **Note:** lucide 아이콘 자체는 엄밀히 FR-E7(R2)라 이 결정은 R1/R2 경계를 의도적으로 살짝 넘는다(제품 오너 승인). Phase 5는 "무엇이 남았는지"를 이 두 항목으로만 본다.

### 서식 토글 의미 (플러그인 run(state) 계약)
- **D-P2-06:** 서식은 **토글식**으로 동작한다. 이미 적용된 서식을 선택해 재클릭하면 마커를 제거한다(굵게↔해제). — **Reversibility:** reversible.
- **D-P2-07:** **빈 선택** 클릭 시 마커 쌍을 삽입하고 그 사이에 커서를 둔다(예: `**|**`). **헤딩**은 레벨을 교체한다(H1 줄에 H2 클릭 → H2로 대체, 중첩 금지). **다중 줄 선택** 시 목록·헤딩은 줄마다 래핑한다. — **Reversibility:** reversible.
- **D-P2-08:** 위 동작은 각 플러그인 `run(state)`의 **TDD 기대 출력 계약**이다. `tests/editor/*.test.ts`가 빈 선택·부분 선택·중복 적용(토글 해제) 케이스를 구현보다 먼저 단언한다(TRD §10). planner는 이 세 케이스의 정확한 입력/출력 문자열을 각 플러그인마다 명시해야 한다.

### 삽입 요소 UX (링크·이미지·표·코드블록)
- **D-P2-09:** 삽입은 **플레이스홀더 스켈레톤** 방식이다 — 다이얼로그 없이 뼈대 마크다운을 삽입하고 편집할 부분을 선택 상태로 둔다: Link `[텍스트](url)`, Image `![alt](url)`, Table 기본 GFM 표 뼈대. 커서 흐름을 끊지 않는다. — **Reversibility:** reversible — Phase 5 툴바 폴리시 시 다이얼로그로 승격 가능.
- **D-P2-10:** Code Block은 **언어 자리를 비운 fence**를 삽입한다(` ``` ` + 개행). **미리보기 구문 강조(syntax highlighting)는 Phase 2 범위 밖** — 파이프라인은 언어 info string을 class로만 통과시키고 강조 라이브러리(highlight.js/prism 등)를 도입하지 않는다. 강조 추가는 scope creep으로 간주해 후속 Phase에서 별도 검토. — **Reversibility:** reversible.

### Claude's Discretion
- 목록·헤딩 플러그인의 다중 줄 선택 시 정확한 `run(state)` 출력 문자열은 planner가 CodeMirror 6 selection API 관례에 맞춰 확정한다(D-P2-08 계약 범위 안에서).
- 툴바 버튼 배치·그룹핑(헤딩 드롭다운 + 인라인 4 + 목록 3 + 블록 3 + 삽입 3)의 시각 순서는 ui-kit 토큰·UI-SPEC(있을 경우)을 따르되 planner/UI 재량.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 요구사항·해석 확정 (우선순위 순)
- `docs/REQUIREMENT.md` §3.1 (FR-E1~E5, FR-E8) — 서식 요구 원문. FR-E1 헤딩(ATX `#`~`####`), E2 인라인 4, E3 목록 3, E4 블록 3, E5 삽입 3, E8 60ms 미리보기.
- `docs/REQUIREMENT.md` §4 — NFR-1.1(60ms), NFR-3.1(sanitize 미통과 raw HTML 렌더 금지), NFR-5.1(CommonMark 0.31.2 spec 테스트 + GFM 확장 테스트), NFR-5.2(export 무손실).
- `docs/PRD.md` §2 공백 #6·#7·#8 — Phase 2 직결: #7(서식 **버튼 동작 자체는 P0**, lucide·툴팁·pressed는 P1/FR-E7). #6·#8은 자동저장(Phase 4) 배경. **REQUIREMENT와 충돌 시 PRD 우선.**
- `docs/PRD.md` §4 릴리스 경계 — R1(P0)에 FR-E1~E5·E8 포함, R2(P1)에 FR-E6 이미지 업로드·FR-E7 툴바 폴리시. 이 경계가 Phase 2 vs Phase 5 분할의 근거.

### 스택·파이프라인·플러그인·테스트 확정
- `docs/TRD.md` §5 마크다운 파이프라인 — `remark-parse → remark-gfm(취소선·태스크·표만) → remark-rehype(allowDangerousHtml) → rehype-raw → rehype-sanitize(허용 스키마) → rehype-react`. 미리보기·프레젠테이션 공유. 60ms 예산 표(파싱 ≤15ms / 요소생성 ≤10ms / React 커밋 ≤35ms), **측정 전 메모이제이션 금지**.
- `docs/TRD.md` §6 에디터 플러그인 아키텍처 — 14 플러그인 = 헤딩1 + 인라인4 + 목록3 + 블록3 + 삽입3. `EditorPlugin` 인터페이스(id, icon: LucideIcon, tooltip, keymap?, `run(state): TransactionSpec`). 순수함수, 플러그인 간 import 금지, 공유는 `types.ts` + selection 헬퍼만. 툴바·키맵은 `index.ts` 레지스트리가 `view.dispatch(plugin.run(view.state))`로 조립.
- `docs/TRD.md` §10 테스트 전략 — CommonMark 0.31.2 `spec.json`(652 예제) fixture 러너(sanitize **전** 출력으로 비교), GFM 3종 별도 테스트, XSS(`<script>`·`onerror`·`javascript:`) 단위, 플러그인당 테스트 1파일(빈/부분/중복 케이스), Playwright 60ms(10,000자 keystroke 100회 MutationObserver p95). **테스트가 구현보다 먼저 커밋(TDD).**
- `docs/TRD.md` §1 스택 — CodeMirror 6(에디터), unified(remark-gfm + rehype-sanitize), Vitest + Playwright. pnpm 고정.
- `docs/TRD.md` §11 디렉터리 구조 — `components/editor/plugins/`, `lib/markdown/`, `app/(main)/w/[wsId]`.

### 디자인·불변식
- `docs/ui-kit.html` — 디자인 토큰 원천(IBM Plex Sans/Mono, accent `#2563eb`, lucide, 순수 CSS 변수). `preview-host`가 마크다운 렌더 표면 참고. 툴바·미리보기 prose 스타일은 이 토큰 이식. (이 Phase는 UI hint=yes — `/gsd-ui-phase 2`로 UI-SPEC 생성 시 시각 계약이 여기서 파생된다.)
- `CLAUDE.md` (레포 루트) 불변식 — Phase 2 직결 5건: (1) 에디터 서식은 플러그인 1기능 1파일 `run(state)` 순수함수, 플러그인 간 import·DOM 접근 금지. (2) 마크다운 파이프라인은 `lib/markdown/` 단일 원천, GFM 취소선·태스크·표 3종만. (3) sanitize 없는 렌더링 금지, raw HTML은 rehype-sanitize 허용 목록 통과분만. (4) export는 `document.content` 원문 그대로(Phase 6 관련이나 파이프라인 역변환 금지 원칙). (5) 미리보기 p95 ≤ 60ms 예산 초과 전까지 블록 메모이제이션 등 선제 최적화 금지 — 측정 먼저.

### 이월 결정 (Phase 1)
- `.planning/phases/01-auth-workspace-foundation/01-CONTEXT.md` — D-14(`w/[wsId]` = 생성 직후 착지 라우트, Phase 1엔 빈 플레이스홀더)를 D-P2-01이 대체한다.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/` — Button, Card, Modal, Input, Form, ConfirmDialog (+ `.module.css`). 툴바 버튼·삽입 다이얼로그(만약 도입 시)에 재사용 후보. Phase 2는 D-P2-09로 다이얼로그를 안 쓰므로 Modal은 당장 불필요.
- `lucide-react ^1.28.0` — 이미 설치됨. 툴바 아이콘·미리보기 렌더 모두 이 패키지 사용(추가 아이콘 의존성 불필요).
- `docs/ui-kit.html` `preview-host` + CSS 변수 토큰 — 미리보기 prose 스타일·툴바 룩의 이식 원천.

### Established Patterns
- **CSS Modules** — Phase 1 전 컴포넌트가 `*.module.css` 패턴. 에디터·툴바·미리보기도 동일하게.
- **TDD (테스트 선행 커밋)** — Phase 1에서 확립. 에디터 플러그인은 특히 엄격: `tests/editor/bold.test.ts`가 `plugins/bold.ts`보다 먼저 커밋.
- **Vitest / Playwright 분리** — `vitest.config.ts`가 `e2e/**` 제외(Phase 1 P01에서 수정됨). 플러그인 단위는 Vitest, 60ms 측정은 Playwright.

### Integration Points
- `app/(main)/w/[wsId]/page.tsx` — Phase 1 빈 플레이스홀더. Phase 2가 여기에 2분할 에디터+미리보기를 심는다(D-P2-01). Phase 4가 이 자리를 3분할로 확장.
- **신규 의존성** — 파이프라인/에디터 패키지 미설치(현재 `lucide-react`만). Phase 2 첫 작업이 codemirror 6 계열 + unified(remark-parse/remark-gfm/remark-rehype/rehype-raw/rehype-sanitize/rehype-react) 설치. pnpm 고정.

</code_context>

<specifics>
## Specific Ideas

- 툴바 lucide 렌더를 Phase 2로 당기되 Phase 5에 남기는 건 pressed 애니메이션 + 툴팁 300ms 지연 **딱 두 개**로 못박음 — 제품 오너가 R1/R2 경계를 살짝 넘는 것을 의도적으로 승인(D-P2-05).
- 호스트를 독립 샌드박스가 아니라 `w/[wsId]`로 선택 — Phase 4 3분할의 미래 자리를 미리 점유하는 편을 선호. 대신 조립형 pane으로 재작업 방지(D-P2-03).
- 코드블록 구문 강조를 명시적으로 Phase 2에서 배제 — "언어 class만 통과"가 무손실·최소 원칙과 정합(D-P2-10).

</specifics>

<deferred>
## Deferred Ideas

- **미리보기 구문 강조(syntax highlighting)** — 코드블록 언어별 하이라이트(highlight.js/prism 등). Phase 2는 언어 class만 통과. 후속 Phase에서 별도 검토(요구사항 ID 없음, scope creep 방지).
- **툴바 폴리시(pressed 애니메이션 + 툴팁 300ms 지연)** — Phase 5 (FR-E7 나머지).
- **이미지 업로드(커서 위치 삽입)** — Phase 5 (EDIT-09/FR-E6). Phase 2의 Image 삽입은 `![alt](url)` 스켈레톤까지만.
- **자동저장·seq 가드·저장 상태 바** — Phase 4 (EDIT-07). Phase 2 호스트 화면은 비영속.
- **테마·레이아웃(split/에디터전용/미리보기전용) 전환** — Phase 5 (FR-E11).
- **프레젠테이션 모드·TOC** — Phase 8 (FR-P). 단, 파이프라인을 미리보기·프레젠테이션이 공유하도록 `lib/markdown/` 단일 원천으로 짜는 건 Phase 2 불변식.

None deferred outside these — 논의는 Phase 2 범위 안에 머물렀다.

## Research Flags (사용자 결정 아님 — researcher/planner 확인 대상)
- ⚠ 설치된 `rehype-sanitize@6.0.0`의 `defaultSchema` export 실물을 대조한 뒤 sanitize 허용 스키마(`del`·`input[type=checkbox][disabled]`·`table` 계열 확장)를 확정하고 XSS 테스트를 작성한다 (STATE.md Blocker).
- ⚠ CommonMark 0.31.2 `spec.json`(652 예제) fixture 소싱 방법(공식 릴리스 다운로드 vs 패키지)을 planner가 정한다.

</deferred>

---

*Phase: 2-markdown-rendering-editor-formatting*
*Context gathered: 2026-08-02*
