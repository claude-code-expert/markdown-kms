# Phase 9: Design System Application - Context

**Gathered:** 2026-08-15
**Status:** Ready for planning

<domain>
## Phase Boundary

`docs/design_system/`에서 뽑은 시각 토큰(색상·타이포그래피·모서리 반경·모션 타이밍)을 markdown-kms의 랜딩(회원가입/로그인)·워크스페이스 메인(`/dashboard`)·에디터 글쓰기 화면(`/w/[wsId]/d/[docId]`)에 적용해 룩앤필을 재작업한다. 신규 백엔드 기능 없음 — RBAC·autosave seq-guard·soft-delete·closure-table 등 기존 로직·API 계약은 전부 유지, 프레젠테이션 레이어(CSS 토큰·컴포넌트 마크업·일부 표시용 데이터 확장)만 재작업. Google 로그인 버튼은 시각적 placeholder만(Auth.js provider 실연동 안 함, Phase 8 descope 결정 유지).

</domain>

<decisions>
## Implementation Decisions

### 디자인 소스 성격 (전제 조건)
- **D-01:** `docs/design_system/`는 markdown-kms 전용 브랜드가 아니라 draculatheme.com(코드 에디터 테마 브랜드)에서 그대로 추출한 킷 — 색상뿐 아니라 카피("400+ apps" 등 마케팅 문구, 뱀파이어/고딕 톤)와 이미지(창업자 Zeno Rocha 인물사진, 몬스터 아이콘, 에디터 스크린샷)까지 포함한다. `DESIGN-HANDOFF.md`의 "카피·이미지를 그대로 보존하라"는 지침은 **따르지 않는다**.
- **D-02:** **토큰만 추출한다.** 색상 역할(background/surface/foreground/muted/border/accent)·타이포그래피(DM Sans/DM Mono 폰트 패밀리 + 웨이트)·반경 스케일(6/12/18px, squircle)·모션 타이밍(180/240/300ms, `--ease-fluid`/`--ease-elastic`)만 이식. 카피·인물사진·몬스터 아이콘·"Dracula"/"400+ apps" 등 브랜드 고유 문구·이미지는 전부 **사용하지 않고 markdown-kms 자체 문구로 교체**한다.
- **D-03:** 폰트 파일은 `docs/design_system/fonts/*.woff2`(DM Sans 400/500/600/700, DM Mono 400)를 그대로 프로젝트에 이식해 자체 호스팅한다(Google Fonts CDN 아님 — `fonts.css` 참고).

### 라이트/다크 토큰 전략
- **D-04:** 라이트 모드가 **기본값 유지**(Phase 5 테마 토글의 기존 사용자 경험 보존). `[data-theme="dark"]` override 블록만 새 Dracula 파생 팔레트(거의 검정 배경 `#0e0d11`류, 보라 액센트 `#7359f8`류)로 **전면 교체** — 기존 blue-accent 다크 값(`--accent: #3b82f6` 등)은 제거.
- **D-05:** 타이포그래피(DM Sans/DM Mono)·반경 스케일(squircle 6/12/18px)·모션 타이밍(180/240/300ms + easing)은 **라이트/다크 공통(전역) 토큰**으로 교체 — 테마와 무관하게 항상 적용. 기존 IBM Plex·기존 radius 값은 완전히 대체된다. 색상 역할만 테마별로 갈린다(라이트=기존 ui-kit 블루 계열 유지, 다크=새 Dracula 파생 팔레트).
- **D-06:** `docs/ui-kit.html`은 색상 토큰 원천 지위를 라이트 모드에 한해 유지한다(CLAUDE.md의 "새 UI는 이 토큰을 이식해 쓴다"는 라이트에는 계속 적용, 다크는 이번 phase가 갱신). CLAUDE.md의 토큰 원천 설명은 이후 실행 단계에서 "라이트=ui-kit.html 색상 + 신규 전역 타입/반경/모션, 다크=신규 Dracula 파생 색상 + 동일 전역 타입/반경/모션"으로 갱신 필요.

