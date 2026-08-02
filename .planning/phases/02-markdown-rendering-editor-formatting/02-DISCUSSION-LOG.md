# Phase 2: Markdown Rendering & Editor Formatting - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-02
**Phase:** 2-markdown-rendering-editor-formatting
**Areas discussed:** 호스트 화면, 툴바 범위, 서식 토글 의미, 삽입 UX

---

## 호스트 화면

| Option | Description | Selected |
|--------|-------------|----------|
| 독립 샌드박스 라우트 | 예: /editor-sandbox, 임시 상태·서버 저장 없음. Playwright 60ms 측정·수동 UAT 가능, Phase 4 3분할과 격리, throwaway | |
| w/[wsId] 플레이스홀더에 임시 2분할 | Phase 1 빈 플레이스홀더에 에디터+미리보기 임시 삽입. Phase 4가 어차피 여기 3분할을 만들어 재작업 위험 | ✓ |
| 컴포넌트+테스트만 | 라우트 없이 컴포넌트+Vitest만. 가장 적지만 시각 UAT·60ms Playwright 측정 불가 | |

**User's choice:** w/[wsId] 플레이스홀더에 임시 2분할
**Notes:** 미래의 3분할 자리를 미리 점유하는 편을 선호. Claude가 재작업 위험을 지적 → 파생 결정으로 "조립형 pane 컴포넌트로 구현해 Phase 4가 감싸도록"(D-P2-03), "문서 API 없으므로 비영속·저장은 Phase 4"(D-P2-02)를 확정.

---

## 툴바 범위

| Option | Description | Selected |
|--------|-------------|----------|
| lucide 아이콘 툴바 + 동작 | 플러그인 메타(TRD §6)가 이미 icon 보유해 렌더는 공짜. pressed 애니메이션·툴팁 300ms 지연만 Phase 5. 엄밀히 lucide는 FR-E7(R2)라 경계를 살짝 넘음 | ✓ |
| 최소 텍스트 버튼 툴바 | 글자 라벨 버튼만(아이콘 없음), 동작만 P0. lucide·툴팁·pressed 전부 Phase 5. R1/R2 경계 가장 깔끔하나 툴바가 벋벋 | |
| 문법 입력만, 툴바 통째 Phase 5 | 키보드 마크다운 문법만. ✗ PRD 공백#7·SC#1 위반 | |

**User's choice:** lucide 아이콘 툴바 + 동작
**Notes:** Phase 5로 미루는 범위를 pressed 애니메이션 + 툴팁 300ms 지연 두 항목으로만 못박음(D-P2-05). R1/R2 경계를 의도적으로 살짝 넘는 것을 승인.

---

## 서식 토글 의미

| Option | Description | Selected |
|--------|-------------|----------|
| 토글식 | 적용된 서식 재클릭=마커 제거, 빈 선택=마커 삽입 후 사이 커서, 헤딩=레벨 교체. 일반 에디터 관례, TRD §10 '중복 적용' 테스트와 정합 | ✓ |
| 가산식(항상 삽입) | 재클릭 시 마커 중첩(****굵게****). 단순하나 어색 | |
| You decide | planner가 CodeMirror 관례로 결정 | |

**User's choice:** 토글식
**Notes:** 이 동작이 각 플러그인 run(state)의 TDD 기대 출력 계약이 됨(D-P2-08). planner가 빈/부분/중복 케이스의 정확한 입출력 문자열을 플러그인마다 명시해야 함.

---

## 삽입 UX

| Option | Description | Selected |
|--------|-------------|----------|
| 플레이스홀더 스켈레톤 | [텍스트](url)·![alt](url)·기본 GFM 표 뼈대 삽입 후 편집부 선택. 다이얼로그 불필요·커서 흐름 유지. 코드블록=언어 자리 빈 fence, 미리보기 구문 강조는 Phase 2 범위 밖 | ✓ |
| 다이얼로그 입력 | URL/alt/표 크기를 기존 Modal 재사용해 모달로 수집. 정확하나 구현·테스트 비용↑, 커서 흐름 끊김 | |
| You decide | planner가 결정, 구문 강조 포함 여부도 위임 | |

**User's choice:** 플레이스홀더 스켈레톤
**Notes:** 코드블록 미리보기 구문 강조(syntax highlighting)를 Phase 2에서 명시적으로 배제 — 언어 class만 통과, 강조 라이브러리 미도입(D-P2-10). 강조 추가는 scope creep으로 후속 검토.

---

## Claude's Discretion

- 목록·헤딩 플러그인의 다중 줄 선택 시 정확한 run(state) 출력 문자열 (D-P2-08 계약 범위 안에서 planner 확정)
- 툴바 버튼 배치·그룹핑의 시각 순서 (ui-kit/UI-SPEC 따르되 planner·UI 재량)

## Deferred Ideas

- 미리보기 구문 강조 — 후속 Phase (요구사항 ID 없음)
- 툴바 폴리시(pressed 애니메이션 + 툴팁 300ms 지연) — Phase 5 (FR-E7 나머지)
- 이미지 업로드 — Phase 5 (EDIT-09/FR-E6)
- 자동저장·seq 가드·저장 상태 바 — Phase 4 (EDIT-07)
- 테마·레이아웃 전환 — Phase 5 (FR-E11)
- 프레젠테이션·TOC — Phase 8 (FR-P)

### Research Flags (not user decisions)
- rehype-sanitize@6.0.0 defaultSchema 실물 대조 후 sanitize 스키마·XSS 테스트 확정 (STATE.md Blocker)
- CommonMark 0.31.2 spec.json(652 예제) fixture 소싱 방법 planner 결정
