# 리디자인 페이지 분석 — 쿨 테마 우선 적용

`docs/claude_design/README.md` + `tokens.css` + `Redesign Options.dc.html`(목업 원본, 1a/1b/2a~2i)을 현재 코드베이스와 대조한 결과다. **이번 스코프는 쿨 테마(라이트+다크)만이다 — 웜 톤은 `tokens.css`에 이미 값이 있지만 나중에 진행.** 1a(쿨)를 기준 삼아 2 시리즈(랜딩~모달) 전 화면에 동일 토큰·컴포넌트 규칙을 적용한다. 기능은 그대로, 시각만 바꾼다는 원칙은 README §"Interactions & Behavior"와 동일하게 유지.

---

## 0. 먼저 결정해야 하는 것 (구현 착수 전 확인 필요)

목업을 코드와 대조하다 보니 "시각만 바꾸면 되는 것"과 "신규 마크업·상태·인프라가 필요한 것"이 섞여 있다. 후자는 조용히 끼워 넣지 않고 먼저 확인받는 게 맞다고 판단했다.

### 0-1. 쿨/웜 세그먼트가 기존 라이트/다크 토글을 대체하는가, 공존하는가

**결정(오너, 2026-08-17): 대체.** 사이드바 하단 자리를 톤(쿨/웜) 세그먼트가 차지하고, 라이트/다크 수동 토글은 제거 — `prefers-color-scheme`만 따른다. `ThemeToggle.tsx`는 `ToneToggle.tsx`로 교체(다크 전환 로직 없이 tone 쿠키만 쓰는 세그먼트 버튼). `theme` 쿠키/`[data-theme]` 자체는 남아있되(다크 팔레트 값은 여전히 필요), 그 값을 사용자가 수동으로 못 바꾸게 되므로 RSC가 `theme` 쿠키를 쓰는 로직은 제거하고 `@media (prefers-color-scheme: dark)`만 남긴다(`layout.tsx`의 no-FOUC 쿠키 읽기 코드 정리 필요 — 쿠키 자체를 안 쓰므로).

### 0-2. 목업에 있지만 지금 코드엔 없는 기능성 요소 — 이번에 같이 넣을지

아래 5가지는 CSS Module 값 교체로 안 끝난다. 확인한 근거(코드 직접 읽음)와 함께 정리했다.

| 항목 | 목업 위치 | 현재 상태 | 필요한 작업 |
|---|---|---|---|
| **아바타(이니셜 원형 배지)** | 헤더 우측("김"), 멤버 목록 각 행("김"/"박"/"최"/"이") | `SiteHeader.tsx`엔 로그아웃 버튼만 있고 아바타 없음. `MemberRow`/`PendingRequestRow`도 이름 텍스트만, 원형 배지 없음(직접 확인) | 새 `Avatar` 아톰(이름 첫 글자 추출 + 배경색) 만들고 3곳에 배치 |
| **⌘K 단축키 힌트 배지** | 사이드바 검색창 우측 `⌘K` mono 배지 | `SearchBox.tsx`에 `⌘`/`kbd`/`Cmd` 참조 전혀 없음(grep 확인) — 실제 단축키 바인딩 자체가 없다 | 순수 장식 라벨만 넣을지, 실제 `Cmd/Ctrl+K`로 검색창 포커스하는 `keydown` 리스너까지 넣을지 결정 필요 |
| **글자수 카운터** | SaveStatusBar 우측 "412자" | `SaveStatusBar.tsx` 직접 읽음 — 저장중/저장됨/실패 3상태 텍스트뿐, 글자수 표시 없음 | 현재 문서 content 길이를 `SaveStatusBar`에 prop으로 전달(부모 `DocumentWorkspace`가 `contentRef`로 이미 최신 길이를 갖고 있음 — 값 자체는 구하기 쉬움) |
| **워크스페이스 빈 상태의 새 문서/새 폴더 버튼** | 2f, EmptyState 패널 안에 직접 두 버튼 | `EmptyState.tsx` 직접 읽음 — `heading`/`body` 문자열 두 개만 받는 순수 프레젠테이션 컴포넌트, 클릭 핸들러 없음. 실제 생성 트리거는 `FolderTree.tsx`의 로컬 state(`creatingRoot`/`creatingDocumentRoot`)가 쥐고 있고, `EmptyState`는 그 컴포넌트 트리 밖(형제 컴포넌트)이라 직접 호출 불가 | 상태를 더 상위(`WorkspaceShell`)로 끌어올리거나, `EmptyState`를 없애고 빈 상태를 `FolderTree`/`WorkspaceShell` 쪽에서 조립하는 구조 변경이 필요 — 단순 재스타일링이 아니라 컴포넌트 트리 조정 |
| **에디터 안 마크다운 문법기호 흐림 처리**(`#`, `>`, `##`, `- [x]`가 muted색, 본문은 진한색) | 1a/1b 에디터 패널 | `EditorHost.tsx` 직접 읽음 — CodeMirror에 마크다운 language mode(`@codemirror/lang-markdown` 등)나 syntax highlighting 확장이 전혀 없음, 순수 plain-text 에디터 | 새 CodeMirror 확장 추가(패키지 설치+language mode+커스텀 highlight 테마) — CSS 재스킨이 아니라 에디터 기능 추가 |

