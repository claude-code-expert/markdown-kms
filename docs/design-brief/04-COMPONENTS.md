# 컴포넌트 인벤토리

`src/components/ui/`의 범용 아톰, 에디터 툴바 패밀리, 그 외 화면에 반복 등장하는 패턴(배지, 트리 행, 상태 바)을 정리했다. 파일 위치는 새 디자인 적용 시 그대로 재사용 — 컴포넌트 구조(props)는 최대한 유지하고 CSS Module 내용만 갈아끼우는 게 제일 적은 리스크다.

## 범용 아톰 (`src/components/ui/`)

**Button** (`Button.tsx`) — variant 3종: `primary`(accent 배경/흰 글자), `secondary`(배경 없음/테두리/기본 텍스트색), `danger`(destructive 배경/흰 글자). `disabled` 상태 공통(opacity 0.5). 패딩 8px 16px, radius-sm, 그림자 없음, hover는 배경색 한 단계 진하게, 클릭은 scale(0.98) 트랜스폼. 앱에서 가장 많이 재사용되는 컴포넌트 — 헤더, 모든 모달/다이얼로그, 문서 액션, 트리 컨텍스트 메뉴 등.

**Input** (`Input.tsx`) — `error` 불리언 하나만 상태로 받음(테두리가 destructive로 전환). 패딩 8px 12px, radius-sm, 포커스 시 2px accent 아웃라인. width 100% 기본.

**Card** (`Card.tsx`) — variant 없는 순수 컨테이너. 배경/테두리/radius-md/패딩-md. 랜딩·로그인·회원가입 래퍼, 워크스페이스 카드 타일에 쓰임.

**Modal** (`Modal.tsx`) — `open`/`onClose`/`title` 필수, Esc로 닫힘. 320px 폭, 풀스크린 반투명 백드롭(rgba(15,23,42,.4)), 상단 타이틀+X 닫기 버튼, 본문은 `children`으로 자유 구성(버튼 정렬은 소비자 책임 — 우측 정렬이 관례). CreateWorkspaceModal, MoveFolderModal, 저장완료 알림 등에 쓰임.

**ConfirmDialog** (`ConfirmDialog.tsx`) — Modal과 별개 컴포넌트(자체 CSS). `destructive` prop으로 확인 버튼이 danger로 바뀜, `confirmDisabled`, `cancelLabel`(기본 "취소") 지원. 하단에 취소(secondary)+확인 버튼이 우측 정렬로 항상 자동 배치됨(Modal과 달리 버튼 레이아웃이 컴포넌트에 내장). 폴더/문서 삭제, 워크스페이스 삭제, 가입 승인/거절, 초안 복구, 휴지통 완전삭제 등 파괴적/확인 필요 액션 전부가 이걸 재사용.

**Form / FormField / FormLabel / FormError / FormSubmit** (`Form.tsx`) — 폼 전용 세트. max-width 360px, label 12px/600, error는 11px destructive(자리 미리 확보로 레이아웃 흔들림 방지). FormSubmit은 일반 Button과 별개 스타일. 로그인/회원가입/워크스페이스 생성 폼에 쓰임.

## 배지(badge) 패턴

별도 컴포넌트 파일 없이 각 소비자가 인라인으로 스타일링하지만 규칙은 통일돼 있다: **역할 배지(Owner/Admin/Editor/Viewer)는 항상 무채색**(`surface-2` 배경 + `border` 테두리 + `muted` 텍스트, `radius:999px` pill) — accent색을 절대 안 씀. 워크스페이스 카드, 멤버 목록, 초대 검색 결과 전부 동일. "색으로만 정보 전달하지 않는다"는 원칙이 배지에 특히 명확히 적용돼 있다.

## 에디터 툴바 패밀리 (`src/components/editor/`)

**Toolbar** — 44px 높이 sticky 바, 무채색 배경(`surface-2`). 좌측부터 그룹 구분선(1px)으로 나뉘어: ① HeadingDropdown(제목1~4/본문 5항목 드롭다운) ② 인라인 서식 4개(굵게/기울임/취소선/인라인코드) ③ 목록 3개(글머리/번호/할일) ④ 블록 3개(인용문/코드블록/구분선) ⑤ 삽입 3개(링크/이미지/표). 모든 버튼 32×32px, 아이콘 16px, hover 시 배경 변화, **누르는 순간만** accent 배경(지속 아님 — 토글 상태 표시 없음), 300ms 지연 툴팁. 맨 우측(margin-left:auto)에 레이아웃 모드 3버튼 세그먼트(분할/에디터만/미리보기만).

**HeadingDropdown** — Heading 아이콘+캐럿 트리거, 클릭 시 5항목 드롭다운.

**ImageDropzone** — 파일을 에디터 위로 끌 때만 나타나는 오버레이(점선 accent 테두리, 가운데 업로드 아이콘+안내문구). 평소엔 DOM에 없음/투명.

**UploadErrorBanner** — 업로드 실패 시 툴바 바로 아래 절대위치로 뜨는 배너(좌측 4px 굵은 보더+연한 배경, destructive 아이콘/텍스트, 우측 X 닫기). 자동으로 안 사라짐.

**EditorHost** — CodeMirror 6 마운트 컴포넌트. 폰트는 DM Mono 14px/1.5, 줄번호 거터 없음, 캐럿/선택영역 accent 토큰 사용.

**서식 플러그인 13종**(각 1파일, `src/components/editor/plugins/`): bold, italic, strikethrough, inline-code, bullet-list, ordered-list, task-list, blockquote, code-block, hr, link, image, table + heading(레벨 팩토리).

## 트리 행 패턴 (사이드바)

폴더/문서 공용 한 줄(32px): 체브런(자식 있으면 화살표, 없으면 빈 스페이서) → 아이콘(16px, **항상 accent색** — 선택 여부 무관, 콘텐츠 정체성 글리프로 취급) → 이름(14px, 말줄임) → hover 시만 나타나는 케밥 메뉴 버튼. 선택된 행은 배경(accent-weak)+텍스트(accent)+굵기(600) 삼중 신호.

## 상태 바 패턴

**SaveStatusBar**: 저장중(회전 스피너+텍스트) / 저장됨(accent 배지 알약으로 하이라이트) / 실패(destructive 아이콘+텍스트+인라인 "재시도" 버튼) 3상태.

권한 부족 안내는 별도 색(dim, destructive보다 옅음)으로 "에러"가 아니라 "안내" 톤을 낸다 — 휴지통의 "편집자 이상만 복원할 수 있어요" 같은 힌트가 이 패턴.
