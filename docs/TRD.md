# TRD — 마크다운 문서 관리 시스템 (markdown-kms)

| 항목 | 내용 |
|------|------|
| 버전 | v1.0.0 (2026-08-01) |
| 상위 문서 | [PRD.md](./PRD.md) v1.0.0 ← [REQUIREMENT.md](./REQUIREMENT.md) v1.0.0 |
| 문서 역할 | 스택·스키마·API·핵심 프로토콜을 구현 착수 가능한 수준으로 확정 |

---

## 1. 기술 스택

REQUIREMENT는 스택을 지정하지 않았다. 아래로 확정한다. 선정 기준은 하나다: **P0~P2 요구를 가장 적은 부품으로 덮는가.**

| 계층 | 선택 | 이 선택인 이유 (탈락 대안) |
|------|------|---------------------------|
| 앱 프레임워크 | Next.js 15 (App Router) + TypeScript | 프론트+API를 한 저장소·한 배포로. 이 규모에 백엔드 분리는 부품만 늘린다 (탈락: SPA+별도 API 서버) |
| DB | PostgreSQL 16 | NFR-2.2 부분 인덱스, FR-D4 검색용 pg_trgm, Closure Table 재귀 없는 조인 — 셋 다 네이티브 (탈락: MySQL — 부분 인덱스 없음) |
| ORM | Drizzle ORM | 스키마가 TS 코드(`src/db/schema.ts`)라 §3 DDL과 1:1 대응, drizzle-kit 마이그레이션. Closure Table 벌크 연산은 `sql` 템플릿으로 그대로 작성 |
| 패키지 매니저 | pnpm | 전 명령 pnpm 경유. npm/yarn 혼용 금지 |
| 인증 | Auth.js v5 (NextAuth) | FR-A2 "OAuth 확장 가능한 구조"를 credentials provider → Google provider 추가로 정확히 충족. 비밀번호는 bcrypt |
| 에디터 | CodeMirror 6 | 커서 위치 삽입(FR-E6)·선택 영역 감싸기(US-1)·10k자 성능이 표준 API. textarea는 이 셋이 전부 수제, Monaco는 IDE급 무게 |
| 마크다운 | unified: remark-parse + remark-gfm + remark-rehype + rehype-raw + rehype-sanitize + rehype-react | micromark 코어가 CommonMark 0.31.2 spec 테스트를 통과. remark-gfm에서 취소선·태스크·표만 활성, footnote 등은 비활성 (§1 범위) |
| 아이콘 | lucide-react | FR-E7 명시 |
| zip | archiver | FR-X2 스트리밍 압축 |
| 테스트 | Vitest + Playwright | spec_tests 러너는 Vitest, 60ms 측정·E2E는 Playwright |
| 스타일 | CSS Modules + `docs/ui-kit.html`의 디자인 토큰 | ui-kit이 순수 CSS 변수 체계(IBM Plex Sans/Mono, accent `#2563eb`)라 그대로 이식. Tailwind는 토큰 이중화만 만든다 |

## 2. 아키텍처

```
브라우저 ── Next.js (단일 배포)
             ├─ RSC/클라이언트 컴포넌트: 트리·에디터·미리보기
             ├─ Route Handlers (/api/*): REST + zod 입력 검증
             │    └─ requireRole(workspaceId, minRole) ← 모든 변경 API 공통 관문
             └─ Drizzle ── PostgreSQL
```

- 미리보기 렌더링은 **전부 클라이언트**에서 수행한다. 60ms 예산(NFR-1.1)에 서버 왕복이 들어갈 자리가 없다.
- 권한 검증은 **전부 서버**에서 수행한다(NFR-3.2). `requireRole`이 세션 → workspace_member.role 조회 → 미달 시 403. UI의 버튼 숨김은 편의일 뿐 보안 경계가 아니다.

## 3. 데이터 모델

