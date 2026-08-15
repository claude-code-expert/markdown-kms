# Phase 9: Design System Application - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-15
**Phase:** 09-design-system-application
**Areas discussed:** 디자인 소스 성격(선행 발견), ui-kit.html 관계, 워크스페이스 메인 라우트/카드, 에디터 사이드바 범위

---

## 디자인 소스 성격 (선행 발견 — 표준 4개 영역 앞에 긴급 확인)

`docs/design_system/`를 코드베이스 스카우트 단계에서 조사한 결과, draculatheme.com에서 그대로 추출된 킷(카피·이미지·브랜드 보이스 포함)임을 확인 — 표준 영역 선택 전에 먼저 확인 필요 판단.

| Option | Description | Selected |
|--------|-------------|----------|
| 토큰만 추출 | 색상·타이포·반경·모션만 이식, 카피/이미지는 markdown-kms 자체로 교체 | ✓ |
| 있는 그대로 이식 | DESIGN-HANDOFF.md 지침대로 카피·이미지까지 보존 | |

**User's choice:** 토큰만 추출
**Notes:** DESIGN-HANDOFF.md의 "실제 카피·이미지 보존" 지침은 원 사이트(draculatheme.com) 자체 복제를 전제로 쓰인 것이라 markdown-kms 리스킨에는 적용하지 않기로 함.

---

## 기존 ui-kit.html과의 관계

| Option | Description | Selected |
|--------|-------------|----------|
| 다크를 기본값으로 전환 | prefers-color-scheme 무관 다크 시작, Dracula 팔레트 의도와 일치 | |
| 라이트를 기본값으로 유지 | 현재처럼 라이트 기본, `[data-theme=dark]`에만 신규 팔레트 | ✓ |

**User's choice:** 라이트를 기본값으로 유지
**Notes:** 기존 사용자 경험(Phase 5 테마 토글) 보존이 우선.

### 타입/반경/모션 전역 여부 (같은 영역, 후속 질문)

| Option | Description | Selected |
|--------|-------------|----------|
| 전역 교체 | DM Sans/DM Mono·squircle 반경·모션 타이밍을 라이트/다크 공통 적용, 색상만 테마별 | ✓ |
| 색상만 교체 | 타입/반경/모션은 기존(IBM Plex·기존 radius) 유지 | |

**User's choice:** 전역 교체
**Notes:** "새 룩" 체감을 위해 타이포·모션까지 일관 적용하기로 함.

---

## 워크스페이스 메인 라우트/구성

| Option | Description | Selected |
|--------|-------------|----------|
| /dashboard 유지 | 기존 라우트, 구조 이미 와이어프레임과 일치 | ✓ |
| /workspaces로 rename | 와이어프레임 캡션 문자 그대로 따름, 회귀 범위 확대 | |

**User's choice:** /dashboard 유지

### 카드 정보 범위 (같은 영역, 후속 질문)

| Option | Description | Selected |
|--------|-------------|----------|
| 실제 조회 가능한 데이터만 | 소유자/생성일/문서·폴더개수는 DB 확장, 공개배지는 스킵(스키마 없음) | ✓ |
| 이름+역할배지만, 시각만 재작업 | 신규 데이터 필드 추가 없음 | |

**User's choice:** 실제 조회 가능한 데이터만
**Notes:** 사용자가 처음 요청에서 "구성을 따라서 데이터를 조회한 뒤 리스팅"이라 명시 — 하드코딩 금지 확인.

---

## 에디터 사이드바 구성요소 범위

| Option | Description | Selected |
|--------|-------------|----------|
| 순수 스타일링만 | 기존 FolderTree 구조 유지, 폰트/색/반경/간격만 재작업 | ✓ |
| 신규 UI 요소까지 구현 | "전체 문서"/"미분류 문서" 고정뷰 + 정렬/추가 버튼까지 신규 구현 | |

**User's choice:** 순수 스타일링만
**Notes:** 신규 필터링/정렬 기능은 스코프 확대이므로 이번 phase 밖으로 明시적 분리, Deferred Ideas에 기록.

---

## Claude's Discretion

- 정확한 색상 hex 매핑, 타이포 스케일 세부 수치, squircle 폴백 구현, 모션 적용 범위, 랜딩 페이지 카피 문구, 3화면 컴포넌트 분해 — 코드베이스 관례 따라 재량.

## Deferred Ideas

- 워크스페이스 카드 "공개" 배지 — 공개/비공개 워크스페이스 개념이 스키마에 없어 신규 기능, 스코프 밖.
- 에디터 사이드바 "전체 문서"/"미분류 문서" 고정 항목 + 정렬(↕)/추가(＋) 버튼 — 신규 필터링/정렬 기능, 스코프 밖.
- Google OAuth 실연동 — Phase 8 descope 결정 유지.
- `docs/design_system`의 카피·이미지·Dracula 브랜딩 — 사용하지 않음.
