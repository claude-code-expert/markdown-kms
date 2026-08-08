---
phase: 05-editor-enhancements-personalization
reviewed: 2026-08-08T00:00:00Z
depth: deep
files_reviewed: 25
files_reviewed_list:
  - src/lib/storage.ts
  - src/app/api/uploads/route.ts
  - src/lib/documents.ts
  - src/lib/validation.ts
  - src/app/api/documents/[id]/route.ts
  - src/app/api/documents/[id]/draft/route.ts
  - src/components/editor/useImageUpload.ts
  - src/components/editor/ImageDropzone.tsx
  - src/components/editor/UploadErrorBanner.tsx
  - src/components/editor/Toolbar.tsx
  - src/components/document/draft-controller.ts
  - src/components/document/useDraft.ts
  - src/components/document/useAutosave.ts
  - src/components/document/autosave-controller.ts
  - src/components/document/DraftRecoveryDialog.tsx
  - src/components/document/DocumentWorkspace.tsx
  - src/components/ui/ConfirmDialog.tsx
  - src/components/layout/EditorPreviewLayout.tsx
  - src/components/layout/LayoutModeToggle.tsx
  - src/components/layout/ThemeToggle.tsx
  - src/components/tree/FolderTree.tsx
  - src/app/globals.css
  - src/app/layout.tsx
  - src/app/(main)/w/[wsId]/d/[docId]/page.tsx
  - src/db/schema.ts
findings:
  critical: 2
  warning: 4
  info: 2
  total: 8
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-08-08
**Depth:** deep
**Files Reviewed:** 25
**Status:** issues_found

## Summary

RBAC 게이트(EDITOR+ before write, uuid fail-closed guard), IDOR 방지(workspace-scoped
document 조회), autosave seq 가드, draft 삭제의 boolean 게이팅(Pitfall 5), path
traversal 방지(uuid 파일명, 확장자 서버 결정)는 설계대로 정확히 구현되어 있고 각
불변식을 지키는 회귀 테스트도 있다. 다만 두 곳에서 문서화된 보안/신뢰성 보장이 실제
호출 순서·에러 경로에서는 성립하지 않는다: (1) 업로드 크기 상한이 요청 바디 전체가
이미 메모리에 버퍼링된 뒤에야 검사되고, (2) 임시 저장(draft) 컨트롤러가 서버 응답을
확인하기 전에 낙관적으로 dirty 플래그를 지우면서 실패를 흡수(unhandled rejection)해
크래시 복구 기능 자체의 데이터 손실 가능성을 만든다. 나머지는 마크다운 인젝션·쿠키
검증 비일관성 등 중간~경미 등급이다.

## Critical Issues

### CR-01: 임시 저장 실패가 조용히 흡수되어 크래시 복구용 draft가 진부화(data loss)

**File:** `src/components/document/draft-controller.ts:20-26`
**Issue:** `dirty`는 `send()` 호출 *이전에* 낙관적으로 `false`로 지워진다(20-24행). `send`가
실패(HTTP 4xx/5xx, `{ok:false}`) 하거나 `fetch` 자체가 reject(오프라인 등)해도 `dirty`
플래그와 재시도 로직이 전혀 없어 다음 콘텐츠 변경이 있을 때까지 이 60초 틱의 draft는
서버에 반영되지 않은 채 버려진다. 게다가 `void send(latestContent)`는 `.catch()`가 없다
— `useDraft.ts:13-20`의 `send`는 `await fetch(...)`가 던지면 그대로 reject하는 async
함수이므로, 이 경로는 **unhandled promise rejection**이 된다.

이 기능의 존재 이유가 "브라우저 크래시 시 마지막 60초 이내 내용을 복구"하는 것인데,
정작 그 저장이 실패했을 때 재시도·상태 노출·에러 처리가 전무해 실패한 순간 이후의
편집 내용은 크래시 복구 대상에서 영구히 빠진다. 자매 컨트롤러인
`autosave-controller.ts`는 같은 패턴(낙관적 seq 증가)을 쓰지만 `pending`을 성공 여부와
무관하게 보존해 `retry()`가 항상 가능하고 `onStatus("error")`로 UI에 실패를 노출한다
— draft-controller는 이 두 안전장치가 모두 없다.