PRD §2·§3의 확정 해석을 반영한 스키마. Drizzle 스키마(`src/db/schema.ts`)의 원천 정의이며, 충돌 시 이 문서를 갱신한 뒤 drizzle-kit으로 마이그레이션한다.

```sql
CREATE TABLE "user" (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  password_hash text,                -- OAuth 전용 계정은 NULL 허용 (R3)
  name          text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workspace (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,  -- 시드 1행만 true, 삭제 불가
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workspace_member (
  workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  role         text NOT NULL CHECK (role IN ('OWNER','ADMIN','EDITOR','VIEWER')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE folder (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  parent_id    uuid REFERENCES folder(id),   -- NULL = 워크스페이스 루트 직속
  name         text NOT NULL,
  is_deleted   boolean NOT NULL DEFAULT false,
  is_trash_root boolean NOT NULL DEFAULT false, -- 직접 삭제 항목만 true (PRD §2-2)
  deleted_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- 폴더 계층 Closure Table. self-reference(depth=0) 포함 (REQUIREMENT §6)
CREATE TABLE folder_closure (
  ancestor_id   uuid NOT NULL REFERENCES folder(id) ON DELETE CASCADE,
  descendant_id uuid NOT NULL REFERENCES folder(id) ON DELETE CASCADE,
  depth         int  NOT NULL,
  PRIMARY KEY (ancestor_id, descendant_id)
);
CREATE INDEX ON folder_closure (descendant_id);

CREATE TABLE document (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  folder_id    uuid REFERENCES folder(id),   -- NULL = 워크스페이스 루트 직속
  title        text NOT NULL DEFAULT '제목 없음',
  content      text NOT NULL DEFAULT '',
  saved_seq    bigint NOT NULL DEFAULT 0,    -- 자동 저장 순서 가드 (§7)
  is_deleted   boolean NOT NULL DEFAULT false,
  is_trash_root boolean NOT NULL DEFAULT false,
  deleted_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- NFR-2.2: 활성 조회 부분 인덱스
CREATE INDEX doc_active_idx    ON document (workspace_id, folder_id) WHERE is_deleted = false;
CREATE INDEX folder_active_idx ON folder   (workspace_id, parent_id) WHERE is_deleted = false;

-- FR-D4 검색: 한국어에 PG 기본 FTS 사전이 없어 trigram 부분일치로 확정
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX doc_title_trgm   ON document USING gin (title gin_trgm_ops)   WHERE is_deleted = false;
CREATE INDEX doc_content_trgm ON document USING gin (content gin_trgm_ops) WHERE is_deleted = false;

CREATE TABLE document_tag (
  document_id uuid NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  tag         text NOT NULL,
  PRIMARY KEY (document_id, tag)
);  -- 최대 3개 제약은 저장 트랜잭션에서 COUNT 검증 (REQUIREMENT §6)

CREATE TABLE document_draft (   -- FR-E10: 문서당 1행 upsert
  document_id uuid PRIMARY KEY REFERENCES document(id) ON DELETE CASCADE,
  content     text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workspace_join_request (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  decided_by   uuid REFERENCES "user"(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  decided_at   timestamptz
);

CREATE TABLE invitation (      -- NFR-3.3: 토큰 원문은 저장하지 않는다 (§9)
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  invitee_id   uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  created_by   uuid NOT NULL REFERENCES "user"(id),
  expires_at   timestamptz NOT NULL,
  used_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
```

## 4. 폴더 트리 연산 (Closure Table)

NFR-1.3이 금지하는 것은 깊이 비례 재귀 쿼리다. 네 연산 모두 고정 쿼리 수로 처리한다.

- **서브트리 조회 (단일 쿼리, US-3 인수 조건)**:
  ```sql
  SELECT f.* FROM folder f
  JOIN folder_closure fc ON fc.descendant_id = f.id
  WHERE fc.ancestor_id = :folderId AND f.is_deleted = false;
  ```
  문서 포함 트리는 위 결과에 `document WHERE folder_id = ANY(...)` 1쿼리를 더해 총 2쿼리.
