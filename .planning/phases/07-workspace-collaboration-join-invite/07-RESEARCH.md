# Phase 7: Workspace Collaboration (Join & Invite) - Research

**Researched:** 2026-08-09
**Domain:** 워크스페이스 멤버십 확장 — 가입 신청/승인 플로우, 서명 stateless 초대 토큰(HMAC), 트랜잭션 기반 멤버십 편입, 메일 발송 모듈 격리
**Confidence:** HIGH (기존 코드베이스 컨벤션이 압도적으로 지배적이고, 토큰 포맷 자체는 TRD §9에 리터럴로 잠겨 있음)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**초대 + 이메일 (WS-05, FR-W5)**
- 이메일 발송(dev): 실 SMTP 미설정 → **서버 콘솔에 수락 링크를 로그**. 발송 로직을 **1모듈에 격리**(`src/lib/mailer.ts` 류 — `storage.ts`처럼 나중에 실 SMTP로 함수 교체). 신규 이메일 dep 미설치.
- 토큰(TRD §9, NFR-3.3 — 확정): `token = base64url(invitation_id + "." + HMAC-SHA256(secret, invitation_id + expires_at))`. 시크릿 = `process.env.AUTH_SECRET`(Auth.js 기존). **DB에 토큰 원문 미저장** — invitation 행(id·expires_at)으로 HMAC 재계산해 검증.
- 토큰 TTL: 7일(expires_at). 일회성(used_at set 후 재사용 거부). 만료·사용·서명불일치는 각각 명확한 거부.
- 회원 검색: 이메일/이름 부분일치로 **기존 회원** 검색(초대 대상=기존 계정, invitee_id → user FK). 멤버 페이지에서 ADMIN이 검색·초대.

**가입 신청 + 멤버 UI (WS-03/04, FR-W3/W4)**
- 참여 신청 발견: 대시보드에 "워크스페이스 참여 신청" — workspace id 입력 → `POST /api/workspaces/:id/join-requests`(신청=회원). 이미 멤버거나 PENDING 중복은 거부.
- 승인/거절 UI: 워크스페이스 멤버 페이지 `w/[wsId]/members` — ADMIN이 PENDING 목록을 승인/거절(승인/거절 라우트, ADMIN).
- 멤버 목록: 멤버 페이지에서 VIEWER+ 멤버 목록 조회. 초대·승인은 ADMIN 전용(서버 검증, UI 게이팅은 편의).
- 승인 시 역할: join 승인 → **EDITOR** 편입(권한 매트릭스 기본, 초대 수락과 동일 역할).

### Claude's Discretion
mailer 모듈 인터페이스, 토큰 encode/verify 헬퍼(순수·테스트 용이), 멤버 페이지 레이아웃, 회원 검색 컴포넌트, join-request 중복 처리(unique 제약 vs 앱 검증) — 코드베이스 관례(CSS Modules·ui-kit·zod·requireRole·DbClient·순수 헬퍼) 따라 재량.

### Deferred Ideas (OUT OF SCOPE)
- Phase 8(프레젠테이션·구글 로그인) → 스코프 제외.
- 실 SMTP 발송·이메일 템플릿 → dev는 콘솔, 모듈만 격리.
- 역할 변경·멤버 제거(kick)·소유권 이전 → 스코프 밖(초대·가입만).
- 알림 센터·실시간 → 추후.
- Phase 3~6 defer된 UAT → 끝에 몰아서(이 phase 후 마일스톤 마감).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WS-03 (P1, FR-W3) | 회원은 워크스페이스에 가입 신청할 수 있다 | `POST /api/workspaces/:id/join-requests` 설계(멤버십 무관, `auth()` 세션만 체크 — `workspaces/route.ts` POST 패턴 그대로), 중복/이미-멤버 400 처리, 대시보드 UI 계약 |
| WS-04 (P1, FR-W4) | Owner·Admin은 가입 신청을 승인·거절할 수 있다 | `PATCH /api/workspaces/:id/join-requests/:reqId` 설계, `requireRole(wsId,"ADMIN")`, `WHERE status='PENDING'` 가드(TRD §7 seq-가드와 동형), 승인 시 트랜잭션 멤버십 INSERT |
| WS-05 (P1, FR-W5/NFR-3.3) | Owner·Admin은 회원을 검색해 초대 메일을 발송하고, 수락 링크(서명·일회성·만료)를 클릭한 회원은 EDITOR로 편입된다 | HMAC 토큰 encode/verify 순수 헬퍼, `invitation` 트랜잭션 편입, `mailer.ts` 격리, 회원 검색 ILIKE, `/invitations/accept` 5-상태 페이지 |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **패키지 매니저**: pnpm 고정. npm/yarn 명령 금지.
- **에디터 플러그인 관례**: 이 phase와 무관(서식 기능 추가 없음).
- **마크다운 파이프라인**: 이 phase와 무관(렌더링 변경 없음).
- **sanitize 없는 렌더링 금지**: 이 phase에서 신규 렌더 표면 없음(멤버 이름/이메일은 React 텍스트 노드로만 출력 — dangerouslySetInnerHTML 사용 금지, escaping은 React 기본이 처리).
- **권한 검증은 서버 전용**: 모든 변경 API(`join-requests` POST/PATCH, `invitations` POST)는 `src/lib/rbac.ts`의 `requireRole` 경유, 위반 403. UI 버튼/섹션 숨김(07-UI-SPEC의 "섹션 자체를 렌더하지 않는다")은 편의일 뿐 보안 경계가 아니다 — 이 phase는 이미 UI-SPEC이 이 원칙을 `canManage` boolean 전달로 명시했다.
- **폴더 계층/소프트 삭제/자동 저장 seq 가드**: 이 phase와 직접 무관하지만, **`WHERE status='PENDING'`·`WHERE used_at IS NULL` 가드는 TRD §7의 `WHERE saved_seq < :seq` 가드와 동일 패턴**(경쟁 상태를 애플리케이션 레벨 낙관적 잠금으로 방지) — 아래 Don't Hand-Roll에서 재사용을 명시한다.
- **태그 최대 3개/document당 draft 1행**: 이 phase와 무관.
- **export 원문 그대로**: 이 phase와 무관.
- **미리보기 60ms 예산 선제 최적화 금지**: 이 phase에 미리보기 렌더 없음, 해당 없음.
- **GSD 워크플로**: 이 phase 종료 후 다음 단계(검증→다음 phase) 안내는 `.claude/CLAUDE.md`의 "구현시 지침" 대로 오케스트레이터가 수행 — 리서치 산출물과 무관.

## Summary

이 phase는 순수 신규 기능(가입 신청/승인, 초대 토큰)이며, 기존 코드베이스가 이미 이 phase가 필요로 하는 거의 모든 패턴을 6개 phase에 걸쳐 확립해 두었다: `requireRole` 서버 게이트, `DbClient` 주입 + `db.transaction`, zod 스키마, `sql` 템플릿 ILIKE(이스케이프 포함), `WHERE <조건>`으로 낙관적 잠금을 거는 가드-업데이트 관용구(`autosaveDocument`의 `saved_seq` 가드, `softDeleteFolder`/`replaceTags`의 idempotent-가드), `ConfirmDialog`/`Button`/`Card` UI 프리미티브, 그리고 `storage.ts`류의 "모듈 하나에 가둬 나중에 교체" 패턴(`mailer.ts`가 그 판박이). 새로 설계해야 하는 유일한 조각은 **HMAC 서명 stateless 토큰의 encode/verify 순수 함수**이며, 포맷 자체는 TRD §9에 리터럴로 고정되어 있어 탐색의 여지가 없다 — 리서치의 실질 가치는 그 리터럴 포맷을 구현 가능한 알고리즘으로 정확히 분해하는 데 있다(아래 Code Examples).

