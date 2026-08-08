---
phase: 06-tags-search-export
plan: 01
subsystem: database
tags: [drizzle, postgresql, pg_trgm, zod, unicode-nfc, archiver]

requires:
  - phase: 04-documents
    provides: document table (title/content columns pg_trgm indexes attach to), documentSchema/autosaveBodySchema in src/lib/validation.ts

provides:
  - documentTag Drizzle table ((document_id, tag) composite PK, FK cascade)
  - pg_trgm extension + gin_trgm_ops GIN indexes on document.title/content (partial, is_deleted=false)
  - one-time NFD->NFC backfill of existing document rows
  - write-time NFC normalization on documentSchema (title/content), propagated to autosaveBodySchema and the documents create route
  - tagsBodySchema/TagsBodyInput (<=3 tags)
  - archiver 8.0.0 + @types/archiver 8.0.0 installed

affects: [06-02-tags, 06-03-search, 06-04-export]

actuals:
  tokens: 2219
  tasks: 3
  commits: 3

tech-stack:
  added: [archiver@8.0.0, "@types/archiver@8.0.0"]
  patterns:
    - "pg_trgm/GIN 인덱스는 drizzle DSL이 아니라 custom SQL 마이그레이션으로 손 작성 (drizzle-kit이 gin_trgm_ops 연산자 클래스를 누락하는 버그 회피)"
    - "NFC 정규화는 zod .transform()으로 쓰기 경로에 배선 — normalizeEmail과 동형의 순수 헬퍼"

key-files:
  created:
    - drizzle/0005_classy_pixie.sql
    - drizzle/0006_pg_trgm_search_index.sql
    - tests/validation/nfc-transform.test.ts
  modified:
    - src/db/schema.ts
    - src/lib/validation.ts
    - package.json
    - pnpm-lock.yaml

key-decisions:
  - "pg_trgm GIN 인덱스는 schema.ts DSL에 선언하지 않는다 — 다음 drizzle-kit generate가 인덱스 없음으로 오인해 DROP을 시도하는 것을 막기 위함(06-RESEARCH Pitfall 2)"
  - "DOC-03/DOC-04는 REQUIREMENTS.md에서 아직 미완료로 남긴다 — 이 plan은 스키마/검증 기반만 놓았고 태그·검색 라우트/UI는 06-02/06-03이 완성한다(04-01의 AUTH-03/WS-01 선례와 동일 원칙)"

patterns-established:
  - "custom SQL migration 절차: pnpm drizzle-kit generate --custom → 손 작성 → 적용 후 pg_indexes로 gin_trgm_ops 존재 육안 확인"

requirements-completed: []

coverage:
  - id: D1
    description: "document_tag 테이블이 (document_id, tag) 복합 PK로 존재하고 document 삭제 시 cascade 된다"
    verification:
      - kind: other
        ref: "psql pg_constraint 조회 — document_tag_document_id_tag_pk PRIMARY KEY, document_tag_document_id_document_id_fk FOREIGN KEY ... ON DELETE CASCADE"
        status: pass
    human_judgment: false
  - id: D2
    description: "document.title/content에 gin_trgm_ops GIN 인덱스가 is_deleted=false 부분 조건으로 2개 붙는다 (DOC-04 기반)"
    verification:
      - kind: other
        ref: "psql pg_indexes 조회 — document_title_trgm_idx, document_content_trgm_idx 모두 USING gin (... gin_trgm_ops) WHERE (is_deleted = false)"
        status: pass
    human_judgment: false
  - id: D3
    description: "기존 document 행의 title/content가 NFC로 백필된다"
    verification:
      - kind: other
        ref: "psql SELECT count(*) FROM document WHERE title IS DISTINCT FROM normalize(title,NFC) OR content IS DISTINCT FROM normalize(content,NFC) => 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "documentSchema가 저장 시 title/content를 NFC로 정규화하고, content는 여전히 trim하지 않는다 (DOC-04, NFR-5.2)"
    verification:
      - kind: unit
        ref: "tests/validation/nfc-transform.test.ts#documentSchema NFC transform"
        status: pass
    human_judgment: false
  - id: D5
    description: "tagsBodySchema가 tags 배열을 trim/min(1)/max(3) 검증한다"
    verification:
      - kind: unit
        ref: "tests/validation/nfc-transform.test.ts#tagsBodySchema"
        status: pass
    human_judgment: false
  - id: D6
    description: "archiver + @types/archiver가 설치되어 06-04 export가 소비할 수 있다"
    verification:
      - kind: other
        ref: "package.json dependencies.archiver=8.0.0, devDependencies.@types/archiver=8.0.0"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-08
