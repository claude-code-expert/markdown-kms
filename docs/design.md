# 랜딩 페이지 디자인 구성

`docs/design_system/`(draculatheme.com 스크랩)에서 가져다 쓸 수 있는 건 **색상·타이포·반경·모션 토큰과 레이아웃 자세(posture) 원칙뿐**이다. 카피·로고(달-박쥐 마크)·몬스터 아이콘·제품 스크린샷 같은 브랜드 자산은 우리 것이 아니므로 쓰지 않는다 — Phase 9(D-06)부터 이어진 원칙 그대로. 색상 원천은 `docs/color.json`.

## 1. 색상

라이트는 `docs/ui-kit.html`, 다크는 이 스크랩에서 이미 추출해 `src/app/globals.css`에 반영돼 있다. `accent-secondary`(Slime Green `#66f859`)만 새로 문서화하고 미적용 상태로 남긴다 — 원본도 홈 검색/필터 활성 상태 하나에만 쓰고, "한 화면엔 액센트 하나" 원칙을 지키기 때문이다.

## 2. 타이포 / 반경 / 모션

DM Sans(본문) / DM Mono(코드), 반경 6/12/18px 3단, 모션 180/240/300ms + `--ease-fluid`/`--ease-elastic` — 전부 Phase 9에서 이미 전역 토큰으로 반영됨. 이 패스에서 발견한 미완성 지점 둘:

- **제목이 본문과 같은 색**: 원본 규칙("headings run one step brighter") 대로 다크 모드용 `--heading-text` 토큰(`#d3d1db`)이 이미 `globals.css`에 박혀 있었는데, 실제로 쓰는 곳이 하나도 없었다. 라이트는 원본 소스에 전용 값이 없으므로 `--text`와 동일하게 채워 넣는다(라이트 모드 시각적 변화 없음, 다크에서만 위계가 생김).
- **Squircle이 `Card`에만 적용됨**: 원본은 버튼·카드·네비·표·블록쿼트 전부에 `corner-shape:squircle`을 쓴다. 우리 앱은 `Card`에만 있었다. `Button`과 랜딩 히어로의 미니 프리뷰 패널(`Card`를 안 쓰는 커스텀 패널)에 같은 `@supports` 점진 향상을 추가한다 — 미지원 브라우저는 기존 `border-radius`로 폴백, 회귀 없음.
- **브랜드 텍스트 선택 색**: 원본은 `::selection`을 액센트로 통일한다. 사이트 전역에 한 줄 추가.

## 3. 랜딩 구성 원칙 — 정직하게 가져올 수 있는 것만

원본의 "신뢰 신호"(로고 월·후기·정확한 구독자 수)는 실제 고객이 없는 지금 그대로 베끼면 없는 사실을 지어내는 꼴이라 채택하지 않는다. 대신 **"막연한 형용사 대신 구체적 숫자"라는 원칙만** 가져온다 — 이미 히어로 카피("60ms 안에", "최대 3개", "한글 검색도 정확하게 동작")에 반영돼 있다.

**유지(이미 만족)**
- 라이브 미리보기 > 정적 갤러리: 원본은 앱 선택 콤보박스로 히어로 스크린샷을 실시간 교체한다. 우리는 실제 3-pane 에디터를 축약한 미니 프리뷰 패널을 히어로에 넣어 같은 원칙("장식이 아니라 이 제품이 실제로 하는 일")을 따른다.
- 한 화면엔 액센트 하나: 넓은 면은 저채도 틴트(`--accent-weak`), 좁은 면(버튼·강조줄·번호)만 고채도 액센트.
- 톤 스텝으로 깊이, 그림자 아님: bg → surface → surface-2 단계 전환으로 구획.

**의도적으로 채택하지 않음(이유 명시)**
- 스크롤 진입 페이드/라이즈(`animation-timeline:view()`): 원본엔 있지만, 이 프로젝트의 anti-slop 품질 게이트가 로드 시 fade/transform 장식을 하드 금지한다 — 소스가 브랜드 정통이어도 우리 게이트가 우선한다.
- 로고 월 / 후기 캐러셀 / FAQ 아코디언: 보여줄 실제 고객·후기·질문이 없다. 확보되면 재검토.

## 4. 1차 패스(랜딩만)에서 바꾼 것

1. `globals.css` — `--heading-text`를 라이트에도 정의(`var(--text)`, 시각 변화 없음), `::selection` 액센트 컬러 추가.
2. `Button.module.css` — `Card`와 동일한 squircle `@supports` 블록 추가.
3. `page.module.css` — 히어로 프리뷰 패널에 squircle 추가, 랜딩 제목류(`headline`/`sectionTitle`/`workspaceCardTitle`/`closingText`)에 `--heading-text` 적용.

## 5. 2차 패스 — 전체 사이트(랜딩·로그인·가입·워크스페이스 메인·에디터) 일관성 정리

