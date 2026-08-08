# Phase 5: Editor Enhancements & Personalization - Context

**Gathered:** 2026-08-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4의 문서·에디터 위에 R2(P1) 편집 강화·개인화를 얹는다: 이미지 업로드(커서 삽입), 툴바 폴리시(300ms 툴팁 지연 + 클릭 pressed), 1분 스냅샷 임시저장·크래시 복구(document_draft), 테마(라이트/다크)·레이아웃(split/editor-only/preview-only) 전환 + 패널 리사이즈.

**이 phase가 하는 것:** `POST /api/uploads`(로컬 디스크, storage 모듈 격리) + image 플러그인 배선, 툴바 pressed/300ms 툴팁, document_draft 테이블·`PUT /api/documents/:id/draft` + 복구 다이얼로그, 테마 토글(쿠키 영속·CSS 변수 override)·레이아웃 모드 토글·패널 리사이즈.
**이 phase가 안 하는 것:** 태그·검색·export(Phase 6), 협업(Phase 7), 프레젠테이션·구글로그인(Phase 8). document_tag는 안 만든다(Phase 6).
</domain>

<decisions>
## Implementation Decisions

### 이미지 업로드 (FR-E6, EDIT-09)
- 저장소: 로컬 디스크 `/uploads`. 저장/삭제/URL 생성을 **storage 모듈 하나에 격리**(S3 계열 전환은 이 모듈 함수 교체로 끝, TRD §8). 업로드 경로가 이 모듈 밖으로 새지 않는다.
- 제한: 최대 5MB, `image/png|jpeg|gif|webp`만. MIME 타입 + 확장자 이중 검증(content-type 스푸핑 방어). 서버에서 검증(EDITOR+).
- 업로드 중 UX: 업로드 시작 시 `![업로드 중...]()` placeholder를 커서 위치에 삽입 → 완료 시 실제 URL 마크다운으로 치환(성공기준: "완료 시 커서 위치 삽입"). 실패 시 placeholder 제거 + 에러 표시.
- 파일명: uuid로 저장(경로순회·충돌 방지). 원본 파일명은 alt 텍스트로. 저장 경로는 서버가 결정(클라 경로 미신뢰).

### 테마 + 레이아웃 (FR-E11, EDIT-12)
- 테마 영속화: **쿠키**(SSR 일관·FOUC 없음). RSC가 쿠키를 읽어 `<html data-theme>` 초기값 설정. 첫 방문은 `prefers-color-scheme` 따름.
- 다크 팔레트: `[data-theme="dark"]`가 `src/app/globals.css`의 CSS 변수(--bg/--text/--accent 등)를 override(ui-kit 토큰 다크 반전). 라이트가 기본 토큰.
- 레이아웃 모드: split / editor-only / preview-only 토글(에디터 헤더/툴바 영역), 쿠키 영속(테마와 일관).
- 패널 리사이즈(Phase 4 deferred): split 모드에서 에디터|미리보기 경계 드래그 리사이즈, 비율을 쿠키 저장.

### 툴바 폴리시 (FR-E7, EDIT-10)
- 300ms 툴팁 지연: hover 후 300ms 뒤 툴팁(CSS transition-delay). Phase 2는 즉시 표시였음.
- 클릭 pressed 피드백: 버튼 클릭 순간 pressed 시각 상태(active). **지속적 서식-활성 표시는 아님**(bold가 켜져있음 추적 X — Phase 2 UAT가 배제한 것과 정합). 클릭 순간 피드백만.

### 임시저장·크래시 복구 (FR-E10, EDIT-11 — TRD §7 확정)
- document_draft 테이블(TRD §3: document_id PK, content, updated_at) + 마이그레이션.
- 1분 타이머: 마지막 임시저장 후 입력이 있었을 때만 `PUT /api/documents/:id/draft`로 upsert(문서당 1행). Phase 4 자동저장(1s)과 별개 타이머.
- 복구: 문서 진입 시 `draft.updated_at > document.updated_at`이면 복구 다이얼로그. 복구→draft를 에디터에 적재 후 정식 저장, 폐기→draft 삭제. 정식 저장 성공 시에도 draft 삭제(진입 시 오탐 방지).

