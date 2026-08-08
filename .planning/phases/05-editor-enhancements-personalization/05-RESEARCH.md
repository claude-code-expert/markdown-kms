# Phase 5: Editor Enhancements & Personalization - Research

**Researched:** 2026-08-08
**Domain:** Next.js 15 App Router 멀티파트 파일 업로드(보안 표면) + 순수 컨트롤러 패턴의 1분 draft 타이머 + `cookies()` 기반 no-FOUC 테마/레이아웃 + 네이티브 드래그 리사이즈
**Confidence:** MEDIUM — TRD §3/§7/§8이 스키마·프로토콜·경로를 이미 확정해 잠긴 부분은 HIGH급이지만, "어떻게 배선할지"의 상당수(업로드 훅이 어디 사는지, draft 복구가 uncontrolled CodeMirror에 내용을 어떻게 밀어넣는지, 쿠키를 어디서 읽는지)는 기존 코드를 직접 읽어 도출한 설계 추론이라 전체를 MEDIUM으로 표기한다. 근거는 각 절의 태그 참조.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**이미지 업로드 (FR-E6, EDIT-09)**
- 저장소: 로컬 디스크 `/uploads`. 저장/삭제/URL 생성을 **storage 모듈 하나에 격리**(S3 계열 전환은 이 모듈 함수 교체로 끝, TRD §8). 업로드 경로가 이 모듈 밖으로 새지 않는다.
- 제한: 최대 5MB, `image/png|jpeg|gif|webp`만. MIME 타입 + 확장자 이중 검증(content-type 스푸핑 방어). 서버에서 검증(EDITOR+).
- 업로드 중 UX: 업로드 시작 시 `![업로드 중...]()` placeholder를 커서 위치에 삽입 → 완료 시 실제 URL 마크다운으로 치환(성공기준: "완료 시 커서 위치 삽입"). 실패 시 placeholder 제거 + 에러 표시.
- 파일명: uuid로 저장(경로순회·충돌 방지). 원본 파일명은 alt 텍스트로. 저장 경로는 서버가 결정(클라 경로 미신뢰).

**테마 + 레이아웃 (FR-E11, EDIT-12)**
- 테마 영속화: **쿠키**(SSR 일관·FOUC 없음). RSC가 쿠키를 읽어 `<html data-theme>` 초기값 설정. 첫 방문은 `prefers-color-scheme` 따름.
- 다크 팔레트: `[data-theme="dark"]`가 `src/app/globals.css`의 CSS 변수(--bg/--text/--accent 등)를 override(ui-kit 토큰 다크 반전). 라이트가 기본 토큰.
- 레이아웃 모드: split / editor-only / preview-only 토글(에디터 헤더/툴바 영역), 쿠키 영속(테마와 일관).
- 패널 리사이즈(Phase 4 deferred): split 모드에서 에디터|미리보기 경계 드래그 리사이즈, 비율을 쿠키 저장.

**툴바 폴리시 (FR-E7, EDIT-10)**
- 300ms 툴팁 지연: hover 후 300ms 뒤 툴팁(CSS transition-delay). Phase 2는 즉시 표시였음.
- 클릭 pressed 피드백: 버튼 클릭 순간 pressed 시각 상태(active). **지속적 서식-활성 표시는 아님**(bold가 켜져있음 추적 X — Phase 2 UAT가 배제한 것과 정합). 클릭 순간 피드백만.

**임시저장·크래시 복구 (FR-E10, EDIT-11 — TRD §7 확정)**
- document_draft 테이블(TRD §3: document_id PK, content, updated_at) + 마이그레이션.
- 1분 타이머: 마지막 임시저장 후 입력이 있었을 때만 `PUT /api/documents/:id/draft`로 upsert(문서당 1행). Phase 4 자동저장(1s)과 별개 타이머.
- 복구: 문서 진입 시 `draft.updated_at > document.updated_at`이면 복구 다이얼로그. 복구→draft를 에디터에 적재 후 정식 저장, 폐기→draft 삭제. 정식 저장 성공 시에도 draft 삭제(진입 시 오탐 방지).

### Claude's Discretion
- storage 모듈 인터페이스, 테마 컨텍스트/훅 구조, 레이아웃 상태 관리, 리사이즈 구현(CSS resize vs 드래그 핸들), draft 타이머 훅 구조 — 코드베이스 관례(CSS Modules·ui-kit·zod·requireRole·순수 컨트롤러 분리) 따라 재량.

### Deferred Ideas (OUT OF SCOPE)
- 태그·검색·export(document_tag, pg_trgm, archiver zip) → Phase 6.
- 협업(join/invite) → Phase 7. 프레젠테이션·구글 로그인 → Phase 8.
- S3 계열 실제 전환(로컬 디스크로 시작, 모듈만 격리) → 추후.
- Phase 3·4 defer된 UAT(시각 항목) → 끝에 몰아서.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EDIT-09 (FR-E6) | 이미지 업로드 완료 시 커서 위치에 이미지 마크다운이 삽입된다 | Architecture Patterns Pattern 1/2, Code Examples "이미지 업로드", Common Pitfalls #1~#4 |
| EDIT-10 (FR-E7) | 툴바는 lucide 아이콘 + hover 300ms 내 툴팁 + 클릭 pressed 피드백을 갖는다 | Architecture Patterns Pattern 3, Code Examples "툴바 CSS" — UI-SPEC이 이미 CSS 전문을 확정, 리서치는 함정만 보강 |
| EDIT-11 (FR-E10) | 1분 주기 임시 스냅샷이 저장되고, 재진입 시 임시본이 최신이면 복구 여부를 묻는다 | Architecture Patterns Pattern 4/5, Code Examples "draft 컨트롤러/upsert", Common Pitfalls #5~#7 |
| EDIT-12 (FR-E11) | 라이트/다크 테마와 split/에디터 전용/미리보기 전용 레이아웃을 전환할 수 있다 | Architecture Patterns Pattern 6/7, Code Examples "쿠키 읽기/쓰기", Common Pitfalls #8~#10 |
</phase_requirements>

---

## Summary

이 phase는 성격이 다른 세 가지 정확성 문제를 하나의 3분할 화면 위에 얹는다. 첫째는 **보안 표면**(이미지 업로드 — 클라이언트가 보낸 어떤 값도 신뢰하지 않고 서버가 바이트 자체를 검사), 둘째는 **비동기 상태와 uncontrolled 에디터의 배선**(draft 크래시 복구 — CodeMirror가 마운트-1회 uncontrolled라는 Phase 2 설계(IME 안전)와 정면으로 만난다), 셋째는 **SSR 타이밍**(테마/레이아웃 — FOUC 없이 첫 페인트에 올바른 값이 박혀 있어야 한다)이다.

가장 중요한 발견은 세 가지다. 첫째, Next.js 15 `cookies()`는 [CITED: nextjs.org/docs/app/api-reference/functions/cookies] Server Component **렌더 중에는 읽기만 가능하고 쓰기(set/delete)는 불가능**하다 — 반면 클라이언트 토글 버튼은 `document.cookie`(순수 브라우저 API, 신규 API 라우트 불필요)로 직접 쓸 수 있어 "Route Handler를 거쳐 쿠키를 쓴다"는 흔한 패턴 자체가 이 phase에는 불필요하다. 둘째, `EditorHost`는 Phase 2/4 설계상 **마운트 후 `initialContent` prop 변경을 무시하는 uncontrolled 컴포넌트**다(`EditorHost.tsx:36` `initialContentRef`, IME 조합 보호) — 그래서 draft 복구의 "에디터에 적재"는 prop을 바꿔서 되는 게 아니라 `getView()`로 얻은 살아있는 `EditorView`에 `view.dispatch({changes: {...}})`를 직접 쏴야 하며, 이 dispatch는 `updateListener`를 정상적으로 통과하므로 **기존 자동저장 파이프라인이 그대로 이어받는다**(별도 "강제 저장" API 불필요). 셋째, TRD §7의 "정식 저장 성공 시에도 draft 삭제"를 자동저장 라우트 안에 심어두면, 복구 다이얼로그의 "복원" 클릭이 별도로 draft를 지울 필요가 없다 — dispatch가 자동저장을 트리거하고, 그 자동저장 성공이 draft를 지운다. 연쇄 반응 하나로 두 요구사항이 동시에 충족된다.