- **폴더 생성**: 부모의 조상 행 복사 + self 행. `INSERT ... SELECT ancestor_id, :newId, depth+1 FROM folder_closure WHERE descendant_id = :parentId` + `(newId, newId, 0)`.
- **폴더 이동**: 서브트리의 기존 조상 링크 DELETE 후 새 부모 조상 × 서브트리 CROSS JOIN INSERT. 이동 대상의 자손으로 이동(사이클)은 closure에 (움직일 폴더 → 새 부모) 행이 존재하는지로 사전 거부.
- **폴더 삭제 (PRD §2-2 cascade)**: 한 트랜잭션에서 서브트리 폴더 전체와 그 폴더들의 문서에 `is_deleted = true, deleted_at = now()`, 삭제 명령 대상에만 `is_trash_root = true`. closure 행은 남긴다 — 복원이 그대로 역연산이 되기 때문.
- **복원**: trash_root 기준 서브트리를 `is_deleted = false`로. 복원 위치의 부모가 삭제 상태면 `parent_id = NULL`(루트)로 옮기고 closure를 재작성한다 (PRD §2-3).

## 5. 마크다운 파이프라인

```
content ─ remark-parse ─ remark-gfm(strikethrough·tasklist·table만) ─ remark-rehype(allowDangerousHtml)
        ─ rehype-raw ─ rehype-sanitize(허용 스키마) ─ rehype-react ─ 미리보기 DOM
```

- **NFR-3.1 충족 방식**: raw HTML은 rehype-raw로 일단 파싱하되 rehype-sanitize 허용 목록을 통과한 요소만 남는다. `<script>`, 이벤트 핸들러 속성, `javascript:` URL은 목록에 없으므로 제거 = "미통과 시 렌더링하지 않음". sanitize 스키마에 GFM 산출물(`del`, `input[type=checkbox][disabled]`, `table` 계열)을 추가한다.
- **NFR-5.2 (export 무손실)**: export는 `document.content` 원문을 그대로 내보낸다. 파이프라인을 역변환하지 않으므로 손실이 원리적으로 없다.
- 같은 파이프라인 함수를 미리보기·프레젠테이션(R3)이 공유한다. 렌더러가 둘이 되는 순간 정합성 테스트도 둘이 된다.

### 60ms 예산 (NFR-1.1)

10,000자 기준 파싱+변환은 수 ms대라 병목이 아니다. 예산은 React 커밋에 쓴다.

| 구간 | 예산 |
|------|------|
| keystroke → 파싱·변환 (unified) | ≤ 15ms |
| rehype-react 요소 생성 | ≤ 10ms |
| React reconcile + 커밋 | ≤ 35ms |

1차 구현은 문서 전체 재파싱 + React 기본 reconcile로 간다. Playwright 측정에서 p95가 60ms를 넘을 때만 블록 단위 메모이제이션(최상위 hast 노드별 `memo` + 노드 해시 key)을 추가한다. 측정 없는 최적화는 하지 않는다.

## 6. 에디터 플러그인 아키텍처

FR-E1~E5의 서식 기능은 **기능당 파일 하나의 플러그인**으로 구현한다. 헤딩 드롭다운 1 + 인라인 4(Bold·Italic·Strikethrough·InlineCode) + 목록 3(Bullet·Ordered·Task) + 블록 3(Blockquote·CodeBlock·HR) + 삽입 3(Link·Image·Table) = 14개 파일. 플러그인 간 import는 금지하고, 공유물은 `types.ts`와 selection 헬퍼뿐이다. 기능 하나의 추가·수정·삭제가 파일 하나로 끝나야 한다.

```ts
// components/editor/plugins/types.ts
export interface EditorPlugin {
  id: string                                // 'bold', 'heading-2', …
  icon: LucideIcon                          // FR-E7
  tooltip: string                           // FR-E7
  keymap?: string                           // 예: 'Mod-b'
  run(state: EditorState): TransactionSpec  // 순수 함수 — DOM 없이 테스트
}
```

