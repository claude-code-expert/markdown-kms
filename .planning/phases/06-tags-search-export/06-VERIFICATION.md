---
phase: 06-tags-search-export
verified: 2026-08-08T20:15:00+09:00
status: human_needed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "문서 화면에서 태그 3개 추가 → 입력 비활성화 확인, 중복 태그 입력 → '이미 추가된 태그예요' 에러 문구, X 클릭 → chip 제거, 새로고침 후 유지 (다크/라이트 모두)"
    expected: "TagBar가 UI-SPEC의 at-limit-disabled / duplicate-rejected / tag-save-fail 세 상태를 정확히 렌더하고 저장이 새로고침 후에도 남는다"
    why_human: "Playwright MCP가 이 실행 환경에 연결되어 있지 않음. vitest는 Node 환경이라 실제 DOM 렌더/CSS 상태를 관찰할 수 없다 — 06-02-SUMMARY D5가 이미 human_judgment:true로 defer함"
  - test: "사이드바 검색창에 IME로 '한글' 입력 → 결과 리스트 표시, 결과 클릭 → 문서 이동, 지우기 X → 트리 복귀, 없는 단어 → no-results 문구, 로딩 중 스피너 (다크/라이트). NFD로 붙여넣은 질의도 같은 문서 매칭"
    expected: "300ms 디바운스와 5개 상태(idle/loading/results/no-results/error)가 실제 브라우저에서 UI-SPEC 카피대로 체감된다"
    why_human: "디바운스 타이밍·IME 조합·실제 네트워크 경합은 실브라우저 관찰이 필요 — NFC/NFD 매칭 자체(백엔드 정확성)는 tests/search/nfc-normalize.test.ts로 이미 자동 검증됨(06-03-SUMMARY D5/D6이 시각 확인만 defer)"
  - test: "문서 우클릭 → '.md 내보내기' → 원문 .md 다운로드 확인, 폴더 우클릭 → '.zip 내보내기' → 다운로드 후 압축 해제해 하위 폴더/문서 계층 보존 확인, 한글 제목 파일명 정상, 실패 시 사이드바 배너 (다크/라이트)"
    expected: "브라우저가 실제 파일을 받고, zip 압축 해제 결과가 buildZipEntries가 계산한 계층과 일치한다"
    why_human: "실제 fetch→blob→<a download> 트리거와 OS 파일시스템 압축 해제는 vitest(Node, DOM 없음)로 관찰 불가 — 06-04-SUMMARY D3이 human_judgment:true로 defer. zip 자체의 구조/사양(PK magic bytes, 계층, sanitize)은 tests/export/zip-export.test.ts + zip-slip.test.ts로 이미 자동 검증됨"
---

# Phase 6: Tags, Search & Export Verification Report

**Phase Goal:** Users can categorize, find, and extract their documents
**Verified:** 2026-08-08T20:15:00+09:00
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A document accepts up to 3 tags; a 4th is rejected on both client and server (DOC-03) | ✓ VERIFIED | Client: `TagBar.tsx` `atLimit = tags.length >= 3` disables input at 3. Server: `tagsBodySchema.max(3)` fast-fails, and `replaceTags` (src/lib/documents.ts:172-199) inserts inside a single `db.transaction`, re-COUNTs the row count *inside* the same transaction, and `throw`s `TagLimitError` on `count > 3` — an uncaught throw inside `client.transaction` auto-rolls back (same convention as `closure.ts#softDeleteFolder`). `tests/tags/replace.test.ts` proves a direct `replaceTags(doc.id, ["a","b","c","d"])` call rejects and leaves the DB with only the prior tag set (`getTagRows` reads `["x"]`, not 4 rows) — this is the DB-unchanged proof the verification method asked for. Route-level: `PUT /api/documents/[id]/tags` returns 400 for a 4th tag (`tests/tags/replace.test.ts#returns 400 for a 4th tag`) |
| 2 | Searching by title/body/tag returns matches, NFC-normalized so Korean pg_trgm search isn't broken by NFC/NFD mismatch | ✓ VERIFIED | `psql \d document` confirms both `document_title_trgm_idx` and `document_content_trgm_idx` exist as `USING gin (... gin_trgm_ops) WHERE is_deleted = false` (real DB, not just migration file). Write-time NFC: `documentSchema` (`src/lib/validation.ts:64-67`) `.transform(normalizeNFC)` on title/content, propagated to `autosaveBodySchema`. Backfill: `psql` count of NFC-mismatched rows = **0**. Query-time NFC: `GET /api/workspaces/[id]/search/route.ts` calls `normalizeNFC(rawQ)` before `searchWorkspace`. Bidirectional match proven by real integration tests against the live DB: `tests/search/nfc-normalize.test.ts` stores an NFC-composed Korean title and matches it with both an NFD-normalized-then-NFC query and an already-NFC query (both directions pass). `searchWorkspace` (src/lib/search.ts) uses Drizzle `sql` template placeholders exclusively (`${workspaceId}`, `${pattern}`) — never string concatenation; `tests/search/nfc-normalize.test.ts#treats SQL/LIKE metacharacters...` proves a `%' OR '1'='1` payload returns `[]` (literal, not injected). Workspace scoping proven by `tests/search/idor.test.ts` (cross-workspace title collision returns 0 results, non-member 403, malformed uuid 400) |
| 3 | User can download a single document as a lossless `.md` file | ✓ VERIFIED | `GET /api/documents/[id]/export/route.ts` does `new Response(doc.content, {...})` — `doc.content` is never passed through `lib/markdown` (grep confirms no import). `tests/export/md-export.test.ts` asserts response body equals a content string containing leading/trailing blank lines and trailing spaces **exactly** (`expect(body).toBe(content)`), proving byte-verbatim NFR-5.2 compliance, not just "some text returned". `Content-Disposition` carries both ASCII `filename=` and RFC 5987 `filename*=UTF-8''...` (tested). VIEWER+/IDOR/malformed-id 403/403/400 all tested |
| 4 | User can download a folder's full subtree as a structure-preserving `.zip` | ✓ VERIFIED | `buildZipEntries` (src/lib/export.ts) walks `getSubtree` and recursively composes `folderPath`, so nested folders produce nested `zipPath`s with the root folder as the top-level directory. `tests/export/zip-export.test.ts` proves exact paths (`프로젝트문서/루트문서.md`, `프로젝트문서/하위폴더/하위문서.md`), same-directory title collision suffixing (`-1`/`-2`), soft-deleted exclusion, and — critically — a zip-slip attempt (`../../etc` folder + `../../passwd` document titles) never produces a `zipPath` containing `..` or escaping the subtree. Route-level test asserts the streamed response is a real non-empty zip via **PK magic bytes** (`[0x50, 0x4b]`), which specifically catches the archiver 8.0.0 `Readable.toWeb()` finalize-timing bug class (RESEARCH Pitfall 3) that a bare 200-status assertion would miss |