### Claude's Discretion
- storage 모듈 인터페이스, 테마 컨텍스트/훅 구조, 레이아웃 상태 관리, 리사이즈 구현(CSS resize vs 드래그 핸들), draft 타이머 훅 구조 — 코드베이스 관례(CSS Modules·ui-kit·zod·requireRole·순수 컨트롤러 분리) 따라 재량.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/editor/Toolbar.tsx` + `.module.css` — pressed/300ms 툴팁을 Phase 5로 명시 defer한 주석 존재. onMouseDown preventDefault 이미 있음. 여기에 pressed 상태 + transition-delay 추가.
- `src/components/editor/plugins/image.ts` — 현재 `![alt](url)` skeleton 삽입. 업로드 완료 URL로 배선(플러그인은 순수 run(state) 유지, 업로드는 툴바/에디터 레벨에서).
- `src/components/document/useAutosave.ts` + `autosave-controller.ts` — Phase 4 자동저장. draft 1분 타이머를 유사 패턴(순수 컨트롤러 분리)으로 추가.
- `src/components/document/DocumentWorkspace.tsx` — 3분할 호스트. 복구 다이얼로그·레이아웃 모드·테마 토글 연동점.
- `src/app/globals.css` — ui-kit CSS 변수(:root). `[data-theme="dark"]` override 추가.
- `src/lib/documents.ts` / `validation.ts` — draft upsert 서비스 + zod. `src/lib/rbac.ts` — 업로드/draft 라우트 EDITOR+.
- `src/components/ui/Modal.tsx`/`ConfirmDialog.tsx` — 복구 다이얼로그 재사용.
- `src/db/schema.ts` — document_draft 테이블 추가(TRD §3 DDL).

### Established Patterns
- 서버 전용 RBAC(requireRole), zod 입력 검증, 순수 컨트롤러 분리(정확성 로직 테스트 용이), DbClient 주입.
- TDD(RED 먼저), CSS Modules + ui-kit 토큰(다크는 변수 override로 확장).
- 플러그인 1기능 1파일·순수 run(state)(TRD §6) — image 플러그인은 이 계약 유지.

### Integration Points
- `POST /api/uploads`(EDITOR, storage 모듈) · `PUT /api/documents/:id/draft`(upsert) · `GET`(진입 시 복구 판단은 RSC가 getDocument + draft 비교).
- 테마/레이아웃 쿠키: RSC(layout.tsx)가 읽어 초기 렌더. 토글은 클라 컴포넌트가 쿠키 set + 즉시 반영.
- 로컬 DB: PG16 @ 5433, DATABASE_URL은 `.env.local`(main tree). worktree 미사용 순차 실행. `/uploads` 디렉터리는 dev 로컬 디스크.
</code_context>

<specifics>
## Specific Ideas

- 이미지 업로드는 보안 표면: 타입/크기 서버 검증, uuid 파일명(경로순회), MIME+확장자 이중 확인, EDITOR+ 게이트. storage 모듈 격리가 이식성+보안 경계.
- draft는 Phase 4 자동저장(document.content)과 **별개 저장소**(document_draft). 복구는 draft가 document보다 최신일 때만 — 정식저장 성공 시 draft 삭제로 오탐 차단.
- 성공기준(ROADMAP): 이미지 업로드 완료 시 커서 삽입 / 툴바 lucide·300ms 툴팁·pressed / 1분 스냅샷 크래시 복구·최신 스냅샷 복구 제안 / 라이트-다크·split-editor-preview 전환.
</specifics>

<deferred>
## Deferred Ideas

- 태그·검색·export(document_tag, pg_trgm, archiver zip) → Phase 6.
- 협업(join/invite) → Phase 7. 프레젠테이션·구글 로그인 → Phase 8.
- S3 계열 실제 전환(로컬 디스크로 시작, 모듈만 격리) → 추후.
- Phase 3·4 defer된 UAT(시각 항목) → 끝에 몰아서.
</deferred>