- `run`은 CodeMirror `EditorState` → `TransactionSpec` 순수 함수다. `EditorView`(DOM)를 만지지 않으므로 Vitest에서 JSDOM 없이 "상태 넣고 결과 문자열 단언"으로 테스트한다. 툴바·키맵은 `index.ts` 레지스트리가 `view.dispatch(plugin.run(view.state))`로 조립한다.
- TDD 단위가 곧 플러그인이다. `tests/editor/bold.test.ts`가 `plugins/bold.ts`보다 먼저 커밋된다 (§10).

## 7. 자동 저장·임시 저장 프로토콜

**자동 저장 (FR-E9, NFR-1.2, PRD §2-8).**

```
입력 → 1s 디바운스 → PUT /api/documents/:id  body { content, title, seq }
```

- `seq`는 에디터 세션에서 단조 증가하는 정수. 서버는
  `UPDATE document SET content=:c, saved_seq=:seq, updated_at=now() WHERE id=:id AND saved_seq < :seq`
  로 반영한다. 옛 요청이 늦게 도착하면 `saved_seq < seq`가 거짓이라 자연 무시 — 취소 없이(NFR-1.2) 순서가 보장된다. affected rows 0 + 최신 요청 성공이면 상태 바는 "저장됨".
- 상태 바 상태 전이: `저장 중` → 2xx `저장됨` / 실패 시 `저장 실패` + 재시도 버튼(NFR-4.2). 재시도는 현재 내용으로 새 seq를 발급한다.
- 문서 열람 시 `seq`는 서버의 `saved_seq`부터 시작한다. 다중 세션은 last-write-wins (PRD §6).

**임시 저장 (FR-E10, NFR-2.1).**

- 마지막 임시 저장 후 입력이 있었을 때만 1분 타이머가 `PUT /api/documents/:id/draft`로 upsert (문서당 1행).
- 문서 진입 시 `draft.updated_at > document.updated_at`이면 복구 다이얼로그. 복구 선택 → draft를 에디터에 적재 후 정식 저장, 폐기 선택 → draft 삭제. 정식 저장 성공 시에도 draft를 삭제해 진입 시 오탐을 막는다.

## 8. API

전 변경 API는 `requireRole` 통과 후 zod로 body 검증. 표는 R1~R2 핵심만, 최소 역할은 PRD §3 매트릭스를 따른다.

| 메서드·경로 | 동작 | 최소 역할 |
|-------------|------|----------|
| POST `/api/auth/signup` | 가입 + 기본 워크스페이스 EDITOR 편입 | - |
| POST `/api/workspaces` | 워크스페이스 생성, 생성자 OWNER | 회원 |
| DELETE `/api/workspaces/:id` | 워크스페이스 삭제 | OWNER |
| GET `/api/workspaces/:id/tree` | 트리 전체 (2쿼리, §4) | VIEWER |
| POST/PATCH/DELETE `/api/folders*` | 폴더 생성·이름변경·이동 / 소프트 삭제 | EDITOR |
| POST/PUT/DELETE `/api/documents*` | 문서 생성·저장(§7) / 소프트 삭제 | EDITOR |
| PUT `/api/documents/:id/tags` | 태그 교체, 서버에서 3개 초과 400 | EDITOR |
| POST `/api/trash/:type/:id/restore` | 복원 (cascade, §4) | EDITOR |
| DELETE `/api/trash/:type/:id` | 완전 삭제 (물리 삭제) | ADMIN |
| GET `/api/workspaces/:id/search?q=` | 제목·본문·태그 ILIKE(trigram) 검색 | VIEWER |
| GET `/api/documents/:id/export` | `.md` 다운로드 | VIEWER |
| GET `/api/folders/:id/export` | 서브트리 zip 스트리밍 (archiver) | VIEWER |
| POST `/api/workspaces/:id/join-requests` + 승인/거절 | 가입 신청 흐름 | 신청: 회원 / 결정: ADMIN |
| POST `/api/workspaces/:id/invitations` | 회원 검색 후 초대 발송 | ADMIN |
| GET `/api/invitations/accept?token=` | 초대 수락 → EDITOR 편입 | 링크 소지 회원 |
| POST `/api/uploads` | 이미지 업로드, URL 반환 | EDITOR |