**결정(오너, 2026-08-17): 아바타 + 글자수 카운터만 이번 스코프에 포함.** ⌘K 단축키·EmptyState 버튼 연결·에디터 구문강조 3개는 순수 시각 재현과 분리해 다음 라운드로 보류(이번 작업에서 손대지 않음 — ⌘K는 장식 배지도 넣지 않고, EmptyState는 지금처럼 정적 텍스트만, 에디터는 plain-text 그대로).

### 0-3. Button `danger` variant — 결과가 아니라 규칙이 바뀐다

README/목업을 같이 보면 규칙은 이렇다: **위험 액션 "트리거" 버튼은 아웃라인**(배경 없음, `border` 테두리, `destructive` 글자색 — 트리 삭제, 태그바 삭제, 휴지통 완전삭제, 멤버 거절 등 목록/행에 붙는 삭제류), **그 클릭 뒤에 뜨는 ConfirmDialog의 최종 확인 버튼만 솔리드**(destructive 배경 + 흰 글자, 2i 모달 목업에서 확인됨). 지금 `Button.tsx`의 `danger` variant 하나가 이 둘 다에 재사용되고 있어서(`ConfirmDialog.tsx`가 `variant={destructive?"danger":"primary"}`로 `Button`을 그대로 씀), 단순히 `.danger` CSS만 아웃라인으로 바꾸면 ConfirmDialog의 최종 확인 버튼까지 같이 아웃라인이 돼버려 목업과 어긋난다. `Button.tsx`에 variant를 하나 더 쪼개거나(`danger`=아웃라인, `dangerSolid`=솔리드), `ConfirmDialog`가 `Button`을 그대로 안 쓰고 자체 솔리드 스타일을 유지하는 두 방법 중 하나를 택해야 한다.

---

## 1. 전역 인프라 변경

| 대상 | 현재 | 목업 | 파일 |
|---|---|---|---|
| 색상 토큰 | `--bg #fff / --accent #2563eb` 등(01 라이트, 1개 축) | `tokens.css`의 `[data-tone="cool"]` 블록 값(이번 스코프), `warm` 블록은 존재만 하고 미적용 | `src/app/globals.css` |
| 폰트 | DM Sans / DM Mono(self-host, 변수명 `--font-ibm-plex-*`는 레거시) | IBM Plex Sans KR / IBM Plex Mono(진짜로 이 폰트가 됨) | `src/app/layout.tsx`의 `localFont` 선언부 |
| 타이포 스케일 | 11~28px 산발 | 8단계(`--text-xs`~`--text-3xl`, tokens.css에 정의됨) | `globals.css` 추가 + 각 컴포넌트 CSS가 리터럴 px 대신 이 변수 참조하도록 점진 교체 |
| radius | 6/12/18 | 6/10/14 | `globals.css` |
| 헤더 높이 | 64px | 52px | `globals.css`의 `--header-h` — 이 토큰을 참조하는 `w/[wsId]/layout.module.css`의 `calc(100vh - var(--header-h))` 등은 값만 따라감(로직 변경 없음) |
| 사이드바 기본폭 | 260px | 236px(최소48/최대400 범위는 유지) | `src/components/layout/WorkspaceShell.tsx`의 기본값 |
| tone 쿠키 | 없음 | `theme` 쿠키와 동일 패턴의 신규 `tone` 쿠키, RSC가 읽어 `<html data-tone>` 세팅 | `src/app/layout.tsx`(read) + 쓰는 쪽은 §0-1 결정에 따라 `ThemeToggle.tsx` 확장 또는 신규 컴포넌트 |

