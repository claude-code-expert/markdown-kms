---
phase: 07-workspace-collaboration-join-invite
verified: 2026-08-09T04:09:44Z
status: human_needed
score: 24/24 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "ADMIN이 회원 초대를 발급하고, 서버 콘솔의 [mailer] 링크를 복사해 초대받은 계정으로 열어 EDITOR로 편입되는지 확인"
    expected: "수락 페이지가 '초대를 수락했어요'를 렌더하고, 워크스페이스 멤버 페이지에 그 계정이 EDITOR로 나타난다"
    why_human: "실제 브라우저 세션 2개(초대자·피초대자)와 pnpm dev 서버가 필요 — HMAC 검증·트랜잭션 편입 로직 자체는 tests/invitations/accept.test.ts 7건으로 이미 증명됨(코드 레벨). 이 항목은 end-to-end 왕복의 육안 확인만 남음."
  - test: "ADMIN 계정과 VIEWER 계정으로 각각 /w/{wsId}/members 페이지를 열어 섹션 노출 차이를 확인"
    expected: "ADMIN은 '승인 대기 중'·'회원 초대' 섹션이 보이고, VIEWER는 '멤버 목록'만 보인다"
    why_human: "canManage boolean 분기와 조건부 렌더 자체는 코드에 존재하고 tsc/build로 컴파일 검증됐지만, 실제 픽셀 노출은 브라우저 육안 확인 필요"
  - test: "대시보드에서 다른 워크스페이스 ID로 참여 신청을 보내고, 그 워크스페이스 ADMIN 화면의 '승인 대기 중'에 나타나는지 확인"
    expected: "신청자 화면엔 '참여 신청을 보냈어요' 문구, ADMIN 화면 '승인 대기 중'에 신청자 행이 나타나고 승인 시 EDITOR로 전환"
    why_human: "계정 2개·워크스페이스 2개를 동시에 여는 왕복 시나리오 — POST/PATCH 각각의 단위 동작은 tests/join-requests/*.test.ts로 이미 증명됨. 이 항목은 화면 간 연결의 육안 확인만 남음."
---

# Phase 7: Workspace Collaboration (Join & Invite) Verification Report

**Phase Goal:** Owners/Admins can grow workspace membership via join requests and invitations — WS-03(가입 신청), WS-04(승인/거절), WS-05(회원 검색·초대·서명된 일회성 만료 링크로 EDITOR 편입).
**Verified:** 2026-08-09T04:09:44Z
**Status:** human_needed (자동 검증 전부 통과, 브라우저 왕복 3건만 사람 확인 대기)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria — 1차 계약)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A member can submit a join request to a workspace. | ✓ VERIFIED | `POST /api/workspaces/[id]/join-requests`가 `auth()` 세션만으로 신청을 접수(`requireRole` 미호출, IDOR 방지 — userId는 세션에서만). `tests/join-requests/create.test.ts` 5건(성공/이미멤버 400/중복PENDING 400/비로그인 403/비-uuid 400) 전부 GREEN. |
| 2 | Owner or Admin can approve or reject a pending join request. | ✓ VERIFIED | `PATCH /api/workspaces/[id]/join-requests/[reqId]`가 `requireRole(ADMIN)` 게이트 + `decideJoinRequest` 가드-업데이트 트랜잭션. `tests/join-requests/decide.test.ts` 12건(4역할 매트릭스 OWNER/ADMIN 성공·EDITOR/VIEWER 403, 승인→EDITOR 편입, 거절→멤버십 없음, 이중결정 409) 전부 GREEN. |
| 3 | Owner or Admin can search members and send an invite email; clicking the signed, one-time, expiring link admits the invitee as EDITOR. | ✓ VERIFIED | 회원 검색: `GET members/search`가 ADMIN 전용 + ILIKE 이스케이프(`tests/invitations/member-search.test.ts` 12건, SQLi/wildcard 리터럴화 포함). 발급: `POST invitations`가 ADMIN 전용, HMAC 토큰을 mailer 링크에만 포함(`tests/invitations/create.test.ts` 9건). 수락: `acceptInvitation`이 위조/만료/재사용/wrong-user 4개 거부 상태 + success(EDITOR 편입 + used_at) 단일 트랜잭션(`tests/invitations/accept.test.ts` 7건, `tests/invitations/token.test.ts` 7건). |

**Score (roadmap SC level):** 3/3 verified.

### Observable Truths (PLAN must_haves — 상세 계약, 5개 plan 통합)