이미지 저장소는 R2에서 로컬 디스크(`/uploads`)로 시작한다. S3 계열 전환은 저장 함수 하나 교체로 끝나도록 업로드 경로를 한 모듈에 가둔다.

## 9. 초대 토큰 (NFR-3.3)

`token = base64url(invitation_id + "." + HMAC-SHA256(secret, invitation_id + expires_at))`

- 서명 검증 실패·`expires_at` 경과·`used_at` 존재 → 410 거부. 수락 성공 시 `used_at` 기록으로 일회성 보장.
- DB에는 토큰 원문을 저장하지 않는다. 유출 표면은 메일 한 곳뿐이다.
- 메일 발송은 nodemailer + SMTP 환경변수. 개발 환경은 콘솔 출력으로 대체.

## 10. 테스트 전략 (NFR-5.1)

개발 방법론은 **TDD**다. 실패하는 테스트 → 최소 구현 → 리팩터 순서를 지키고, 아래 표의 테스트가 대응 구현보다 먼저 커밋된다.

| 대상 | 방법 |
|------|------|
| CommonMark 정합성 | 0.31.2 `spec.json`(652 예제)을 fixture로 Vitest 러너 작성. 파이프라인 출력 HTML과 스펙 기대값 비교. sanitize 단계 전 출력으로 비교한다(스펙은 raw HTML 보존을 기대하므로) |
| GFM 확장 3종 | 취소선·태스크·표 자체 테스트 파일 별도 작성 (NFR-5.1 명시) |
| XSS | `<script>`·`onerror`·`javascript:` 페이로드가 sanitize 후 부재함을 단위 테스트 |
| RBAC | 역할 4종 × 주요 API 매트릭스 통합 테스트, 미달 요청 403 확인 |
| 저장 순서 | 서버 유닛: seq 역순 도착 시 affected rows 0 검증 |
| 에디터 플러그인 | 플러그인당 테스트 파일 1개 (`tests/editor/*.test.ts`). `run(state)` 순수 함수에 빈 선택·부분 선택·중복 적용 케이스 단언 (§6) |
| 60ms p95 | Playwright: 10,000자 문서에 keystroke 100회, `MutationObserver` 타임스탬프로 p95 산출 |
| E2E | 가입→작성→자동저장→삭제→복원, 폴더 cascade, 초대 수락 흐름 |

## 11. 디렉터리 구조

```
src/
  app/(auth)/login, signup          # 인증 화면
  app/(main)/w/[wsId]/…             # 트리 + 에디터 3분할 화면
  app/api/…                         # §8 route handlers
  db/schema.ts                      # §3의 Drizzle 표현
  lib/markdown/                     # 파이프라인 + sanitize 스키마 (단일 원천)
  lib/rbac.ts                       # requireRole
  lib/closure.ts                    # §4 트리 연산 (sql 템플릿)
  components/editor/plugins/        # §6 — 1기능 1파일 + types.ts + index.ts 레지스트리
  components/tree/ preview/
drizzle.config.ts
tests/spec/                         # CommonMark spec.json 러너 + GFM 테스트
tests/editor/                       # 플러그인 TDD 테스트 (§10)
e2e/                                # Playwright
```

스캐폴딩은 `pnpm create next-app` 최신 명령으로 시작한다 (수제 보일러플레이트 금지 — 저장소 scaffold 스킬 규칙). 개발 진행은 GSD 워크플로(`/gsd-new-project` → phase별 plan→execute→verify)를 따른다.