핵심 설계 난제는 하나: TRD 공식이 `HMAC-SHA256(secret, invitation_id + expires_at)`을 요구하는데 `expires_at`은 토큰 자체에 평문으로 실리지 않고(토큰엔 `invitation_id + "." + mac`만 들어간다) DB의 `invitation` 행에서 읽어와야 한다. 따라서 **서명 재계산은 반드시 `invitation` 행 조회 이후에만 가능**하다 — 07-CONTEXT.md의 "서명 HMAC 비교(위조) → invitation 조회" 순서 서술은 개념적 순서(거부 사유의 우선순위)이지, 리터럴 실행 순서가 아니다. 이 리서치는 두 순서를 모두 만족시키는 정확한 구현 순서를 Pitfall 1에서 확정한다. 두 번째 난제는 `expires_at`의 canonical 직렬화(Postgres timestamptz ↔ JS Date 왕복 시 서브밀리초 손실 가능성)이며, epoch-ms 정수로 통일해 해결한다(Pitfall 3).

신규 npm 의존성은 0개다. HMAC은 Node 내장 `crypto`(`createHmac`, `timingSafeEqual`), base64url은 Node 내장 `Buffer`/`digest` 인코딩, 메일은 콘솔 로그, 검색은 기존 `sql` 템플릿 ILIKE 패턴 재사용이다.

**Primary recommendation:** `src/lib/invitation-token.ts`(순수 encode/parse/verifyMac 헬퍼, DOM/DB 없음 — 에디터 플러그인의 `run(state)` 순수 함수 관례와 동형) + `src/lib/invitations.ts`(DB 조회·트랜잭션·5-상태 판정을 조합하는 `acceptInvitation()`) + `src/lib/mailer.ts`(1-함수 모듈) + `src/lib/member-search.ts`(ILIKE) 로 라이브러리 레이어를 나누고, 라우트는 전부 `requireRole` → zod parse → lib 함수 호출의 3단 구조를 그대로 반복한다. 새 아키텍처 결정은 없다 — 기존 패턴의 정확한 재적용이 전부다.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 초대 토큰 encode/HMAC 서명 | API / Backend | — | `AUTH_SECRET`은 서버 전용 시크릿, 브라우저에 절대 노출 불가. 순수 함수이므로 DB/네트워크 계층과도 분리(테스트 용이성) |
| 초대 토큰 verify(서명·만료·일회성·invitee 일치) | API / Backend | Database / Storage | 서명 재계산에 DB의 `expires_at`이 필요해 lib 함수가 DB 조회를 감싼다(TRD §9) — 순수 크립토 부분만 별도 파일로 분리해 테스트는 DB 없이, 통합은 DB 있이 |
| 멤버십 편입(INSERT workspace_member) | Database / Storage | API / Backend | 원자성이 핵심(중복 편입 방지, `used_at`/`status` 동시 갱신) — 반드시 단일 트랜잭션. API 계층은 트랜잭션을 호출만 함 |
| 가입 신청 승인/거절 결정 | API / Backend | Database / Storage | `requireRole(ADMIN)` 게이트는 서버 전용, DB는 `WHERE status='PENDING'` 가드로 경쟁 상태만 방지 |
| 회원 검색(이메일/이름 ILIKE) | Database / Storage | API / Backend | pg ILIKE 패턴 매칭이 DB에서 수행(기존 `searchWorkspace`와 동형), API는 wsId 검증·requireRole만 |
| 메일 발송 | API / Backend | — | dev 콘솔 로그도 서버 프로세스에서만 실행(브라우저에서 절대 실행 불가) — `storage.ts`의 "저장 함수 하나 교체" 격리와 동일 이유 |
| 멤버 페이지 초기 렌더(멤버 목록·PENDING 목록) | Frontend Server (SSR) | Database / Storage | `w/[wsId]/layout.tsx`가 이미 RSC에서 `getWorkspaceFolders`/`getWorkspaceDocuments`를 직접 호출하는 것과 동일하게, 멤버 페이지도 RSC가 DB 함수를 직접 호출(클라이언트 fetch 없음, 로딩 상태 없음 — UI-SPEC 확정) |
| 승인/거절/초대발송 액션(클릭 이후) | Browser / Client | API / Backend | `ConfirmDialog` + `fetch` + `router.refresh()` — `TrashList.tsx`의 mutation 패턴 그대로(옵티미스틱 UI 없음) |
| 초대 수락 검증·리다이렉트 | Frontend Server (SSR) | API / Backend | UI-SPEC이 명시: "토큰 검증은 RSC 렌더 이전에 서버에서 완료" — 클라이언트 fetch를 경유하지 않고 페이지 자체가 서버에서 lib 함수를 직접 호출(`d/[docId]/page.tsx`가 `lib/documents.getDocument`를 직접 부르는 것과 동일한 "GET API 라우트 없이 RSC가 직접 호출" 관례) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:crypto` (내장) | Node 20 런타임 내장 | HMAC-SHA256 서명, `timingSafeEqual` 상수시간 비교 | Node stdlib. `storage.ts`가 이미 같은 모듈의 `randomUUID`를 사용 중(선례) — 신규 crypto 라이브러리를 들여올 이유가 없다 [VERIFIED: package.json — "engines"/devDependencies에 `@types/node: "^20"`, Node 20 타겟 확정] |
| `drizzle-orm` | 0.45.2 (기존 설치) | `invitation`/`workspace_join_request` 테이블 CRUD, 트랜잭션 | 이미 전 phase가 사용 중인 ORM. 신규 버전 불필요 [VERIFIED: package.json:17] |
| `zod` | 4.4.3 (기존 설치) | 요청 바디/쿼리 파라미터 검증(`inviteeId`, `decision`, `token` 등) | 코드베이스 전역 표준(`src/lib/validation.ts`) [VERIFIED: package.json:38] |
| `next-auth` (Auth.js v5) | 5.0.0-beta.32 (기존 설치) | 세션 조회(`auth()`), `AUTH_SECRET` 환경변수(HMAC 시크릿 재사용) | 이미 로그인에 쓰이는 `AUTH_SECRET`을 그대로 재사용 — 신규 시크릿 관리 불필요 [VERIFIED: package.json:26] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (없음) | — | 메일 발송은 dev 콘솔 로그로 대체 — nodemailer 등 신규 dep 미설치(TRD §9는 프로덕션에서 nodemailer를 언급하지만 07-CONTEXT.md가 "신규 이메일 dep 미설치"로 이 phase 범위를 명시적으로 좁혔다) | 이 phase 범위 밖(실 SMTP는 향후 phase) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Node 내장 `crypto.createHmac`/`timingSafeEqual` | `jsonwebtoken`(JWT) | JWT는 TRD §9가 지정한 정확한 토큰 포맷(`base64url(id + "." + mac)`)과 다른 구조(header.payload.signature 3-파트, Base64 payload에 클레임 평문 노출)라 채택 불가 — TRD가 이미 포맷을 확정했으므로 대안 탐색 자체가 범위 밖 |
| DB 조회 후 서명 재계산 | 토큰 자체에 `expires_at`을 평문 클레임으로 포함(자체완결형 JWT류) | TRD §9 리터럴 공식이 `base64url(invitation_id + "." + HMAC(...))`뿐 — `expires_at`을 토큰에 평문으로 추가하면 공식을 벗어난 포맷이 되어 잠긴 결정 위반 |
| 앱 레벨 SELECT-then-INSERT 중복 가드(join-request) | DB partial unique index(`WHERE status='PENDING'`) | 더 강한 동시성 보장이지만 TRD §3 DDL 변경(마이그레이션) 필요 — 이 phase는 TRD 스키마를 그대로 씀(개정 없음). 낮은 동시성의 협업 기능이라 앱 레벨 체크로 충분(YAGNI), 이중 PENDING이 생겨도 승인/거절이 각각 독립적으로 idempotent해 무해 |

**Installation:**
```bash
# 신규 설치 없음 — 전부 기존 devDependencies/dependencies로 충분
```

**Version verification:** `node:crypto`는 Node 런타임 내장이라 npm 레지스트리 버전 확인 대상이 아니다. `drizzle-orm`/`zod`/`next-auth`는 이미 설치된 버전을 그대로 사용(신규 설치·업그레이드 없음) — package.json을 이 세션에 직접 읽어 확인했다.

## Package Legitimacy Audit

**이 phase는 신규 외부 패키지를 설치하지 않는다.** HMAC은 Node 내장 `crypto`, base64url은 Node 내장 `Buffer` 인코딩, 메일은 콘솔 로그다. Package Legitimacy Gate(`gsd_run query package-legitimacy check`)는 설치 대상 패키지가 있을 때만 필수이며, 여기선 실행 대상이 없어 스킵한다.

**Packages removed due to [SLOP] verdict:** 없음(설치 대상 없음)
**Packages flagged as suspicious [SUS]:** 없음(설치 대상 없음)

## Architecture Patterns

### System Architecture Diagram

**A. 초대 발송 플로우**
```
ADMIN 브라우저
  │ 1. 이메일/이름 입력 (SearchBox 재사용, 300ms debounce)
  ▼