`docs/design_system/system/kit.html`·`kit.dark.html`·`artifacts/form.html`·`artifacts/landing.html`(사용자가 "샘플 html"로 지목한 파일들)을 실제로 읽었다. 결론: 이 넷은 draculatheme.com을 손으로 측정한 `DESIGN.md`/`guide.md`와 달리 **범용 디자인 토큰 생성기가 찍어낸 자동 생성 데모**다(`kit.html` 안에 "The ~20-field input every other token is derived from"라는 문구가 그대로 박혀 있다 — 우리 얘기가 아니라 그 생성기 툴 자기소개). 컬러 hex는 같지만 표현 방식이 실제 브랜드 자세(guide.md "Depth comes from tonal steps... not shadows")와 반대로 컬러 글로우 그림자(`box-shadow:0 12px 32px var(--brand-color-primary-bg)`), 장식용 배경 원/도트 패턴, 카드 베벨 그림자를 쓴다 — 전부 이 프로젝트의 anti-slop 하드 게이트 위반. **그래서 이 네 파일의 장식적 선택은 채택하지 않았고**, 대신 그 안에서 장식과 무관한 구조적 확인만 가져왔다(타입 스케일 실측치, form label/input 뼈대, 뱃지/스탯 표현 방식).

실제로 바꾼 것:

1. **공용 컴포넌트**
   - `ConfirmDialog`가 커스텀 버튼 대신 `Button` 컴포넌트를 쓰도록 교체 — font-weight 500(4사이즈 규칙 위반)과 4번째 padding 값(7px 14px) 파편을 없앰. squircle도 `Card`/`Modal`과 맞춤.
   - `Button.module.css`의 `.danger:hover` 하드코딩 hex(`#b91c1c`) → 새 토큰 `--destructive-strong`(라이트 `#b91c1c`, 다크 `#ef7570` — `--accent-strong`이 다크에서 더 밝아지는 것과 같은 규칙)로 교체.
2. **타이포 스케일 정리** — 이 프로젝트가 이미 쓰던 4사이즈(12/14/16/24px)에서 벗어난 임의값들을 흡수:
   - `DeleteWorkspaceDialog` 13px→14px, 11px→12px
   - `ThemeToggle` 13px→14px
   - `FolderPathPicker` 메뉴 아이템 13px→12px
   - 랜딩(`page.module.css`): `sectionTitle` 20→24, `paragraph`/`steps li` 15→14, `featureTerm`/`workspaceCardTitle` 15→16, `closingText` 18→16. 히어로 `headline`(39px)만 예외로 유지 — 페이지 전체에서 유일하게 24px보다 커야 하는 자리.
3. **워크스페이스 카드**(`WorkspaceCard`) — 소유자·생성일·문서수·폴더수가 가운뎃점으로 한 줄에 눌려 있던 걸 분리: 역할 뱃지(`TagBar`의 `.chip`과 같은 중립 필 — 색으로만 정보 전달 금지 원칙 유지), 문서/폴더 수는 아이콘+숫자 쌍으로.

로그인/가입/에디터 화면 자체는 이번 조사에서 추가로 손댈 지점이 안 나왔다 — 공용 컴포넌트(Button/ConfirmDialog/토큰) 수정이 자동으로 반영되는 것 외에는 이미 일관된 상태였다.

## 6. 3차 패스 — 헤더 색감 + 아이콘 accent 확대

헤더가 `var(--bg)`(무지 흰/보이드) 배경에 텍스트 로고만 있어 "밋밋하다"는 피드백. 아이콘도 대부분 `var(--muted)`로 눌려 있었다.

- **SiteHeader**: 배경을 `var(--accent)` 단색으로 채움. 64px 얇은 띠라 히어로 밴드의 "넓은 면 저채도" 원칙과는 별개로 취급 — 브랜드가 항상 보이는 유일한 자리라 존재감을 우선했다. 로고는 흰 텍스트 + 반투명 흰 배지(`rgba(255,255,255,.18)`) 안의 작은 아이콘(`form.html` 샘플의 구조만 차용, 그림자·블롭은 미채택). 헤더 배경 자체가 accent라 `회원가입` 버튼은 같은 색이면 묻히므로, 그 버튼만 흰 배경 + accent 텍스트로 반전(`SiteHeader.module.css`의 `.ctaOnAccent`, `Button.module.css`의 `.primary`를 안 쓰고 `.btn`만 공유).
- **콘텐츠 정체성 아이콘 → accent**: `FolderTreeNode.folderIcon`(폴더·문서 트리 아이콘, 선택 여부 무관 항상), `WorkspaceCard`의 문서/폴더 수 아이콘(숫자 텍스트 자체는 계속 muted, 아이콘만), 랜딩 히어로 미니 프리뷰의 문서 아이콘(`previewFileIcon`, 실제 트리와 동일 규칙 유지).
- **바꾸지 않은 것**: 셰브런·케밥·검색·테마토글 같은 UI 크롬 아이콘은 계속 무채색 — "각 아이콘"을 전부 accent로 칠하면 원칙(작은 면적만 고채도) 자체가 무너진다. 에디터 Toolbar 아이콘도 요청대로 제외(서식 버튼은 지속 활성 상태 색을 안 갖는다는 기존 불변식).