---

## 2. 컴포넌트 인벤토리 — 값 교체 매핑

`docs/design-brief/04-COMPONENTS.md`에 정리된 현재 컴포넌트 기준, 목업이 요구하는 새 값만 나열(구조는 유지).

| 컴포넌트 | 파일 | 바뀌는 값 |
|---|---|---|
| Button primary | `Button.module.css` | padding 6~8px 14~16px(기존 8px 16px), 폰트 12~13px/500(기존 14px/600) |
| Button secondary | 〃 | 배경 없음 + `border` 테두리, 글자 muted — 큰 변화 없음(값만 미세 조정) |
| Button danger | 〃 | **솔리드→아웃라인**(§0-3 참고, 컴포넌트 분기 필요) |
| Input | `Input.module.css` | 포커스 처리 미세 조정, 나머지 거의 동일 |
| Card | `Card.module.css` | 그림자 없음 원칙 유지(랜딩 미니 프리뷰만 예외 그림자) |
| Modal / ConfirmDialog | `Modal.module.css` / `ConfirmDialog.module.css` | 폭 320→340px, radius-md(10px), 그림자 `0 12px 32px rgba(20,23,28,.14)`, 타이틀 14.5px/600, 본문 12.5px/1.6 |
| 배지(역할/저장됨) | 각 소비자 인라인 | mono 10px/500로 통일(현재 12px 산발), 나머지 무채색 규칙은 유지 |
| 트리 행 | `FolderTreeNode.module.css` | 높이 32→28px, radius-sm, 체브런 16→12px + 색 muted→dim, 아이콘 16→15px(accent 고정 유지) |
| 에디터 툴바 | `Toolbar.module.css` | 높이 44→40px 내외, 버튼 32→26px, 레이아웃 세그먼트 active 표시가 accent-weak 배경에서 흰 배경+옅은 그림자로 변경 |
| SaveStatusBar | `SaveStatusBar.module.css` | 높이 40→36px, "저장됨"이 평문 텍스트에서 accent 배지 알약으로(1a에서 확인 — 이건 이미 `docs/design-brief/05`에도 "accent 배지"로 기록돼 있어 실제로는 기존 구현과 이미 유사, 재확인만 필요) + 글자수 요소 추가(§0-2) |
| FolderPathPicker | `FolderPathPicker.module.css` | 이미 목업과 근접(테두리+배경+mono 폰트로 바꾸는 정도) — 저위험 |

---

## 3. 화면별 분석 (1a + 2a~2i)

