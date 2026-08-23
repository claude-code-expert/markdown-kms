# Handoff: markdown-kms 전체 사이트 리디자인 (쿨/웜 테마)

## Overview
markdown-kms(Next.js 15 + CSS Modules 마크다운 워크스페이스)의 전 화면을 하나의 디자인 시스템으로 개편한다.
방향: 절제된 툴 UI, 무채색 기반 + 파랑 accent(다크=보라 유지), IBM Plex 모노스페이스를 메타 정보 전반에 액센트로 사용.
테마는 2축: **light/dark**(기존) × **cool/warm 톤**(신규 — 사이드바 하단 세그먼트로 전환).

## About the Design Files
동봉된 `Redesign Options.dc.html`(+`support.js` 런타임)은 **HTML로 만든 디자인 레퍼런스(목업)**다. 프로덕션 코드로 복사하지 말 것.
할 일은 이 목업의 생김새를 **기존 코드베이스(src/components/** + CSS Modules + var(--token) 체계) 안에서 재현**하는 것.
원칙: 컴포넌트 구조(tsx/props)는 유지하고 **CSS Module 내용과 globals.css 토큰 값만 교체**한다.
브라우저에서 목업을 열면 화면별 목업이 배지 id(1a, 2a~2i)로 구분돼 있다.

## Fidelity
**High-fidelity.** 색상 hex·타이포·간격·radius가 최종값이다. 픽셀 단위로 재현하되, 반복 패턴(버튼/배지/행)은 아래 스펙을 단일 소스로 삼는다.

## 적용 순서 (권장)
1. `tokens.css`의 내용으로 `src/app/globals.css`의 토큰 블록 교체 (+ `data-tone` 속성 지원: theme 쿠키와 같은 방식으로 tone 쿠키를 RSC에서 읽어 `<html data-theme data-tone>` 세팅).
2. 폰트를 DM Sans/DM Mono → **IBM Plex Sans KR / IBM Plex Mono**로 교체(next/font). 레거시 변수명 `--font-ibm-plex-*`가 이제 실제 폰트와 일치하게 됨.
3. 아톰(Button/Input/Card/Modal/ConfirmDialog/Form) CSS Module 교체 → 이후 화면별 모듈.
4. 아이콘은 lucide-react 유지(목업의 아이콘은 lucide 스타일 1.7~1.8 stroke).

## Design Tokens
`tokens.css` 참고(즉시 사용 가능). 요약:
- 쿨 라이트: bg #ffffff / surface #f6f8fa / surface-2 #eceff3 / border #e3e7ec / text #14171c / muted #5c6672 / dim #94a0ae / accent #2e5fe8 / accent-weak #ecf1fe / destructive #d92d20
- 웜 라이트: bg #fdfcfa / surface #f7f5f1 / surface-2 #efece6 / border #e7e2d9 / text #211d16 / muted #6e6759 / dim #a49c8d / accent #3a55c9 / accent-weak #ebeefa / destructive #c93c2b
- 다크: 쿨 #0f1115 계열 + accent #8b7cf6(보라 유지), 웜 #16130f 계열 + accent #a08df2
- radius: 6 / 10 / 14 · spacing: 기존 4배수 유지 · motion: 기존 유지(클릭 = scale(0.98) translateY(1px), 장식 모션 금지)
- 헤더 높이: 64 → **52px** (`--header-h` 참조처 자동 반영)

## 타이포그래피 규칙
- Sans(IBM Plex Sans KR): 본문·라벨·버튼. UI 기본 13px/400, 페이지 제목 17px/700, 섹션 소제목 15px/600.
- **Mono(IBM Plex Mono) 액센트 — 이 시스템의 아이덴티티.** 다음에만 사용:
  - 배지 전부(역할 배지, 저장됨 배지): 10~10.5px/500
  - 브레드크럼(FolderPathPicker), ⌘K kbd, 타임스탬프·상대시간, 문서/폴더 카운트, 글자수
  - 섹션 라벨(예: FOLDERS, 승인 대기 중): 10~11px/600, letter-spacing 0.08em
  - 워드마크 "markdown-kms": 13px/500
  - 에디터 입력(CodeMirror): 12.5~14px/1.75
- 미리보기 렌더: h1 21/700(하단 보더), h2 16/600, 본문 13.5~15px/1.7, 인용 좌측 3px border-strong + muted, 인라인코드 surface-2 알약, 코드블록 code-bg 고정(테마 무관), 체크박스 accent.

## Components (src/components/ui/)
**Button** — variant 유지(primary/secondary/danger).
- primary: bg accent, 흰 글자, border 없음, radius-sm, padding 6~8px 14~16px, 12~13px/500. hover: accent-strong.
- secondary: bg 없음, border 1px var(--border), 글자 muted. hover: surface-2.
- danger: **솔리드 → 아웃라인으로 변경.** bg 없음, border var(--border), 글자 destructive. (모달의 최종 확인 버튼만 솔리드 destructive bg + 흰 글자.)
- disabled: opacity 0.45 + cursor default. 클릭 피드백 기존 transform 유지.

**Input** — border var(--border), 포커스 border-strong→accent 1px + 아웃라인 없음(또는 2px accent 유지 시 offset 0), radius-sm, padding 8px 12px, 13px. error: border destructive + 하단 11px destructive 메시지(자리 미리 확보 유지).

**Card** — bg var(--bg), border 1px var(--border), radius-md(10px). 그림자 없음(랜딩 미니 프리뷰만 예외적으로 0 8px 24px rgba(20,23,28,.07)).

**Modal / ConfirmDialog** — 340px 폭(기존 320 → 340), radius-md, padding 20px, 그림자 0 12px 32px rgba(20,23,28,.14), 백드롭 rgba(15,17,21,.4). 타이틀 14.5px/600, 본문 12.5px/1.6 muted, 버튼 우측 정렬 gap 8px. DraftRecoveryDialog의 "폐기"는 좌측 밑줄 텍스트 링크(destructive).

**배지(공통 패턴)** — mono 10px/500, surface-2 bg + 1px border + muted 글자, radius 999px, padding 2px 8px. 역할 배지는 항상 무채색(기존 원칙 유지). "저장됨" 배지만 accent-weak bg + accent 글자.

**트리 행** — 높이 28px(기존 32 → 28), radius-sm. 체브런 12px dim → 아이콘 15px **accent 고정** → 이름 13px → hover 케밥. 선택: accent-weak bg + accent 글자 + 600. 드래그 타겟 accent-weak, 순환 금지 빨간 틴트 — 기존 동작 유지.

**사이드바** — 폭 236px 기본(48~400 리사이즈, 쿠키 기억 유지). 세로 순서: 검색(⌘K kbd 포함) → FOLDERS 라벨행 + 새폴더/새문서 아이콘버튼(26px 히트, 17px 아이콘) → 트리 → 하단 고정: 휴지통 / 멤버 / **쿨·웜 테마 세그먼트**(기존 다크 토글 자리 — 다크 전환과의 관계는 오너 확인 필요, 목업은 tone 세그먼트로 표현). 활성 링크 accent-weak.

**에디터 툴바** — 높이 40px, bg surface, 상하 border. 버튼 26px, 그룹 사이 1px×16px 구분선. 서식 13종 + 우측 분할/에디터/미리보기 세그먼트(선택 = 흰 bg + 그림자). 누르는 순간만 accent — 토글 상태 없음(기존 동작).

**SaveStatusBar** — 36px, 상단 border. 좌: 저장됨 배지(accent) + mono 타임스탬프(dim), 우: 글자수 mono dim. 저장중=스피너, 실패=destructive+재시도 버튼(기존 3상태 유지).

## Screens (목업 id ↔ 라우트 ↔ 기존 파일)
| id | 라우트 | 비고 |
|---|---|---|
| 1a | /w/[wsId]/d/[docId] | 핵심 화면. 조회 중 문서 상태(수정+삭제). 1b는 동일 화면의 웜 톤 |
| 2a | / | 랜딩. 히어로+미니 프리뷰(그래픽 자산 없이 박스 목업), 기능 4카드 grid, 개설/가입 2단, 쓰는 법 01~04(mono 번호), 클로징 밴드 |
| 2b | /login | 중앙 카드 340px. 에러 자리 미리 확보 |
| 2c | /signup | 이메일 에러 상태 예시 포함 |
| 2d | /invitations/accept | 성공 카드 + 나머지 4분기(만료/사용됨/다른계정/무효) — 5분기 모두 필수 |
| 2e | /dashboard | 680px 컬럼. 카드(이름+역할배지/소유자·생성일/문서·폴더 수/OWNER만 휴지통 아이콘). 신청 버튼 3상태: 신청(accent 아웃라인)/신청됨(disabled)/이미 멤버예요(disabled) + 성공 메시지 줄 |
| 2f | /w/[wsId] | 빈 상태. 새 문서(primary)+새 폴더(secondary) CTA가 바로 보여야 함(US 인수조건) |
| 2g | /w/[wsId]/trash | 편집자 시점: 복원 활성, 완전삭제 disabled+하단 dim 힌트. RestoreRootBanner = 좌측 3px border-strong 안내 톤 |
| 2h | /w/[wsId]/members | 3섹션(승인 대기: ADMIN+만/멤버 목록: 무채색 배지/회원 초대: 초대·✓ 초대 보냄·이미 멤버) |
| 2i | 모달 4종 | DraftRecovery / 삭제 확인 / 저장 완료 / 워크스페이스 삭제(이름 재입력, 불일치 시 삭제 disabled) |

## Interactions & Behavior (변경 없음 — 반드시 유지)
01-OVERVIEW.md의 기능 계약 그대로: 권한별 버튼 존재/disabled 지점, 파괴적 액션 ConfirmDialog, 폼 검증(태그 3개·이름 100자), 툴바 13종+레이아웃 3모드, 사이드바 기능(리사이즈/접기/DnD/컨텍스트 메뉴), 저장 3상태, 새 문서 vs 조회 중 버튼 세트. 시각만 교체한다.

## State Management
기존 그대로. 신규는 tone(cool|warm) 쿠키 하나 — theme 쿠키와 동일 패턴(RSC에서 읽어 html 속성 세팅, 깜빡임 방지).

## Assets
- 아이콘: lucide-react 유지 (search, folder, folder-plus, file-text, file-plus, trash-2, users, link, image, table, check, chevron-*, more-vertical, tag)
- 폰트: IBM Plex Sans KR(400/500/600/700), IBM Plex Mono(400/500) — next/font/google 또는 self-host
- 그래픽 자산 없음(랜딩 프리뷰는 CSS 박스 목업)

## Files
- `tokens.css` — globals.css 교체용 토큰(즉시 사용)
- `Redesign Options.dc.html` + `support.js` — 목업 원본(브라우저에서 열어 참조; 프로덕션 코드 아님)

## 오너 확인 필요(열린 질문)
- 쿨/웜 세그먼트가 기존 라이트/다크 토글을 **대체**인지 **공존**인지(목업은 tone 세그먼트만 표시, tokens.css는 2축 모두 지원)