**Fix:**
```typescript
export function createDraftController({
  send,
  intervalMs = 60_000,
}: DraftControllerOptions): DraftController {
  let dirty = false;
  let latestContent = "";
  const timer = setInterval(() => {
    if (!dirty) return;
    const content = latestContent;
    void send(content)
      .then((res) => {
        if (res.ok) {
          // 이 틱 이후 새 입력이 없었을 때만 지운다 — 성공 응답이 늦게 온 사이
          // 사용자가 계속 타이핑했다면 dirty를 유지해 다음 틱이 재전송하게 한다.
          if (latestContent === content) dirty = false;
        }
      })
      .catch(() => {
        // 네트워크 실패 — dirty를 켜진 채로 두어 다음 틱이 재시도한다.
      });
  }, intervalMs);

  return {
    onContentChange(content) {
      latestContent = content;
      dirty = true;
    },
    dispose() {
      clearInterval(timer);
    },
  };
}
```

### CR-02: 업로드 크기 상한이 전체 요청 바디를 버퍼링한 뒤에야 검사됨 (DoS)

**File:** `src/lib/storage.ts:64`, `src/app/api/uploads/route.ts:24`
**Issue:** `storage.ts`의 주석과 `tests/upload/storage.test.ts`는 "Pitfall 3: size가
`arrayBuffer()` 읽기 전에 체크된다"고 명시하지만, 이는 `saveUpload()` 함수 *내부*에서만
사실이다. 실제 호출 경로는 `route.ts:24`의 `const formData = await req.formData();`가
먼저 실행되는데, Node의 Fetch API 기반 `Request.formData()`/`.formData()` 구현(undici)은
멀티파트 바디 *전체*를 파싱하기 위해 요청 본문을 완전히 메모리에 읽어들인다 — 즉
`saveUpload(file)`이 호출되는 시점에는 이미 전체 파일 바이트가 서버 메모리에 존재한다.
`file.size > MAX_BYTES` 체크(storage.ts:64)는 두 번째 복사(arrayBuffer 변환)만 막을 뿐,
"5MB 넘는 업로드는 바이트를 읽지 않는다"는 주석의 실제 보안 목적(DoS 방지)은 달성되지
않는다. Next.js App Router Route Handler는 Pages API의 `bodyParser.sizeLimit` 같은 기본
바디 크기 제한이 없다 — 인증된 EDITOR 권한을 가진 사용자(또는 탈취된 세션)가 임의로 큰
멀티파트 바디를 반복 전송해 메모리 소모 DoS를 일으킬 수 있다.

**Fix:** `req.formData()` 호출 전에 `Content-Length` 헤더로 선제 차단하거나, 스트리밍
멀티파트 파서(예: `busboy`)로 청크 단위 크기 제한을 적용해야 실제로 "바이트를 읽기
전에 차단"이 성립한다. 최소 완화책:
```typescript
export async function POST(req: Request) {
  const wsId = new URL(req.url).searchParams.get("wsId");
  if (!wsId) return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });

  const contentLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BYTES + MULTIPART_OVERHEAD) {
    return Response.json({ error: "이미지 크기는 5MB를 넘을 수 없어요." }, { status: 413 });
  }
  // ... requireRole 이후 req.formData()
```
근본적으로는 `formData()` 자체가 무제한 버퍼링하므로, 완전한 방어는 스트리밍 파서로
교체하는 것뿐이다 — 최소한 `Content-Length` 선검사로 명백히 큰 페이로드는 바디를 읽기
전에 걸러야 주석의 주장과 실제 동작이 일치한다.

## Warnings

### WR-01: 클라이언트가 지정한 파일명이 이스케이프 없이 마크다운 alt 텍스트에 삽입됨 (마크다운 인젝션)