status: complete
---

# Phase 6 Plan 1: Tags/Search/Export Foundation Summary

**document_tag 스키마 + pg_trgm GIN 인덱스(gin_trgm_ops) custom SQL 마이그레이션 + NFD→NFC 백필 + 저장 시 NFC 정규화 + tagsBodySchema + archiver 설치**

## Performance

- **Duration:** 25 min
- **Tasks:** 3 (checkpoint:decision 게이트 승인 포함)
- **Files modified:** 10 (schema.ts, validation.ts, 2 migration SQL, 2 migration meta, journal, package.json, pnpm-lock.yaml, 1 신규 테스트 파일)

## Accomplishments
- `document_tag` 테이블(복합 PK + FK cascade) 생성 및 dev DB(5433) 적용
- pg_trgm 확장 + `gin_trgm_ops` GIN 인덱스 2개(title/content, `WHERE is_deleted=false`)를 custom SQL 마이그레이션으로 손 작성해 drizzle-kit의 알려진 연산자 클래스 누락 버그(drizzle-orm#2935)를 우회
- 기존 document 행 NFD→NFC 일회성 백필(`IS DISTINCT FROM` 가드로 이미 NFC인 행은 미변경)
- `documentSchema`에 `.transform(normalizeNFC)` 추가 — `autosaveBodySchema`와 문서 생성 라우트에 파일 수정 없이 자동 전파, content는 여전히 trim 없음(NFR-5.2)
- `tagsBodySchema`/`TagsBodyInput` 신설(≤3, trim/min(1))
- `archiver`/`@types/archiver` 8.0.0 설치

## Task Commits

1. **Task 1: one-way 마이그레이션 게이트** — 승인 기록만(커밋 없음, 사전 승인됨)
2. **Task 2: document_tag 스키마 + pg_trgm custom SQL 마이그레이션 + NFC 백필** — `5a43b85` (feat)
3. **Task 3: NFC 저장 정규화 + tagsBodySchema + archiver 설치** — `178f1af` (test, RED) → `ceae079` (feat, GREEN)

## Files Created/Modified
- `src/db/schema.ts` - `documentTag` 테이블 선언 추가, document 테이블 주석 갱신
- `drizzle/0005_classy_pixie.sql` - `document_tag` CREATE TABLE (drizzle-kit generate 산출물)
- `drizzle/0006_pg_trgm_search_index.sql` - pg_trgm 확장 + 2개 GIN 인덱스(gin_trgm_ops) + NFC 백필 UPDATE (custom, 손 작성)
- `src/lib/validation.ts` - `normalizeNFC` 순수 헬퍼, `documentSchema` NFC transform, `tagsBodySchema`/`TagsBodyInput`
- `tests/validation/nfc-transform.test.ts` - NFC 변환, content 공백 보존, title trim, tagsBodySchema ≤3 검증 테스트
- `package.json`/`pnpm-lock.yaml` - archiver 8.0.0, @types/archiver 8.0.0

## Decisions Made
- pg_trgm 인덱스를 `schema.ts` DSL에 넣지 않음(주석으로 명시) — 다음 `drizzle-kit generate` 실행 시 인덱스를 DROP 대상으로 오인하는 것을 방지
- `documentSchema`의 `.pick({title:true})` 파생 스키마(문서 생성 라우트)가 자동으로 NFC transform을 상속하므로 라우트 파일은 건드리지 않음(계획대로)
- `REQUIREMENTS.md`의 DOC-03/DOC-04는 이 plan에서 완료 처리하지 않음 — 스키마/검증 기반만 놓았고 실제 태그 저장 라우트(06-02)·검색 라우트(06-03)가 기능을 완성해야 체크 가능(04-01의 AUTH-03/WS-01 선례와 동일 원칙)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `document_tag` 테이블 + pg_trgm GIN 인덱스 + NFC 백필이 dev DB에 적용 완료 — 06-02(태그)·06-03(검색)이 실 DB로 바로 검증 가능
- `tagsBodySchema` 준비 완료 — 06-02의 `PUT /api/documents/:id/tags` 라우트가 즉시 소비 가능
- `archiver` 설치 완료 — 06-04의 zip export 라우트가 즉시 소비 가능
- 검색 질의 시점 NFC 정규화(`q.trim().normalize("NFC")`)는 06-03의 범위 — 이 plan은 쓰기 절반만 담당

---
*Phase: 06-tags-search-export*
*Completed: 2026-08-08*

## Self-Check: PASSED

All created files verified present on disk; all task commits (`5a43b85`, `178f1af`, `ceae079`) verified present in git log.
