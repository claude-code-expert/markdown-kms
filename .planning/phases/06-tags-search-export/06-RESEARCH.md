# Phase 6: Tags, Search & Export - Research

**Researched:** 2026-08-08
**Domain:** PostgreSQL trigram 검색(한국어 NFC), 태그 트랜잭션 검증, Next.js 15 Route Handler 스트리밍 zip, 무손실 export
**Confidence:** MEDIUM-HIGH — TRD/CONTEXT가 대부분을 잠갔고 남은 불확실성은 (1) drizzle-kit이 `gin_trgm_ops` 연산자 클래스를 `generate`로 정확히 뽑아내는지(알려진 버그), (2) 기존 행의 NFC 정합성(백필 필요 여부) 둘로 좁혀진다.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**태그 (DOC-03, FR-D3)**
- 입력 위치: 에디터 제목 행 아래 메타 바 — chip 스타일 입력(Enter/comma로 추가, X로 제거).
- 3개 제한 UX: 3개 도달 시 입력 비활성. 4번째는 클라이언트에서 거부 + API 직접 호출도 서버가 400(COUNT 검증, US-6/NFR-3.2). **서버가 최종 권위**.
- 저장: `PUT /api/documents/:id/tags`로 전체 교체(replace all). EDITOR+. 트랜잭션에서 기존 태그 삭제 후 재삽입, COUNT>3이면 400.
- 표시: 문서 메타 바 + 검색 결과에 태그 노출.

**검색 (DOC-04, FR-D4)**
- 검색창: 사이드바 상단 검색 입력(debounce ~300ms). 범위 = 현 워크스페이스.
- 결과: 리스트(제목 + 본문 스니펫 + 태그), 클릭 시 해당 문서로 이동(`w/[wsId]/d/[docId]`). VIEWER+.
- 내부: `GET /api/workspaces/:id/search?q=` — 제목·본문·태그 ILIKE(pg_trgm 부분일치). **NFC 정규화**: q와 저장 텍스트를 NFC로 정규화한 뒤 비교(한국어 NFC/NFD 코드포인트 불일치 방지 — 성공기준). pg_trgm GIN 인덱스(제목·본문). 파라미터 바인딩(SQL 인젝션 방지).

**Export (EXP-01/02, FR-X1/X2, NFR-5.2)**
- 트리거: 문서 컨텍스트 메뉴 ".md 내보내기" + 폴더 컨텍스트 메뉴 ".zip 내보내기". VIEWER+.
- md: `GET /api/documents/:id/export` — `document.content` **원문 그대로** 다운로드(NFR-5.2, 파이프라인 역변환 금지·손실 0). `Content-Disposition: attachment; filename="{제목}.md"`.
- zip: `GET /api/folders/:id/export` — 서브트리를 archiver로 스트리밍 zip. **폴더 계층 보존**(zip 디렉터리 구조), 파일명 `{문서제목}.md`. 엔트리명 sanitize(경로순회/zip-slip 방지 — 제목의 `/`·`..` 등 제거). 같은 폴더 내 동일 제목 충돌은 접미사(`-1`,`-2`).

### Claude's Discretion
- 태그 chip 컴포넌트 구조, 검색 debounce/결과 컴포넌트, export 스트리밍 응답 구현, zip 엔트리명 sanitize 헬퍼, NFC 정규화 위치(입력 저장 시 + 질의 시) — 코드베이스 관례(CSS Modules·ui-kit·zod·requireRole·DbClient·순수 헬퍼 분리) 따라 재량.

### Deferred Ideas (OUT OF SCOPE)
- 협업(join-request·invite·이메일) → Phase 7.
- Phase 8(프레젠테이션·구글 로그인) → 스코프 제외(구현 안 함).
- 검색 하이라이트·고급 필터·정렬 → 필요 시 추후.
- S3 export·대용량 스트리밍 최적화 → 추후.
- Phase 3·4·5 defer된 UAT(시각) → 끝에 몰아서.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DOC-03 | (P1, FR-D3) 문서당 태그 3개까지 입력되고 4개째는 클라이언트·서버 모두 거부한다 | Pattern 1(replace-all 트랜잭션 + COUNT 검증), Pitfall 4, Code Example(태그 라우트), Validation Architecture 테스트 맵 |
| DOC-04 | (P1, FR-D4) 제목·본문·태그 검색이 동작한다 (NFC 정규화, pg_trgm) | Pattern 2(NFC 정규화 쓰기+질의), Pitfall 1·2(백필, GIN 연산자 클래스), Architecture Diagram 검색 흐름 |
| EXP-01 | (P1, FR-X1/NFR-5.2) 문서를 원본 무손실 `.md`로 다운로드할 수 있다 | Code Example(md export 라우트), Architecture Diagram export .md 흐름 |
| EXP-02 | (P1, FR-X2) 폴더 하위 전체를 구조 유지 `.zip`으로 다운로드할 수 있다 | Pattern 3(archiver→Web stream 어댑터), Pattern 4(zip-slip sanitize), Pitfall 3·5, Standard Stack(archiver) |
</phase_requirements>

## Summary

Phase 6은 세 축(태그·검색·export) 모두 TRD §3/§8과 06-CONTEXT.md가 스키마·API·UX를 이미 확정했다. 연구가 채워야 할 공백은 "무엇을"이 아니라 "어떻게 정확히" 세 가지다.