| # | Plan | Truth | Status | Evidence |
|---|------|-------|--------|----------|
| 1 | 07-01 | invitation 테이블(id/workspaceId/inviteeId/createdBy/expiresAt/usedAt/createdAt) + cascade FK | ✓ VERIFIED | `psql \d invitation` 실측: workspaceId/inviteeId FK `ON DELETE CASCADE`, createdBy FK cascade 없음(TRD 리터럴 준수), usedAt nullable — 코드·스키마·DB 3단 일치 |
| 2 | 07-01 | workspace_join_request 테이블 + status CHECK(PENDING/APPROVED/REJECTED) | ✓ VERIFIED | `psql \d workspace_join_request` 실측: `CHECK (status = ANY (ARRAY['PENDING','APPROVED','REJECTED']))` 확인 |
| 3 | 07-01 | DB에 토큰 원문 컬럼 없음(id·expiresAt만) | ✓ VERIFIED | `psql \d invitation` 컬럼 목록에 token/mac 컬럼 부재 — NFR-3.3 충족 |
| 4 | 07-01 | encodeInvitationToken이 TRD §9 공식대로 base64url(id+"."+HMAC-SHA256)을 생성 | ✓ VERIFIED | `src/lib/invitation-token.ts:16-21` 코드 직독 + `tests/invitations/token.test.ts` round-trip 테스트 GREEN |
| 5 | 07-01 | verifyMac이 timingSafeEqual 상수시간 비교로 위조/변조 거부, expiresAt은 .getTime() epoch-ms로 발급·검증 동일 직렬화 | ✓ VERIFIED | `invitation-token.ts:42-48`에 길이체크 후 `timingSafeEqual`만 사용(`===` 없음) 확인. `token.test.ts`에 변조-거부·다른-secret-거부·다른-expiresAt-거부·epoch-ms 일관성 4케이스 GREEN |
| 6 | 07-02 | ADMIN이 POST invitations로 발급 시 행 생성+메일 전달, 비-ADMIN 403 | ✓ VERIFIED | `route.ts`에 `requireRole(wsId,"ADMIN")` 확인. `tests/invitations/create.test.ts`: ADMIN 성공 1건 + VIEWER/EDITOR 403(it.each) + non-member 403 + 비로그인 403 |
| 7 | 07-02 | 이미 멤버인 대상 초대 시 400 거부 | ✓ VERIFIED | `route.ts:47-50` existingMember 조회 후 400. 테스트 "rejects inviting an existing member" GREEN |
| 8 | 07-02 | 유효 토큰+본인이면 EDITOR 편입 + used_at 기록(재사용 불가) | ✓ VERIFIED | `invitations.ts:61-74` 단일 `client.transaction` 내 INSERT+UPDATE. `accept.test.ts` success 케이스 + 원자성/멱등 케이스 GREEN |
| 9 | 07-02 | acceptInvitation이 5-상태(success/expired/already-used/invalid-signature/wrong-user)를 정확히 판정, 트랜잭션 원자성 | ✓ VERIFIED | `invitations.ts:41-76` 판정 순서 코드 직독 일치. `accept.test.ts` 7건 전부 5-상태+변조+not-found-fold 커버, GREEN |
| 10 | 07-02 | raw 토큰이 mailer 링크에만 등장, DB 미저장 | ✓ VERIFIED | `mailer.ts` 단일 `console.log` export만 존재(추가 저장 없음). `createInvitation`은 id/expiresAt만 반환(#3 재확인) |
| 11 | 07-03 | 비멤버 회원이 POST join-requests로 신청 가능 | ✓ VERIFIED | 위 SC #1과 동일 근거 |
| 12 | 07-03 | 이미 멤버/이미 PENDING → 400 | ✓ VERIFIED | `route.ts:24-42` 두 SELECT 가드. `create.test.ts` already-member/duplicate-PENDING 케이스 GREEN |
| 13 | 07-03 | ADMIN 승인 시 EDITOR 편입+APPROVED, 거절 시 REJECTED | ✓ VERIFIED | `join-requests.ts:34-51` 가드-업데이트 트랜잭션. `decide.test.ts` approve/reject 케이스 GREEN |
| 14 | 07-03 | 비-ADMIN 403, 이미 결정된 신청 재결정 409 | ✓ VERIFIED | `decide.test.ts` 4역할 매트릭스 + already-decided/nonexistent 409 GREEN |
| 15 | 07-03 | 승인의 status갱신+멤버십INSERT가 단일 트랜잭션, WHERE status='PENDING' 가드 | ✓ VERIFIED | `join-requests.ts:34-38` UPDATE...WHERE status='PENDING' 코드 직독. concurrent double-approve 테스트가 두 번째 호출에서 AlreadyDecidedError 확인 |
| 16 | 07-04 | ADMIN GET members/search로 ILIKE 검색 + isMember 플래그 | ✓ VERIFIED | `member-search.ts:35-43` sql 템플릿 + EXISTS 서브쿼리. `member-search.test.ts` 이메일/이름 부분일치 + isMember 정확성 케이스 GREEN |
| 17 | 07-04 | 비-ADMIN 403, %/_ 메타문자 리터럴 이스케이프 | ✓ VERIFIED | `member-search.ts:32` `.replace(/[\\%_]/g,"\\$&")` + `ESCAPE '\\'`. 테스트: wildcard 리터럴화 + SQLi 케이스 GREEN, RBAC VIEWER/EDITOR/non-member 403 |
| 18 | 07-04 | getWorkspaceMembers/getPendingJoinRequests 조인 조회 | ✓ VERIFIED | `members.ts:10-30` 코드 직독. `tests/members/list.test.ts` 2건(워크스페이스 스코프 확인, PENDING만 필터) GREEN |
| 19 | 07-04 | 검색 쿼리가 sql 템플릿 바인딩만 사용(문자열 연결 없음) | ✓ VERIFIED | `member-search.ts` 전체에 문자열 `+` 연결 부재, `sql\`...\`` 템플릿만 사용 확인 |
| 20 | 07-05 | 멤버 페이지가 멤버 목록(VIEWER+) + ADMIN 전용 섹션 렌더 | ✓ VERIFIED (코드) / 시각 확인 대기 | `page.tsx:19-29` requireRole(VIEWER)→canManage boolean. `MembersView.tsx:24-47` 조건부 렌더(비활성 아님, 미렌더). 컴파일·번들 검증됨; 실제 렌더 육안 확인은 human_verification #2 |
| 21 | 07-05 | ADMIN이 ConfirmDialog로 승인/거절, PATCH 호출 + router.refresh() | ✓ VERIFIED | `PendingRequestRow.tsx:53-69` PATCH 호출 + 성공시 router.refresh(), 실패시 다이얼로그 유지+인라인 에러 |
| 22 | 07-05 | ADMIN 회원검색(debounce·레이스가드)+초대, isMember 배지/버튼 상태 전환 | ✓ VERIFIED | `InviteSearch.tsx` seqRef 레이스가드(52,56,62행) + 300ms debounce(79행) + per-row sendingId/sentIds 상태 확인 |
| 23 | 07-05 | 대시보드 참여 신청 입력 + 성공/실패 인라인 문구 | ✓ VERIFIED | `JoinWorkspaceInput.tsx` 전체 — POST 호출, 성공시 필드 비움+중립 문구, 실패시 destructive 문구, 다음 keystroke에 문구 소거 |
| 24 | 07-05 | FolderTree에 '멤버' 링크가 휴지통 링크 아래 추가 | ✓ VERIFIED | `FolderTree.tsx:429-437` trashLink 바로 아래, ThemeToggle 위에 위치 확인 |

**Score:** 24/24 must-haves verified (0 present-behavior-unverified).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/schema.ts` (invitation, workspaceJoinRequest) | TRD §3 DDL 컬럼·FK·CHECK | ✓ VERIFIED | 코드+DB `\d` 실측 일치 |
| `drizzle/0007_tricky_selene.sql` | 마이그레이션 적용 | ✓ VERIFIED | 로컬 PG16@5433에 적용 확인, 기존 테이블 DROP/파괴적 ALTER 없음 |
| `src/lib/invitation-token.ts` | 순수 HMAC 헬퍼 | ✓ VERIFIED | node:crypto만 import, DB/process.env 참조 없음 |
| `src/lib/invitations.ts` | createInvitation/acceptInvitation | ✓ VERIFIED | DbClient 주입 + 트랜잭션 |
| `src/lib/mailer.ts` | sendInvitationEmail 단일 export | ✓ VERIFIED | console.log 1줄, 신규 dep 없음 |
| `src/app/api/workspaces/[id]/invitations/route.ts` | POST(ADMIN) | ✓ VERIFIED | requireRole ADMIN + zod + 이미멤버 400 |
| `src/app/(auth)/invitations/accept/page.tsx` | RSC 5-상태 | ✓ VERIFIED | acceptInvitation 직접 호출, GET API 라우트 파일 없음(`src/app/api/invitations` 부재 확인) |
| `src/lib/join-requests.ts` | createJoinRequest/decideJoinRequest/AlreadyDecidedError | ✓ VERIFIED | 가드-업데이트 트랜잭션 |
| `src/app/api/workspaces/[id]/join-requests/route.ts` | POST(세션만) | ✓ VERIFIED | requireRole 미사용 확인(grep) |
| `src/app/api/workspaces/[id]/join-requests/[reqId]/route.ts` | PATCH(ADMIN) | ✓ VERIFIED | requireRole ADMIN + AlreadyDecidedError→409 |
| `src/lib/member-search.ts` | searchUsersForInvite | ✓ VERIFIED | ILIKE 이스케이프 + isMember |
| `src/lib/members.ts` | getWorkspaceMembers/getPendingJoinRequests | ✓ VERIFIED | 조인 쿼리, 워크스페이스 스코프 |
| `src/app/api/workspaces/[id]/members/search/route.ts` | GET(ADMIN) | ✓ VERIFIED | requireRole ADMIN |
| `src/app/(main)/w/[wsId]/members/page.tsx` | RSC 멤버 페이지 | ✓ VERIFIED | canManage boolean만 클라이언트 전달 |
| `src/components/members/{MembersView,MemberRow,PendingRequestRow,InviteSearch}.tsx` | 멤버 UI 4종 | ✓ VERIFIED | 전부 구현 완료, 스텁/placeholder 없음 |
| `src/components/workspace/JoinWorkspaceInput.tsx` | 대시보드 참여 신청 | ✓ VERIFIED | 전체 상태머신 구현 |
| `dashboard/page.tsx`, `FolderTree.tsx` 수정 | 참여신청 섹션 + 멤버 링크 | ✓ VERIFIED | 코드 직독 확인 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| invitations POST 라우트 | encodeInvitationToken → mailer | `route.ts:57-60` | ✓ WIRED | 토큰 생성 후 즉시 sendInvitationEmail 호출, 이 지점이 토큰이 등장하는 유일한 곳 |
| accept RSC page | acceptInvitation() 직접 호출 | `page.tsx:27` | ✓ WIRED | GET API 라우트 없음(Pitfall 6 준수), RSC가 lib 직접 await |
| acceptInvitation 트랜잭션 | INSERT onConflictDoNothing + UPDATE WHERE used_at IS NULL | `invitations.ts:61-74` | ✓ WIRED | 단일 `client.transaction` 콜백 내부에 둘 다 존재 |
| decideJoinRequest 트랜잭션 | UPDATE WHERE status='PENDING' + INSERT workspaceMember | `join-requests.ts:34-48` | ✓ WIRED | 단일 트랜잭션, 0행이면 throw로 롤백 |
| members/page.tsx | getWorkspaceMembers/getPendingJoinRequests(07-04) | `page.tsx:26-27` | ✓ WIRED | RSC 직접 await |
| PendingRequestRow | PATCH join-requests/:reqId(07-03) | `PendingRequestRow.tsx:57-61` | ✓ WIRED | fetch 호출 + 응답 처리(성공 refresh/실패 인라인) |
| InviteSearch | GET members/search(07-04) + POST invitations(07-02) | `InviteSearch.tsx:54,87` | ✓ WIRED | 둘 다 실제 호출 + 응답 상태 반영 |
| JoinWorkspaceInput | POST join-requests(07-03) | `JoinWorkspaceInput.tsx:37` | ✓ WIRED | fetch 호출 + 성공/실패 분기 |
| FolderTree membersLink | `/w/{wsId}/members` | `FolderTree.tsx:429-437` | ✓ WIRED | href + active 클래스 계산 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| MembersView(members) | `getWorkspaceMembers` DB 조인 결과 | `members.ts:10-16` | Yes — `workspace_member ⨝ user`, 실제 SELECT | ✓ FLOWING |
| MembersView(pending) | `getPendingJoinRequests` DB 조인 결과 | `members.ts:18-30` | Yes — `workspace_join_request ⨝ user`, status='PENDING' 필터 | ✓ FLOWING |
| InviteSearch(results) | `GET members/search` 응답 | `route.ts` → `searchUsersForInvite` | Yes — 실 ILIKE 쿼리, 정적 반환 아님 | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 토큰 위조 거부(HMAC 상수시간) | `pnpm vitest run tests/invitations/token.test.ts` | 7/7 pass | ✓ PASS |
| 5-상태 판정 + IDOR(wrong-user) 방어 | `pnpm vitest run tests/invitations/accept.test.ts` | 7/7 pass | ✓ PASS |
| 초대 발급 ADMIN 게이트 + 이미멤버 400 | `pnpm vitest run tests/invitations/create.test.ts` | 9/9 pass | ✓ PASS |
| 회원 검색 ILIKE/isMember/RBAC/SQLi | `pnpm vitest run tests/invitations/member-search.test.ts` | 12/12 pass | ✓ PASS |
| 멤버/PENDING 목록 워크스페이스 스코프 | `pnpm vitest run tests/members/list.test.ts` | 2/2 pass | ✓ PASS |
| 가입 신청 세션 바인딩 + 중복 거부 | `pnpm vitest run tests/join-requests/create.test.ts` | 5/5 pass | ✓ PASS |
| 승인/거절 트랜잭션 + 이중결정 409 | `pnpm vitest run tests/join-requests/decide.test.ts` | 24/24 pass | ✓ PASS |
| 전체 회귀 스위트 | `pnpm vitest run` | 1046/1046 pass (67 files) | ✓ PASS |
| 타입체크 | `pnpm exec tsc --noEmit` | 무출력(clean) | ✓ PASS |
| 프로덕션 빌드 + 번들 크기 | `pnpm build` | `/w/[wsId]/members` 4.27 kB First Load JS (rbac/bcrypt 미유입, trash 3.67kB와 동급) | ✓ PASS |
| Lint | `pnpm exec eslint <phase files>` | 무출력(clean) | ✓ PASS |
| DB 스키마 실측 | `psql \d invitation`, `psql \d workspace_join_request` | 토큰 컬럼 없음, CHECK 제약 확인 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| WS-03 | 07-01, 07-03, 07-05 | 회원 가입 신청 | ✓ SATISFIED | POST join-requests + JoinWorkspaceInput UI, 자동 테스트 5건 |
| WS-04 | 07-01, 07-03, 07-05 | ADMIN 승인/거절 | ✓ SATISFIED | PATCH join-requests + PendingRequestRow UI, 자동 테스트 24건 |
| WS-05 | 07-01, 07-02, 07-04, 07-05 | 회원검색·초대·서명 링크 EDITOR 편입 | ✓ SATISFIED | invitation-token/invitations/member-search + InviteSearch/accept UI, 자동 테스트 35건 |

REQUIREMENTS.md 매핑(WS-03/04/05 → Phase 7, Complete)과 일치. Orphaned requirement 없음.

### Anti-Patterns Found

없음. 이 phase가 수정한 17개 파일에 TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER 마커나 하드코딩 빈 스텁 패턴이 없다(grep 0 hits). `PendingRequestRow.tsx`에 `ponytail:` 주석 1건(TrashList의 `formatRequestedAt` 중복을 의도적으로 유지, 3번째 호출부 생기면 추출 예정) — 이는 명시적으로 마킹된 의도적 단순화이며 debt marker gate 대상(TBD/FIXME/XXX)이 아니다.

### Human Verification Required

1. **초대 수락 전체 왕복** — ADMIN이 회원 검색→초대 발급→서버 콘솔 `[mailer]` 링크 복사→초대받은 계정으로 열기→EDITOR 편입 확인. HMAC 검증·트랜잭션 편입 로직 자체는 `tests/invitations/accept.test.ts` 7건으로 코드 레벨 증명 완료 — 남은 것은 실제 브라우저 두 세션의 화면 확인.
2. **멤버 페이지 역할별 섹션 노출** — ADMIN 계정과 VIEWER 계정으로 각각 열어 '승인 대기 중'·'회원 초대' 섹션 유무 육안 확인. 조건부 렌더 로직은 컴파일+번들 크기(4.27kB, rbac 미유입)로 검증됨.
3. **대시보드 참여 신청 → 승인 대기 노출 왕복** — 계정 A가 워크스페이스 B에 신청 → 워크스페이스 B ADMIN 화면에 나타나는지 확인. 각 엔드포인트 단위 동작은 자동 테스트로 증명됨, 화면 간 연결만 남음.

이 3건은 07-VALIDATION.md의 Manual-Only 표에 이미 계획된 항목이며, 07-02/07-03/07-05 SUMMARY들이 일관되게 "phase 말 배치 수동 검증"으로 명시 유보한 항목과 동일하다. 백엔드 로직·RBAC·트랜잭션 원자성·보안 방어(IDOR, 타이밍 공격, SQLi, 이중결정)는 전부 실 DB 통합 테스트로 자동 증명되어 있다.

### Gaps Summary

없음. 24개 must-have 전부 VERIFIED, 3개 roadmap Success Criteria 전부 코드 레벨로 관통 확인됨. 남은 항목은 순수 시각/왕복 확인 3건뿐이며 phase 자체가 "phase 말 배치 수동 검증"으로 계획해 둔 항목과 정확히 일치한다.

---

_Verified: 2026-08-09T04:09:44Z_
_Verifier: Claude (gsd-verifier)_