GET /api/workspaces/:id/members/search?q=   [requireRole ADMIN]
  │ 2. ILIKE(user.email, user.name) + EXISTS(workspace_member) 조인 → isMember 플래그
  ▼
검색 결과 렌더 (이미 멤버=배지 / 아님=초대 버튼)
  │ 3. "초대" 클릭
  ▼
POST /api/workspaces/:id/invitations   [requireRole ADMIN, body: { inviteeId }]
  │ 4. INSERT invitation(workspaceId, inviteeId, createdBy, expiresAt=now+7d) RETURNING id, expiresAt
  ▼
encodeInvitationToken(id, expiresAt, AUTH_SECRET)   [순수 함수, DB 없음]
  │ 5. token = base64url(id + "." + HMAC-SHA256(secret, id + expiresAt))
  ▼
sendInvitationEmail(inviteeEmail, `${origin}/invitations/accept?token=${token}`)
  │ 6. dev: console.log(link) — 토큰 원문이 노출되는 유일한 지점
  ▼
201 응답 → 버튼 상태 "초대 보냄"
```

**B. 초대 수락 플로우**
```
사용자가 이메일(콘솔 로그)의 링크 클릭
  ▼
GET /invitations/accept?token=... (RSC 페이지, API 라우트 아님 — 아래 Pitfall 6)
  │ 1. auth() 세션 체크
  ├─ 세션 없음 → redirect(/login?callbackUrl=...) [별도 렌더 상태 아님]
  ▼ 세션 있음
acceptInvitation(token, session.user.id)
  │ 2. parseInvitationToken(token) — base64url 디코드 → invitationId + mac 분리
  │    실패 → { status: "invalid-signature" }
  ▼
  3. SELECT invitation WHERE id = invitationId
  │    없음 → { status: "invalid-signature" }  (존재 여부를 별도 노출하지 않음, Pitfall 5)
  ▼
  4. verifyMac(invitationId, row.expiresAt, AUTH_SECRET, mac)  [timingSafeEqual]
  │    불일치 → { status: "invalid-signature" }
  ▼
  5. row.expiresAt < now?  → { status: "expired" }
  ▼
  6. row.usedAt !== null?  → { status: "already-used" }
  ▼
  7. row.inviteeId !== session.user.id?  → { status: "wrong-user" }
  ▼
  8. db.transaction:
       INSERT workspace_member(workspaceId, userId=session.user.id, role='EDITOR')
         ON CONFLICT DO NOTHING   ← 이미 멤버였어도 idempotent
       UPDATE invitation SET usedAt=now()
         WHERE id=invitationId AND usedAt IS NULL   ← 재확인 가드(TOCTOU 방지, Pitfall 4)
  ▼
  9. { status: "success", workspaceId, workspaceName }
  ▼
RSC가 5개 상태 중 하나를 렌더(success/expired/already-used/invalid-signature/wrong-user)
```

**C. 가입 신청 플로우**
```
대시보드(회원, 워크스페이스 무관)
  │ workspace id 입력 → "신청"
  ▼
POST /api/workspaces/:id/join-requests   [auth() 세션만 체크 — requireRole 아님, 아직 멤버가 아니므로]
  │ 이미 멤버? SELECT workspace_member → 있으면 400
  │ 이미 PENDING? SELECT workspace_join_request WHERE status='PENDING' → 있으면 400
  ▼
INSERT workspace_join_request(workspaceId, userId, status='PENDING')
  │
  ▼
201 → "참여 신청을 보냈어요"

ADMIN — w/[wsId]/members 페이지 "승인 대기 중" 섹션
  │ "승인" 또는 "거절" 클릭 (ConfirmDialog 확인 후)
  ▼
PATCH /api/workspaces/:id/join-requests/:reqId   [requireRole ADMIN, body: { decision }]
  │ db.transaction:
  │   UPDATE workspace_join_request SET status=:decision, decidedBy, decidedAt=now()
  │     WHERE id=:reqId AND status='PENDING'   ← 가드, 0행이면 409(이미 처리됨)
  │   decision === 'APPROVED' 이면:
  │     INSERT workspace_member(workspaceId, userId, role='EDITOR') ON CONFLICT DO NOTHING
  ▼
200/204 → router.refresh() → 목록에서 제거
```

### Recommended Project Structure
```
src/
├── lib/
│   ├── invitation-token.ts   # 순수 encode/parse/verifyMac — DB·crypto 외 의존성 없음, 유닛 테스트 대상
│   ├── invitations.ts        # acceptInvitation() — DB 조회 + 트랜잭션 + 5-상태 판정 (DbClient 주입)
│   ├── join-requests.ts      # createJoinRequest()/decideJoinRequest() — DbClient 주입
│   ├── member-search.ts      # searchUsersForInvite() — ILIKE, search.ts와 동형
│   ├── members.ts            # getWorkspaceMembers()/getPendingJoinRequests() — 멤버 페이지 RSC용
│   └── mailer.ts             # sendInvitationEmail() — 1-함수 모듈, storage.ts류 격리
├── app/
│   ├── api/workspaces/[id]/
│   │   ├── join-requests/route.ts           # POST
│   │   └── join-requests/[reqId]/route.ts   # PATCH
│   ├── api/workspaces/[id]/invitations/route.ts     # POST
│   ├── api/workspaces/[id]/members/search/route.ts  # GET
│   ├── (auth)/invitations/accept/page.tsx           # RSC 5-상태 결과 페이지 (Pitfall 6)
│   └── (main)/w/[wsId]/members/page.tsx             # RSC — 멤버 목록 + (canManage 조건부) PENDING/검색
└── components/
    └── members/
        ├── MembersView.tsx        # 페이지 레이아웃 조립(3섹션)
        ├── PendingRequestRow.tsx  # ConfirmDialog 승인/거절
        ├── MemberRow.tsx          # 읽기 전용 행 + 역할 배지
        └── InviteSearch.tsx       # SearchBox 재사용 + per-row 초대 버튼
```

### Pattern 1: 순수 크립토 헬퍼 (에디터 플러그인 `run(state)` 관례의 동형)
**What:** 서명 계산과 파싱은 DB·네트워크·세션 없이 입력→출력만 있는 순수 함수로 분리한다.
**When to use:** `encodeInvitationToken`, `parseInvitationToken`, `verifyMac` — 이 셋은 `AUTH_SECRET` 문자열 + 원시 데이터만 받는다.
**Example:**
```typescript
// src/lib/invitation-token.ts — CLAUDE.md "1기능 1파일" 정신을 크립토 헬퍼에도 적용(순수 함수,
// DOM/DB 없음 — components/editor/plugins의 run(state) 순수 함수 관례와 동일 이유: 유닛 테스트가
// DB 없이 "문자열 넣고 결과 단언"으로 가능해진다).
import { createHmac, timingSafeEqual } from "node:crypto";