**File:** `src/components/editor/useImageUpload.ts:73`
**Issue:** `` `![${file.name}](${body.url})` `` — `file.name`은 사용자가 선택한 파일의
클라이언트 제공 이름으로, `saveUpload`가 검증하는 건 바이트(매직넘버)뿐이고 파일명은
전혀 검증·이스케이프되지 않는다. 파일명에 `]`, `(`, `)` 같은 마크다운 특수문자가
있으면 alt 텍스트를 조기 종료시켜 문서에 임의의 마크다운(예: 피싱 링크, 추가 이미지)을
주입할 수 있다. 예: 파일명이 `x](https://evil.example/steal "click me`인 경우
`![x](https://evil.example/steal "click me](/uploads/<uuid>.png)`가 생성되어, 실제
업로드 URL 대신(또는 병행해) 공격자 URL을 가리키는 링크가 문서에 삽입된다.
`rehype-sanitize`가 `javascript:` 등 위험 프로토콜은 막아주므로 스크립트 실행(XSS)까지는
이어지지 않지만, `http(s)` 기반 피싱/콘텐츠 위조는 그대로 통과한다.
`e2e/image-upload.spec.ts:55`도 `file.name`을 그대로 alt로 기대해 이 동작을 고정시키고
있어, 악성 파일명에 대한 회귀 테스트가 전혀 없다.

**Fix:** 삽입 전 alt 텍스트에서 마크다운 제어 문자를 이스케이프하거나 제거한다.
```typescript
function sanitizeAlt(name: string): string {
  return name.replace(/[[\]()]/g, "");
}
// ...
insert: `![${sanitizeAlt(file.name)}](${body.url})`,
```

### WR-02: 업로드된 이미지가 워크스페이스 권한 없이 완전 공개로 서빙됨

**File:** `src/lib/storage.ts:74`, `public/uploads/`
**Issue:** `saveUpload`는 파일을 `public/uploads/`에 쓰고, Next.js는 이를 인증/RBAC
검사 없이 정적으로 서빙한다. 업로드(POST) 시점에는 `requireRole(wsId, "EDITOR")`가
정확히 걸려 있지만, 저장된 이미지의 조회(GET `/uploads/<uuid>.ext`)에는 어떠한 서버측
권한 검증도 없다 — CLAUDE.md의 "권한 검증은 서버 전용... 모든 변경 API는
`requireRole` 경유" 불변식은 쓰기 경로만 지키고 있고, 워크스페이스 비공개 문서에 첨부된
이미지 자체는 URL(uuid)만 알면 워크스페이스 비멤버·비로그인 사용자도 열람 가능하다.
UUID라 추측은 어렵지만(obscurity), 문서 URL을 통해 uuid가 노출된 채 문서 링크가
외부로 공유되는 경우 이미지는 여전히 그 uuid로 영구히 공개 접근 가능하다(문서가 이후
삭제/휴지통행이 되어도 이미지 파일 자체는 지워지지 않음 — 별도 이슈지만 연관).

**Fix:** 최소한 이미지 서빙을 `/api/uploads/[filename]` 라우트로 옮기고
`requireRole(workspaceId, "VIEWER")`를 태우거나(문서-이미지 연결 정보가 필요),
production 요구사항상 허용 가능한 트레이드오프라면 그 결정을 TRD/PRD에 명시적으로
기록해 의도적 설계임을 남겨야 한다(현재는 문서화 없이 암묵적으로 뚫려 있다).

### WR-03: 임시 저장 폐기(DELETE) 실패가 무시됨

**File:** `src/components/document/DocumentWorkspace.tsx:82-85`
**Issue:** `handleDiscard`는 `await fetch(...DELETE)`의 응답 상태를 확인하지 않고 바로
`setShowRecovery(false)`를 호출한다. DELETE가 403/500으로 실패하거나 네트워크 예외로
`fetch` 자체가 reject해도(이 경우 async 이벤트 핸들러 내부라 unhandled rejection) UI는
"폐기됨"으로 진행한다 — 서버에는 draft가 그대로 남아 있어 다음 재방문 시 다시 복구
다이얼로그가 뜨거나(사용자는 이미 폐기했다고 인지) 최소한 실패 사실을 알 방법이 없다.

