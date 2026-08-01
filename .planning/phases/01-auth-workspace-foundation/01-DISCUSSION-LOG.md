# Phase 1: Auth & Workspace Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-01
**Phase:** 1-auth-workspace-foundation
**Areas discussed:** 가입 폼·비밀번호 정책, 로그인 세션 유지, 로그인 후 착지 화면, 워크스페이스 생성·전환 UX

---

## 가입 폼·비밀번호 정책

### 비밀번호 규칙
| Option | Description | Selected |
|--------|-------------|----------|
| 8자 이상, 복잡도 강제 없음 | NIST 800-63B 현대 권장 — 길이 우선 | ✓ |
| 12자 이상 + 영문·숫자 혼합 | 더 엄격한 사내 기준 | |
| 6자 이상, 규칙 최소 | 데모·내부용 최소 마찰, 보안 약함 | |

### 이메일 인증
| Option | Description | Selected |
|--------|-------------|----------|
| v1 제외 — 가입 즉시 로그인 | AUTH-01 '즉시 로그인' 정합, 메일 인프라 R2에 첫 등장 | ✓ |
| 포함 — 인증 전 제한 | '즉시 로그인' 위배 + Phase 1에 메일 인프라 당겨와야 함 | |

### 가입 폼 필드
| Option | Description | Selected |
|--------|-------------|----------|
| 이메일·비밀번호·이름 3필드 | name 직접 입력, 사이드바·멤버 표시에 바로 사용 | ✓ |
| 이메일·비밀번호 2필드, name=이메일 로컬부 | 마찰 적지만 표시명 어색 | |

**User's choice:** 8자 이상(복잡도 없음) / v1 제외 / 3필드
**Notes:** 셋 다 권장안 채택. 이메일 인증 제외는 AUTH-01 인수조건과 정면 정합.

---

## 로그인 세션 유지

### 세션 유지 기간(maxAge)
| Option | Description | Selected |
|--------|-------------|----------|
| 30일 | Auth.js 기본, 재로그인 마찰 최소 | |
| 7일 | 중간 지점, 주 1회 재로그인 | |
| 24시간 | 짧은 유지, 보안 우선·매일 재로그인 | ✓ |

### '로그인 상태 유지' 방식
| Option | Description | Selected |
|--------|-------------|----------|
| 항상 유지 (체크박스 없음) | 단순·저마찰, 개인 도구 기본 | ✓ |
| remember-me 체크박스 | 선택권 주지만 플로·테스트 복잡도 증가 | |

**User's choice:** 24시간 / 항상 유지
**Notes:** 권장(30일)보다 짧은 24시간 선택 — 보안 우선. remember-me 없이 슬라이딩 갱신(Auth.js 기본) 채택.

---

## 로그인 후 착지 화면

### 기본 워크스페이스 모델
| Option | Description | Selected |
|--------|-------------|----------|
| 단일 공용, 전원 EDITOR | 시드 1행 공용 WS에 전원 EDITOR 합류, 문서 해석과 정합 | ✓ |
| 사용자별 개인 기본 WS | 스키마 'is_default 시드 1행'과 충돌 | |

### 착지 화면 구성
| Option | Description | Selected |
|--------|-------------|----------|
| 사이드바 + 빈 본문 플레이스홀더 | Phase 4 3분할 좌측 이음, 재작업 최소 | |
| 워크스페이스 카드 대시보드 | 카드 목록 랜딩, 3분할 진입 시 교체 | ✓ |
| 최소 — 환영 + WS 이름 텍스트 | 최소 코드, 사이드바 재작업 필요 | |

### 기본 워크스페이스 표시 이름
| Option | Description | Selected |
|--------|-------------|----------|
| 기본 워크스페이스 | 직관적·중립적, 한국어 UI 일관 | ✓ |
| 공용 워크스페이스 | 전원 공유를 이름으로 알림 | |
| Getting Started | 온보딩 느낌 영문명 | |

**User's choice:** 단일 공용(전원 EDITOR) / 카드 대시보드 / "기본 워크스페이스"
**Notes:** 착지는 권장(사이드바 껍데기) 대신 카드 대시보드 선택. AUTH-03 "사이드바" 문구는 Phase 1에서 카드 대시보드로 충족(상시 사이드바는 Phase 4) — CONTEXT D-12에 명시해 verifier 오탐 방지.

---

## 워크스페이스 생성·전환 UX

### 생성 흐름
| Option | Description | Selected |
|--------|-------------|----------|
| 모달 다이얼로그 | 이름 필드 1개, ui-kit 모달 이식 | ✓ |
| 별도 생성 페이지 | 이름 하나엔 과함 | |

### 생성 직후 동작
| Option | Description | Selected |
|--------|-------------|----------|
| 즉시 그 워크스페이스로 진입 | /w/[newId] 이동, 방금 만든 WS 활성화 | ✓ |
| 대시보드에 머물며 카드 추가 | 연속 생성 편하지만 한 번 더 클릭 | |

### 삭제 확인 UX (OWNER 전용)
| Option | Description | Selected |
|--------|-------------|----------|
| 단순 확인 다이얼로그 | Phase 1엔 문서 없어 위험 낮음, 최소 마찰 | |
| 이름 재입력 확인 | GitHub 방식, cascade 비가역에 확실 | ✓ |

**User's choice:** 모달 / 즉시 진입 / 이름 재입력 확인
**Notes:** 삭제는 권장(단순 확인)보다 강한 이름 재입력 선택 — cascade 비가역성에 대한 명시 선호.

## Claude's Discretion
- 로그인 브루트포스 rate-limit / 계정 잠금: researcher·planner 판단.
- 세션 슬라이딩 갱신 주기(updateAge): Auth.js 기본값.
- JWT 세션 전략: Auth.js v5 credentials 제약(스택 잠금, 논의 대상 아님).

## Deferred Ideas
- 가입 신청·초대 메일 → Phase 7
- Google OAuth → Phase 8
- 로그아웃·비밀번호 재설정 UX → 요구사항 ID 없음, 후속 검토
- 상시 폴더 사이드바 → Phase 4
