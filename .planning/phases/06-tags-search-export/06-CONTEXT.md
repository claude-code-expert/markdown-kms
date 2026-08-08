# Phase 6: Tags, Search & Export - Context

**Gathered:** 2026-08-08
**Status:** Ready for planning

<domain>
## Phase Boundary

문서를 **분류·검색·추출**한다: 문서당 태그 최대 3개(클라+서버 검증), 워크스페이스 내 제목·본문·태그 pg_trgm 부분일치 검색(한국어 NFC 정규화), 단일 문서 무손실 `.md` export, 폴더 서브트리 구조보존 `.zip` export.

**이 phase가 하는 것:** document_tag 테이블·pg_trgm 확장·마이그레이션, `PUT /api/documents/:id/tags`(교체·3개 서버검증), `GET /api/workspaces/:id/search?q=`(trigram·NFC), `GET /api/documents/:id/export`(.md 원문), `GET /api/folders/:id/export`(archiver zip), 태그 입력 UI·검색 UI·export 메뉴. archiver 신규 설치.
**이 phase가 안 하는 것:** 협업(Phase 7). Phase 8(프레젠테이션·구글 로그인)은 **스코프 제외**(사용자 결정). document_draft는 Phase 5서 이미 만듦.
</domain>

<decisions>
## Implementation Decisions

### 태그 (DOC-03, FR-D3)
- 입력 위치: 에디터 제목 행 아래 메타 바 — chip 스타일 입력(Enter/comma로 추가, X로 제거).
- 3개 제한 UX: 3개 도달 시 입력 비활성. 4번째는 클라이언트에서 거부 + API 직접 호출도 서버가 400(COUNT 검증, US-6/NFR-3.2). **서버가 최종 권위**.
- 저장: `PUT /api/documents/:id/tags`로 전체 교체(replace all). EDITOR+. 트랜잭션에서 기존 태그 삭제 후 재삽입, COUNT>3이면 400.
- 표시: 문서 메타 바 + 검색 결과에 태그 노출.

### 검색 (DOC-04, FR-D4)
- 검색창: 사이드바 상단 검색 입력(debounce ~300ms). 범위 = 현 워크스페이스.
- 결과: 리스트(제목 + 본문 스니펫 + 태그), 클릭 시 해당 문서로 이동(`w/[wsId]/d/[docId]`). VIEWER+.
- 내부: `GET /api/workspaces/:id/search?q=` — 제목·본문·태그 ILIKE(pg_trgm 부분일치). **NFC 정규화**: q와 저장 텍스트를 NFC로 정규화한 뒤 비교(한국어 NFC/NFD 코드포인트 불일치 방지 — 성공기준). pg_trgm GIN 인덱스(제목·본문). 파라미터 바인딩(SQL 인젝션 방지).

### Export (EXP-01/02, FR-X1/X2, NFR-5.2)
- 트리거: 문서 컨텍스트 메뉴 ".md 내보내기" + 폴더 컨텍스트 메뉴 ".zip 내보내기". VIEWER+.
- md: `GET /api/documents/:id/export` — `document.content` **원문 그대로** 다운로드(NFR-5.2, 파이프라인 역변환 금지·손실 0). `Content-Disposition: attachment; filename="{제목}.md"`.
- zip: `GET /api/folders/:id/export` — 서브트리를 archiver로 스트리밍 zip. **폴더 계층 보존**(zip 디렉터리 구조), 파일명 `{문서제목}.md`. 엔트리명 sanitize(경로순회/zip-slip 방지 — 제목의 `/`·`..` 등 제거). 같은 폴더 내 동일 제목 충돌은 접미사(`-1`,`-2`).

### Claude's Discretion
- 태그 chip 컴포넌트 구조, 검색 debounce/결과 컴포넌트, export 스트리밍 응답 구현, zip 엔트리명 sanitize 헬퍼, NFC 정규화 위치(입력 저장 시 + 질의 시) — 코드베이스 관례(CSS Modules·ui-kit·zod·requireRole·DbClient·순수 헬퍼 분리) 따라 재량.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/db/schema.ts` — document 존재, document_tag는 없음(주석에 "Phase 6" 명시). document_tag 추가(TRD §3: document_id + tag, PK). pg_trgm 확장 + GIN 인덱스.
- `src/lib/documents.ts` / `validation.ts` — 태그 서비스(replaceTags·getTags·3개 검증)·검색·export 서비스. DbClient 주입 패턴.
- `src/lib/rbac.ts` — requireRole(EDITOR 태그, VIEWER 검색·export).
- `src/app/api/documents/[id]/route.ts` — 라우트 4단계 IDOR shape analog(태그·export 라우트).
- `src/components/tree/DocumentTreeLeaf.tsx`·`FolderContextMenu.tsx` — 문서/폴더 컨텍스트 메뉴에 export 항목 추가.
- `src/components/document/DocumentWorkspace.tsx` — 제목 행 메타 바(태그 입력) 연동점.
- `src/components/tree/FolderTree.tsx` — 사이드바 상단 검색 입력 마운트.
- `src/components/ui/` — Input·Button 재사용.

### Established Patterns
- 서버 전용 RBAC(requireRole), zod 검증, Drizzle `sql`/트랜잭션, DbClient 주입, IDOR workspace_id 서버 재유도.
- TDD(RED 먼저), CSS Modules + ui-kit 토큰(다크 var() 대응), 순수 헬퍼 분리(NFC·sanitize·3개검증 테스트 용이).
- export 원문 그대로 = 파이프라인(lib/markdown) 미경유. 렌더 HTML 아님.

### Integration Points
- `PUT /api/documents/:id/tags` · `GET /api/workspaces/:id/search?q=` · `GET /api/documents/:id/export` · `GET /api/folders/:id/export`. 모두 IDOR workspace_id 서버 재유도.
- archiver: `pnpm add archiver` + `@types/archiver`(dev). 서브트리는 Phase 3 getSubtree(active) + 문서 조회로 구성.
- 로컬 DB PG16@5433, DATABASE_URL은 `.env.local`(main tree). pg_trgm 확장 마이그레이션. worktree 미사용 순차.
</code_context>

<specifics>
## Specific Ideas

- NFC 정규화가 한국어 검색 정확성의 핵심: 저장 시(또는 질의 시 양쪽) `String.prototype.normalize("NFC")`로 맞춰야 pg_trgm이 같은 글자를 매칭. 성공기준 SC2가 이걸 직접 요구.
- export 무손실은 파이프라인 역변환 금지가 전제 — `document.content`를 그대로 스트림. zip은 폴더 구조를 디렉터리로 재현하되 엔트리명 sanitize(보안).
- 태그 3개 상한은 클라 UX(입력 비활성)와 서버 COUNT 400 **둘 다** — UI 숨김은 보안 아님(NFR-3.2).
- 성공기준(ROADMAP): 4번째 태그 클라+서버 거부 / 제목·본문·태그 검색 NFC 정규화 / 단일 .md 무손실 / 폴더 .zip 구조보존.
</specifics>

<deferred>
## Deferred Ideas

- 협업(join-request·invite·이메일) → Phase 7.
- Phase 8(프레젠테이션·구글 로그인) → 스코프 제외(구현 안 함).
- 검색 하이라이트·고급 필터·정렬 → 필요 시 추후.
- S3 export·대용량 스트리밍 최적화 → 추후.
- Phase 3·4·5 defer된 UAT(시각) → 끝에 몰아서.
</deferred>