const DELIMITER = "."; // base64url 알파벳(A-Z a-z 0-9 - _)엔 "."이 없어 안전한 구분자

// TRD §9 리터럴 공식: HMAC-SHA256(secret, invitation_id + expires_at) — id와 expires_at 사이에
// 구분자가 없다(Pitfall 2에서 이게 왜 안전한지 설명). expires_at은 epoch-ms 정수 문자열로
// 직렬화한다(Pitfall 3 — ISO 문자열 대신 쓰는 이유).
function computeMac(invitationId: string, expiresAtMs: number, secret: string): string {
  return createHmac("sha256", secret).update(`${invitationId}${expiresAtMs}`).digest("base64url");
}

export function encodeInvitationToken(invitationId: string, expiresAt: Date, secret: string): string {
  const mac = computeMac(invitationId, expiresAt.getTime(), secret);
  // TRD §9: token = base64url(invitation_id + "." + HMAC(...)) — "." + mac까지 합친 전체를 다시
  // base64url로 감싼다(이중 인코딩이 아니라, 공식이 원래 그렇게 정의되어 있다).
  return Buffer.from(`${invitationId}${DELIMITER}${mac}`, "utf8").toString("base64url");
}

export type ParsedToken = { invitationId: string; mac: string };

// 실패는 예외가 아니라 null — 호출부(acceptInvitation)가 invalid-signature로 매핑한다.
export function parseInvitationToken(token: string): ParsedToken | null {
  let payload: string;
  try {
    payload = Buffer.from(token, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const sepIndex = payload.indexOf(DELIMITER);
  if (sepIndex < 0) return null;
  const invitationId = payload.slice(0, sepIndex);
  const mac = payload.slice(sepIndex + 1);
  if (!invitationId || !mac) return null;
  return { invitationId, mac };
}

// 상수시간 비교 — timingSafeEqual은 길이가 다르면 던진다(Node 문서, [CITED: nodejs.org/api/crypto.html]
// 웹서치 교차검증) 그래서 길이를 먼저 확인한다.
export function verifyMac(invitationId: string, expiresAt: Date, secret: string, mac: string): boolean {
  const expected = computeMac(invitationId, expiresAt.getTime(), secret);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```
`[CITED: nodejs.org/api/crypto.html + GitGuardian HMAC 가이드, 웹서치 cross-check]` — `createHmac`/`timingSafeEqual`은 Node 6.6.0부터 안정 API, `digest('base64url')`/`Buffer.toString('base64url')`는 Node 15.7부터 지원(이 프로젝트는 Node 20 타겟이라 문제 없음).

### Pattern 2: 가드-업데이트로 낙관적 잠금(기존 관용구 재사용)
**What:** `WHERE <상태 조건>`을 건 `UPDATE ... RETURNING`으로 "이미 처리됨"/"이미 사용됨"을 별도 SELECT-then-branch 없이 원자적으로 판별한다.
**When to use:** join-request 승인/거절의 중복 결정 방지, invitation의 `used_at` 재사용 방지.
**Example:**
```typescript
// TRD §7 autosaveDocument의 `WHERE saved_seq < seq`, closure.ts softDeleteFolder의
// `WHERE is_deleted = false` 가드와 완전히 동일한 관용구 — 이 phase가 발명하는 게 아니라
// 코드베이스에 이미 3곳에서 쓰이는 패턴을 그대로 가져온다.
const decided = await tx
  .update(workspaceJoinRequest)
  .set({ status: decision, decidedBy: adminUserId, decidedAt: new Date() })
  .where(and(eq(workspaceJoinRequest.id, reqId), eq(workspaceJoinRequest.status, "PENDING")))
  .returning({ userId: workspaceJoinRequest.userId, workspaceId: workspaceJoinRequest.workspaceId });
if (decided.length === 0) {
  throw new AlreadyDecidedError(); // 라우트가 409로 매핑
}
```

### Pattern 3: RSC가 DB 함수를 직접 호출(GET API 라우트 없음)
**What:** 클라이언트 fetch 왕복이 필요 없는 초기 렌더는 RSC가 `lib/*.ts`를 직접 `await`한다.
**When to use:** 멤버 페이지(멤버 목록·PENDING 목록), 초대 수락 결과 페이지.
**Example:**
```typescript
// src/app/api/documents/[id]/route.ts:12-13 주석이 이미 이 원칙을 문서화하고 있다:
// "GET is deliberately absent from this file: no RSC caller (the d/[docId] page calls
// lib/documents.getDocument directly, RESEARCH Anti-pattern)."
// 이 phase의 멤버 페이지·초대 수락 페이지도 동일 원칙 — /api/invitations/accept라는
// GET 라우트 파일을 따로 만들지 않는다(TRD §8 표의 "GET /api/invitations/accept?token="은
// 오퍼레이션의 개념적 명세이지, app/api 아래 실제 route.ts 파일을 요구하는 게 아니다).
```

### Anti-Patterns to Avoid
- **토큰에 `expires_at`을 평문 클레임으로 추가**: TRD §9 공식을 벗어난 포맷이 된다. `expires_at`은 항상 DB에서 읽는다.
- **`timingSafeEqual` 앞에 길이 체크 생략**: 길이가 다른 버퍼를 넘기면 예외를 던진다 — 위조된 토큰이 서버 500을 유발하는 결과가 된다.
- **`===`로 서명 비교**: 타이밍 공격에 취약. 반드시 `timingSafeEqual`.
- **초대 존재 여부를 별도 상태로 노출**("이 초대는 존재하지 않습니다" 같은 문구)**: UI-SPEC은 5개 상태만 정의한다(success/expired/already-used/invalid-signature/wrong-user) — invitation을 찾을 수 없는 경우도 invalid-signature로 접는다(열거 공격 방지, Pitfall 5).
- **가입 신청 라우트에서 `requireRole` 호출**: 신청자는 아직 멤버가 아니므로 `requireRole`은 항상 403을 던진다 — `workspaces/route.ts` POST처럼 `auth()` 세션 존재만 확인한다.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 서명 검증(상수시간 비교) | 커스텀 `for` 루프 바이트 비교 또는 `===` | Node 내장 `crypto.timingSafeEqual` | 타이밍 공격 방지가 표준 라이브러리 책임 — 재구현은 미묘한 타이밍 누출 버그를 만들기 쉽다 |
| 경쟁 상태 방지(중복 승인/재사용) | 애플리케이션 레벨 락(뮤텍스, in-memory Set) | `UPDATE ... WHERE status='PENDING'`/`WHERE used_at IS NULL` 가드-업데이트 | 코드베이스가 이미 3곳(`autosaveDocument`, `softDeleteFolder`, `restoreFolder`)에서 이 패턴으로 해결했다 — 프로세스 재시작·다중 인스턴스에도 견고한 DB 레벨 원자성 |
| base64url 인코딩 | 수제 Base64 → `+/=` 치환 함수 | `Buffer.toString('base64url')` / `hmac.digest('base64url')` | Node 15.7+ 내장, 수제 치환은 패딩 처리 등에서 엣지케이스를 놓치기 쉽다 |
| ILIKE 와일드카드 이스케이프 | 직접 정규식으로 `%`/`_` 필터링 | `src/lib/search.ts`의 `.replace(/[\\%_]/g, "\\$&")` + `ESCAPE '\\'` 패턴 그대로 재사용 | 이미 검증된 패턴(T-06-SQLI 테스트 통과) — 새 구현은 새 회귀 표면 |
| 멱등 멤버십 편입 | SELECT 후 조건부 INSERT(2-스텝, 경쟁 상태 존재) | `INSERT ... ON CONFLICT DO NOTHING`(PK가 이미 `(workspace_id, user_id)` 복합키) | DB가 PK 제약으로 이미 유일성을 보장 — 애플리케이션 레벨 존재 체크는 TOCTOU 창을 만들 뿐 |

**Key insight:** 이 phase에서 "새로 발명해야 하는" 로직은 사실상 없다. 유일한 신규 조각(HMAC 인코딩)조차 TRD가 정확한 수식으로 잠가 두었다 — 실패 모드는 전부 "기존 패턴을 안 가져다 씀"이지 "새 알고리즘이 틀림"이 아니다.

## Common Pitfalls

### Pitfall 1: CONTEXT.md의 검증 순서 서술과 실제 실행 순서의 불일치
**What goes wrong:** 07-CONTEXT.md는 "서명 HMAC 비교(위조) → invitation 조회"라고 순서를 적었지만, TRD §9 공식상 서명 재계산에는 DB의 `expires_at`이 필요해 **invitation 조회가 기술적으로 먼저 일어날 수밖에 없다**. 이 서술을 리터럴로 구현하려 하면 막힌다.
**Why it happens:** CONTEXT.md의 순서는 "거부 사유의 우선순위"(무엇을 먼저 검사해 어떤 에러를 반환할지)를 서술한 것이지, 실행 순서 그 자체가 아니다.
**How to avoid:** 실제 구현 순서는: (1) 토큰 파싱(base64url 디코드 + `.` 분리, 실패=invalid-signature) → (2) `invitation` 행 조회(없으면 invalid-signature, Pitfall 5) → (3) DB의 `expires_at`으로 서명 재계산 + `timingSafeEqual`(불일치=invalid-signature) → (4) 만료 체크 → (5) 일회성 체크 → (6) invitee 일치 체크. **관찰 가능한 거부 사유의 순서**(서명 위조가 만료보다 먼저 걸러진다는 것)는 CONTEXT의 의도와 정확히 일치한다 — DB 조회는 사용자에게 노출되는 판정이 아니라 내부 구현 디테일이다.
**Warning signs:** 플래너가 이 순서를 "구현 불가능한 스펙"으로 오인해 CONTEXT를 재해석하려 들면 이 설명을 그대로 인용할 것.

### Pitfall 2: `invitation_id + expires_at` 무구분자 연결의 이론적 모호성
**What goes wrong:** TRD 공식은 `HMAC-SHA256(secret, invitation_id + expires_at)`을 구분자 없이 문자열 연결한다. 원론적으로 서로 다른 `(id, expires_at)` 쌍이 같은 연결 문자열을 만들 수 있다면(예: `id="a"+"123"` vs `id="a1"+"23"`) 서명 위조 표면이 된다.
**Why it happens:** HMAC 페이로드 설계의 고전적 함정(canonicalization ambiguity) — 웹서치로 교차확인한 일반 모범사례도 "구분자 없는 연결은 피하라"고 권고한다 `[CITED: 웹서치 HMAC 모범사례 종합]`.
**How to avoid:** 이 설계에서는 실제로 악용 불가능하다 — 검증 시 `invitation_id`는 **토큰에서 파싱된 값으로 DB를 조회**하고, `expires_at`은 **그 특정 행의 실제 값**이다. 공격자가 임의의 `(id, expires_at)` 쌍을 골라 서명을 위조할 수 없다 — 이미 존재하는 행의 진짜 `expires_at`과만 대조되기 때문에, 연결 모호성이 있어도 "다른 유효한 행으로 오인되는" 경로가 없다. 게다가 UUID는 항상 36자 고정 길이라 실질적 모호성도 없다. TRD 공식이 잠긴 결정이므로 구분자를 추가하는 변형은 하지 않는다 — 이 설명을 근거로 그대로 구현한다.
**Warning signs:** 코드 리뷰에서 "구분자가 없다"는 지적이 나올 수 있음 — 위 근거로 방어 가능.

### Pitfall 3: `expires_at` 직렬화 불일치(발급 시 vs 검증 시)
**What goes wrong:** `expires_at`을 `.toISOString()`으로 직렬화하면, JS `Date`(밀리초 정밀도)가 Postgres `timestamptz`(마이크로초 정밀도 컬럼이지만 JS에서 쓴 값은 항상 000마이크로초)를 왕복할 때 드라이버·타임존 처리 방식에 따라 문자열 표현이 미묘하게 달라질 위험이 있다(예: `Z` 접미사, 프랙션 자릿수).
**Why it happens:** 발급 시점(INSERT 직후 `.returning()`으로 받은 `Date` 객체)과 검증 시점(다른 요청에서 다시 SELECT해 온 `Date` 객체)이 같은 값을 가리켜도, 두 경로가 서로 다른 직렬화 함수를 거치면 문자열이 달라질 수 있다.
**How to avoid:** `expires_at`을 HMAC 입력에 넣을 때 항상 `.getTime()`(epoch 밀리초, 정수)으로 직렬화한다. `postgres`(porsager) 드라이버가 반환하는 `Date` 객체든, INSERT 직후 `.returning()`이 반환하는 `Date` 객체든, `.getTime()`은 항상 같은 정수를 낸다 — 밀리초보다 미세한 정밀도는 애초에 JS Date가 가지지 않으므로 정보 손실이 없다. ISO 문자열 대신 정수를 쓰는 것이 이 문제의 유일한 확실한 해법이다.
**Warning signs:** 갓 발급한 토큰이 즉시 invalid-signature로 거부되면 이 직렬화 문제부터 의심.

### Pitfall 4: 승인/수락의 TOCTOU(이중 클릭·동시 요청)
**What goes wrong:** "이미 처리됨"을 라우트 초입에서 SELECT로 확인하고 나중에 UPDATE하면, 두 동시 요청이 모두 SELECT를 통과한 뒤 둘 다 UPDATE를 성공시켜 `used_at`이 두 번 갱신되거나 멤버십이 중복 처리 시도될 수 있다.
**Why it happens:** check-then-act 사이의 창.
**How to avoid:** Pattern 2의 가드-업데이트(`WHERE status='PENDING'`/`WHERE used_at IS NULL`)를 **트랜잭션 내부의 실제 UPDATE 문**에 걸어야 한다 — 트랜잭션 시작 전에 미리 읽어온 값으로 판단하지 않는다. `INSERT ... ON CONFLICT DO NOTHING`과 짝을 지어 멤버십 INSERT 자체도 멱등하게 만든다(Don't Hand-Roll 표).
**Warning signs:** 부하 테스트나 더블클릭 시 `used_at`이 예상과 다른 시각으로 찍히거나 동일 초대에 대해 두 번 다른 응답(success/already-used)이 관찰되면 가드 위치를 재점검.

### Pitfall 5: invitation 미존재를 별도 상태로 노출(열거 공격)
**What goes wrong:** "이 초대를 찾을 수 없습니다" 같은 6번째 상태를 만들면, 공격자가 무작위 UUID를 넣어 어떤 invitation ID가 실제로 존재하는지 오라클로 활용할 수 있다.
**Why it happens:** UI-SPEC이 정의한 5개 상태(success/expired/already-used/invalid-signature/wrong-user)에 "not-found"가 없다.
**How to avoid:** `invitation` 행이 없으면 `invalid-signature`로 접는다 — "서명이 유효하지 않다"는 것이 공격자 관점에서 "존재하지 않는 ID를 시도했다"와 구분되지 않는 가장 자연스러운 상태다.
**Warning signs:** 없음(설계 시점에 이미 반영해야 함) — 플래너가 새 상태를 추가하려 하면 UI-SPEC 위반임을 지적할 것.

### Pitfall 6: `GET /api/invitations/accept?token=`을 실제 API 라우트 파일로 오해
**What goes wrong:** TRD §8 표에 `GET /api/invitations/accept?token=`이 나열되어 있어, `src/app/api/invitations/accept/route.ts` 파일을 만들고 그걸 프론트가 `fetch`로 호출하도록 구현하기 쉽다. 하지만 07-UI-SPEC.md는 "로딩: 해당 없음 — 토큰 검증은 RSC 렌더 이전에 서버에서 완료되므로(페이지 자체가 결과), 클라이언트 로딩 상태가 없다"고 명시한다 — 클라이언트 fetch 왕복이 있으면 로딩 상태가 필연적으로 생긴다.
**Why it happens:** TRD의 API 표는 "이 애플리케이션이 수행하는 오퍼레이션"을 문서화한 것이지, 파일 구조를 지정한 게 아니다. `documents/[id]/route.ts`의 코드 주석이 이미 이 원칙(GET을 RSC 직접 호출로 대체하고 라우트 파일을 만들지 않음)을 문서화하고 있다.
**How to avoid:** `/invitations/accept` RSC 페이지(`page.tsx`)가 `acceptInvitation()` lib 함수를 직접 `await`한다. 별도의 `app/api/invitations/accept/route.ts`는 만들지 않는다.
**Warning signs:** 플랜에 "클라이언트가 accept API를 fetch한다"는 태스크가 있으면 UI-SPEC의 "로딩 상태 없음" 요구와 충돌.

### Pitfall 7: `AUTH_SECRET` 부재
**What goes wrong:** `process.env.AUTH_SECRET`이 로컬 `.env.local`에 없으면 `createHmac("sha256", undefined)`가 던진다(Node crypto는 키 인자에 `undefined`를 허용하지 않는다).
**Why it happens:** 이 프로젝트는 이미 Auth.js v5(Credentials + JWT 세션)를 쓰고 있어 `AUTH_SECRET`이 로그인 기능 자체의 필수 전제다 `[CITED: authjs.dev/guides/environment-variables — "AUTH_SECRET is the only mandatory environment variable... In production... required, if not set, NextAuth.js will throw an error"]` — 즉 로그인이 이미 동작하고 있다면 이 값은 이미 설정되어 있을 가능성이 높다.
**How to avoid:** 그래도 실행 전 `.env.local`에 `AUTH_SECRET`이 설정돼 있는지 확인(신규 요구가 아니라 기존 요구의 재사용 확인). 새 env var를 추가하지 않는다 — CONTEXT.md가 명시한 "시크릿 = process.env.AUTH_SECRET(Auth.js 기존)"을 그대로 따른다.
**Warning signs:** 초대 발송 라우트가 500(TypeError)을 내면 이 값부터 확인.

### Pitfall 8: 멤버 검색 결과에서 ILIKE 이스케이프 누락
**What goes wrong:** `%`나 `_`가 포함된 검색어(드물지만 이름에 포함될 수 있음)를 그대로 패턴에 넣으면 의도치 않은 광범위 매치가 발생한다.
**Why it happens:** `src/lib/search.ts`의 기존 패턴을 복붙하지 않고 새로 짜면 이스케이프를 빠뜨리기 쉽다.
**How to avoid:** `search.ts`의 `.replace(/[\\%_]/g, "\\$&")` + `ESCAPE '\\'` 그대로 재사용(Don't Hand-Roll 표).

## Code Examples

### 초대 발급(라우트)
```typescript
// src/app/api/workspaces/[id]/invitations/route.ts — 패턴: requireRole → zod parse → lib 호출
// (workspaces/[id]/search/route.ts, documents/[id]/route.ts와 완전히 동형)
import { z } from "zod";
import { db } from "@/db";
import { invitation, user, workspace, workspaceMember } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { ForbiddenError, forbiddenResponse, requireRole } from "@/lib/rbac";
import { encodeInvitationToken } from "@/lib/invitation-token";
import { sendInvitationEmail } from "@/lib/mailer";

const bodySchema = z.object({ inviteeId: z.uuid() });
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // CONTEXT: 7일

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id: wsId } = await context.params;
  if (!z.uuid().safeParse(wsId).success) {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  let session;
  try {
    session = await requireRole(wsId, "ADMIN");
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
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const [invitee] = await db.select().from(user).where(eq(user.id, parsed.data.inviteeId));
  if (!invitee) return Response.json({ error: "존재하지 않는 회원입니다." }, { status: 400 });

  const [existingMember] = await db
    .select()
    .from(workspaceMember)
    .where(and(eq(workspaceMember.workspaceId, wsId), eq(workspaceMember.userId, invitee.id)));
  if (existingMember) return Response.json({ error: "이미 멤버예요." }, { status: 400 });

  const expiresAt = new Date(Date.now() + TTL_MS);
  const [created] = await db
    .insert(invitation)
    .values({ workspaceId: wsId, inviteeId: invitee.id, createdBy: session.userId, expiresAt })
    .returning({ id: invitation.id, expiresAt: invitation.expiresAt });

  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not configured"); // Pitfall 7
  const token = encodeInvitationToken(created.id, created.expiresAt, secret);
  const origin = new URL(req.url).origin; // env var 신규 추가 없이 요청 origin에서 링크를 구성
  await sendInvitationEmail(invitee.email, `${origin}/invitations/accept?token=${token}`);

  return Response.json({ id: created.id }, { status: 201 });
}
```

### mailer.ts — storage.ts류 격리
```typescript
// src/lib/mailer.ts — storage.ts의 "저장 함수 하나 교체로 끝나도록 한 모듈에 가둔다" 원칙의
// 메일 버전. sendInvitationEmail이 유일한 export. 프로덕션 SMTP 전환은 이 함수 본문 교체만으로
// 끝나야 한다(호출부는 그대로).
export async function sendInvitationEmail(to: string, acceptLink: string): Promise<void> {
  // TRD §9: "유출 표면은 메일 한 곳뿐" — 토큰 원문이 등장하는 유일한 지점이 이 로그다.
  console.log(`[mailer] invitation email → ${to}: ${acceptLink}`);
}
```

### acceptInvitation — Pitfall 1/4의 실제 구현
```typescript
// src/lib/invitations.ts
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { invitation, workspace, workspaceMember } from "@/db/schema";
import { parseInvitationToken, verifyMac } from "@/lib/invitation-token";

type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export type AcceptResult =
  | { status: "success"; workspaceId: string; workspaceName: string }
  | { status: "expired" }
  | { status: "already-used" }
  | { status: "invalid-signature" }
  | { status: "wrong-user" };

export async function acceptInvitation(
  token: string,
  currentUserId: string,
  client: DbClient = db,
): Promise<AcceptResult> {
  const parsed = parseInvitationToken(token);
  if (!parsed) return { status: "invalid-signature" };

  const [row] = await client.select().from(invitation).where(eq(invitation.id, parsed.invitationId));
  if (!row) return { status: "invalid-signature" }; // Pitfall 5: not-found를 별도 노출하지 않음

  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not configured");
  if (!verifyMac(row.id, row.expiresAt, secret, parsed.mac)) {
    return { status: "invalid-signature" };
  }
  if (row.expiresAt.getTime() < Date.now()) return { status: "expired" };
  if (row.usedAt !== null) return { status: "already-used" };
  if (row.inviteeId !== currentUserId) return { status: "wrong-user" };

  const [ws] = await client.select({ name: workspace.name }).from(workspace).where(eq(workspace.id, row.workspaceId));

  await client.transaction(async (tx) => {
    await tx
      .insert(workspaceMember)
      .values({ workspaceId: row.workspaceId, userId: currentUserId, role: "EDITOR" })
      .onConflictDoNothing();
    // Pitfall 4: 트랜잭션 내부의 UPDATE 자체가 가드 — 트랜잭션 시작 전 읽은 row.usedAt이 아니라
    // 지금 이 UPDATE 시점의 DB 상태로 재확인한다.
    await tx
      .update(invitation)
      .set({ usedAt: new Date() })
      .where(and(eq(invitation.id, row.id), isNull(invitation.usedAt)));
  });

  return { status: "success", workspaceId: row.workspaceId, workspaceName: ws?.name ?? "" };
}
```
`[ASSUMED]` — `.onConflictDoNothing()`은 drizzle-orm의 표준 upsert API 계열(같은 파일 트리에서 이미 `documents.ts`의 `upsertDraft`가 자매 API인 `.onConflictDoUpdate({ target, set })`를 검증된 형태로 사용 중, `src/lib/documents.ts:128-135` [VERIFIED: 이 세션에 Read함] — `.onConflictDoNothing()`은 같은 drizzle-orm 0.45.2 postgres 다이얼렉트의 표준 자매 메서드이지만 이 세션에서 공식 문서로 직접 확인하지 않았다). 리스크는 낮음(같은 라이브러리·같은 버전의 자매 API) — Assumptions Log 참조.

### `/invitations/accept` RSC 페이지 골격
```typescript
// src/app/(auth)/invitations/accept/page.tsx — Pitfall 6: API 라우트를 fetch하지 않고 직접 호출
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { acceptInvitation } from "@/lib/invitations";

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/invitations/accept?token=${token ?? ""}`)}`);
  }
  if (!token) {
    // 토큰 자체가 없는 방문(직접 URL 타이핑 등) — invalid-signature와 동일 렌더로 접는다.
  }
  const result = await acceptInvitation(token ?? "", session.user.id);
  // result.status에 따라 UI-SPEC "Invitation-Accept Result Contract"의 5개 분기 렌더
  return null; // 실제 구현은 플래너/실행자가 UI-SPEC 표대로 채운다
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| NextAuth v4 `NEXTAUTH_SECRET` | Auth.js v5 `AUTH_SECRET`(별칭으로 구버전 이름도 인식) | v5 정식화(이 프로젝트는 이미 `5.0.0-beta.32`로 v5) | 이 phase와 무관 — 이미 v5로 설치돼 있고 CONTEXT.md가 `AUTH_SECRET`을 명시적으로 지정했다. 신규 조사 불필요, 그대로 재사용 |

**Deprecated/outdated:** 해당 없음 — 이 phase가 다루는 표면(HMAC, ILIKE, Drizzle 트랜잭션)은 전부 이미 검증된 stdlib/기존 스택 API라 최신성 이슈가 없다.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | `drizzle-orm@0.45.2`의 `.onConflictDoNothing()`이 `.onConflictDoUpdate()`와 동일한 postgres 다이얼렉트 계열에서 정상 동작한다 | Code Examples "acceptInvitation" | 낮음 — 실패 시 대안은 `try { insert } catch (uniqueViolation) {}` 또는 사전 SELECT-then-conditional-insert로 즉시 교체 가능. 유닛 테스트가 첫 실행에서 바로 드러낼 문제 |
| A2 | `AUTH_SECRET`이 이미 `.env.local`에 설정되어 있어 로그인이 정상 동작 중이다 | Pitfall 7 | 낮음 — `.env.local`은 보호 경로라 이 세션에서 직접 열람 불가(protect-paths.sh 훅 대상), 로그인 기능이 이미 존재한다는 사실(auth.ts의 JWT 세션 전략)로 간접 추론했다. 실행자가 `pnpm dev` 기동 시 즉시 검증됨 |
| A3 | 초대 발송 API가 `new URL(req.url).origin`으로 수락 링크의 origin을 구성해도 무방하다(별도 `AUTH_URL`류 env var 불필요) | Code Examples "초대 발급" | 낮음 — 코드베이스에 `AUTH_URL`/`NEXTAUTH_URL` 참조가 전무해(grep 확인) 새 env var를 만들지 않는 이 방식이 기존 관례에 더 부합. 리버스 프록시 뒤에서 `req.url`의 origin이 왜곡되면(X-Forwarded-Host 미반영) 문제가 될 수 있으나 이 프로젝트는 로컬 개발 단계라 해당 없음 |

## Open Questions

1. **초대 대상이 이미 멤버인 경우 서버가 거부해야 하는가, 아니면 멱등하게 발급을 허용해야 하는가?**
   - What we know: UI-SPEC은 검색 결과에서 "이미 멤버"면 버튼 자체를 숨기므로(클라이언트는 애초에 요청을 안 보낸다), 서버 쪽 정책은 CONTEXT.md에 명시되어 있지 않다.
   - What's unclear: 서버가 방어적으로 400을 낼지, 아니면 발급은 허용하고 수락 시 `ON CONFLICT DO NOTHING`으로 조용히 무해화할지.
   - Recommendation: 이 리서치는 400 거부를 권장한다(Code Examples에 반영) — 불필요한 초대 이메일 스팸을 막고, join-request의 "이미 멤버" 거부와 정책을 대칭시킨다. 플래너가 재량으로 뒤집어도 안전(수락 로직이 어느 쪽이든 idempotent하다).

2. **join-request 중복 방지를 DB partial unique index로 승격할지, 앱 레벨 SELECT 체크로 남길지.**
   - What we know: TRD §3 DDL에 `workspace_join_request`용 unique 제약이 없다(이 세션에 TRD 원문 확인: PK는 `id` 단일 컬럼뿐).
   - What's unclear: 동시에 같은 사용자가 "신청" 버튼을 연타하는 극단적 동시성 케이스에서 앱 레벨 SELECT-then-INSERT가 이중 PENDING 행을 만들 수 있다.
   - Recommendation: 앱 레벨 체크로 시작(YAGNI, TRD DDL 변경 없이 이 phase를 끝낼 수 있음). 이중 PENDING이 생겨도 각각 독립적으로 승인/거절 가능해 데이터 일관성이 깨지지 않는다 — 문제가 실제로 관측되면 후속 phase에서 partial unique index 마이그레이션을 추가한다.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Node.js `crypto` 모듈 | HMAC 서명/검증 | ✓ (내장) | Node 20 런타임 내장 | — |
| PostgreSQL 16 (로컬 5433, Homebrew) | `invitation`/`workspace_join_request` 마이그레이션 | ✓ (MEMORY.md 기록상 로컬 환경 확인됨) | PG16 | — |
| `AUTH_SECRET` env var | 토큰 서명 시크릿 | 미확인(보호 경로, 이 세션에서 직접 열람 불가) | — | 실행자가 `pnpm dev` 기동 시점에 확인 — 로그인 기능이 이미 동작 중이라면 이미 설정되어 있을 것 (Pitfall 7/A2) |

**Missing dependencies with no fallback:** 없음.
**Missing dependencies with fallback:** `AUTH_SECRET` 존재 여부 미확인 — 실행 시점에 즉시 드러나며 로그인 기능이 이미 이 값에 의존하므로 실질적으로 이미 설정되어 있을 가능성이 매우 높다.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 [VERIFIED: package.json:55] |
| Config file | `vitest.config.ts` — `DATABASE_URL_TEST`로 실 DB 대상 통합 테스트, `fileParallelism: false` [VERIFIED: 이 세션에 Read함] |
| Quick run command | `pnpm vitest run tests/invitations tests/join-requests` |
| Full suite command | `pnpm vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|-------------|
| WS-03 | 회원이 가입 신청 생성(멱등, 이미 멤버/중복 PENDING 거부) | unit/integration | `pnpm vitest run tests/join-requests/create.test.ts` | ❌ Wave 0 |
| WS-04 | ADMIN이 PENDING 승인(EDITOR 편입)/거절, RBAC 매트릭스(비-ADMIN 403) | integration | `pnpm vitest run tests/join-requests/decide.test.ts` | ❌ Wave 0 |
| WS-05 (토큰) | encode/parse/verifyMac 순수 함수 — 정상/변조/만료/재사용/타 사용자 케이스 | unit | `pnpm vitest run tests/invitations/token.test.ts` | ❌ Wave 0 |
| WS-05 (수락 플로우) | `acceptInvitation()` 5-상태 전부(success/expired/already-used/invalid-signature/wrong-user), 트랜잭션 원자성 | integration | `pnpm vitest run tests/invitations/accept.test.ts` | ❌ Wave 0 |
| WS-05 (초대 발급) | ADMIN만 발급 가능(RBAC), 이미 멤버 거부, mailer가 링크를 정확히 넘겨받음(mock) | integration | `pnpm vitest run tests/invitations/create.test.ts` | ❌ Wave 0 |
| WS-05 (회원 검색) | ILIKE 매치, isMember 플래그 정확성, 이스케이프(`%`/`_`) | integration | `pnpm vitest run tests/invitations/member-search.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm vitest run tests/invitations tests/join-requests` (해당 태스크가 건드린 디렉터리만)
- **Per wave merge:** `pnpm vitest run` (전체 스위트 — `tests/rbac/matrix.test.ts`가 기존 라우트를 계속 통과하는지도 함께 확인)
- **Phase gate:** 전체 스위트 green + `pnpm exec tsc --noEmit`(`typecheck-on-stop.sh` 훅과 동일 기준) 후 `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/invitations/helpers.ts` — `createTestInvitation()`(만료/사용됨 다양한 상태로 씨딩), `tests/rbac/helpers.ts`의 `createTestUser`/`createTestWorkspace`/`addMember`/`mockSessionFor` 재사용
- [ ] `tests/invitations/token.test.ts` — DB 없이 순수 함수만 테스트(가장 빠르게 작성 가능한 테스트, TDD RED 먼저 원칙에 가장 적합)
- [ ] `tests/invitations/accept.test.ts`, `tests/invitations/create.test.ts`, `tests/invitations/member-search.test.ts`
- [ ] `tests/join-requests/create.test.ts`, `tests/join-requests/decide.test.ts`
- [ ] `tests/rbac/matrix.test.ts`에 join-requests/invitations 라우트 행 추가(기존 파일 확장, 신규 파일 아님 — 4역할 × 신규 라우트 매트릭스)
- 프레임워크 설치 자체는 불필요(Vitest 이미 전면 구성됨)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|-------------------|
| V2 Authentication | yes(간접) | Auth.js v5 세션(`auth()`) — 이 phase는 신규 인증 로직을 추가하지 않고 기존 세션만 소비 |
| V3 Session Management | yes(간접) | 기존 JWT 세션 그대로(`src/auth.ts`) — 변경 없음 |
| V4 Access Control | **yes(이 phase의 핵심)** | `requireRole(wsId, "ADMIN")` — 초대 발급, join-request 결정, 멤버 검색. `requireRole(wsId, "VIEWER")`(레이아웃 상속) — 멤버 목록 조회. `invitation.inviteeId === session.user.id` — 수락 시점의 대상자 검증(이건 워크스페이스 역할 기반이 아니라 리소스 소유자 기반 접근 제어) |
| V5 Input Validation | yes | zod(`z.uuid()` for wsId/reqId/inviteeId, `z.enum(["APPROVED","REJECTED"])` for decision) — 기존 `src/lib/validation.ts` 패턴 확장 |
| V6 Cryptography | **yes(이 phase의 핵심)** | `node:crypto`의 `createHmac`/`timingSafeEqual` — 절대 수제 구현 금지. 시크릿은 기존 `AUTH_SECRET` 재사용(신규 시크릿 미도입) |

### Known Threat Patterns for Next.js/PostgreSQL/HMAC 스택

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| 초대 토큰 위조(서명 없이/변조된 서명으로 임의 워크스페이스 편입 시도) | Tampering, Elevation of Privilege | `timingSafeEqual` 기반 HMAC 검증 — Pitfall 1~3 |
| 초대 링크 재전송/재사용(사용된 링크로 재편입 시도) | Repudiation(반박 불가능한 일회성 보장 필요) | `used_at IS NULL` 가드-업데이트, 트랜잭션 원자성(Pitfall 4) |
| 타이밍 공격으로 서명 바이트 추정 | Information Disclosure | `timingSafeEqual`(상수시간) — `===` 절대 금지 |
| invitation ID 열거로 존재 여부 탐지 | Information Disclosure | not-found를 invalid-signature로 접음(Pitfall 5) |
| 로그인된 제3자가 타인에게 온 초대 링크를 가로채 자신이 편입 시도 | Elevation of Privilege | `invitee_id === session.user.id` 명시적 체크(wrong-user 상태) — 이게 없으면 "링크를 아는 사람 누구나 편입 가능"이라는 심각한 IDOR가 된다 |
| join-request/invitation 라우트를 role 우회해 직접 호출 | Elevation of Privilege | 전 변경 라우트 `requireRole` 서버 게이트(NFR-3.2), UI 숨김은 보안 아님(CLAUDE.md) |
| 멤버 검색 ILIKE에 SQL 메타문자 주입 | Tampering | drizzle `sql` 템플릿 바인딩(문자열 연결 금지) + `ESCAPE '\\'`(`search.ts` 기존 패턴, T-06-SQLI 테스트로 검증된 방식) |
| 가입 신청/초대 바디의 mass-assignment(예: `role` 필드를 클라이언트가 직접 지정) | Tampering, Elevation of Privilege | zod 스키마가 허용 필드를 명시적으로 제한(`inviteeId`만 받고 `role`은 서버가 하드코딩한 `"EDITOR"`) — `documents.ts`의 mass-assignment 가드(T-04-01-MASS) 관례와 동일 |

## Sources

### Primary (HIGH confidence)
- `docs/TRD.md` §3(DDL), §8(API 표), §9(토큰 공식) — 이 세션에 Read함, 리터럴 인용
- `docs/PRD.md` §2-9(초대 = 기존 회원 검색, 용어 정정), §3(권한 매트릭스) — 이 세션에 Read함
- `.planning/phases/07-workspace-collaboration-join-invite/07-CONTEXT.md`, `07-UI-SPEC.md` — 이 세션에 Read함, 전문 인용
- `src/db/schema.ts`, `src/lib/rbac.ts`, `src/auth.ts`, `src/lib/documents.ts`, `src/lib/closure.ts`, `src/lib/search.ts`, `src/lib/storage.ts`, `src/app/api/workspaces/**`, `src/app/api/documents/[id]/route.ts`, `src/components/tree/SearchBox.tsx`, `src/components/ui/ConfirmDialog.tsx`, `src/components/trash/TrashList.tsx`, `tests/rbac/*.ts` — 전부 이 세션에 Read함

### Secondary (MEDIUM confidence, 웹서치 + 공식 문서 교차검증)
- [Auth.js Environment Variables](https://authjs.dev/guides/environment-variables) — `AUTH_SECRET` 필수 여부
- [Node.js Crypto 공식 문서](https://nodejs.org/api/crypto.html) — `createHmac`/`timingSafeEqual`
- [GitGuardian HMAC Secrets Explained](https://blog.gitguardian.com/hmac-secrets-explained-authentication/) — HMAC 페이로드 설계 모범사례(구분자, 만료 서명 포함, 일회성은 상태 저장 필요)

### Tertiary (LOW confidence)
- 없음(웹서치 결과는 모두 공식 문서와 교차검증해 MEDIUM으로 승격했다)

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — 신규 의존성 0개, 전부 이 세션에 package.json으로 버전 확인
- Architecture: HIGH — TRD/CONTEXT/UI-SPEC이 API 표면과 토큰 포맷을 리터럴로 고정, 나머지는 기존 코드베이스 패턴의 직접 재사용
- Pitfalls: HIGH(크립토 부분은 MEDIUM) — 가드-업데이트/RBAC/ILIKE 패턴은 이 세션에 직접 읽은 기존 코드에서 도출. HMAC 직렬화/canonicalization 추론은 웹서치 교차검증 기반(MEDIUM)

**Research date:** 2026-08-09
**Valid until:** 2026-09-08 (30일 — 스택이 안정적이라 빠른 만료 사유 없음, TRD/CONTEXT가 변경되면 즉시 무효)
