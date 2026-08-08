---
phase: 06-tags-search-export
reviewed: 2026-08-08T10:53:36Z
depth: deep
files_reviewed: 24
files_reviewed_list:
  - src/db/schema.ts
  - drizzle/0005_classy_pixie.sql
  - drizzle/0006_pg_trgm_search_index.sql
  - src/lib/documents.ts
  - src/lib/validation.ts
  - src/lib/search.ts
  - src/lib/export.ts
  - src/app/api/documents/[id]/tags/route.ts
  - src/app/api/documents/[id]/export/route.ts
  - src/app/api/folders/[id]/export/route.ts
  - src/app/api/workspaces/[id]/search/route.ts
  - src/app/(main)/w/[wsId]/d/[docId]/page.tsx
  - src/components/document/DocumentWorkspace.tsx
  - src/components/document/TagBar.tsx
  - src/components/tree/SearchBox.tsx
  - src/components/tree/FolderTree.tsx
  - src/components/tree/download-export.ts
  - tests/tags/helpers.ts
  - tests/tags/rbac.test.ts
  - tests/tags/replace.test.ts
  - tests/search/helpers.ts
  - tests/search/idor.test.ts
  - tests/search/nfc-normalize.test.ts
  - tests/export/helpers.ts
  - tests/export/md-export.test.ts
  - tests/export/zip-export.test.ts
  - tests/export/zip-slip.test.ts
  - tests/validation/nfc-transform.test.ts
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-08-08T10:53:36Z
**Depth:** deep
**Files Reviewed:** 24 (plus 8 test files read for cross-check)
**Status:** issues_found

## Summary

Phase 6(태그·검색·내보내기)의 핵심 위협 벡터 — SQL 인젝션, IDOR, zip-slip, 태그 3개 제한, export 원문 보존 — 는 대체로 잘 방어되어 있고 테스트로 실증됨(`tests/search/nfc-normalize.test.ts`의 `%' OR '1'='1` 리터럴 바인딩 케이스, `tests/export/zip-slip.test.ts`, 4개 라우트 전부의 cross-workspace 403 케이스). 다만 zip 스트리밍 경로에 서버 프로세스를 죽일 수 있는 미처리 프로미스 거부가 하나 있고(Critical), Content-Disposition 헤더의 따옴표 이스케이프 누락·zip 세그먼트 새니타이즈의 콜론 누락·태그 저장 트랜잭션의 동시성 허점이 각각 Warning 수준으로 남아 있다.

## Critical Issues

### CR-01: `archive.finalize()`의 미처리 Promise 거부가 서버 프로세스를 죽일 수 있음

**File:** `src/app/api/folders/[id]/export/route.ts:46`
**Issue:**
```ts
void archive.finalize();
```
`node_modules/archiver/lib/core.js:710-738`을 직접 확인하면 `finalize()`가 반환하는 Promise는 이중 finalize/abort 상황뿐 아니라, 실제 zip 모듈(zlib 스트림 등)에서 `error` 이벤트가 발생하는 **모든** 경우에 reject 된다(`self._module.on("error", (err) => { errored = true; reject(err); })`). 코드 주석은 "Pitfall 3: fire-and-forget — await 불필요"라고 정당화하지만, 이는 스트림이 `Readable.toWeb()`을 통해 클라이언트로 정상 전달되는 경로만 고려한 것이고, `finalize()`가 돌려주는 별도의 Promise 자체는 아무도 `.catch()`하지 않는다.

Node.js는 v15부터 처리되지 않은 Promise 거부(unhandled rejection)에서 기본적으로 프로세스를 종료한다(`--unhandled-rejections=throw` 기본값). 즉, 압축 중 내부 스트림 오류(예: 클라이언트가 다운로드를 중간에 취소해 파이프가 깨지거나, zlib 오류 등)가 하나만 발생해도 **Next.js 서버 프로세스 전체가 크래시**해 모든 사용자에게 영향을 준다. 이는 인증된 사용자라면 누구나(자신이 접근 가능한 폴더의 내보내기 도중 연결을 끊는 것만으로) 유발 가능한 DoS 벡터다.

**Fix:**
```ts
archive.finalize().catch((err) => {
  // 스트림 자체의 에러는 Readable.toWeb()이 이미 ReadableStream 쪽으로 전파하므로,
  // 여기서는 오직 "미처리 거부로 인한 프로세스 크래시"만 막으면 된다.
  console.error("zip finalize error", err);
});
```

## Warnings