**Score:** 4/4 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/schema.ts` (`documentTag`) | (document_id, tag) composite PK, FK cascade | ✓ VERIFIED | `psql \d document_tag`: PK `document_tag_document_id_tag_pk` btree(document_id, tag); FK `... ON DELETE CASCADE` |
| `drizzle/0006_pg_trgm_search_index.sql` | pg_trgm ext + 2 GIN indexes + NFC backfill | ✓ VERIFIED | Applied to dev DB; `pg_indexes` count = 2 gin_trgm_ops indexes; backfill mismatch count = 0 |
| `src/lib/validation.ts` (normalizeNFC, tagsBodySchema) | write-time NFC + tag body cap | ✓ VERIFIED | Present, used by documentSchema and tags route |
| `src/lib/documents.ts` (replaceTags/getTags/TagLimitError) | transactional replace-all + 3-cap authority | ✓ VERIFIED | Substantive, wired into route, proven by tests |
| `src/app/api/documents/[id]/tags/route.ts` (PUT) | EDITOR+, 4-stage IDOR, 400 on limit | ✓ VERIFIED | Wired, tested (200/400/403×2) |
| `src/components/document/TagBar.tsx` | chip UI, 3-limit disabled, dup/fail states | ✓ VERIFIED | Mounted in DocumentWorkspace between titleRow/body, wired to RSC `initialTags` from `page.tsx`'s `getTags(docId)` |
| `src/lib/search.ts` (searchWorkspace) | pg_trgm ILIKE, param-bound, ws-scoped | ✓ VERIFIED | Real GIN index consumed, no string concat |
| `src/app/api/workspaces/[id]/search/route.ts` (GET) | VIEWER, NFC query normalization | ✓ VERIFIED | Wired, tested |
| `src/components/tree/SearchBox.tsx` | debounce + race guard + 5 states | ✓ VERIFIED | Sequence-number race guard (mirrors autosave-controller pattern), mounted in FolderTree above `.header`, `.tree`↔`.searchResults` exclusive render |
| `src/lib/export.ts` (sanitizeZipSegment, buildZipEntries) | archiver-free, zip-slip safe | ✓ VERIFIED | Confirmed no `archiver` import (grep + dedicated test); real zip-slip test passes |
| `src/app/api/documents/[id]/export/route.ts` (GET) | VIEWER, verbatim content | ✓ VERIFIED | No lib/markdown import; byte-exact test |
| `src/app/api/folders/[id]/export/route.ts` (GET) | VIEWER, archiver zip stream | ✓ VERIFIED | Real PK-magic-byte zip returned |
| `src/components/tree/FolderTree.tsx` (menu items + download-export.ts) | export menu items + fetch→blob→download | ✓ VERIFIED | `.md 내보내기` / `.zip 내보내기` wired to `downloadExport()`, failure banner state present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `TagBar` | `PUT /documents/:id/tags` | `saveTags` fetch | ✓ WIRED | Optimistic local update + revert-on-fail |
| `PUT /tags` route | `replaceTags` | direct call, TagLimitError→400 | ✓ WIRED | Confirmed in route source |
| `d/[docId]/page.tsx` | `DocumentWorkspace` | `getTags(docId)` → `initialTags` prop | ✓ WIRED | Confirmed in `Promise.all` and prop pass-through |
| `SearchBox` (debounce) | `GET /workspaces/:id/search` | `fetch` in `useSearchResults` | ✓ WIRED | 300ms `setTimeout`, sequence-number guard |
| Search route | `searchWorkspace` | `normalizeNFC(q)` then call | ✓ WIRED | Confirmed in route source |
| `searchWorkspace` | pg_trgm GIN index | `ILIKE` on `title`/`content`, `EXISTS` on `document_tag.tag` | ✓ WIRED | Real DB index present, real match tests pass |
| FolderTree context menu | `downloadExport` | `exportDocument`/`exportFolder` onClick | ✓ WIRED | Confirmed in FolderTree.tsx |
| `/documents/:id/export` route | `getDocument` | content streamed raw | ✓ WIRED | No pipeline transform |
| `/folders/:id/export` route | `buildZipEntries` + `ZipArchive` | entries queued, `finalize()`, `Readable.toWeb` | ✓ WIRED | Real zip bytes proven by test |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| DOC-03 | 06-01, 06-02 | 문서당 태그 3개, 4번째 클라/서버 모두 거부 | ✓ SATISFIED | replaceTags txn COUNT + tagsBodySchema + TagBar atLimit |
| DOC-04 | 06-01, 06-03 | 제목·본문·태그 검색, NFC 정규화, pg_trgm | ✓ SATISFIED | searchWorkspace + gin_trgm_ops index + bidirectional NFC test |
| EXP-01 | 06-01, 06-04 | 단일 문서 무손실 .md 다운로드 | ✓ SATISFIED | byte-verbatim route + test |
| EXP-02 | 06-04 | 폴더 서브트리 구조보존 .zip 다운로드 | ✓ SATISFIED | buildZipEntries + zip-slip test + real PK bytes |

REQUIREMENTS.md marks all 4 as `[x] ... Complete` — matches the code evidence above, not a premature claim.

### Anti-Patterns Found

None. Grepped all 13 phase-modified source files (`documents.ts`, `search.ts`, `export.ts`, `validation.ts`, `schema.ts`, all 4 routes, `TagBar.tsx`, `SearchBox.tsx`, `download-export.ts`, `FolderTree.tsx`) for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER|not yet implemented|coming soon` — zero matches.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite green | `pnpm vitest run` | 977/977 passed, 57 test files | ✓ PASS |
| Typecheck clean | `pnpm exec tsc --noEmit` | no output (clean) | ✓ PASS |
| gin_trgm_ops indexes exist on live DB | `psql ... \d document` | 2 indexes, `WHERE is_deleted = false` | ✓ PASS |
| NFC backfill complete on live DB | `psql SELECT count(*) FROM document WHERE title/content IS DISTINCT FROM normalize(...)` | `0` | ✓ PASS |
| document_tag PK/FK cascade | `psql \d document_tag` | composite PK + `ON DELETE CASCADE` | ✓ PASS |
| archiver dependency installed | `grep archiver package.json` | `"archiver": "^8.0.0"`, `"@types/archiver": "^8.0.0"` | ✓ PASS |