첫째, `pg_trgm` GIN 인덱스는 TRD §3에 리터럴 SQL로 이미 박혀 있다(`gin (title gin_trgm_ops) WHERE is_deleted = false`) — plain 컬럼 위 인덱스이지 `normalize(title, NFC)` 같은 함수형 인덱스가 아니다. 이 고정된 인덱스 모양과 한국어 NFC 정확성(성공기준 2)을 동시에 만족시키는 유일한 방법은 **저장 시점에 title·content를 NFC로 정규화해 컬럼 자체가 항상 NFC를 담게 만들고, 질의 시점에도 `q`를 NFC로 정규화해 비교하는 것**이다. drizzle-kit `generate`가 GIN 연산자 클래스(`gin_trgm_ops`)를 마이그레이션 SQL에서 누락하는 알려진 버그(drizzle-orm#2935)가 있어, 이 phase의 pg_trgm 관련 마이그레이션은 **custom SQL 마이그레이션 파일**(`drizzle-kit generate --custom`)로 직접 작성해야 한다 — `CREATE EXTENSION`도 어차피 drizzle 스키마 DSL로 표현 불가능하므로 같은 파일에 담는다.

둘째, 태그 3개 상한은 06-CONTEXT.md가 이미 정확한 절차를 지정했다: 트랜잭션에서 기존 태그 전체 삭제 → 재삽입 → `COUNT(*) > 3`이면 예외를 던져 트랜잭션을 롤백하고 라우트가 400을 반환한다. `document_tag`의 PK가 `(document_id, tag)`라 정확히 동일한 문자열 재삽입은 자연히 막히지만, 대소문자만 다른 중복(`React`/`react`)은 PK가 다른 값으로 취급해 그대로 들어간다 — 서버 dedup은 이 phase의 재량 영역이라 trim+NFC 정규화 후 대소문자 무시 dedup을 권장한다.

셋째, export는 md는 파이프라인을 거치지 않고 `document.content` 원문을 그대로 스트림하면 끝이라 리스크가 낮다. zip은 `archiver`가 Node.js 스트림을 만들고 Next.js 15 Route Handler는 Web `ReadableStream`을 기대하므로 둘 사이를 변환하는 어댑터가 필요하다 — Next.js 공식 스트리밍 가이드의 `iteratorToStream` 패턴이나 Node `Readable.toWeb()`(Node 18+ 안정)으로 `archiver`의 PassThrough 출력을 감싼다. 한글 파일명은 `Content-Disposition`에 `filename`(ASCII 폴백) + `filename*=UTF-8''...`(RFC 5987 percent-encoding) 둘 다 넣어야 브라우저 호환성이 보장된다.

**Primary recommendation:** NFC 정규화는 쓰기 경로(zod 스키마의 `.transform()`)와 검색 질의 양쪽에 순수 헬퍼로 넣고, pg_trgm 마이그레이션은 custom SQL 파일로 손으로 작성하며, zip 스트리밍은 `archiver` → Node `Readable` → `Readable.toWeb()` → `Response(stream)`으로 연결한다.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 태그 3개 제한 검증 | API/Backend | Browser/Client | 서버가 최종 권위(NFR-3.2), 클라 비활성화는 UX 편의일 뿐 |
| NFC 정규화(쓰기) | API/Backend | — | zod 스키마 transform, DB에 항상 정규형만 저장되게 |
| NFC 정규화(질의) | API/Backend | — | 검색 라우트가 `q` 파라미터를 정규화 후 쿼리 빌드 |
| trigram 검색 실행 | Database/Storage | API/Backend | GIN 인덱스·ILIKE 매칭은 PG가 수행, API는 파라미터 바인딩만 |
| zip 스트리밍 생성 | API/Backend | — | `archiver`는 Node 전용 라이브러리, 브라우저에서 불가 |
| export 다운로드 트리거 | Browser/Client | — | `fetch` → blob → 숨김 `<a download>` 합성 클릭(UI-SPEC 잠금) |
| 폴더 서브트리 조회 | Database/Storage | API/Backend | 기존 `getSubtree`(closure.ts) 재사용, 신규 쿼리 없음 |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| archiver | 8.0.0 [VERIFIED: npm registry] | zip 스트리밍 생성 | TRD §1에서 이미 확정. Node.js 생태계 표준 zip 스트리밍 라이브러리, 주간 다운로드 3700만+ |
| @types/archiver | 8.0.0 [VERIFIED: npm registry] | archiver 타입 정의 (dev) | DefinitelyTyped 공식, archiver 본체와 버전 동기화됨 |

### Supporting
없음 — 나머지는 전부 기존 설치 의존성(drizzle-orm, zod, Next.js Route Handler) 재사용.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| archiver | zip-stream(archiver의 하위 레이어) | archiver가 이미 zip-stream을 감싸 디렉터리 구조·엔트리 큐잉 API를 제공. 직접 zip-stream을 쓰면 그 레이어를 재구현하는 셈(Don't Hand-Roll) |
| plain 컬럼 GIN 인덱스 + 쓰기 시 정규화 | `gin (normalize(title, NFC) gin_trgm_ops)` 함수형 인덱스 | TRD §3이 이미 plain 컬럼 인덱스 SQL을 리터럴로 확정해 뒀다(문서 위계상 TRD가 최상위 실행 가능 스펙) — 함수형 인덱스로 바꾸는 것은 TRD 개정 사안이라 이 phase 범위 밖. 쓰기 시 정규화만으로 동일한 정확성을 얻을 수 있어 개정 필요 없음 |

**Installation:**
```bash
pnpm add archiver
pnpm add -D @types/archiver
```

**Version verification:** `npm view archiver version` → `8.0.0`(2026-05-08 배포). `npm view @types/archiver version` → `8.0.0`(2026-06-05 배포, archiver 본체와 메이저 버전 동기화). `npm view archiver scripts.postinstall` → 빈 값(설치 스크립트 없음, 공급망 리스크 낮음).

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| archiver | npm | 다수 연차 배포 이력(현재 8.0.0, 2026-05 최신 릴리스) | 37,093,439/주 | github.com/archiverjs/node-archiver | OK | Approved |
| @types/archiver | npm | DefinitelyTyped 소속, 8.0.0(2026-06 최신) | 6,542,087/주 | github.com/DefinitelyTyped/DefinitelyTyped | OK | Approved |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

두 패키지 모두 `gsd-tools query package-legitimacy check`가 `OK`로 판정했고, 배포 주체(archiverjs 조직, DefinitelyTyped)와 다운로드 규모가 명확한 정상 패키지다. TRD §1에서 이미 이름이 지정돼 있었지만(`[ASSUMED]` 출처), 이번 세션에서 npm 레지스트리 조회 + legitimacy 게이트로 `archiver`/`@types/archiver`라는 정확한 패키지명·버전을 [VERIFIED: npm registry]로 승격했다.

## Architecture Patterns

### System Architecture Diagram

```
[검색]
사이드바 검색 입력 (300ms debounce, 클라)
      │ q=<사용자입력>
      ▼
GET /api/workspaces/:wsId/search?q=
      │ 1. z.uuid() wsId 검증 → 2. requireRole(wsId, VIEWER)
      │ 3. q.trim().normalize("NFC")
      ▼
Drizzle: SELECT title, content 스니펫, tag
  WHERE workspace_id=:wsId AND is_deleted=false
  AND (title ILIKE %q% OR content ILIKE %q% OR tag ILIKE %q%)   ← 파라미터 바인딩
      │ PG 옵티마이저가 doc_title_trgm / doc_content_trgm GIN 인덱스로 라우팅
      ▼
결과 JSON [{id, title, snippet, tags}]  → 클라 렌더 → 클릭 시 /w/:wsId/d/:docId 이동

[태그]
메타 바 chip 입력 (Enter/comma)
      │ tags: string[] (0~3개)
      ▼
PUT /api/documents/:docId/tags
      │ 1. z.uuid() docId 검증 → 2. resolveWorkspaceIdForDocument → 3. requireRole(wsId, EDITOR)
      │ 4. tags.map(trim → normalize NFC) → 대소문자 무시 dedup
      ▼
트랜잭션: DELETE document_tag WHERE document_id=:docId
          INSERT document_tag (document_id, tag) VALUES ... ON CONFLICT DO NOTHING
          SELECT COUNT(*) FROM document_tag WHERE document_id=:docId
          COUNT > 3 → throw(롤백) → 400 / else COMMIT → 204

[export .md]
문서 컨텍스트 메뉴 ".md 내보내기" 클릭
      ▼
GET /api/documents/:docId/export
      │ requireRole(wsId, VIEWER) → getDocument(docId, wsId)
      ▼
Response(document.content, {
  "Content-Type": "text/markdown; charset=utf-8",
  "Content-Disposition": `attachment; filename="doc.md"; filename*=UTF-8''${encoded}`
})
      │ 파이프라인(lib/markdown) 미경유 — content 그대로

[export .zip]
폴더 컨텍스트 메뉴 ".zip 내보내기" 클릭
      ▼
GET /api/folders/:folderId/export
      │ requireRole(wsId, VIEWER) → getSubtree(folderId) [폴더들] + document WHERE folder_id=ANY [문서들]
      ▼
archiver(zip) 인스턴스 생성
  폴더 트리를 상대 경로로 재구성(부모 체인 조회 or 클라이언트 측 트리 그대로 재사용)
  각 문서를 sanitize된 엔트리명으로 append(폴더경로/제목.md, content)
  동일 경로 내 제목 충돌 시 -1/-2 접미사
      ▼
archive.finalize() → Node Readable → Readable.toWeb() → Response(webStream, {
  "Content-Type": "application/zip",
  "Content-Disposition": `attachment; filename="folder.zip"; filename*=UTF-8''${encoded}`
})
```

### Recommended Project Structure
```
src/
├── lib/
│   ├── documents.ts          # 기존 — 태그 서비스(replaceTags/getTags) 추가
│   ├── search.ts             # 신규 — normalizeNFC 헬퍼 + searchWorkspace(workspaceId, q) 순수 조합
│   ├── export.ts             # 신규 — sanitizeZipEntryName, buildFolderZip(folderId) 헬퍼
│   ├── validation.ts         # 기존 — tagsBodySchema 추가, documentSchema에 NFC transform 추가
│   └── rbac.ts                # 기존 — 변경 없음(requireRole 재사용)
├── app/api/
│   ├── documents/[id]/
│   │   ├── tags/route.ts     # 신규 PUT
│   │   └── export/route.ts   # 신규 GET
│   ├── folders/[id]/
│   │   └── export/route.ts   # 신규 GET
│   └── workspaces/[id]/
│       └── search/route.ts   # 신규 GET
└── components/
    ├── document/TagBar.tsx           # 신규 — 태그 chip 입력
    └── tree/SearchBox.tsx            # 신규 — 검색 입력 + 결과 리스트
```

### Pattern 1: 태그 replace-all 트랜잭션 (COUNT 서버 검증)
**What:** 기존 태그 삭제 → 정규화된 신규 태그 삽입 → COUNT로 최종 검증. 클라이언트가 배열 길이를 3개로 이미 제한했더라도, 서버는 클라이언트를 신뢰하지 않고 COUNT를 직접 센다(NFR-3.2, "서버가 최종 권위").
**When to use:** `PUT /api/documents/:id/tags` 구현 시 정확히 이 형태로.
**Example:**
```ts
// src/lib/documents.ts에 추가 (기존 DbClient 주입 패턴 재사용)
export async function replaceTags(documentId: string, rawTags: string[], client: DbClient = db) {
  return client.transaction(async (tx) => {
    await tx.delete(documentTag).where(eq(documentTag.documentId, documentId));

    // 정규화 + 대소문자 무시 dedup — Map으로 첫 등장 값(원 대소문자)을 보존
    const seen = new Map<string, string>();
    for (const raw of rawTags) {
      const norm = raw.trim().normalize("NFC");
      if (!norm) continue;
      const key = norm.toLowerCase();
      if (!seen.has(key)) seen.set(key, norm);
    }
    const tags = [...seen.values()];

    if (tags.length > 0) {
      await tx.insert(documentTag).values(tags.map((tag) => ({ documentId, tag })));
    }

    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(documentTag)
      .where(eq(documentTag.documentId, documentId));

    if (count > 3) {
      throw new TagLimitError("태그는 최대 3개까지 저장할 수 있습니다."); // 트랜잭션 자동 롤백
    }
    return tags;
  });
}
```
*[ASSUMED] — `document_tag` 스키마 정의(src/db/schema.ts)는 이 phase가 신규로 작성하는 대상이라 아직 코드베이스에 존재하지 않는다. 위 예시는 TRD §3 DDL을 Drizzle 관례(schema.ts의 folder/document 테이블 패턴)로 그대로 옮긴 것이며, 플래너가 실제 스키마 파일을 작성할 때 확정된다.*

### Pattern 2: NFC 정규화 — 쓰기 시점 + 질의 시점 양쪽
**What:** title/content 저장 스키마에 `.transform()`으로 NFC 정규화를 끼워 넣어 DB 컬럼이 항상 정규형만 담게 하고, 검색 질의 `q`도 동일 정규화를 거쳐 비교한다.
**When to use:** `documentSchema`(생성+자동저장 공용, TRD-대상 컬럼) 및 검색 라우트의 `q` 파싱.
**Example:**
```ts
// src/lib/search.ts (신규)
export function normalizeNFC(text: string): string {
  return text.normalize("NFC");
}

// src/lib/validation.ts — 기존 documentSchema 확장 (title은 이미 trim, content는 trim 없음 유지)
export const documentSchema = z.object({
  title: z.string().trim().max(255, "제목은 255자를 넘을 수 없습니다.").transform(normalizeNFC),
  content: z.string().transform(normalizeNFC), // trim 없음 유지 — normalize는 trim이 아니다(공백 보존)
});
```
```sql
-- 검색 쿼리 (파라미터 바인딩, Drizzle sql 템플릿)
SELECT id, title, LEFT(content, 200) AS snippet
FROM document
WHERE workspace_id = ${workspaceId}
  AND is_deleted = false
  AND (title ILIKE ${'%' + normalizedQ + '%'} OR content ILIKE ${'%' + normalizedQ + '%'})
```
**Source:** PostgreSQL 16 공식 문서(`normalize()`/`IS NORMALIZED`)는 PG13에서 도입돼 PG16까지 유지된다 [CITED: postgresql.org, database.guide] — 이 phase는 그 SQL 함수를 쓰지 않고 애플리케이션 레이어(zod transform)에서 정규화하는 방식을 택한다. 이유는 TRD §3의 GIN 인덱스가 plain 컬럼 위에 있어(함수형 인덱스 아님) SQL 레벨 `normalize()` 호출이 인덱스를 못 타기 때문이다 — 쓰기 시점 정규화가 인덱스 모양을 바꾸지 않고 정확성을 얻는 유일한 경로다.

### Pattern 3: archiver → Web ReadableStream 어댑터
**What:** `archiver`는 Node.js `stream.Readable`(구체적으로 `Transform`/`PassThrough` 기반)을 생성한다. Next.js 15 Route Handler는 Web Streams API(`ReadableStream`)를 `Response` 생성자에 넘겨야 한다. Node 18+가 안정적으로 제공하는 `Readable.toWeb()`으로 변환한다.
**When to use:** `GET /api/folders/:id/export` 구현.
**Example:**
```ts
// src/app/api/folders/[id]/export/route.ts
import archiver from "archiver";
import { Readable } from "node:stream";

export const runtime = "nodejs"; // archiver는 Node API 의존 — edge runtime 불가

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  // ...z.uuid 검증, resolveActiveWorkspaceId, requireRole(wsId, "VIEWER") — 기존 패턴 그대로

  const archive = archiver("zip", { zlib: { level: 9 } });
  const entries = await buildZipEntries(folderId); // lib/export.ts — 서브트리+문서 조회, 경로 sanitize

  for (const entry of entries) {
    archive.append(entry.content, { name: entry.zipPath }); // "폴더A/폴더B/문서제목.md"
  }
  archive.finalize(); // 비동기 — 스트림 종료는 archiver가 알아서 처리

  const webStream = Readable.toWeb(archive) as ReadableStream;
  const filename = `${folderName}.zip`;
  return new Response(webStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${asciiSafe(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
```
**Source:** Next.js 공식 스트리밍 가이드(App Router)는 `ReadableStream`을 `Response`에 직접 넘기는 패턴을 문서화한다 [CITED: nextjs.org/docs/app/guides/streaming]. `archiver` → Web stream 변환은 커뮤니티 검증 패턴(Eric Burel 블로그, vercel/next.js Discussion #58044)이며 [CITED: ericburel.tech, github.com/vercel/next.js/discussions/58044], Node의 `Readable.toWeb()`은 Node 17+에서 안정화된 공식 API다.

### Pattern 4: zip 엔트리명 sanitize (zip-slip 방지)
**What:** 폴더/문서 제목을 그대로 zip 엔트리 경로에 쓰면 `../../etc/passwd` 같은 제목이 경로 순회를 일으킬 수 있다(zip-slip). 압축 생성 시점(엔트리를 archiver에 넣기 전)에 이름을 sanitize한다.
**When to use:** `buildZipEntries` 헬퍼에서 폴더명·문서제목을 zip 경로 세그먼트로 변환할 때마다.
**Example:**
```ts
// src/lib/export.ts
export function sanitizeZipSegment(name: string): string {
  // 경로 구분자 제거, 상위 디렉터리 참조 제거, 제어문자 제거. 빈 문자열이면 대체값.
  const cleaned = name
    .replace(/[\/\\]/g, "-")       // 슬래시류 → 하이픈 (디렉터리 세그먼트 분리 방지)
    .replace(/\.\./g, "_")          // 상위 경로 참조 무력화
    .replace(/[\x00-\x1f]/g, "")    // 제어문자 제거
    .trim();
  return cleaned || "제목 없음";
}
```
**When to dedupe collisions:** 같은 zip 디렉터리 내 sanitize 후 제목이 겹치면 `-1`, `-2` 접미사(CONTEXT.md 잠금). 폴더 단위로 그룹핑한 뒤 등장 순서대로 카운터를 붙인다.

### Anti-Patterns to Avoid
- **함수형 GIN 인덱스로 임의 개정:** TRD §3의 plain 컬럼 인덱스 SQL을 `gin (normalize(title,'NFC') gin_trgm_ops)`로 바꾸고 싶은 유혹이 있을 수 있으나, 이는 TRD 개정 절차(§3 갱신 후 마이그레이션, CLAUDE.md 불변식)를 요구하는 사안이다. 이 phase는 쓰기 시 정규화로 동일한 결과를 TRD 변경 없이 얻는다.
- **`drizzle-kit generate` 결과를 검증 없이 신뢰:** 알려진 버그(drizzle-orm#2935)로 `gin_trgm_ops` 연산자 클래스가 생성된 마이그레이션 SQL에서 누락될 수 있다 — 생성 후 반드시 SQL 파일을 열어 `gin_trgm_ops`가 실제로 박혀 있는지 확인한다(또는 애초에 custom SQL 마이그레이션으로 손으로 작성).
- **content에 `.trim()`을 정규화와 함께 추가:** `.normalize("NFC")`는 공백을 건드리지 않지만, 실수로 `.trim().normalize(...)`를 content에 적용하면 마크다운 의미상 중요한 앞뒤 공백(NFR-5.2, CLAUDE.md content 불변식)이 사라진다. title만 trim, content는 정규화만.
- **zip 엔트리 경로에 사용자 입력을 그대로 사용:** sanitize 없이 폴더명/문서제목을 zip 경로에 연결하면 zip-slip 취약점.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| zip 스트리밍 압축 | 커스텀 zip writer | `archiver` | 이미 TRD-확정 의존성, zip-stream 위에서 디렉터리/파일 큐잉·압축레벨을 다 처리 |
| 한국어 fuzzy 검색 | 형태소 분석기·자체 FTS 사전 | PostgreSQL `pg_trgm` GIN 인덱스 | 한국어에 PG 기본 FTS 사전이 없다는 점을 TRD §3이 이미 명시 — trigram 부분일치가 이 규모에 적절한 표준 해법 |
| Unicode 정규화 로직 | 코드포인트 직접 매핑 테이블 | `String.prototype.normalize("NFC")`(JS 표준) | ECMAScript 표준 내장 함수, 재구현할 이유가 없다 |
| Node stream ↔ Web stream 변환 | 수동 `ReadableStream` 어댑터(이터레이터 직접 구현) | `Readable.toWeb()`(Node 17+ 표준 API) | Node 표준 라이브러리가 이미 제공, 이터레이터 패턴은 Next.js 공식 문서의 폴백 예시일 뿐 표준 API가 있으면 그것을 쓴다 |

**Key insight:** 이 phase의 세 축(태그·검색·export) 모두 "표준 라이브러리/DB 기능이 이미 있다" — pg_trgm(DB 내장), archiver(TRD 확정), `normalize()`(JS 표준)와 `Readable.toWeb()`(Node 표준). 커스텀 구현이 필요한 지점은 정확히 하나, "이 세 표준 조각을 이 프로젝트의 RBAC/트랜잭션/zod 관례에 맞게 배선하는 것"뿐이다.

## Common Pitfalls

### Pitfall 1: 기존 행이 이미 NFD로 저장돼 있을 수 있다
**What goes wrong:** Phase 1~5에서 이미 생성된 문서(로컬 개발 DB의 테스트 데이터, UAT 산출물)의 title/content가 브라우저 IME 조합 결과에 따라 NFD 코드포인트를 담고 있을 수 있다. Phase 6이 쓰기 경로에만 정규화를 추가하면, 그 이후 **재저장되지 않은** 기존 행은 검색에서 계속 매칭 실패한다.
**Why it happens:** NFC 정규화를 쓰기 시점(zod transform)에만 넣으면 과거 행은 건드리지 않는다.
**How to avoid:** pg_trgm 마이그레이션과 같은 custom SQL 파일에 일회성 백필을 추가한다: `UPDATE document SET title = normalize(title, NFC), content = normalize(content, NFC) WHERE title IS DISTINCT FROM normalize(title, NFC) OR content IS DISTINCT FROM normalize(content, NFC);` (PG16 `normalize()` 함수 사용 — 이때는 일회성 배치라 인덱스 사용 여부가 문제되지 않는다). `document_tag`는 이 phase가 신규 생성하는 테이블이라 백필 대상이 없다.
**Warning signs:** UAT에서 "화면에 보이는 글자와 똑같이 검색했는데 결과가 안 나온다" — 특히 자소 분리형 IME 입력 경로(레거시 macOS 파일명 복사·붙여넣기 등)를 거친 문서에서 재현된다.

### Pitfall 2: `drizzle-kit generate`가 `gin_trgm_ops` 연산자 클래스를 누락
**What goes wrong:** 스키마에 `index().using("gin", table.title.op("gin_trgm_ops"))`로 선언해도, `drizzle-kit generate`가 뽑아내는 SQL이 `USING gin ("title")`로 연산자 클래스 없이 나올 수 있다(drizzle-orm 0.33/drizzle-kit 0.24 기준 보고된 버그, 이 프로젝트의 drizzle-kit 0.31.10에서도 재현 여부 미확인).
**Why it happens:** 알려진 drizzle-kit 버그.
**How to avoid:** `pg_trgm`/GIN 인덱스 마이그레이션은 애초에 **custom SQL 마이그레이션**(`pnpm drizzle-kit generate --custom`으로 빈 파일 생성 후 손으로 SQL 작성)으로 만든다 — `CREATE EXTENSION IF NOT EXISTS pg_trgm;`부터 GIN 인덱스 생성까지 전부 SQL 원문으로 작성하면 drizzle-kit의 자동 추출 로직을 아예 우회한다. drizzle 스키마(`schema.ts`)에는 `document_tag` 테이블만 선언하고, pg_trgm 확장/인덱스는 스키마 DSL에 반영하지 않거나(그러면 다음 `generate` 실행 시 drizzle가 "인덱스 없음"으로 오인해 DROP 시도할 수 있음) `.op()`로 선언하되 **생성된 SQL 파일을 열어 `gin_trgm_ops`가 실제로 포함됐는지 반드시 확인**한다.
**Warning signs:** `\d document`(psql)로 인덱스 정의를 확인했을 때 `USING gin (title)`만 있고 `gin_trgm_ops`가 없으면, ILIKE 쿼리가 인덱스를 못 타 순차 스캔으로 떨어진다(작은 개발 DB에서는 체감 안 되다가 데이터가 늘면 급격히 느려진다).

### Pitfall 3: Node stream을 Web stream으로 변환 없이 그대로 `Response`에 전달
**What goes wrong:** `new Response(archive)`처럼 archiver의 Node `Readable`을 Web `ReadableStream` 자리에 그대로 넘기면 타입 에러이거나(TypeScript) 런타임에 빈 응답/에러가 난다.
**Why it happens:** Node.js 스트림과 WHATWG Streams API는 다른 인터페이스다.
**How to avoid:** `Readable.toWeb(archive)`로 명시적으로 변환한다(Node 17+). `archive.finalize()`는 스트림 종료를 트리거하는 비동기 호출이라 `await` 하지 않고 fire-and-forget으로 두되(내부적으로 'end' 이벤트가 스트림 종료를 처리), append 호출들이 finalize 이전에 모두 동기적으로 큐잉되었는지 확인한다.
**Warning signs:** 다운로드된 zip 파일이 0바이트이거나 손상됨(finalize 타이밍 문제), 또는 Route Handler가 응답을 아예 반환하지 못하고 타임아웃.

### Pitfall 4: 태그 COUNT 검증을 트랜잭션 밖에서 수행
**What goes wrong:** DELETE-INSERT를 트랜잭션 안에서 하고 COUNT 체크를 트랜잭션 커밋 후에 하면, COUNT>3 판정 시점에 이미 잘못된 상태가 커밋되어버려 롤백이 불가능하다.
**Why it happens:** "COUNT 검증 후 400"을 "커밋 후 애플리케이션 레벨에서 체크"로 오독하기 쉽다.
**How to avoid:** DELETE → INSERT → SELECT COUNT(*) → 조건부 throw를 **전부 하나의 `client.transaction(async (tx) => {...})` 콜백 안에서** 수행한다(closure.ts의 `softDeleteFolder`/`moveFolder`가 보여주는 기존 관례와 동일 — throw하면 자동 롤백). 예외를 라우트 핸들러에서 잡아 400으로 변환한다.
**Warning signs:** 통합 테스트에서 "4번째 태그 추가 시 400을 받았는데 DB엔 4개가 남아있다"가 재현되면 이 문제다.

### Pitfall 5: export 파일명에 `filename*`만 넣고 ASCII `filename` 폴백을 생략
**What goes wrong:** 구형 브라우저/일부 다운로드 매니저가 `filename*` 파라미터를 이해하지 못하면 파일명이 깨지거나 빈 이름으로 다운로드된다.
**Why it happens:** RFC 5987 확장 파라미터만으로 충분하다고 오해하기 쉽다.
**How to avoid:** `Content-Disposition: attachment; filename="<ASCII-safe 폴백>"; filename*=UTF-8''<percent-encoded>` 형태로 항상 둘 다 포함한다. ASCII 폴백은 비-ASCII 문자를 언더스코어 등으로 치환하거나 고정 문자열("document.md"/"folder.zip")로 대체해도 무방하다(실제 파일명은 `filename*`가 담당).
**Warning signs:** 한글 제목 문서를 export했을 때 특정 브라우저에서 파일명이 `document.md`가 아니라 깨진 문자열로 저장됨.

## Code Examples

### 태그 저장 라우트 (RBAC + 트랜잭션 + 400)
```ts
// src/app/api/documents/[id]/tags/route.ts
import { z } from "zod";
import { replaceTags, TagLimitError, resolveWorkspaceIdForDocument } from "@/lib/documents";
import { ForbiddenError, forbiddenResponse, requireRole } from "@/lib/rbac";
import { tagsBodySchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const target = await resolveWorkspaceIdForDocument(id);
  if (!target) return forbiddenResponse();

  try {
    await requireRole(target.workspaceId, "EDITOR");
  } catch (err) {
    if (err instanceof ForbiddenError) return forbiddenResponse();
    throw err;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const parsed = tagsBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "잘못된 요청입니다." }, { status: 400 });
  }

  try {
    const tags = await replaceTags(id, parsed.data.tags);
    return Response.json({ tags }, { status: 200 });
  } catch (err) {
    if (err instanceof TagLimitError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
```
*이 라우트 파일은 이 phase가 신규로 작성하는 코드이며 기존 파일에서 검증된 텍스트가 아니다 — `src/app/api/documents/[id]/route.ts`(§ files_to_read)의 IDOR 4단계 관례를 그대로 옮긴 것으로 [ASSUMED] 태그를 붙인다.*

### md export 라우트 (원문 그대로, 한글 파일명)
```ts
// src/app/api/documents/[id]/export/route.ts
import { z } from "zod";
import { getDocument, resolveWorkspaceIdForDocument } from "@/lib/documents";
import { ForbiddenError, forbiddenResponse, requireRole } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const target = await resolveWorkspaceIdForDocument(id);
  if (!target) return forbiddenResponse();

  try {
    await requireRole(target.workspaceId, "VIEWER");
  } catch (err) {
    if (err instanceof ForbiddenError) return forbiddenResponse();
    throw err;
  }

  const doc = await getDocument(id, target.workspaceId);
  if (!doc) return forbiddenResponse();

  const filename = `${doc.title}.md`;
  const asciiSafe = filename.replace(/[^\x20-\x7E]/g, "_");
  return new Response(doc.content, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${asciiSafe}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Node Readable → 수동 이터레이터 → ReadableStream 어댑터 | `Readable.toWeb()` | Node 17(experimental) → Node 18+(stable) | 어댑터 코드를 직접 작성할 필요 없음, 표준 API로 충분 |
| PG13 미만: 애플리케이션에서 ICU/타 라이브러리로 NFC 정규화 | PG13+ `normalize()`/`IS NORMALIZED` SQL 함수 | PostgreSQL 13(2020) | 이 phase는 여전히 애플리케이션 레이어(JS `.normalize()`) 정규화를 택한다 — TRD 인덱스가 plain 컬럼이라 SQL 함수형 정규화는 인덱스를 못 타기 때문(위 Pattern 2 참조). PG의 `normalize()`는 백필 배치에서만 사용 |

**Deprecated/outdated:**
- 없음 — 이 phase가 다루는 스택 요소(archiver, pg_trgm, Node stream API) 모두 현재 유지보수되는 최신 버전.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `document_tag` Drizzle 스키마(`src/db/schema.ts`)의 실제 필드명·인덱스는 TRD §3 DDL을 코드베이스 관례로 옮긴 추정치이며 아직 코드에 없다 | Pattern 1, Code Examples | 플래너가 스키마 파일을 작성할 때 필드명이 미세하게 다를 수 있음(예: `tag` vs `tagName`) — TRD DDL 자체는 신뢰할 수 있으므로 리스크는 낮음 |
| A2 | 태그 서버 dedup을 "trim + NFC + 대소문자 무시"로 구현하는 것은 CONTEXT.md의 "Claude's Discretion"에 속한 설계 판단이며, PRD/TRD가 명시적으로 요구하지 않는다 | Pattern 1 | 사용자가 대소문자를 구분하는 태그를 원했다면 이 정규화가 과도한 제약이 됨 — UI-SPEC의 "duplicate-rejected(대소문자 무시 일치)"와는 일관되므로 리스크 낮음 |
| A3 | 기존 문서 행의 NFD 오염 여부는 실제 DB를 조회해 확인하지 않았다(로컬 PG16 개발 DB 접근 없이 진행) — Pitfall 1의 백필 필요성은 추정 | Pitfall 1 | 실제로 기존 행이 전부 이미 NFC라면 백필은 불필요한 방어 조치이지만, 실행 비용이 낮아(일회성 UPDATE) 안전 마진으로 유지 권장 |
| A4 | drizzle-kit 0.31.10(이 프로젝트 버전)에서 `gin_trgm_ops` 누락 버그가 실제로 재현되는지 확인하지 않았다(보고된 버전은 0.24.2) | Pitfall 2 | 버그가 이미 수정됐다면 custom SQL 마이그레이션은 과잉 대비이지만, 생성된 SQL을 확인하는 습관 자체는 비용이 없다 |

## Open Questions

1. **폴더 zip export 시 서브트리 최상위 폴더 자체를 zip 루트로 포함할지, 그 하위 내용만 압축할지**
   - What we know: CONTEXT.md는 "폴더 계층 보존"만 명시하고 최상위 폴더명을 zip 최상위 디렉터리로 넣을지는 언급하지 않는다.
   - What's unclear: `getSubtree(folderId)`는 자기 자신(depth 0)을 포함해 반환하므로, 최상위 폴더도 압축 대상에 포함된다 — 이걸 zip 파일 안의 최상위 디렉터리로 만들지, 아니면 그 폴더의 자식들을 zip 루트에 바로 풀지는 UX 선택.
   - Recommendation: 최상위 폴더명을 zip 루트 디렉터리로 사용(예: `내보내기.zip` 안에 `프로젝트문서/` 폴더가 있고 그 안에 하위 구조) — 압축 해제 시 파일이 흩어지지 않아 사용자 기대와 더 잘 맞는다. 플래너가 UAT로 확인 권장.

2. **검색 스니펫 생성 방식(단순 `LEFT(content, N)` vs 매치 위치 주변 컨텍스트)**
   - What we know: UI-SPEC은 "본문 스니펫"만 요구하고 하이라이트는 명시적으로 "필요 시 추후"(Deferred).
   - What's unclear: 매치된 키워드 주변 텍스트를 잘라내는 것("컨텍스트 스니펫")이 나은 UX이지만, 이 phase 범위에서 그 복잡도가 필요한지.
   - Recommendation: 이 phase는 `LEFT(content, 200)` 정도의 단순 앞부분 절단으로 충분(Deferred 항목인 "검색 하이라이트·고급 필터"와 결이 같다) — 매치 위치 기반 스니펫은 후속 phase로 미룬다.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | pg_trgm 확장, GIN 인덱스, `normalize()` | 로컬 dev(Homebrew PG16@5433) 존재(MEMORY 참조) — 이 세션에서 직접 재확인하지 않음 | PG16 [ASSUMED — MEMORY 근거] | 없음(핵심 의존성, 대체 불가) |
| Node.js | `Readable.toWeb()`(Node 17+) | Next.js 15가 요구하는 Node 버전이 이미 18.18+ 이상(Next.js 15 최소 요구사항) | Next.js 15 최소 요구 버전과 함께 충족 [CITED: Next.js 공식 요구사항] | 없음 |
| archiver | zip 스트리밍 | 미설치(신규 의존성, 이 phase에서 `pnpm add`) | 8.0.0 (설치 예정) | — |

**Missing dependencies with no fallback:**
- 없음 — archiver는 설치 계획이 이미 확정돼 있고, PostgreSQL/Node는 이미 프로젝트가 의존 중.

**Missing dependencies with fallback:**
- 없음.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (기존 설치, 신규 의존성 없음) |
| Config file | `vitest.config.ts` — `DATABASE_URL_TEST` 사용, `fileParallelism: false` |
| Quick run command | `pnpm vitest run tests/documents/tags.test.ts` (신규 파일 예시) |
| Full suite command | `pnpm vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DOC-03 | 4번째 태그 서버 400 거부, 3개 이하는 저장 | unit(트랜잭션) | `pnpm vitest run tests/documents/tags.test.ts -t "COUNT"` | ❌ Wave 0 |
| DOC-03 | PUT /tags EDITOR 미만 403 | integration(RBAC) | `pnpm vitest run tests/documents/tags-rbac.test.ts` | ❌ Wave 0 |
| DOC-04 | NFC 정규화 — NFD로 입력된 쿼리가 NFC로 저장된 제목을 찾는다 | unit | `pnpm vitest run tests/search/nfc-normalize.test.ts` | ❌ Wave 0 |
| DOC-04 | 제목·본문·태그 검색이 workspace로 스코프됨(IDOR) | integration | `pnpm vitest run tests/search/idor.test.ts` | ❌ Wave 0 |
| EXP-01 | .md export가 `document.content`와 바이트 동일 | unit | `pnpm vitest run tests/export/md-export.test.ts` | ❌ Wave 0 |
| EXP-02 | .zip export가 폴더 계층을 보존하고 엔트리명이 sanitize됨 | integration | `pnpm vitest run tests/export/zip-export.test.ts` | ❌ Wave 0 |
| EXP-02 | zip-slip 페이로드(`../../`가 포함된 제목)가 안전하게 처리됨 | unit | `pnpm vitest run tests/export/zip-slip.test.ts -t "sanitize"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** 해당 태스크가 건드리는 파일의 단위 테스트만(`pnpm vitest run tests/<domain>/`)
- **Per wave merge:** `pnpm vitest run`(전체 스위트)
- **Phase gate:** 전체 스위트 green + `pnpm exec tsc --noEmit` 후 `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/documents/tags.test.ts` — DOC-03 COUNT>3 롤백, dedup, 정상 replace-all
- [ ] `tests/documents/tags-rbac.test.ts` — EDITOR 미만 403, IDOR(타 워크스페이스 문서 태그 수정 시도)
- [ ] `tests/search/nfc-normalize.test.ts` — NFC/NFD 혼재 쿼리·저장 데이터 매칭 검증(`각`류 자모 분리 vs `각` 완성형 비교)
- [ ] `tests/search/idor.test.ts` — 검색 결과가 워크스페이스 경계를 넘지 않음, VIEWER 미만 403
- [ ] `tests/export/md-export.test.ts` — content 원문과 응답 바디 바이트 비교, RBAC(VIEWER+)
- [ ] `tests/export/zip-export.test.ts` — 서브트리 폴더 구조가 zip 디렉터리와 1:1, 동일 제목 충돌 시 `-1`/`-2`
- [ ] `tests/export/zip-slip.test.ts` — `../`·`/` 포함 제목이 sanitize되어 zip 엔트리가 상위 디렉터리를 벗어나지 않음
- [ ] 신규 마이그레이션(pg_trgm custom SQL) — `pnpm drizzle-kit migrate` 실행 후 `\d document`로 GIN 인덱스에 `gin_trgm_ops` 존재 여부 수동 확인(자동화 테스트로 포착 어려움, 실행 시 체크리스트 항목)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | 이 phase는 인증 로직을 다루지 않음(기존 Auth.js 세션 재사용) |
| V3 Session Management | no | 동일 |
| V4 Access Control | yes | `requireRole`(EDITOR: 태그 저장, VIEWER: 검색·export) — 모든 신규 라우트가 기존 게이트 재사용 |
| V5 Input Validation | yes | zod(`tagsBodySchema`, 검색 `q` 길이/trim), zip 엔트리명 sanitize(zip-slip), `z.uuid()` 경로 파라미터 검증 |
| V6 Cryptography | no | 해당 없음 |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL 인젝션(검색 `q` 파라미터를 문자열 결합으로 ILIKE에 삽입) | Tampering | Drizzle `sql` 템플릿 리터럴 또는 `ilike()` 헬퍼로 파라미터 바인딩(문자열 연결 금지) — CONTEXT.md가 이미 "파라미터 바인딩" 명시 |
| IDOR(다른 워크스페이스 문서/폴더의 태그·검색·export에 접근) | Elevation of Privilege / Information Disclosure | 기존 `resolveWorkspaceIdForDocument`/`resolveActiveWorkspaceId`로 workspaceId를 서버가 재유도 후 `requireRole` — 클라이언트가 보낸 workspaceId를 신뢰하지 않음(기존 4단계 IDOR 관례 재사용) |
| zip-slip(경로 순회를 유발하는 폴더/문서명) | Tampering | zip 엔트리명 생성 시 `sanitizeZipSegment`로 `/`, `\`, `..` 제거(Pattern 4) |
| 태그 개수 제한 클라이언트 우회 | Tampering | 서버 트랜잭션 COUNT 검증(Pattern 1) — UI 비활성화는 보안 경계가 아님(NFR-3.2) |
| ReDoS(검색어에 정규식 특수문자 대량 포함) | Denial of Service | ILIKE는 정규식이 아니라 SQL LIKE 패턴이라 ReDoS 벡터가 원천적으로 없음. 단, `%`/`_` 와일드카드 문자를 사용자가 그대로 넣으면 의도치 않은 광범위 매칭이 될 수 있어 필요 시 이스케이프 고려(스코프 낮음 — 워크스페이스 내부 신뢰된 사용자 대상 기능이라 우선순위는 낮음, [ASSUMED]) |

## Sources

### Primary (HIGH confidence)
- `src/db/schema.ts`, `src/lib/documents.ts`, `src/lib/closure.ts`, `src/lib/rbac.ts`, `src/lib/validation.ts`, 기존 API route 파일 4종 — 이 세션에서 직접 Read, 코드베이스 관례의 1차 출처
- `docs/TRD.md` §1/§3/§4/§5/§8 — 스택·스키마·API 확정 문서, 이 세션에서 직접 Read
- `.planning/phases/06-tags-search-export/06-CONTEXT.md`, `06-UI-SPEC.md` — 잠긴 결정, 이 세션에서 직접 Read
- npm 레지스트리 `npm view archiver/@types/archiver` — 이 세션에서 직접 실행

### Secondary (MEDIUM confidence)
- PostgreSQL 공식 문서 기반 `normalize()`/`IS NORMALIZED`(PG13+) 요약 — [database.guide](https://database.guide/understanding-the-normalize-function-in-postgresql/), [postgresql.org 메일링 리스트 논의](https://www.postgresql.org/message-id/2309023a-6f69-f049-70e5-3c70b4fb9672@2ndquadrant.com)
- `pg_trgm` GIN 인덱스 관례 — [PostgreSQL 공식 pg_trgm 문서](https://www.postgresql.org/docs/current/pgtrgm.html), [Medium 가이드](https://medium.com/@valentim.dba/the-essential-guide-to-indexing-like-ilike-searches-in-postgresql-using-pg-trgm-c72318ecce08)
- Next.js 15 스트리밍 Route Handler 패턴 — [nextjs.org/docs/app/guides/streaming](https://nextjs.org/docs/app/guides/streaming), [Eric Burel 블로그](https://www.ericburel.tech/blog/nextjs-stream-files)
- Content-Disposition RFC 5987/6266 한글 파일명 — [MDN Content-Disposition](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Disposition), [httpwg.org RFC 6266](https://httpwg.org/specs/rfc6266.html)

### Tertiary (LOW confidence)
- drizzle-kit `gin_trgm_ops` 누락 버그(drizzle-orm#2935) — 보고 버전(0.24.2)이 이 프로젝트 버전(0.31.10)과 달라 현재도 재현되는지 미확인. [GitHub Issue](https://github.com/drizzle-team/drizzle-orm/issues/2935)
- archiver + Next.js 커뮤니티 예제(vercel/next.js Discussion #58044) — 비공식 커뮤니티 답변, 코드 그대로 검증되지 않음

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — archiver는 TRD가 이미 확정했고 npm 레지스트리로 버전·정상성 검증 완료
- Architecture(NFC 전략): MEDIUM — TRD 인덱스 SQL(고정)과 SC2(정확성)를 동시에 만족하는 유일한 경로로 추론했으나, 기존 행 백필 필요성은 실제 DB 조회로 확인하지 못함(A3)
- Pitfalls: MEDIUM — drizzle-kit 버그(Pitfall 2)는 이 프로젝트의 정확한 버전에서 재현을 확인하지 않은 이관 지식

**Research date:** 2026-08-08
**Valid until:** 2026-09-07 (30일 — 안정적 스택, archiver/PostgreSQL 모두 빠르게 변하지 않음)
