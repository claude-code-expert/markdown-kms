# Phase 7: Workspace Collaboration (Join & Invite) - Context

**Gathered:** 2026-08-09
**Status:** Ready for planning

<domain>
## Phase Boundary

워크스페이스 멤버십을 **가입 신청**과 **초대**로 키운다: 회원이 워크스페이스에 참여 신청 → Owner/Admin 승인·거절, Owner/Admin이 기존 회원을 검색해 초대 메일 발송 → 서명·일회성·만료 링크 클릭 시 EDITOR로 편입.

**이 phase가 하는 것:** invitation·workspace_join_request 테이블·마이그레이션, `POST /api/workspaces/:id/join-requests` + 승인/거절, `POST /api/workspaces/:id/invitations`(ADMIN·회원검색·토큰 발급·메일 발송), `GET /api/invitations/accept?token=`(검증→EDITOR 편입), 멤버 페이지(멤버 목록·초대·PENDING 승인)·대시보드 참여 신청.
**이 phase가 안 하는 것:** Phase 8(프레젠테이션·구글 로그인)은 **스코프 제외**. 마지막 phase.
</domain>

<decisions>
## Implementation Decisions

### 초대 + 이메일 (WS-05, FR-W5)
- 이메일 발송(dev): 실 SMTP 미설정 → **서버 콘솔에 수락 링크를 로그**. 발송 로직을 **1모듈에 격리**(src/lib/mailer.ts 류 — storage.ts처럼 나중에 실 SMTP로 함수 교체). 신규 이메일 dep 미설치.
- 토큰(TRD §9, NFR-3.3 — 확정): `token = base64url(invitation_id + "." + HMAC-SHA256(secret, invitation_id + expires_at))`. 시크릿 = `process.env.AUTH_SECRET`(Auth.js 기존). **DB에 토큰 원문 미저장** — invitation 행(id·expires_at)으로 HMAC 재계산해 검증.
- 토큰 TTL: 7일(expires_at). 일회성(used_at set 후 재사용 거부). 만료·사용·서명불일치는 각각 명확한 거부.
- 회원 검색: 이메일/이름 부분일치로 **기존 회원** 검색(초대 대상=기존 계정, invitee_id → user FK). 멤버 페이지에서 ADMIN이 검색·초대.

### 가입 신청 + 멤버 UI (WS-03/04, FR-W3/W4)
- 참여 신청 발견: 대시보드에 "워크스페이스 참여 신청" — workspace id 입력 → `POST /api/workspaces/:id/join-requests`(신청=회원). 이미 멤버거나 PENDING 중복은 거부.
- 승인/거절 UI: 워크스페이스 멤버 페이지 `w/[wsId]/members` — ADMIN이 PENDING 목록을 승인/거절(승인/거절 라우트, ADMIN).
- 멤버 목록: 멤버 페이지에서 VIEWER+ 멤버 목록 조회. 초대·승인은 ADMIN 전용(서버 검증, UI 게이팅은 편의).
- 승인 시 역할: join 승인 → **EDITOR** 편입(권한 매트릭스 기본, 초대 수락과 동일 역할).

### Claude's Discretion
- mailer 모듈 인터페이스, 토큰 encode/verify 헬퍼(순수·테스트 용이), 멤버 페이지 레이아웃, 회원 검색 컴포넌트, join-request 중복 처리(unique 제약 vs 앱 검증) — 코드베이스 관례(CSS Modules·ui-kit·zod·requireRole·DbClient·순수 헬퍼) 따라 재량.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/db/schema.ts` — user/workspace/workspace_member 존재. invitation·workspace_join_request 추가(TRD §3 DDL). member 테이블은 workspace_member(PK workspace_id+user_id, role).
- `src/lib/rbac.ts` — `requireRole`, ROLE_RANK(VIEWER<EDITOR<ADMIN<OWNER). 승인/초대 ADMIN, 편입은 workspace_member INSERT(role=EDITOR).
- `src/lib/documents.ts`/`closure.ts` — DbClient 주입·트랜잭션 패턴. 멤버십 INSERT·join 승인은 트랜잭션.
- `src/app/api/workspaces/[id]/` + `route.ts` — 라우트 analog. `search/` 라우트가 회원 검색 analog(pg_trgm 재사용 가능하나 user 대상은 이메일/이름 ILIKE).
- `src/app/(main)/w/[wsId]/` — 멤버 페이지 `members/` 신설. `dashboard/` — 참여 신청 진입.
- `src/components/ui/` — Input·Button·Modal·ConfirmDialog 재사용.
- Auth.js v5 세션(`@/auth`) — 현재 사용자·회원 판별. `process.env.AUTH_SECRET`.

### Established Patterns
- 서버 전용 RBAC(requireRole), zod 검증, Drizzle 트랜잭션·DbClient 주입, IDOR 방어.
- TDD(RED 먼저), CSS Modules + ui-kit 토큰(다크 var() 대응), 순수 헬퍼 분리(토큰 encode/verify·검증).
- 서명·stateless 토큰(DB 미저장) — Auth.js JWT와 유사 철학.

### Integration Points
- `POST /api/workspaces/:id/join-requests` + `PATCH .../join-requests/:reqId`(승인/거절, ADMIN) · `POST /api/workspaces/:id/invitations`(ADMIN) · `GET /api/invitations/accept?token=`(링크 소지 회원).
- 멤버 검색: 기존 user 이메일/이름 ILIKE(초대 대상). 멤버 페이지 RSC가 workspace_member + user 조인 목록.
- 로컬 DB PG16@5433, DATABASE_URL은 `.env.local`. AUTH_SECRET도 `.env.local`. worktree 미사용 순차.
</code_context>

<specifics>
## Specific Ideas

- 토큰 검증 순서(보안): 서명 HMAC 비교(위조) → invitation 조회 → 만료(expires_at) → 일회성(used_at null) → invitee가 현재 로그인 사용자와 일치? → workspace_member EDITOR INSERT(트랜잭션, 중복 편입 방지) → used_at set. 각 실패는 명확 거부.
- 이메일 격리가 핵심: dev는 콘솔 로그, 발송 함수 하나만 교체하면 프로덕션 SMTP. 토큰 원문은 메일(=콘솔)에만, DB엔 없음.
- 권한: 신청=회원 누구나, 결정(승인/거절)·초대=ADMIN+. 서버 검증 필수(NFR-3.2).
- 성공기준(ROADMAP): 회원이 참여 신청 / Owner·Admin이 PENDING 승인·거절 / Owner·Admin이 회원 검색+초대 메일, 서명·일회성·만료 링크 클릭 시 EDITOR 편입.
</specifics>

<deferred>
## Deferred Ideas

- Phase 8(프레젠테이션·구글 로그인) → 스코프 제외.
- 실 SMTP 발송·이메일 템플릿 → dev는 콘솔, 모듈만 격리.
- 역할 변경·멤버 제거(kick)·소유권 이전 → 스코프 밖(초대·가입만).
- 알림 센터·실시간 → 추후.
- Phase 3~6 defer된 UAT → 끝에 몰아서(이 phase 후 마일스톤 마감).
</deferred>