### 워크스페이스 메인
- **D-07:** 라우트는 **`/dashboard` 유지**(rename 안 함). 현재 `/dashboard`가 이미 와이어프레임의 "폴더 트리 없는 중앙 정렬 카드 리스트 + 워크스페이스 만들기 + 참여 신청" 구조와 일치(`WorkspaceCard.tsx`, `CreateWorkspaceButton.tsx`, `JoinWorkspaceInput.tsx`) — 디자인만 재작업.
- **D-08:** 카드에 표시할 정보는 **와이어프레임 중 실제 DB에서 조회 가능한 항목만** — 이름·역할 배지(기존)에 소유자 이름·생성일·문서 개수·폴더 개수를 추가(`listMembershipsForUser` 확장 필요). "공개" 배지는 스킵(공개 워크스페이스 플래그가 스키마에 없음 — 스코프 밖 신규 기능이므로 이번 phase에서 만들지 않음). "문서" 버튼은 카드 클릭과 동일 동작(워크스페이스 진입)으로, 시각적 추가만.

### 에디터 사이드바
- **D-09:** 와이어프레임의 "전체 문서"/"미분류 문서" 고정 항목, 폴더열 정렬(↕)/추가(＋) 버튼은 **구현하지 않는다** — 필터링·정렬 로직이 없는 신규 기능이라 스코프 밖. `FolderTree` 기존 구조(폴더/문서 트리 + 검색박스 + 컨텍스트 메뉴)를 그대로 두고 **순수 스타일링(폰트·색·반경·간격)만** 재작업한다. 사이드바 폭(260px)·검색창 위치 등 레이아웃 골격은 와이어프레임을 참고하되 신규 네비게이션 항목은 별도 Deferred Idea로 기록.

### Claude's Discretion
- 정확한 색상 hex 매핑(Dracula raw 토큰 → 프로젝트 CSS 변수명), 타이포 스케일 세부(h1~h6/body/caption 크기), squircle 구현 방식(`corner-shape: squircle` CSS 지원 여부에 따라 폴백 `border-radius`), 모션 적용 범위(버튼 hover/press, 카드 scroll-in 등 어디까지), 랜딩 페이지 카피 문구 자체, 3화면 각각의 구체적 컴포넌트 분해 — 코드베이스 관례(CSS Modules·ui-kit 변수 오버라이드 패턴) 따라 재량.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 디자인 토큰 원천 (신규, 이번 phase)
- `docs/design_system/DESIGN.md` — 색상 역할표(hex+OKLCH)·타이포·레이아웃 posture·모션 타이밍 (draculatheme.com 원본 그대로, 카피/이미지는 미사용)
- `docs/design_system/system/variables.css` / `docs/design_system/system/variables.dark.css` — CSS 커스텀 프로퍼티 원본
- `docs/design_system/system/tokens.default.json` / `tokens.dark.json` / `tokens.compact.json` — 토큰 JSON
- `docs/design_system/fonts/fonts.css` + `docs/design_system/fonts/*.woff2` — DM Sans/DM Mono 자체 호스팅 폰트 파일
- `docs/design_system/brand.json` — 구조화 토큰(색상 role/hex/OKLCH/usage)

### 기존 디자인 토큰 원천 (라이트 모드용, 유지)
- `docs/ui-kit.html` — 기존 색상 토큰 원천(라이트 기본값), IBM Plex는 이번 phase로 대체됨
- `src/app/globals.css` — 현재 `:root`/`[data-theme="dark"]` 토큰 정의 위치, 이번 phase가 직접 수정할 파일

### 와이어프레임
- `docs/images/workspace-main-wireframe.svg` — 워크스페이스 메인 레이아웃 (D-07/D-08 근거)
- `docs/images/write-form-wireframe.svg` — 에디터 글쓰기 화면 레이아웃 (D-09 근거)