**Fix:**
```typescript
async function handleDiscard() {
  try {
    const res = await fetch(`/api/documents/${docId}/draft`, { method: "DELETE" });
    if (!res.ok) return; // 배너/재시도 UX는 범위 밖이더라도 최소한 다이얼로그를 유지
  } catch {
    return;
  }
  setShowRecovery(false);
}
```

### WR-04: `theme` 쿠키 값이 검증 없이 `data-theme`에 그대로 주입됨(같은 phase의 다른 쿠키와 비일관)

**File:** `src/app/layout.tsx:37-45`
**Issue:** 같은 phase에서 함께 도입된 `layoutMode`(허용값 배열 검사, page.tsx:46-48)와
`splitRatio`(`Number.isFinite` 가드, page.tsx:49-50)는 둘 다 값 검증 후 폴백을 두는
반면, `theme` 쿠키는 `cookieStore.get("theme")?.value`를 그대로 `data-theme`에 넣는다
(React가 속성값을 이스케이프하므로 XSS는 아니다 — 위험도는 낮음). 하지만 예컨대
`theme=Dark`(대소문자 오타)나 조작된 임의 문자열이 들어오면 `[data-theme="dark"]` 규칙도
`:root:not([data-theme])`(미방문자용 OS-설정 폴백) 규칙도 매치되지 않아 라이트 테마
기본값으로 조용히 새 버려, 다크 모드를 명시적으로 선택했던 사용자가 이유 없이 라이트로
보이는 경우가 생길 수 있다. `tests/theme/rsc-cookie.test.ts`도 `"light"`/`"dark"`/
`undefined` 세 값만 검증해 이 경로는 테스트되지 않는다.

**Fix:**
```typescript
const themeCookie = cookieStore.get("theme")?.value;
const theme = themeCookie === "dark" || themeCookie === "light" ? themeCookie : undefined;
```

## Info

### IN-01: draft 60초 틱과 autosave 삭제 사이의 무해한 경합으로 불필요한 복구 다이얼로그가 뜰 수 있음

**File:** `src/components/document/draft-controller.ts:22-26`, `src/lib/documents.ts:143-158`
**Issue:** draft upsert는 순서 가드가 없는(`TRD §7`, 의도된 설계) 고정 60초 틱이라,
autosave가 draft를 삭제한 직후 몇백ms 안에 draft 틱이 겹치면 이미 삭제된 draft가 같은
(이미 저장된) 내용으로 재생성될 수 있다. 이후 `isDraftNewer`가
`draft.updatedAt > doc.updatedAt`을 비교할 때 두 타임스탬프가 서로 다른 요청에서
`new Date()`로 찍혀 순서가 뒤집힐 수 있어, 다음 방문 시 이미 저장된 것과 동일한 내용을
"복구할까요?" 다이얼로그로 다시 묻는 경우가 생길 수 있다. 데이터 손실은 없고 UX
잡음 수준이라 Info로 분류한다.
**Fix:** 필요하다면 draft 틱에도 "최근 autosave 성공 후 N초 이내면 스킵" 정도의 저비용
가드를 추가할 수 있으나, 현재 설계(문서화된 트레이드오프)에서 굳이 손댈 필요는 낮다.

### IN-02: placeholder 텍스트를 리터럴로 문서에 갖고 있으면 업로드 완료 시 엉뚱한 위치가 치환될 수 있음

**File:** `src/components/editor/useImageUpload.ts:55-57, 69-74`
**Issue:** placeholder 검색이 `doc.indexOf(PLACEHOLDER)` 방식(좌표 매핑 대신 텍스트
검색, 설계상 의도됨)이라, 사용자가 `![업로드 중...]()` 문자열을 리터럴로 이미 문서에
가지고 있는 극히 드문 경우 업로드 placeholder가 아니라 그 리터럴 텍스트가 먼저
매치되어 치환될 수 있다. 발생 확률이 매우 낮고 설계 문서(RESEARCH Pattern 2)가 이미
이 트레이드오프를 인지하고 선택한 것이라 정보 제공 수준으로만 남긴다.
**Fix:** 필요 시 좀 더 유니크한 placeholder 마커(예: 타임스탬프/nonce 접미사)로 강화
가능하나 현재 우선순위는 낮다.

---

_Reviewed: 2026-08-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