### Probe Execution

Not applicable — this phase has no `scripts/*/tests/probe-*.sh` probes; verification relies on the vitest integration suite against a real local Postgres (which is itself the "probe" for DB-level behavior in this codebase's convention).

## Human Verification Required

3 items — all are genuine "needs real browser eyes" checks (visual state rendering, real file download + unzip, IME timing feel), not gaps in the underlying logic, which is already proven by DB-backed integration tests. See frontmatter `human_verification` for full detail. Summary:

1. **TagBar visual states** — 3-limit disabled input, duplicate-tag error copy, chip removal, persistence across refresh, dark/light theming. Backend/data-layer already proven (`tests/tags/*`); only the DOM render is unverified (no Playwright MCP connection this session).
2. **SearchBox visual states + IME feel** — 5-state rendering (idle/loading/results/no-results/error), debounce timing, real Korean IME input. Backend NFC/pg_trgm correctness already proven by DB-backed tests; only the browser-observable timing/rendering is unverified.
3. **Real download + unzip** — actual browser download trigger, unzip and inspect folder hierarchy, Korean filename handling, failure banner appearance. Byte-level and structural correctness already proven by tests (byte-exact `.md`, real zip magic bytes + exact paths for `.zip`); only the OS-level file-save/unzip round-trip is unverified.

## Gaps Summary

No gaps. All 4 ROADMAP success criteria are backed by evidence at all four verification levels (exists, substantive, wired, data-flowing) plus real-DB integration tests that specifically prove the hard parts named in the phase goal: server-side transactional 3-tag cap with DB-unchanged rollback proof, bidirectional NFC/NFD Korean matching against a real `gin_trgm_ops` index, byte-verbatim `.md` export, and zip-slip-safe structure-preserving `.zip` export with real zip-magic-byte verification. The only open items are conventional "human eyes on a real browser" checks that this project's own plans already flagged as deferred (Playwright MCP not connected this session) — they do not indicate missing or stubbed functionality.

---

*Verified: 2026-08-08T20:15:00+09:00*
*Verifier: Claude (gsd-verifier)*