| id | 라우트/대상 | 필요한 변경 | 분류 |
|---|---|---|---|
| **1a** | `/w/[wsId]/d/[docId]` (문서 편집, 조회 상태) | §1·§2 전역/컴포넌트 값 적용 + 태그바 우측 "수정"(solid primary)/"삭제"(outline danger) 배치 확인 | 대부분 CSS 스왑. 에디터 구문강조만 예외(§0-2) |
| **2a** | `/` 랜딩 | 히어로 배지 텍스트(`MARKDOWN KNOWLEDGE BASE`, mono accent), 기능카드 4개(아이콘+제목+설명), 개설/가입 2단, 쓰는 법 mono 번호(01~04), 클로징 밴드 — 현재 `docs/design-brief/05-WIREFRAMES.md` §1 레이아웃 골격과 거의 동일, 값만 교체 | 순수 CSS 스왑 |
| **2b** | `/login` | 카드 340px, 라벨 11.5px/600, 인풋 border-strong, 에러 자리 확보(`min-height:14px`, 이미 현재 `Form.tsx`에 있는 패턴) | 순수 CSS 스왑 |
| **2c** | `/signup` | 2b와 동일 + 필드별 에러 상태(이메일 형식 오류 예시) | 순수 CSS 스왑 |
| **2d** | `/invitations/accept` | 성공 카드(체크 배지+굵은 워크스페이스명) + 4분기 미니 카드 그리드(EXPIRED/USED/WRONG ACCOUNT/INVALID, mono 라벨+화살표 안내) — 5분기 전부 있어야 함(01-OVERVIEW.md "유지해야 하는 것" 4번) | 순수 CSS 스왑 |
| **2e** | `/dashboard` | 카드 리스트가 세로 스택은 유지, 문서/폴더 수 표시가 "문서 N개" 텍스트→아이콘+숫자만(mono)으로 축약, 헤더에 아바타 추가(§0-2), 참여신청 "신청" 버튼이 아웃라인 accent로 | 대부분 CSS 스왑 + 아바타(§0-2) |
| **2f** | `/w/[wsId]` 빈 상태 | 아이콘 배지(52px) 추가, EmptyState 안에 새 문서/새 폴더 버튼 추가 | **구조 변경 필요**(§0-2, EmptyState가 지금 정적 컴포넌트) |
| **2g** | `/w/[wsId]/trash` | 복원/완전삭제 버튼 아웃라인화(§0-3과 동일 규칙), RestoreRootBanner 좌측 보더 색상 값만 교체 | 순수 CSS 스왑 |
| **2h** | `/w/[wsId]/members` | 섹션 라벨 mono 11px 패턴 적용, 멤버 행에 아바타 추가(§0-2), 거절 버튼 아웃라인화 | 대부분 CSS 스왑 + 아바타(§0-2) |
| **2i** | 모달 4종(DraftRecovery/삭제확인/저장완료/워크스페이스삭제) | §2 Modal/ConfirmDialog 공통 값 적용. 워크스페이스 삭제 모달에 입력창 위 작은 mono 라벨(대상 워크스페이스명) 추가 — 지금은 placeholder 안에만 있음(사소한 추가) | 대부분 CSS 스왑 |

---

## 4. 적용 순서 제안 (README §"적용 순서" 구체화)

1. `globals.css` 토큰 블록을 `tokens.css`의 `[data-tone="cool"]`/`[data-theme="dark"][data-tone="cool"]` 값으로 교체(웜 블록은 그대로 파일에 남겨두되 미적용 — 나중에 씀). `--header-h` 52px 포함.
2. 폰트 IBM Plex Sans KR/Mono로 `layout.tsx` `localFont` 교체 — `--font-ibm-plex-*` 변수명은 그대로 두고 소스만 교체(레거시 이름이 실제 값과 맞아떨어지게 됨).
3. tone 쿠키 인프라 추가(§0-1 결정: 대체) — `layout.tsx`의 `theme` 쿠키 읽기/`[data-theme]` 수동 세팅 로직 제거하고 `prefers-color-scheme`만 남김, `tone` 쿠키를 같은 no-FOUC 패턴으로 신규 추가. `ThemeToggle.tsx` → `ToneToggle.tsx`(쿨/웜 세그먼트, 다크 전환 로직 없음)로 교체.
4. 아톰(Button/Input/Card/Modal/ConfirmDialog) — §0-3 danger variant 분기부터 처리.
5. 사이드바/트리(WorkspaceShell/FolderTree/FolderTreeNode) 값 교체 + 기본폭 236px + ToneToggle 배치.
6. 문서 워크스페이스(TagBar/SaveStatusBar/FolderPathPicker/Toolbar) 값 교체 — 1a가 기준. SaveStatusBar에 글자수 카운터 추가(§0-2).
7. 나머지 화면별(2a~2i) 값 교체 + 아바타 컴포넌트(헤더/멤버 목록, §0-2) 배치.

각 단계 끝에 `pnpm exec tsc --noEmit` + 관련 vitest + 최소 1개 e2e로 회귀 확인(이 프로젝트의 기존 관례).