이미지 업로드는 신규 의존성이 필요 없다: MIME 스니핑은 png/jpeg/gif/webp 4종의 매직 바이트가 각 8/3/6/12바이트 이내라 `file-type` 류 패키지 없이 직접 비교로 충분하고(Don't Hand-Roll 참조), 정적 서빙도 `public/uploads/`에 저장하면 Next.js가 이미 확장자 기반 Content-Type으로 자동 서빙한다(전용 GET 라우트 불필요) — `dev 로컬 디스크` 범위로 잠긴 이 phase에서는 이 경로가 가장 적은 부품으로 요구를 덮는다.

**Primary recommendation:** `saveUpload(file: File)` 하나만 아는 `src/lib/storage.ts`에 매직바이트 스니핑+uuid 파일명+`public/uploads/` 쓰기를 몰아넣고, 업로드 오케스트레이션(파일 선택/드롭·placeholder 삽입·문자열 치환·에러 배너)은 Toolbar가 아니라 `EditorPreviewLayout` 레벨의 새 훅(`useImageUpload`)이 소유한다 — Toolbar는 image 버튼 클릭만 그 훅에 위임한다. draft는 autosave-controller.ts를 그대로 본뜬 순수 컨트롤러(`draft-controller.ts`, 이번엔 디바운스가 아니라 "입력 있었으면 60초마다 upsert")로 만들고, 복구 다이얼로그의 "복원"은 CodeMirror에 dispatch 한 번 쏘는 것으로 끝낸다(자동저장이 나머지를 처리). 테마/레이아웃은 RSC가 `cookies()`로 읽고 클라 토글은 `document.cookie`로 직접 쓴다 — API 라우트 0개.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 이미지 업로드 검증(매직바이트·크기·확장자)·파일 저장 | API / Backend | Database/Storage(파일시스템) | 클라 MIME/확장자는 스푸핑 가능 — 서버가 바이트를 직접 읽어야 신뢰 경계가 성립(NFR-3.1/NFR-3.2와 동일 원칙의 파일판) |
| 업로드 오케스트레이션(placeholder 삽입·치환·드래그드롭·에러 배너) | Browser / Client | — | CodeMirror 상태(캐럿 위치)와 낙관적 UI가 클라에만 있음 — 서버는 바이트만 검증, UX 흐름은 순수 클라 로직 |
| draft 1분 타이머·"입력 있었는지" 판정 | Browser / Client | — | Phase 4 autosave-controller와 동형: 순수 함수로 분리해 Vitest에서 fake timer로 검증 가능해야 함(TRD §10 TDD 요구) |
| draft upsert·"진입 시 최신 여부" 비교 | API / Backend | Database / Storage | `document_draft` PK가 문서당 1행을 보장 — 비교 로직(`updated_at` 대소)은 신뢰 경계 안(서버가 계산한 두 타임스탬프)이라 RSC가 계산해 내려줘도 안전 |
| 테마/레이아웃/리사이즈 비율의 **초기값** | Frontend Server (SSR/RSC) | — | FOUC 방지의 유일한 방법은 첫 HTML에 올바른 값이 이미 있는 것 — `cookies()`는 Server Component에서 읽기 전용으로 이 역할을 정확히 한다 |
| 테마/레이아웃/리사이즈 비율의 **토글·영속화** | Browser / Client | — | `document.cookie` 직접 쓰기 + DOM 즉시 반영 — Server Action/Route Handler 경유는 이 값들(비민감·비-httpOnly 필요)엔 왕복만 늘리는 과설계 |
| 리사이즈 드래그의 실시간 폭 계산 | Browser / Client | — | 마우스 이동마다 서버 왕복은 불가능 — 순수 DOM 이벤트+로컬 state, mouseup 1회만 서버(쿠키)에 영속 |

---

## Standard Stack

이 phase는 **신규 npm 패키지를 설치하지 않는다.** 매직바이트 스니핑(Don't Hand-Roll 참조), 정적 파일 서빙(`public/`), 쿠키 read/write(`next/headers` + `document.cookie`), 드래그 리사이즈(native `mousedown`/`mousemove`) 전부 플랫폼 기본 기능 또는 이미 설치된 스택으로 덮인다.

### Core (기존 의존성 재확인 — 버전 변경 없음)
| Library | Version(설치됨) | Purpose | 확인 방법 |
|---------|------|---------|-----------|
| next | 15.5.22 | Route Handler `request.formData()`(업로드), `cookies()`(테마 SSR), `public/` 정적 서빙 | package.json [VERIFIED: package.json:19] |
| drizzle-orm | 0.45.2 | `document_draft` 테이블 + `onConflictDoUpdate` upsert | package.json [VERIFIED: package.json:16], API 형태는 아래 인용 |
| zod | 4.4.3 | draft PUT body(`{content}`) 검증 — `documentSchema`/`autosaveBodySchema`와 동일 패턴 | `src/lib/validation.ts:55-67` [VERIFIED: src/lib/validation.ts:55-67] |
| lucide-react | 설치됨(package.json) | `Upload`/`AlertCircle`/`X`/`Columns2`/`PanelRightClose`/`PanelLeftClose`/`Moon`/`Sun`(UI-SPEC 지정 아이콘) | 이미 설치, 추가 설치 불필요 |
| Node.js `crypto.randomUUID()` / `fs/promises` | Node 24.2.0(글로벌) | uuid 파일명, 디렉터리 생성·쓰기 | `node --version` [VERIFIED: 로컬 실행 결과] — 둘 다 Node 표준 내장, import 없이 `crypto`/`fs`에서 가져옴 |

### Supporting
없음 — 매직바이트 검사기(아래 Don't Hand-Roll), 쿠키 읽기/쓰기, 드래그 리사이즈 모두 신규 의존성 없이 표준 API/직접 구현으로 해결된다.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 매직바이트 4종(png/jpeg/gif/webp)을 직접 비교하는 ~30줄 함수 | `file-type` npm 패키지 | png/jpeg/gif/webp 4종 고정 화이트리스트에는 과설계(ponytail 5단: 이미 있는 몇 줄이 라이브러리 감사 부담보다 싸다). CONTEXT도 "MIME+확장자 이중 검증"만 요구, 임의 포맷 자동판별은 요구하지 않음 |
| `public/uploads/`에 저장 + Next.js 기본 정적 서빙 | 전용 GET Route Handler(`app/uploads/[filename]/route.ts`)로 파일시스템 밖 디렉터리에서 서빙 | CONTEXT가 "dev 로컬 디스크" 범위로 명시 잠금 — `public/`은 zero-code로 Content-Type까지 자동 처리[CITED: 웹서치, Next.js public 폴더 규약]. 단점(서버리스 배포 시 런타임 쓰기가 재배포 없이 반영 안 됨)은 이 phase 범위 밖(S3 전환은 "추후" deferred) |
| 클라 테마 토글이 `document.cookie` 직접 쓰기 | Server Action으로 쿠키 set | Server Action은 서버 왕복 1회 + 폼/트랜지션 보일러플레이트가 필요[CITED: nextjs.org/docs cookies "Setting cookies is not supported during Server Component rendering... invoke a Server Function... or use a Route Handler"] — 테마처럼 비민감·즉시-반영이 핵심인 값에는 과설계. `document.cookie`는 표준 브라우저 API(rung 4) |
| 드래그 리사이즈를 네이티브 mouse 이벤트로 직접 구현 | `react-resizable-panels` 등 패널 라이브러리 | UI-SPEC Registry Safety가 이미 "네이티브 DOM 이벤트, 추가 라이브러리 없음"으로 잠금 — 리서치가 대안을 다시 여는 게 아니라 확정을 재확인 |

**Installation:** 불필요 — 신규 패키지 없음.

**버전 검증 근거:** 이번 세션에 `package.json`을 직접 읽어 next/drizzle-orm/zod 버전을 확인했다. 레지스트리 최신 대조는 Phase 4 RESEARCH에서 이미 수행되었고(같은 스택, 변경 없음) 이 phase에서 재확인할 신규 패키지가 없어 생략한다.

---

## Package Legitimacy Audit

**이 phase는 외부 패키지를 설치하지 않는다 — Package Legitimacy Gate 적용 대상 없음.**

매직바이트 검사, 정적 파일 서빙, 쿠키 R/W, 드래그 리사이즈 모두 Node/브라우저 표준 API 또는 이미 설치된 Next.js/Drizzle API로 해결된다(위 Standard Stack "Alternatives Considered" 참조).

**Packages removed due to [SLOP] verdict:** 없음
**Packages flagged as suspicious [SUS]:** 없음

---

## Architecture Patterns

### System Architecture Diagram

```
[브라우저]
  이미지 업로드 흐름
  ┌─ 툴바 image 버튼 클릭 ─┐         ┌─ 파일 드래그드롭 ─┐
  └───────────┬────────────┘         └─────────┬─────────┘
              ▼                                 ▼
       useImageUpload 훅(EditorPreviewLayout 소유)
              │  1. getView().dispatch(placeholder 삽입 "![업로드 중...]()")
              │  2. FormData(file) → POST /api/uploads?wsId=…
              ▼
     ┌──────────────────────────────────────────────┐
     │ Route Handler POST /api/uploads (runtime=nodejs)│
     │  requireRole(wsId, EDITOR) → formData() → File  │
     │  storage.saveUpload(file):                      │
     │    size>5MB? → 400                              │
     │    매직바이트 스니핑 실패? → 400                 │
     │    uuid 파일명 결정 → public/uploads/에 write    │
     │    반환 { url: "/uploads/{uuid}.{ext}" }         │
     └──────────────────────┬───────────────────────┘
                             ▼
       useImageUpload: 성공 → placeholder 문자열을 찾아
       "![원본파일명](url)"로 dispatch 치환
       실패 → placeholder 제거 + 에러 배너 상태 set
              │
              ▼
     EditorHost updateListener → onChange → 기존 자동저장 파이프라인(Phase 4, 변경 없음)

  draft 크래시 복구 흐름
  ┌─ 60초 타이머(입력 있었을 때만) ──▶ PUT /api/documents/:id/draft { content } (upsert)
  │
  └─ 문서 진입(RSC, d/[docId]/page.tsx)
       getDocument() + getDraft() 병렬 조회
       draft.updatedAt > document.updatedAt ?
         │yes                              │no
         ▼                                 ▼
   hasNewerDraft=true prop            평소처럼 렌더
         ▼
   ConfirmDialog 자동 open
     "복원" → getView().dispatch(draft.content로 전체 치환)
              → updateListener → 기존 자동저장(1s) 트리거
              → 자동저장 성공 시 서버가 draft 행 삭제(연쇄, 별도 호출 불필요)
     "폐기" → DELETE /api/documents/:id/draft
     "나중에" → 아무 것도 안 함(닫기만)

  테마/레이아웃 흐름
  RSC(app/layout.tsx) : await cookies() → theme 값 → <html data-theme=…>(없으면 속성 생략)
  RSC(d/[docId]/page.tsx 등) : layoutMode/splitRatio 쿠키 → DocumentWorkspace 초기 prop
  클라 토글 : document.cookie 직접 write + DOM(data-theme)/React state 즉시 반영 — API 호출 없음
  globals.css : [data-theme="dark"]{…} (명시 선택)
                @media(prefers-color-scheme:dark){ :root:not([data-theme]){…} } (첫 방문 OS 추종)
```

### Recommended Project Structure
```
src/
  lib/
    storage.ts                 # NEW — saveUpload(file): { url } | { error } 하나만 export, 매직바이트+uuid+fs 격리
  app/
    api/
      uploads/route.ts         # NEW — POST, requireRole(wsId, EDITOR), runtime=nodejs
      documents/[id]/
        draft/route.ts         # NEW — PUT(upsert)/DELETE(폐기)
  components/
    document/
      draft-controller.ts      # NEW — autosave-controller.ts와 동형의 순수 60s 컨트롤러
      useDraft.ts               # NEW — React 얇은 래퍼(autosave의 useAutosave.ts와 동형)
      DraftRecoveryDialog.tsx   # NEW — ConfirmDialog 확장(children에 "폐기" 인라인 버튼)
    editor/
      useImageUpload.ts         # NEW — 업로드 오케스트레이션 훅(EditorPreviewLayout에서 사용)
      ImageDropzone.tsx         # NEW — .editorPane 오버레이(드래그 중만 조건부 렌더)
      UploadErrorBanner.tsx     # NEW — 에디터 페인 상단 배너
      Toolbar.tsx                # MODIFIED — image id 특수 처리(파일 입력 open으로 가로채기)
    layout/
      LayoutModeToggle.tsx      # NEW — 3버튼 세그먼트, 제목 입력 행 우측
      ThemeToggle.tsx            # NEW — 사이드바 최하단 행
      EditorPreviewLayout.tsx    # MODIFIED — grid 변형 + 리사이즈 핸들 + getView 상위 노출
  db/schema.ts                  # MODIFIED — documentDraft 테이블 추가
drizzle/                        # drizzle-kit generate 산출물(신규 마이그레이션 1개)
```

### Pattern 1: 업로드 오케스트레이션은 Toolbar가 아니라 EditorPreviewLayout이 소유한다
**What:** Toolbar는 image 버튼 클릭을 가로채 숨겨진 `<input type="file">`을 열기만 하고, 실제 업로드(fetch, placeholder 삽입/치환, 에러 배너)는 `EditorPreviewLayout`(또는 그 아래 새 훅)이 담당한다.
**When to use:** 드롭존 오버레이·에러 배너가 UI-SPEC상 `.editorPane` 전체를 대상으로 하고(툴바 하위 요소가 아님), 플러그인 파일(`image.ts`)은 `run(state)` 순수 계약을 유지해야 하기 때문(TRD §6 1기능1파일 불변식 — 업로드는 플러그인이 담당할 일이 아니라 애초에 "플러그인이 아닌 별도 관심사").
**Example:**
```ts
// components/editor/Toolbar.tsx 발췌 — image만 특수 처리, 나머지 13개는 기존 그대로
onClick={() => {
  const view = getView();
  if (!view) return;
  if (plugin.id === "image") {
    onImageButtonClick(); // 부모(EditorPreviewLayout)가 넘겨준 콜백 — 숨김 input.click()
    return;
  }
  view.dispatch(plugin.run(view.state));
  view.focus();
}}
```
`image.ts` 플러그인 파일 자체(`run(state)`)는 삭제하지 않는다 — 계약 유지, 기존 `tests/editor/image.test.ts`도 그대로 통과해야 한다(순수 함수를 직접 테스트하지, 클릭 플로우를 테스트하지 않으므로).

### Pattern 2: placeholder는 좌표가 아니라 리터럴 문자열로 추적한다
**What:** CONTEXT가 고정한 placeholder 텍스트(`![업로드 중...]()`)를 업로드 완료/실패 시 `view.state.doc.toString().indexOf(placeholder)`로 다시 찾아 그 위치에 `dispatch`한다. CodeMirror의 `RangeSet`/`StateField` 데코레이션으로 위치를 실시간 추적하지 않는다.
**When to use:** 업로드는 비동기라 시작 시점의 `(from, to)` 오프셋이 응답이 돌아올 때까지 사용자의 다른 편집으로 무효화될 수 있다. 위치 추적 확장을 새로 만드는 대신, CONTEXT가 이미 확정한 "고정 placeholder 텍스트" 계약을 문자열 검색으로 활용하면 훨씬 적은 코드로 같은 효과를 낸다(ponytail: 이미 있는 계약을 재사용).
**Pitfall this avoids:** 좌표 기반 추적은 CodeMirror의 changes-mapping API를 올바르게 연쇄해야 하는 정확성 부담이 있다 — 리터럴 검색은 그 부담을 없애는 대신 "placeholder 텍스트가 우연히 사용자 문서에 이미 존재하는 경우"라는 훨씬 희귀한 edge case로 치환한다. 이 부담은 **동시 업로드 여러 건**일 때 커진다 — 아래 Common Pitfalls #2 참조.

### Pattern 3: 툴바 pressed/툴팁은 순수 CSS — JS 상태 불필요
**What:** UI-SPEC Toolbar Interaction Contract가 이미 완성된 CSS를 제공한다(`:active` pressed, 방향별 `transition-delay`로 "숨김 즉시/표시 300ms" 분리). 이 phase는 `Toolbar.module.css`만 수정하면 되고 `Toolbar.tsx`의 상태 로직은 건드리지 않는다(image 버튼 가로채기 제외).
**When to use:** 항상 — hover/pressed 같은 momentary 시각 상태는 React state로 옮기면 리렌더만 늘어난다(Don't Hand-Roll의 반대 방향: "네이티브 CSS가 있는데 JS로 재구현하지 않는다").
**Example:**
```css
/* Toolbar.module.css — UI-SPEC 원문 그대로 */
.button:active { background: var(--accent-weak); color: var(--accent); }
.tooltip { transition: opacity 0s linear 0s; }              /* 숨김 즉시 */
.buttonWrap:hover .tooltip { transition: opacity 0s linear 300ms; opacity: 1; } /* 표시 300ms 지연 */
```

### Pattern 4: draft 컨트롤러는 autosave-controller.ts를 그대로 본뜬다 — 디바운스 대신 "더티 플래그 + 주기 타이머"
**What:** `autosave-controller.ts`(Phase 4)와 동일하게 React-less 순수 함수로 분리하되, 로직은 다르다: 자동저장은 "입력 후 1초 조용하면 저장"(디바운스)이지만 draft는 "60초마다, 그 60초 안에 입력이 있었을 때만 저장"(주기 + 더티 플래그)이다.
**When to use:** TRD §7 "마지막 임시 저장 후 입력이 있었을 때만 1분 타이머가 upsert" — 무조건 60초마다 쏘면 입력 없는 문서도 계속 네트워크를 태운다.
**Example:**
```ts
// components/document/draft-controller.ts
export interface DraftControllerOptions {
  send: (content: string) => Promise<{ ok: boolean }>;
  intervalMs?: number; // 기본 60_000, 테스트에서만 override
}

export function createDraftController({ send, intervalMs = 60_000 }: DraftControllerOptions) {
  let dirty = false;
  let latestContent = "";
  const timer = setInterval(() => {
    if (!dirty) return;
    dirty = false;
    void send(latestContent);
  }, intervalMs);

  return {
    onContentChange(content: string) {
      latestContent = content;
      dirty = true;
    },
    dispose() {
      clearInterval(timer);
    },
  };
}
```
`setInterval`은 Phase 4의 `setTimeout` 디바운스와 마찬가지로 신규 의존성 없이 표준 API로 충분하다 — 테스트는 `vi.useFakeTimers()` + `vi.advanceTimersByTime(60_000)`으로 Phase 4 `autosave-controller.test.ts`와 동일한 패턴을 재사용한다.

### Pattern 5: draft 복구는 "dispatch 한 번"으로 끝난다 — 별도 강제저장 API 불필요
**What:** "복원" 클릭 시 `getView().dispatch({ changes: { from: 0, to: view.state.doc.length, insert: draftContent } })` 한 번만 호출한다. `EditorHost`의 `updateListener`(`EditorHost.tsx:51`, `update.docChanged` 시 `onChangeRef.current` 호출)는 프로그래매틱 dispatch도 동일하게 통과시키므로, 이 한 번의 dispatch가 `DocumentWorkspace.handleContentChange` → `scheduleSave` → 기존 1초 디바운스 자동저장 파이프라인을 자연스럽게 트리거한다.
**When to use:** "복원 클릭 → draft를 에디터에 적재 후 정식 저장"(CONTEXT 잠금)을 구현할 때. 별도의 "즉시 저장" 메서드를 `AutosaveController`에 새로 추가하지 않는다 — 1초 지연은 사용자에게 감지되지 않고, 이미 검증된 자동저장 경로(seq 가드 포함)를 재사용하는 편이 새 경로를 하나 더 만드는 것보다 안전하다.
**Integration point:** 이 dispatch를 하려면 `DocumentWorkspace`가 `EditorPreviewLayout` 안 깊숙이 있는 `EditorView`에 접근해야 한다 — 현재 `EditorPreviewLayout`은 `hostRef`를 내부에만 갖고 `Toolbar`에만 `getView` 콜백을 전달한다(`EditorPreviewLayout.tsx:20,30`). `EditorPreviewLayout` 자체를 `EditorHostHandle`과 동일한 패턴으로 `forwardRef`+`useImperativeHandle`화해 `getView`를 상위(`DocumentWorkspace`)로도 노출해야 한다 — Common Pitfalls #6 참조.
**Draft 자동 삭제와의 연쇄:** TRD §7 "정식 저장 성공 시에도 draft 삭제"를 `PUT /api/documents/:id`(자동저장 라우트) 내부에 구현해 두면(Pitfall #5 참조), 위 dispatch가 트리거한 자동저장이 성공하는 순간 서버가 draft를 지운다 — "복원" 버튼 핸들러가 draft 삭제를 별도로 호출할 필요가 없다.

### Pattern 6: 테마/레이아웃 초기값은 RSC의 `cookies()` 읽기, 토글은 클라의 `document.cookie` 쓰기
**What:** `src/app/layout.tsx`를 async Server Component로 바꿔 `await cookies()`로 `theme` 쿠키를 읽고 `<html data-theme={theme ?? undefined}>`를 렌더한다. 레이아웃 모드/리사이즈 비율은 문서 페이지에서만 의미가 있으므로 `d/[docId]/page.tsx`(또는 `w/[wsId]/layout.tsx`)에서 같은 방식으로 읽어 `DocumentWorkspace`에 prop으로 내려준다. 토글 버튼(클라 컴포넌트)은 `document.cookie = "theme=dark; path=/; max-age=31536000; samesite=lax"`를 직접 실행하고 동시에 `document.documentElement.dataset.theme = "dark"`로 DOM을 즉시 갱신한다.
**When to use:** 이 phase의 모든 영속 UI 설정(테마/레이아웃모드/리사이즈비율) — 셋 다 비민감·클라이언트가 소유해야 하는 값(서버 검증 대상 아님, `httpOnly` 불필요)이라 Server Action/Route Handler 왕복이 과설계다.
**Why not a Route Handler:** [CITED: nextjs.org/docs/app/api-reference/functions/cookies] "Setting cookies is not supported during Server Component rendering... invoke a Server Function from the client or use a Route Handler" — 이건 **RSC 렌더 중에** 쓸 수 없다는 것이지, 클라이언트가 쓸 수 없다는 뜻이 아니다. 클라 컴포넌트는 애초에 브라우저에서 실행되므로 `document.cookie`가 정확히 이 문제를 위한 표준 API다.
**Example (globals.css — 첫 방문 OS 추종):**
```css
/* 명시적 쿠키가 있을 때 (RSC가 data-theme을 심어줌) */
[data-theme="dark"] { --bg: #0f172a; --text: #f1f5f9; /* … UI-SPEC 12개 변수 */ }

/* 쿠키가 아직 없을 때(첫 방문)만 OS 설정을 따른다 — CONTEXT "첫 방문은 prefers-color-scheme 따름" */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) { --bg: #0f172a; --text: #f1f5f9; /* … 동일 12개, 값 중복 */ }
}
```
UI-SPEC의 다크 섹션은 `[data-theme="dark"]` 블록만 명시하고 이 `@media` 폴백 블록을 별도로 적어두지 않았다 — 그러나 CONTEXT의 "첫 방문은 prefers-color-scheme 따름" 요구를 충족하는 표준 방법은 이 두 블록 병행뿐이다(서버가 OS 다크모드 설정을 알 방법이 없다 — User-Agent Client Hints는 opt-in 헤더가 필요하고 브라우저 지원이 일관되지 않아 이 규모 프로젝트에 맞지 않는다). **Open Questions #1 참조.**

### Pattern 7: 리사이즈는 `mousedown`(핸들) → `mousemove`/`mouseup`(window)로 리스너를 옮긴다
**What:** 드래그 시작은 6px 히트 영역에서 감지하지만, 드래그 도중 커서가 그 영역을 벗어나도(빠르게 움직이면 흔함) 계속 추적해야 하므로 `mousemove`/`mouseup`은 `window`에 등록하고 `mouseup` 시 제거한다.
**When to use:** 네이티브 드래그 핸들 구현 시 표준 패턴. UI-SPEC이 라이브러리 없이 이걸 요구한다.
**Example:**
```tsx
function onHandleMouseDown(e: React.MouseEvent) {
  e.preventDefault();
  const container = containerRef.current!;
  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none"; // 드래그 중 텍스트 선택 방지 (Pitfall #10)
  function onMove(ev: MouseEvent) {
    const rect = container.getBoundingClientRect();
    const pct = ((ev.clientX - rect.left) / rect.width) * 100;
    setRatio(Math.min(80, Math.max(20, pct))); // UI-SPEC: 20~80% 클램프
  }
  function onUp() {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    document.cookie = `splitRatio=${ratioRef.current}; path=/; max-age=31536000; samesite=lax`; // mouseup 1회만 (UI-SPEC)
  }
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}
```

### Anti-Patterns to Avoid
- **`AbortController`로 이전 업로드/자동저장 취소:** NFR-1.2가 자동저장에 대해 이미 이 패턴을 명시적으로 배제했다(Phase 4 RESEARCH 확정). draft/업로드도 같은 원칙을 따라 취소 대신 무시(discard-by-comparison)로 처리한다.
- **draft 타이머를 자동저장과 같은 컨트롤러 인스턴스에 합치기:** CONTEXT가 "Phase 4 자동저장(1s)과 별개 타이머"로 명시했다 — 하나의 컨트롤러에 두 주기를 억지로 넣으면 seq 가드(자동저장 전용)와 upsert(draft 전용)의 동시성 모델이 섞여 테스트하기 어려워진다.
- **이미지 URL 검증을 클라이언트 Content-Type 헤더로 대체:** `File.type`(브라우저가 확장자/헤더로 추정한 값)은 사용자가 얼마든지 조작 가능한 파일을 업로드해 스푸핑할 수 있다 — 서버는 반드시 바이트 자체(매직넘버)를 본다.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| png/jpeg/gif/webp 매직바이트 판별 | 범용 파일 타입 감지 라이브러리 통합(`file-type` 등 수십 종 포맷 지원) | 4종 화이트리스트만 비교하는 ~30줄 함수(Code Examples 참조) | 임의 포맷 자동판별은 이 phase 요구가 아니다(CONTEXT: png/jpeg/gif/webp "만") — 신규 의존성 감사 부담이 이득보다 크다(ponytail 5단: 몇 줄로 되는 걸 패키지로 하지 않는다) |
| uuid 파일명 생성 | `uuid` npm 패키지 | Node 내장 `crypto.randomUUID()`(Node 14.17+, 프로젝트는 24.2.0) | 표준 라이브러리가 이미 있다(ponytail 3단) |
| 쿠키 파싱/직렬화 | `js-cookie` 등 클라 쿠키 라이브러리 | `document.cookie` 문자열 직접 조립(이 phase가 쓰는 값은 단순 key=value 3종뿐, 특수문자 없음) | 3개의 단순 값에 파싱 라이브러리는 과설계 — RSC 쪽은 이미 `next/headers`의 `cookies()`가 파싱을 대신한다 |
| 드래그 리사이즈 패널 | `react-resizable-panels`, `re-resizable` 등 | 네이티브 `mousedown`/`mousemove`/`mouseup`(Pattern 7) | UI-SPEC Registry Safety가 이미 잠금(신규 컴포넌트 라이브러리 금지) |
| 정적 파일 서빙 인프라 | Express 스타일 커스텀 정적 서버, 별도 CDN 설정 | `public/uploads/`(Next.js 기본 정적 서빙) | R2 범위가 "dev 로컬 디스크"로 잠겨 있고, S3 전환은 storage 모듈 교체로 미룬 명시적 결정 |

**Key insight:** 이 phase가 "새로 만들어야 하는" 것은 전부 **비즈니스 로직**(어떤 확장자를 허용할지, 어떤 조건에서 draft를 지울지, 어떤 비율로 클램프할지)이지 **인프라**(파일 감지, 쿠키 파싱, 드래그 프레임워크)가 아니다. 인프라를 패키지로 채우려는 유혹이 클수록, 이 phase의 실제 위험은 로직 쪽(placeholder 재검색 경합, draft 오탐 삭제, uncontrolled 에디터에 값 밀어넣기)에 있다는 뜻이다 — Common Pitfalls가 이 로직들을 다룬다.

---

## Common Pitfalls

### Pitfall 1: `File.type`(클라 Content-Type)을 신뢰해 확장자를 결정
**What goes wrong:** 공격자가 `.png`로 이름 붙인 실행 파일이나 SVG(XSS 벡터)를 업로드해도 브라우저의 `File.type`은 파일명 확장자를 보고 `image/png`라고 보고할 수 있다 — 서버가 이를 그대로 믿고 저장하면 검증이 무의미해진다.
**Why it happens:** `formData.get('file')`로 받은 `File` 객체의 `.type`은 클라이언트(브라우저)가 채운 메타데이터이지 서버가 검증한 값이 아니다.
**How to avoid:** 저장할 확장자는 **서버가 매직바이트를 스니핑해 직접 결정**한다(Code Examples "이미지 업로드" 참조) — `File.type`/`File.name`의 확장자는 참고만 하고 저장 경로 결정에 관여시키지 않는다. CONTEXT의 "MIME 타입 + 확장자 이중 검증"은 "클라 헤더와 서버 판정을 비교"가 아니라 "서버가 매직바이트(=MIME의 신뢰 가능한 대체)와 최종 저장 확장자를 자체 결정"으로 구현한다.
**Warning signs:** 저장 함수 시그니처에 `file.name`이나 `file.type`에서 뽑은 확장자를 파라미터로 받는 코드가 있다면 검증이 새고 있는 것.

### Pitfall 2: 동시(concurrent) 업로드 시 placeholder 리터럴 검색이 잘못된 위치를 치환
**What goes wrong:** 사용자가 이미지 버튼을 두 번 빠르게 누르거나 두 파일을 연달아 드롭하면 문서 안에 `![업로드 중...]()`가 두 개 생기고, `indexOf` 기반 치환이 항상 첫 번째 것만 찾아 두 번째 업로드의 결과를 첫 번째 자리에 잘못 끼워 넣을 수 있다.
**Why it happens:** Pattern 2의 리터럴 문자열 검색은 "정확히 하나의 placeholder만 존재"를 암묵적으로 가정한다.
**How to avoid:** `useImageUpload` 훅에 "업로드 진행 중" 플래그를 두고, 진행 중일 때는 이미지 버튼/드롭존을 비활성화(또는 무시)해 **동시 업로드 자체를 만들지 않는다** — UI-SPEC도 큐/다중 업로드 UI를 정의하지 않았으므로 이 제약은 스펙과 정합적이다.
**Warning signs:** 업로드 버튼에 disabled 상태가 없다, 또는 드롭존이 업로드 진행 중에도 계속 렌더된다.

### Pitfall 3: `file.size` 체크를 매직바이트 스니핑 뒤에 함
**What goes wrong:** 5MB 제한 확인 전에 `await file.arrayBuffer()`로 전체 파일을 메모리에 올리면, 제한을 넘는 대용량 파일도 일단 전부 읽은 뒤에야 거부된다 — 불필요한 메모리/시간 낭비(작은 DoS 표면).
**Why it happens:** "검증 순서"를 신경 쓰지 않고 스니핑 함수부터 작성하기 쉽다.
**How to avoid:** `formData.get('file')`로 얻은 `File` 객체는 `.size`가 이미 파싱된 메타데이터로 존재한다(내용을 읽지 않고 접근 가능) — **크기 체크를 매직바이트 스니핑보다 먼저** 수행해 초과분은 바이트를 읽지도 않고 즉시 400.
**Warning signs:** `saveUpload` 함수 안에서 `arrayBuffer()` 호출이 크기 비교보다 앞선다.

### Pitfall 4: 업로드 라우트에 `runtime = "nodejs"`를 빠뜨림
**What goes wrong:** Edge 런타임에서는 `fs/promises`(파일시스템 쓰기)를 쓸 수 없어 빌드/런타임 에러가 난다.
**Why it happens:** 다른 라우트(`documents/[id]/route.ts`)가 이미 `export const runtime = "nodejs";`를 쓰고 있어 낯설지 않지만, 새 라우트 파일을 만들 때 복사하는 걸 잊기 쉽다.
**How to avoid:** `app/api/uploads/route.ts` 최상단에 `export const runtime = "nodejs";`를 명시(기존 코드베이스 관례, `src/app/api/documents/[id]/route.ts:6` [VERIFIED: src/app/api/documents/[id]/route.ts:6] `export const runtime = "nodejs";`).
**Warning signs:** `next build` 또는 `next dev`에서 `fs` 관련 모듈 해석 에러.

### Pitfall 5: draft 삭제를 "affected rows 확인 없이" 자동저장 성공에 매핑
**What goes wrong:** TRD §7 seq 가드는 "옛 요청이 늦게 도착하면 자연 무시"를 허용한다(`autosaveDocument`가 0행 반영 시에도 200을 반환, `documents/[id]/route.ts:47-48`). 이 상황에서 무조건 draft를 지우면, 실제로는 아무것도 저장되지 않았는데(오래된 요청이 무시됨) 사용자의 유효한 draft가 사라지는 오탐이 생긴다.
**Why it happens:** "정식 저장 성공 시에도 draft 삭제"를 "PUT 요청이 200을 반환하면 삭제"로 단순화하면 seq 가드의 존재를 무시하게 된다.
**How to avoid:** `autosaveDocument()`는 이미 boolean을 반환한다(`src/lib/documents.ts:110-123`, `return rows.length === 1` [VERIFIED: src/lib/documents.ts:120-123]) — 이 반환값이 **실제로 반영됐을 때만** true다. 자동저장 라우트에서 `if (await autosaveDocument(...)) { await deleteDraft(id); }`처럼 반환값을 게이트로 써야 한다.
**Warning signs:** draft 삭제 호출이 `autosaveDocument`의 반환값과 무관하게 항상 실행된다.

### Pitfall 6: `EditorPreviewLayout`이 `getView`를 Toolbar에만 주고 상위(`DocumentWorkspace`)엔 노출하지 않음
**What goes wrong:** draft 복구("복원" 클릭)와 이미지 업로드 오케스트레이션 둘 다 `EditorView`에 직접 `dispatch`해야 하는데, 현재 `EditorPreviewLayout.tsx`는 `hostRef`를 자기 안에만 갖고 `getView` 콜백을 `Toolbar`에게만 넘긴다(`EditorPreviewLayout.tsx:20,30`). `DocumentWorkspace`가 이 draft 복구를 트리거하려면 뷰에 접근할 방법이 없다.
**Why it happens:** Phase 2/4까지는 `Toolbar`만 뷰가 필요했다 — 이 phase에서 처음으로 "에디터 밖(다이얼로그)에서 에디터 내용을 갈아끼우는" 요구가 생긴다.
**How to avoid:** `EditorPreviewLayout`을 `EditorHostHandle`과 동일한 패턴(`forwardRef` + `useImperativeHandle`)으로 확장해 `getView`를 상위로도 노출한다. 또는 `useImageUpload`/draft 복구 로직을 `EditorPreviewLayout` 내부로 끌어올려(Pattern 1처럼) `DocumentWorkspace`가 뷰에 직접 접근할 필요 자체를 없앤다 — 둘 다 유효하며 플래너 재량(CONTEXT `Claude's Discretion`).
**Warning signs:** `DocumentWorkspace.tsx`에 `EditorView`나 CodeMirror import가 등장한다(계층 위반 신호) — 대신 `EditorPreviewLayout`이 노출하는 명령형 API(`loadDraft(content)` 같은 상위 레벨 메서드)를 통해서만 접근해야 계층이 깨끗하다.

### Pitfall 7: draft 비교(`draft.updated_at > document.updated_at`)를 서버-클라 시계 차이에 노출
**What goes wrong:** 두 타임스탬프를 각각 다른 요청(클라 fetch 두 번)에서 받아 클라이언트에서 비교하면 안 된다 — 네트워크 지연이 비교 결과를 흔들 수 있다.
**Why it happens:** "RSC가 이미 계산해 내려준다"(UI-SPEC 잠금)를 놓치고 클라 컴포넌트에서 두 값을 각각 fetch하려는 유혹.
**How to avoid:** `d/[docId]/page.tsx`(RSC)가 `getDocument()`와 새 `getDraft(documentId)`를 **같은 요청 컨텍스트 안에서** 병렬 조회(`Promise.all`)하고, `draft.updatedAt > document.updatedAt` 비교도 서버에서 끝내 `hasNewerDraft: boolean` + `draftContent: string | null`만 클라로 내려준다(UI-SPEC "RSC가 draft.updated_at > document.updated_at을 이미 계산해 prop으로 내려준다" 고정).
**Warning signs:** 클라 컴포넌트 안에 `new Date(draft.updatedAt) > new Date(doc.updatedAt)` 같은 비교 코드가 있다.

### Pitfall 8: `cookies()`를 클라 컴포넌트에서 import 시도
**What goes wrong:** `next/headers`의 `cookies()`는 서버 전용 API다 — `"use client"` 컴포넌트에서 import하면 빌드 에러가 난다.
**Why it happens:** 토글 버튼(클라 컴포넌트)이 "지금 테마가 뭔지"를 알아야 아이콘/문구를 바꾸는데(UI-SPEC "라이트일 때 Moon, 다크일 때 Sun"), `cookies()`로 직접 읽으려 시도하기 쉽다.
**How to avoid:** 초기 테마 값은 RSC가 prop으로 클라 컴포넌트에 내려주거나(초기 렌더), 클라 컴포넌트가 `document.documentElement.dataset.theme`(DOM에서 직접 읽기, RSC가 이미 심어둔 값)를 mount 시 1회 읽는다. 이후 토글 클릭마다 로컬 state로 관리한다.
**Warning signs:** `"use client"` 파일 상단에 `import { cookies } from "next/headers"`.

### Pitfall 9: `cookies()` 도입이 로그인/가입 페이지까지 강제로 동적 렌더링시킴을 인지하지 못함
**What goes wrong:** `src/app/layout.tsx`는 `(auth)`와 `(main)` 라우트 그룹 전체를 감싼다(최상위 RootLayout) — 여기서 `cookies()`를 호출하면 로그인/가입 페이지를 포함한 **모든** 라우트가 동적 렌더링으로 전환된다[CITED: nextjs.org/docs cookies "Using it in a layout or page will opt a route into dynamic rendering"].
**Why it happens:** 테마를 "사이트 전역"으로 자연스럽게 두려다 보면 최상위 layout이 가장 편한 자리로 보인다.
**How to avoid:** 이 프로젝트는 이미 세션 기반 인증(Auth.js)과 `requireRole`(DB 조회)로 사실상 모든 인증된 라우트가 동적이다(`w/[wsId]/layout.tsx`가 매 요청 DB 쿼리를 이미 수행 — `layout.tsx:31,34` [VERIFIED: src/app/(main)/w/[wsId]/layout.tsx:31,34]) — 로그인 페이지 하나가 정적 최적화를 잃는 것은 이 규모에서 실질적 비용이 없다. **막을 필요는 없지만, 플래너가 "왜 모든 페이지가 동적으로 바뀌었지?"라고 놀라지 않도록 의도된 트레이드오프임을 문서화**한다.
**Warning signs:** 없음(의도된 동작) — 다만 `next build` 출력에서 이전에 static이던 라우트(있었다면)가 dynamic으로 바뀐 걸 발견했을 때 이 항목을 참조.

### Pitfall 10: 드래그 리사이즈 중 텍스트 선택/커서 깜빡임
**What goes wrong:** `mousemove` 핸들러만 구현하고 `user-select`/커서 고정을 빼먹으면, 빠르게 드래그할 때 에디터·미리보기의 텍스트가 파랗게 선택되거나 커서가 매 프레임 기본 화살표로 깜빡인다.
**Why it happens:** 핸들 자체의 `cursor: col-resize` CSS만 있고, 드래그 동안 커서가 다른 요소(에디터 텍스트 등) 위를 지나가면 그 요소의 CSS(`cursor: text` 등)가 우선한다.
**How to avoid:** `mousedown` 시점에 `document.body.style.cursor = "col-resize"`와 `document.body.style.userSelect = "none"`을 강제로 걸고 `mouseup`에서 되돌린다(Pattern 7 예시 참조) — 드래그 중엔 body 전체가 커서/선택을 통제하게 한다.
**Warning signs:** 수동 테스트에서 빠른 드래그 시 커서가 깜빡이거나 인접 텍스트가 파랗게 선택된다.

---

## Code Examples

### 이미지 업로드 — storage 모듈(매직바이트 스니핑, 신규 의존성 0)
```ts
// src/lib/storage.ts — TRD §8 "저장 함수 하나 교체로 끝나도록 업로드 경로를 한 모듈에 가둔다"
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_BYTES = 5 * 1024 * 1024; // CONTEXT: 최대 5MB

// 매직바이트 서명 — offset 0 기준. [CITED: 웹서치 cross-check, PNG Wikipedia + file-signature 레퍼런스]
function sniffImageType(buf: Buffer): { ext: string } | null {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
      && buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a) {
    return { ext: "png" };
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: "jpg" };
  }
  if (buf.length >= 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38
      && (buf[4] === 0x37 || buf[4] === 0x39) && buf[5] === 0x61) {
    return { ext: "gif" };
  }
  if (buf.length >= 12 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46
      && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) {
    return { ext: "webp" };
  }
  return null;
}

export async function saveUpload(
  file: File,
): Promise<{ url: string } | { error: "TOO_LARGE" | "BAD_TYPE" }> {
  if (file.size > MAX_BYTES) return { error: "TOO_LARGE" }; // Pitfall 3: 바이트 읽기 전에 먼저 체크

  const buf = Buffer.from(await file.arrayBuffer());
  const sniffed = sniffImageType(buf); // Pitfall 1: file.type/file.name은 참고하지 않는다
  if (!sniffed) return { error: "BAD_TYPE" };

  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${randomUUID()}.${sniffed.ext}`; // CONTEXT: uuid 파일명, 클라 경로 미신뢰
  await writeFile(path.join(UPLOAD_DIR, filename), buf);

  return { url: `/uploads/${filename}` }; // public/uploads/ → Next.js가 그대로 정적 서빙
}
```

### 이미지 업로드 — Route Handler
```ts
// src/app/api/uploads/route.ts
import type { NextRequest } from "next/server";
import { ForbiddenError, forbiddenResponse, requireRole } from "@/lib/rbac";
import { saveUpload } from "@/lib/storage";

export const runtime = "nodejs"; // Pitfall 4: fs 접근에 필수

export async function POST(req: NextRequest) {
  const wsId = req.nextUrl.searchParams.get("wsId");
  if (!wsId) return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });

  try {
    await requireRole(wsId, "EDITOR"); // CONTEXT: EDITOR+ 게이트
  } catch (err) {
    if (err instanceof ForbiddenError) return forbiddenResponse();
    throw err;
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const result = await saveUpload(file);
  if ("error" in result) {
    const message =
      result.error === "TOO_LARGE"
        ? "이미지 크기는 5MB를 넘을 수 없어요."
        : "PNG, JPEG, GIF, WEBP 형식만 업로드할 수 있어요."; // UI-SPEC Copywriting Contract 문구 재사용
    return Response.json({ error: message }, { status: 400 });
  }

  return Response.json({ url: result.url }, { status: 200 });
  // 원본 파일명은 서버가 돌려줄 필요 없음 — 클라가 File.name을 이미 갖고 있음(alt 텍스트 조립은 클라)
}
```

### document_draft — 스키마 추가
```ts
// src/db/schema.ts — TRD §3 DDL 1:1 대응 (document_id PK, content, updated_at)
export const documentDraft = pgTable("document_draft", {
  documentId: uuid("document_id")
    .primaryKey()
    .references(() => document.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```
마이그레이션은 `pnpm drizzle-kit generate` → `pnpm drizzle-kit migrate`(CLAUDE.md 지정 명령)로 생성한다.

### document_draft — upsert (Drizzle `onConflictDoUpdate`)
```ts
// src/lib/documents.ts에 추가할 함수 형태 — API 시그니처는 설치된 drizzle-orm에서 직접 확인
// [VERIFIED: node_modules/drizzle-orm/pg-core/query-builders/insert.d.ts:142-171]
//   .onConflictDoUpdate({ target: cars.id, set: { brand: 'Porsche' } })  ← 공식 타입 정의 주석의 예시를 인용
export async function upsertDraft(documentId: string, content: string, client: DbClient = db) {
  await client
    .insert(documentDraft)
    .values({ documentId, content })
    .onConflictDoUpdate({
      target: documentDraft.documentId,
      set: { content, updatedAt: new Date() },
    });
}

export async function getDraft(documentId: string, client: DbClient = db) {
  const [row] = await client.select().from(documentDraft).where(eq(documentDraft.documentId, documentId));
  return row ?? null;
}

export async function deleteDraft(documentId: string, client: DbClient = db) {
  await client.delete(documentDraft).where(eq(documentDraft.documentId, documentId));
}
```

### draft 삭제를 자동저장 성공에 게이트 (Pitfall 5)
```ts
// src/app/api/documents/[id]/route.ts PUT 핸들러 — 기존 로직에 한 줄 추가
const saved = await autosaveDocument(id, content, title, seq); // 기존, 반환값 이미 boolean
if (saved) {
  await deleteDraft(id); // TRD §7 "정식 저장 성공 시에도 draft 삭제" — 반영 안 됐으면(false) 지우지 않는다
}
return Response.json({ seq }, { status: 200 });
```

### 테마 — RSC에서 읽기 (`document.cookie` 쓰기는 Pattern 6 예시 참조)
```tsx
// src/app/layout.tsx
import { cookies } from "next/headers"; // [CITED: nextjs.org/docs/app/api-reference/functions/cookies]

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies(); // Next.js 15: cookies()는 async — await 필수
  const theme = cookieStore.get("theme")?.value; // "dark" | "light" | undefined(첫 방문)

  return (
    <html lang="ko" className={/* 기존 폰트 변수 */""} data-theme={theme} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Next.js 14 이하 `cookies()` 동기 함수 | Next.js 15부터 `cookies()`는 **async**(`await` 필수, 구버전 호환을 위해 동기 접근도 잠정 허용되지만 향후 제거 예정) | v15.0.0-RC[CITED: nextjs.org/docs cookies "Version History"] | 이 phase의 모든 RSC 쿠키 읽기 코드는 `await cookies()`로 작성해야 한다 — 프로젝트가 이미 15.5.22를 쓰므로 처음부터 async로 작성하면 문제없음 |
| Route Handler `context.params`가 동기 객체 | Next.js 15부터 `params`는 **Promise** — `await params` 필요 | v15.0.0-RC[CITED: nextjs.org/docs route.js "Version History"] | 이미 프로젝트 전역에 적용돼 있음(`documents/[id]/route.ts:15` 등) — 신규 라우트(`uploads/route.ts`, `documents/[id]/draft/route.ts`)도 동일 패턴을 따라야 한다 |

**Deprecated/outdated:** 없음 — 이 phase가 쓰는 API(`request.formData()`, `cookies()`, Drizzle `onConflictDoUpdate`)는 전부 현재 권장 방식이다.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | `public/uploads/`에 런타임 쓰기가 이 프로젝트의 배포 환경(로컬 dev, `next start` 가정)에서 재배포 없이 즉시 서빙된다 | Standard Stack "Alternatives Considered", Don't Hand-Roll | 프로덕션이 서버리스(Vercel 등)로 바뀌면 `public/`은 빌드 시점에 고정되어 런타임 쓰기가 반영되지 않는다 — CONTEXT가 "dev 로컬 디스크"로 명시 잠갔으므로 현재는 위험 낮음, S3 전환 시 storage 모듈 교체로 해결(TRD §8 이미 이 경로를 예정) |
| A2 | draft 복구 dispatch가 트리거하는 자동저장이 1초 이내에 완료되어 사용자가 "정식 저장"으로 체감한다 | Architecture Patterns Pattern 5 | 네트워크가 느리면 "복원" 클릭 후 잠깐 저장 상태 바가 "저장 중"으로 남아있는 게 보일 수 있음 — 기능적으로는 문제없으나(seq 가드가 정확성 보장), 플래너가 즉시 저장이 필요하다고 판단하면 `AutosaveController`에 `flush()` 메서드 추가를 고려해야 함(신규 메서드, 이 리서치는 불필요하다고 판단했으나 최종 결정은 플래너 재량) |
| A3 | `@media (prefers-color-scheme: dark)` CSS 블록 추가가 UI-SPEC이 명시하지 않은 범위라도 CONTEXT 요구("첫 방문은 prefers-color-scheme 따름")를 만족시키기 위해 필요하다는 판단 | Architecture Patterns Pattern 6, Open Questions #1 | UI-SPEC 체커가 "다크 섹션은 `[data-theme="dark"]` 블록만"으로 승인했다면 이 추가 블록이 범위 이탈로 보일 수 있음 — planner가 UI-SPEC과 CONTEXT 중 무엇을 우선할지 명시적으로 정해야 함 |
| A4 | `POST /api/uploads`에 workspaceId를 쿼리 파라미터(`?wsId=`)로 전달하는 것이 폼 필드로 전달하는 것보다 낫다는 판단(둘 다 유효, 코드베이스에 선례 없음) | Code Examples "이미지 업로드 — Route Handler" | 사소한 설계 선택 — 틀려도 플래너가 쉽게 바꿀 수 있음(리스크 낮음) |

---

## Open Questions

1. **다크 테마 첫 방문 폴백을 CSS `@media`로 구현할지, UI-SPEC을 그대로(명시 쿠키만) 따를지**
   - What we know: CONTEXT 잠금 "첫 방문은 prefers-color-scheme 따름"과 UI-SPEC의 다크 섹션(`[data-theme="dark"]` 블록만 명시)이 문면상 완전히 정합하지 않는다 — UI-SPEC이 이 폴백 CSS를 빠뜨렸거나, "첫 방문"을 서버가 아닌 클라 JS로 처리하는 걸 암묵 전제했을 수 있다.
   - What's unclear: 플래너가 Pattern 6의 `@media` 이중 블록(값 중복 12개)을 채택할지, 아니면 클라이언트에서 `window.matchMedia('(prefers-color-scheme: dark)')`로 첫 방문 시 1회 감지해 쿠키를 즉시 써넣는 JS 방식(FOUC 위험 약간 있음 — 첫 페인트는 라이트로 그려졌다가 JS 실행 후 바뀔 수 있음)을 택할지.
   - Recommendation: `@media` CSS 이중 블록(Pattern 6)을 권장 — FOUC가 완전히 없고 신규 JS도 없다. 값 중복은 12개 변수뿐이라 유지보수 부담이 크지 않다.

2. **draft 복구를 위한 `EditorView` 접근 경로 — `EditorPreviewLayout` forwardRef 확장 vs 업로드/복구 로직을 그 안으로 끌어올리기**
   - What we know: 둘 다 Pitfall 6의 문제를 해결한다.
   - What's unclear: 어느 쪽이 이 phase의 나머지 요구(이미지 업로드 오케스트레이션도 같은 `EditorView` 접근이 필요)와 더 잘 맞는지는 실제 컴포넌트 트리를 짜보기 전엔 확정하기 어렵다.
   - Recommendation: 업로드 오케스트레이션과 draft 복구 둘 다 `EditorPreviewLayout` 레벨로 끌어올리는 쪽을 권장(Pattern 1이 이미 업로드에 대해 이렇게 권장) — 그러면 `DocumentWorkspace`는 여전히 CodeMirror를 몰라도 되고, `hasNewerDraft`/`draftContent` prop만 `EditorPreviewLayout`에 전달하면 된다.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| PostgreSQL (로컬, 5433) | `document_draft` 마이그레이션·upsert 테스트 | ✓ | 확인됨(`pg_isready` accepting connections) | — |
| Node.js | `crypto.randomUUID()`, `fs/promises`, 업로드 라우트 | ✓ | v24.2.0 | — |
| pnpm | 전 명령(CLAUDE.md 고정) | ✓ | 10.18.3 | — |
| 로컬 디스크 쓰기 권한(`public/uploads/`) | 이미지 업로드 저장 | ✓(로컬 dev 환경, 별도 확인 불필요) | — | — |

**Missing dependencies with no fallback:** 없음.
**Missing dependencies with fallback:** 없음 — 이 phase의 모든 의존성이 이미 사용 가능하다.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (`vitest.config.ts`, `environment: "node"`) |
| Config file | `/Users/codevillain/Claude-Code-Expert/markdown-kms/vitest.config.ts` [VERIFIED: vitest.config.ts:1-33] |
| Quick run command | `pnpm vitest run tests/documents/draft-controller.test.ts`(신규 파일 예시) |
| Full suite command | `pnpm vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| EDIT-09 | 서버가 매직바이트로 png/jpeg/gif/webp만 허용하고, 5MB 초과·비허용 포맷을 거부한다 | unit | `pnpm vitest run tests/lib/storage.test.ts -t "sniff"` | ❌ Wave 0 |
| EDIT-09 | `POST /api/uploads`가 VIEWER를 403으로 거부하고 EDITOR 이상만 허용한다 | integration | `pnpm vitest run tests/uploads/rbac.test.ts` | ❌ Wave 0 |
| EDIT-10 | 툴바 CSS 클래스가 `:active`/`transition-delay` 규칙을 갖는다 | manual-only(시각 CSS, UI-SPEC이 이미 값 확정) | — | 해당 없음 — Playwright 시각 회귀는 이 규모에서 과설계, 코드 리뷰로 충분 |
| EDIT-11 | draft 컨트롤러가 "입력 없으면 60초 타이머에도 upsert하지 않는다" / "입력 있으면 60초 후 upsert" | unit | `pnpm vitest run tests/documents/draft-controller.test.ts` | ❌ Wave 0 |
| EDIT-11 | 자동저장이 실제로 반영됐을 때만(`saved===true`) draft를 삭제한다(Pitfall 5) | integration | `pnpm vitest run tests/documents/draft-autodelete.test.ts` | ❌ Wave 0 |
| EDIT-11 | `draft.updatedAt > document.updatedAt`일 때만 `hasNewerDraft=true`를 계산한다 | unit | `pnpm vitest run tests/documents/draft-comparison.test.ts` | ❌ Wave 0 |
| EDIT-12 | 쿠키 값에 따라 `<html data-theme>`가 올바르게 렌더된다(쿠키 없음/light/dark 3케이스) | integration(RSC 렌더 테스트 또는 Playwright) | `pnpm vitest run tests/theme/rsc-cookie.test.ts` (또는 e2e) | ❌ Wave 0 |
| EDIT-12 | 리사이즈 비율이 20~80%로 클램프된다 | unit | `pnpm vitest run tests/layout/resize-clamp.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** 해당 태스크가 건드린 파일의 테스트만(`pnpm vitest run <file>`)
- **Per wave merge:** `pnpm vitest run`(전체)
- **Phase gate:** 전체 테스트 green + `tsc --noEmit` clean 후 `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/lib/storage.test.ts` — 매직바이트 판별 4종 + 크기 초과 + 비허용 포맷 케이스
- [ ] `tests/uploads/rbac.test.ts` — VIEWER 403, EDITOR 200 (기존 `tests/rbac/matrix.test.ts` 패턴 재사용 가능)
- [ ] `tests/documents/draft-controller.test.ts` — `tests/documents/autosave-controller.test.ts`와 동형의 fake-timer 테스트
- [ ] `tests/documents/draft-autodelete.test.ts` — seq 역순 도착 시 draft가 살아남는지(Pitfall 5 회귀 방지)
- [ ] `tests/documents/draft-comparison.test.ts` — RSC 비교 로직(순수 함수로 분리해 테스트 가능하게 — 예: `isDraftNewer(draft, doc)`)
- [ ] `tests/layout/resize-clamp.test.ts` — 20~80% 클램프 순수 함수 테스트

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|-----------------|---------|-------------------|
| V4 Access Control | yes | `requireRole(wsId, "EDITOR")` — 업로드·draft PUT/DELETE 전부 이 게이트를 통과(기존 `src/lib/rbac.ts` 재사용, 신규 게이트 로직 없음) |
| V5 Input Validation | yes | 업로드: 매직바이트 스니핑(서버, 클라 Content-Type 미신뢰) + 5MB 크기 캡. draft: `z.object({content: z.string()})` (기존 `zod` 패턴, `src/lib/validation.ts` 확장) |
| V12 (OWASP ASVS 4.x) File and Resources / 파일 업로드 | yes | uuid 파일명(경로순회 원천 차단 — 클라 문자열이 파일시스템 경로에 전혀 관여하지 않음), 저장 디렉터리 고정(`path.join(process.cwd(), "public", "uploads")`, 상위 이동 불가), 확장자는 서버가 매직바이트로 결정(스니핑 실패 시 저장 자체를 거부) |
| V6 Cryptography | no | 이 phase는 신규 비밀/토큰을 다루지 않는다(초대 토큰 HMAC은 Phase 7 범위) |

### Known Threat Patterns for Next.js 15 App Router + 로컬 파일 업로드

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Content-Type 스푸핑으로 악성 파일을 이미지로 위장 업로드(예: 실행 파일에 `.png` 확장자) | Tampering | 서버 매직바이트 스니핑 — 클라 `File.type`/`file.name` 확장자는 저장 결정에 전혀 관여하지 않음(Pitfall 1) |
| 경로순회(`../../etc/passwd` 류 파일명)로 업로드 디렉터리 밖에 쓰기 | Tampering | 저장 파일명이 100% 서버 생성 uuid — 클라가 보낸 어떤 문자열도 `path.join`에 들어가지 않음(원천 차단, sanitize가 아니라 애초에 입력을 안 씀) |
| 대용량 파일 반복 업로드로 디스크 고갈(DoS) | Denial of Service | 5MB 캡 + 크기 우선 체크(Pitfall 3) — 워크스페이스별/전체 업로드 총량 제한은 이 phase 범위 밖(CONTEXT가 언급하지 않음, R2 스코프) |
| VIEWER가 업로드/draft 쓰기 API를 직접 호출(UI 우회) | Elevation of Privilege | `requireRole(wsId, "EDITOR")`가 모든 변경 API의 유일한 진짜 경계(CLAUDE.md 불변식) — UI 버튼 숨김은 보안이 아님 |
| SVG 업로드를 통한 저장형 XSS(SVG는 `<script>` 포함 가능) | Tampering/XSS | 허용 포맷이 png/jpeg/gif/webp뿐(SVG 제외, CONTEXT 잠금) — 매직바이트 화이트리스트가 SVG를 애초에 거부하므로 별도 SVG sanitize 불필요 |

---

## Sources

### Primary (HIGH confidence)
없음 — 이 phase는 Context7 MCP가 세션에 연결되지 않아 1차 소스는 공식 웹 문서 직접 fetch로 대체했다(아래 Secondary).

### Secondary (MEDIUM confidence)
- [Next.js `route.js` API Reference](https://nextjs.org/docs/app/api-reference/file-conventions/route) — Route Handler의 `request.formData()`, `cookies()` 사용법, `params` Promise화 확인
- [Next.js `cookies()` API Reference](https://nextjs.org/docs/app/api-reference/functions/cookies) — async 함수, RSC 읽기 전용/쓰기는 Server Function·Route Handler 전용, 동적 렌더링 opt-in 확인
- 매직바이트 시그니처 — 2개 이상 독립 소스 교차검증(Wikipedia PNG 문서 + file-signature 레퍼런스 사이트) — `gsd_run query classify-confidence --provider websearch --verified` → MEDIUM

### Tertiary (LOW confidence)
- `public/` 폴더 외부 디렉터리 서빙 관련 웹서치 결과(공식 문서가 이 사용 사례를 직접 다루지 않아 커뮤니티 논의 종합) — 이 phase는 이 경로를 채택하지 않으므로(A1 참조 — `public/uploads/` 직접 사용) 실질 영향 낮음

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — 신규 패키지가 없어 "무엇을 설치할지" 자체가 질문이 아니다. 기존 버전은 `package.json` 직접 읽기로 확인.
- Architecture: MEDIUM — TRD/CONTEXT/UI-SPEC이 프로토콜·CSS·경로를 잠갔지만, 컴포넌트 트리 배선(특히 `EditorView` 상위 노출, 업로드 오케스트레이션 위치)은 기존 코드를 읽고 추론한 설계 판단.
- Pitfalls: MEDIUM-HIGH — 대부분 기존 코드(`autosaveDocument`의 boolean 반환, `EditorHost`의 uncontrolled 마운트, `documents/[id]/route.ts`의 `runtime="nodejs"` 관례)를 직접 읽어 도출했으나, 매직바이트 값 자체는 웹서치 교차검증(MEDIUM)에 의존.

**Research date:** 2026-08-08
**Valid until:** 2026-09-07 (30일 — 안정 스택, Next.js/Drizzle API 변경 속도를 고려한 표준 유효기간)