### 프로젝트 불변식
- `CLAUDE.md` — 지켜야 할 불변식(sanitize 필수·RBAC 서버 전용·seq 가드 등) 및 §언어(전 산출물 한글), §문서 체계
- `.planning/PROJECT.md` — 프로젝트 전체 맥락, R1~R3 릴리스 단위, Key Decisions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app/globals.css` — `:root`(라이트 기본)·`[data-theme="dark"]`(override) 2블록 구조. 이번 phase가 다크 블록 전면 교체 + 전역 타입/반경/모션 변수 추가.
- `src/components/ui/*`(Button·Modal·ConfirmDialog·Input·Form·Card) — CSS Modules + `var(--token)` 참조만 사용, 토큰 값이 바뀌어도 컴포넌트 코드 자체는 무수정으로 리스킨됨.
- `src/app/(main)/dashboard/page.tsx` + `WorkspaceCard.tsx`/`CreateWorkspaceButton.tsx`/`JoinWorkspaceInput.tsx` — 워크스페이스 메인 화면 기존 구현.
- `src/app/(main)/w/[wsId]/layout.tsx` + `src/components/tree/FolderTree.tsx` — 에디터 화면 사이드바(폴더 트리) 기존 구현. `w/[wsId]/d/[docId]/page.tsx` + `DocumentWorkspace.tsx` — 제목행·저장/수정/삭제 버튼·에디터 3분할.
- `src/app/(auth)/login/`, `src/app/(auth)/signup/` — 랜딩(로그인/가입) 폼 기존 구현, `login-form.tsx`/`signup-form.tsx`.
- `src/lib/db-membership.ts`(`listMembershipsForUser`) — D-08의 소유자/생성일/문서·폴더 개수 확장 지점.

### Established Patterns
- CSS Modules + `var(--token)` 간접 참조 — Phase 5 테마 토글이 이미 이 패턴으로 다크모드를 구현(컴포넌트 무수정, 토큰만 override).
- RSC가 쿠키(`data-theme`)를 읽어 초기 렌더 — no-FOUC 패턴 기존 확립, 이번 phase가 건드릴 필요 없음.
- 서버 전용 RBAC(`requireRole`)는 화면 리스킨과 무관 — 전 화면에서 100% 유지.

### Integration Points
- `src/app/globals.css` — 색상/타입/반경/모션 토큰 전부 여기 한 곳에서 갱신.
- `public/fonts/` 또는 유사 경로 — `docs/design_system/fonts/*.woff2` 복사 대상(신규).
- `src/lib/db-membership.ts` — D-08 카드 데이터 확장(문서/폴더 개수 집계 쿼리 추가).

</code_context>

<specifics>
## Specific Ideas

- 색상만 바뀌는 게 아니라 "이 페이지 뭘로 만들었지" 라는 느낌이 드는 신선한 룩앤필을 원함 — 타입/반경/모션까지 전역 교체하기로 한 결정(D-05)이 이 의도를 반영.
- 워크스페이스 카드의 "문서 개수·폴더 개수" 등은 **실제 조회되는 값**이어야 한다(사용자가 처음 요청 문구: "구성을 따라서 데이터를 조회한 뒤 리스팅") — 하드코딩 플레이스홀더 금지.
- 각 단계(화면 단위)마다 회귀 없음을 vitest 전체 + 관련 playwright e2e로 확인하며 진행 — ROADMAP Phase 9 성공기준 4번, 실행(execute) 단계 PLAN에 반드시 반영.

</specifics>

<deferred>
## Deferred Ideas

- 워크스페이스 카드의 "공개" 배지 — 공개/비공개 워크스페이스 개념 자체가 스키마에 없음. 신규 기능이라 이번 phase 스코프 밖, 향후 phase 후보로 기록.
- 에디터 사이드바 "전체 문서"/"미분류 문서" 고정 뷰, 폴더열 정렬(↕)/추가(＋) 버튼 — 필터링·정렬 신규 기능, 이번엔 순수 스타일링만(D-09). 향후 phase 후보.
- Google OAuth 실연동(Auth.js provider) — Phase 8 descope 결정 유지, 이번 phase는 시각적 placeholder만.
- `docs/design_system`의 카피·이미지·Dracula 브랜딩 자체 — 전혀 사용하지 않음(D-01/D-02), 토큰만 추출.

</deferred>

---

*Phase: 09-design-system-application*
*Context gathered: 2026-08-15*