### WR-01: Content-Disposition의 `filename=` 따옴표 문자열에 이스케이프가 없음 (헤더 파라미터 주입 가능)

**File:** `src/app/api/documents/[id]/export/route.ts:32-37`, `src/app/api/folders/[id]/export/route.ts:49-54`
**Issue:**
```ts
const filename = `${doc.title}.md`;
const asciiSafe = filename.replace(/[^\x20-\x7E]/g, "_");
return new Response(doc.content, {
  headers: {
    "Content-Disposition": `attachment; filename="${asciiSafe}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  },
});
```
`asciiSafe`는 제어문자(CR/LF 포함, `\x0D`/`\x0A`는 `\x20-\x7E` 밖이라 `_`로 치환됨)만 걸러내고 **큰따옴표(`"`, `\x22`)와 백슬래시(`\`, `\x5C`)는 그대로 통과**시킨다. 둘 다 `\x20-\x7E` 범위 안이라 살아남는다. `document.title`은 사용자가 자유롭게 입력하는 텍스트(최대 255자, 어떤 문자든 허용 — `documentSchema`에 quote 금지 없음)이므로, 제목에 `"`가 들어가면 RFC 6266 quoted-string이 조기 종료되어 다음과 같은 형태가 만들어진다.

```
Content-Disposition: attachment; filename="Report "Q3" numbers.md"; filename*=UTF-8''...
```

`filename="Report "` 뒤의 `Q3" numbers.md"`는 문법적으로 헤더 값 내부의 잉여 토큰이 되어, 파서에 따라 같은 헤더 필드 안에 임의 파라미터가 주입된 것처럼 해석될 수 있다(CRLF가 막혀 있어 새 헤더 라인 주입까지는 불가능하지만, 동일 헤더 값 내부의 구조 파괴는 그대로 발생). 폴더 export의 `folderName`도 `folder.name`을 그대로 쓰고 `folderSchema`에 동일하게 quote 제한이 없어 같은 문제를 겪는다. 두 export 라우트 모두 테스트(`tests/export/md-export.test.ts`)는 "한글제목"만 검증하고 따옴표 포함 제목 케이스는 없다.

**Fix:** quoted-string 내부의 `"`와 `\`를 RFC 6266대로 이스케이프하거나, 애초에 quoted-string에는 ASCII-safe 치환에서 `"`/`\`도 함께 다른 문자로 치환한다.
```ts
const asciiSafe = filename
  .replace(/[^\x20-\x7E]/g, "_")
  .replace(/["\\]/g, "_"); // quoted-string 이스케이프 대신 안전하게 치환
```

### WR-02: `sanitizeZipSegment`가 콜론과 선행/후행 점을 처리하지 않음

**File:** `src/lib/export.ts:17-24`
**Issue:**
```ts
export function sanitizeZipSegment(name: string): string {
  const cleaned = name
    .replace(/[/\\]/g, "-")
    .replace(/\.\./g, "_")
    .replace(/[\x00-\x1f]/g, "")
    .trim();
  return cleaned || "제목 없음";
}
```
- 콜론(`:`)이 그대로 남는다. 리뷰 요청에서 명시적으로 짚은 "Windows 드라이브 `C:`" 벡터가 새니타이즈되지 않은 채 zip 엔트리 이름에 들어간다(예: 문서 제목 `C:\Windows\System32` → 백슬래시만 대시로 바뀌어 `C:-Windows-System32`). POSIX zip 리더에서 직접적인 경로 탈출로 이어지진 않지만, Windows 파일시스템의 예약 문자(ADS 구분자이기도 함)를 그대로 허용하는 것은 계약(zip-slip 방어의 "모든 escape vector 차단")과 맞지 않는다.
- `/\.\./g`는 겹치지 않는 2-문자 쌍만 매칭하므로, 홀수 개의 점이 연속되면(`"....."` 등) 마지막 점 하나가 새니타이즈를 통과한다(`"__."`). 슬래시가 없어 실질적 탈출 경로는 아니지만, "leading/trailing dots" 케이스로 명시 요청된 항목이라 커버리지 공백으로 남는다.
- `tests/export/zip-slip.test.ts`에는 콜론이나 홀수-점 케이스 테스트가 없다.

**Fix:**
```ts
export function sanitizeZipSegment(name: string): string {
  const cleaned = name
    .replace(/[/\\]/g, "-")
    .replace(/\.\./g, "_")
    .replace(/[\x00-\x1f:]/g, "")
    .replace(/^\.+|\.+$/g, "") // 선행/후행 점 제거
    .trim();
  return cleaned || "제목 없음";
}
```

### WR-03: `replaceTags`가 동시 쓰기에 대한 잠금이 없어 정당한 요청이 스퓨리어스하게 `TagLimitError`로 실패할 수 있음

**File:** `src/lib/documents.ts:172-199`
**Issue:** 같은 문서에 대해 두 개의 `PUT /tags` 요청이 거의 동시에 들어오는 경우(더블클릭, 두 탭 등)를 생각해 보자. PostgreSQL 기본 격리 수준(READ COMMITTED)에서 `DELETE FROM document_tag WHERE document_id = X`는 트랜잭션 단위가 아니라 **문장 단위**로 스냅샷을 새로 뜬다. TX1이 먼저 기존 행을 지우고 커밋 전이면, TX2의 동일 `DELETE`는 TX1이 잠근 그 행에서 블로킹된 뒤 TX1 커밋 시 EvalPlanQual로 재평가되지만, 이때 TX1이 새로 INSERT한 행들은 TX2의 DELETE 문 스냅샷에 애초에 존재하지 않았으므로 삭제 대상에 포함되지 않는다. 결과적으로 TX1의 새 태그(a,b,c)와 TX2의 새 태그(d,e,f)가 PK 충돌 없이 공존하게 되고, TX2의 `SELECT count(*)`(같은 트랜잭션이지만 READ COMMITTED라 이 시점엔 TX1의 커밋된 행이 보임)가 6을 세어 `count > 3`으로 롤백된다. TX2 호출자는 자신이 3개 이하의 정당한 태그만 보냈는데도 "태그는 최대 3개까지 저장할 수 있습니다" 400을 받는다 — 보안 위반(초과 저장)은 아니지만, replace-all 계약이 깨지고 UX상 원인 불명의 실패가 발생하는 동시성 결함이다.

**Fix:** 같은 문서에 대한 태그 갱신을 직렬화한다. 예: 트랜잭션 시작 시 `SELECT ... FOR UPDATE`로 document 행을 잠그거나, `pg_advisory_xact_lock(hashtext(documentId))`를 트랜잭션 첫 문장으로 추가한다.
```ts
export async function replaceTags(documentId: string, rawTags: string[], client: DbClient = db) {
  return client.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${documentId}))`);
    await tx.delete(documentTag).where(eq(documentTag.documentId, documentId));
    // ...
  });
}
```

## Info

### IN-01: `replaceTags`가 `lib/validation.ts`의 `normalizeNFC`를 재사용하지 않고 인라인으로 재구현

**File:** `src/lib/documents.ts:178`
**Issue:**
```ts
const norm = raw.trim().normalize("NFC");
```
`src/lib/validation.ts:54-56`에 이미 `normalizeNFC(text: string) { return text.normalize("NFC"); }`가 존재하고, `documentSchema`도 이를 `.transform()`으로 재사용한다. `documents.ts`가 이를 import하지 않고 `.normalize("NFC")`를 직접 호출해 같은 정규화 로직이 두 곳에 나뉜다. 기능상 차이는 없지만("06-RESEARCH Pattern 2"가 명시한 단일 규칙을 두 파일이 각자 구현), 향후 정규화 방식이 바뀔 때(NFC 외 옵션 추가 등) 한쪽만 고치는 실수를 유발하기 쉽다.

**Fix:** `import { normalizeNFC } from "@/lib/validation"`; `const norm = normalizeNFC(raw.trim());`

### IN-02: 검색 쿼리의 LIKE 와일드카드(`%`, `_`)가 이스케이프되지 않아 사용자가 의도치 않은 전체 매치를 겪을 수 있음

**File:** `src/lib/search.ts:39-40`
**Issue:**
```ts
const pattern = `%${q}%`;
```
`q`는 파라미터 바인딩되므로 SQL 인젝션 위험은 없다(`tests/search/nfc-normalize.test.ts`가 실증). 다만 `q` 자체에 `%`나 `_`가 들어 있으면 ILIKE 와일드카드로 해석되어, 사용자가 검색창에 `%`만 입력하면 사실상 워크스페이스의 모든 문서가 매치된다. 보안 결함은 아니지만 검색 결과의 정확성을 해치는 기능적 결함이다.
**Fix:** `q.replace(/[%_]/g, "\\$&")`로 리터럴 이스케이프한 뒤 `ESCAPE '\'`를 ILIKE에 지정하거나, 최소한 알려진 동작으로 문서화한다.

---

_Reviewed: 2026-08-08T10:53:36Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
