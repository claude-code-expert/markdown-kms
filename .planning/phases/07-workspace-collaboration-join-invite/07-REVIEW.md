---
phase: 07-workspace-collaboration-join-invite
reviewed: 2026-08-09T04:16:30Z
depth: deep
files_reviewed: 24
files_reviewed_list:
  - src/db/schema.ts
  - drizzle/0007_tricky_selene.sql
  - src/lib/invitation-token.ts
  - src/lib/invitations.ts
  - src/lib/join-requests.ts
  - src/lib/member-search.ts
  - src/lib/members.ts
  - src/lib/mailer.ts
  - src/app/api/workspaces/[id]/invitations/route.ts
  - src/app/api/workspaces/[id]/join-requests/route.ts
  - src/app/api/workspaces/[id]/join-requests/[reqId]/route.ts
  - src/app/api/workspaces/[id]/members/search/route.ts
  - src/app/(auth)/invitations/accept/page.tsx
  - src/app/(main)/w/[wsId]/members/page.tsx
  - src/components/members/MembersView.tsx
  - src/components/members/MemberRow.tsx
  - src/components/members/PendingRequestRow.tsx
  - src/components/members/InviteSearch.tsx
  - src/components/workspace/JoinWorkspaceInput.tsx
  - src/app/(main)/dashboard/page.tsx
  - src/components/tree/FolderTree.tsx
  - tests/invitations/token.test.ts
  - tests/invitations/accept.test.ts
  - tests/invitations/create.test.ts
  - tests/invitations/member-search.test.ts
  - tests/join-requests/create.test.ts
  - tests/join-requests/decide.test.ts
  - tests/members/list.test.ts
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-08-09T04:16:30Z
**Depth:** deep
**Files Reviewed:** 24 source + 6 test files
**Status:** issues_found

## Summary

HMAC 초대 토큰 스펙(`src/lib/invitation-token.ts`)은 검토한 코드 중 가장 견고하다. 구분자·epoch-ms 직렬화·상수시간 비교·not-found 폴딩·`AUTH_SECRET` fail-closed 처리 모두 focus 항목이 요구한 방어를 정확히 구현했고, `acceptInvitation`의 5-state 우선순위와 guard-update 트랜잭션도 의도한 대로 동작한다. 초대(invitation) 경로는 문제 없음.

반면 참여 신청(join-request) 결정 경로에서 **워크스페이스 경계 검증이 완전히 빠져 있다.** `decideJoinRequest`가 `reqId`만으로 행을 찾고 URL의 `wsId`와 대조하지 않기 때문에, 자신이 관리자인 임의의(자기 소유) 워크스페이스를 이용해 다른 워크스페이스로 향한 참여 신청을 무단 승인할 수 있다 — 결과적으로 어떤 워크스페이스든 관리자 승인 없이 스스로를 멤버로 만들 수 있는 권한 상승 경로다. 마일스톤 마감 직전 병목이므로 최우선 수정 대상.

그 외 참여 신청 POST 경로의 워크스페이스 존재 확인 누락(500 유출/오라클), 초대 링크 origin의 Host 헤더 신뢰, 동시 제출 시 중복 PENDING 레이스 등을 Warning으로 남긴다.

## Critical Issues

### CR-01: `decideJoinRequest`가 워크스페이스 경계를 검증하지 않아 임의 워크스페이스 무단 가입이 가능하다

**File:** `src/lib/join-requests.ts:34-51`, `src/app/api/workspaces/[id]/join-requests/[reqId]/route.ts:13-48`

**Issue:**
`PATCH /api/workspaces/[id]/join-requests/[reqId]` 라우트는 `requireRole(wsId, "ADMIN")`으로 "이 호출자가 URL의 wsId에 대해 ADMIN인가"만 검증한다. 그런 다음 `decideJoinRequest(reqId, decision, session.userId)`를 호출하는데, 이 함수는 `wsId`를 아예 인자로 받지 않고 다음 조건으로만 행을 찾는다.

```ts
// src/lib/join-requests.ts:34-39
const decided = await tx
  .update(workspaceJoinRequest)
  .set({ status: decision, decidedBy: adminUserId, decidedAt: new Date() })
  .where(and(eq(workspaceJoinRequest.id, reqId), eq(workspaceJoinRequest.status, "PENDING")))
  .returning({ userId: workspaceJoinRequest.userId, workspaceId: workspaceJoinRequest.workspaceId });
```

즉 `reqId`가 실제로 어느 워크스페이스에 속하는지는 전혀 검사하지 않는다. `APPROVED` 분기는 이 행에서 읽은(URL의 `wsId`가 아니라 DB 행의) `workspaceId`로 멤버십을 삽입하므로, 공격 시나리오는 다음과 같이 100% 셀프서비스로 완성된다.

1. 누구든 `POST /api/workspaces`로 워크스페이스를 만들면 자동으로 그 워크스페이스의 OWNER가 된다 (`src/app/api/workspaces/route.ts:36`).
2. 그 사용자가 `POST /api/workspaces/{target-ws-id}/join-requests`로 **다른(자신이 멤버가 아닌) 임의 워크스페이스**에 참여 신청을 낸다 — 이 라우트는 신청자 자신의 세션으로만 동작하고 `requireRole`을 호출하지 않는다(의도된 설계, WS-03). `reqId`를 응답으로 받는다.
3. 같은 사용자가 `PATCH /api/workspaces/{자기가-OWNER인-워크스페이스-id}/join-requests/{reqId}` 로 `{decision:"APPROVED"}`를 보낸다. `requireRole(자기-워크스페이스, "ADMIN")`은 통과한다(자기 워크스페이스이므로). `decideJoinRequest`는 `reqId`로만 행을 찾아 그대로 승인하고, 그 행의 실제 `workspaceId`(target-ws-id)로 `workspace_member`에 EDITOR로 삽입한다.

결과: target 워크스페이스의 관리자는 아무 것도 승인하지 않았는데 공격자가 EDITOR로 합류한다. WS-03/WS-04가 보장하려던 "관리자 승인 게이트"가 완전히 우회된다. `tests/join-requests/decide.test.ts`의 4-role 매트릭스는 항상 `wsId == 신청이 실제로 속한 워크스페이스`인 경우만 검증하고 있어 이 경로는 테스트되지 않는다.

**Fix:**
`decideJoinRequest`가 `wsId`를 받아 guard-update의 `WHERE` 절에 포함시킨다. 기존 "존재하지 않는 reqId"와 동일하게 0-rows → `AlreadyDecidedError`(409)로 접혀도 열거 오라클이 생기지 않으므로 자연스러운 확장이다.

```ts
// src/lib/join-requests.ts
export async function decideJoinRequest(
  workspaceId: string,
  reqId: string,
  decision: "APPROVED" | "REJECTED",
  adminUserId: string,
  client: DbClient = db,
) {
  return client.transaction(async (tx) => {
    const decided = await tx
      .update(workspaceJoinRequest)
      .set({ status: decision, decidedBy: adminUserId, decidedAt: new Date() })
      .where(
        and(
          eq(workspaceJoinRequest.id, reqId),
          eq(workspaceJoinRequest.workspaceId, workspaceId), // ← 누락됐던 경계 검증
          eq(workspaceJoinRequest.status, "PENDING"),
        ),
      )
      .returning({ userId: workspaceJoinRequest.userId, workspaceId: workspaceJoinRequest.workspaceId });

    if (decided.length === 0) throw new AlreadyDecidedError();
    // ... 이하 동일
  });
}
```

그리고 라우트에서 `decideJoinRequest(wsId, reqId, parsed.data.decision, session.userId)`로 호출부를 갱신한다. `tests/join-requests/decide.test.ts`에 "다른 워크스페이스의 reqId를 자기 워크스페이스 wsId로 결정 시도 → 409, 상태 불변, 멤버십 생성 안 됨" 케이스를 반드시 추가해 회귀를 막는다.

## Warnings

### WR-01: 초대 수락 링크의 origin이 검증되지 않은 `req.url`(Host 헤더)에서 만들어진다

**File:** `src/app/api/workspaces/[id]/invitations/route.ts:60-61`

**Issue:**
```ts
const origin = new URL(req.url).origin; // A3: no new env var, request origin builds the link
await sendInvitationEmail(invitee.email, `${origin}/invitations/accept?token=${token}`);
```
`req.url`의 origin은 Next.js가 수신한 요청의 Host(또는 프록시가 전달한 X-Forwarded-Host) 헤더에서 파생된다. 리버스 프록시가 Host 헤더 위조를 막아주지 않는 배포 환경(직접 노출된 Node 서버 등)에서는 공격자가 임의 Host 헤더로 초대를 트리거해 실제 초대 대상자의 메일함에 `https://attacker-controlled/invitations/accept?token=...` 형태의 링크가 발송되게 만들 수 있다. `acceptInvitation`의 wrong-user 검사 덕분에 토큰 자체를 탈취해도 공격자 계정으로 가입시키는 건 불가능하지만, 피싱/토큰 노출 표면은 늘어난다.

**Fix:** 배포 origin을 신뢰 가능한 값(환경변수 `NEXT_PUBLIC_APP_ORIGIN` 등)으로 고정하거나, 최소한 Host 헤더를 알려진 허용 목록과 대조한 뒤에만 사용한다.

### WR-02: 참여 신청 POST가 워크스페이스 존재를 확인하지 않아 FK 위반이 그대로 500으로 새어나간다

**File:** `src/app/api/workspaces/[id]/join-requests/route.ts:15-49`

**Issue:** 이 라우트는 `requireRole`을 호출하지 않는 설계(신청자가 아직 멤버가 아니므로 의도적)라서, `wsId`가 uuid 형식은 맞지만 실제로 존재하지 않는 워크스페이스일 때 이를 걸러낼 지점이 없다. `createJoinRequest(wsId, userId)`가 그대로 `workspace_join_request.workspace_id` FK 제약을 위반하며 처리되지 않은 DB 예외가 500으로 노출된다. 부수적으로 응답 코드(201 성공 / 400 이미-멤버·이미-신청 / 500 워크스페이스 없음)를 조합하면 워크스페이스 존재 여부를 구분할 수 있는 오라클이 된다.

**Fix:** `workspace` 테이블에서 존재 여부를 먼저 확인해 404(또는 기존 400 계열과 동일한 포맷)로 응답한다.

```ts
const [ws] = await db.select({ id: workspace.id }).from(workspace).where(eq(workspace.id, wsId));
if (!ws) return Response.json({ error: "존재하지 않는 워크스페이스예요." }, { status: 404 });
```

### WR-03: 참여 신청 중복 체크가 SELECT-then-INSERT라 동시 더블클릭 시 PENDING 행이 중복 생성될 수 있다

**File:** `src/app/api/workspaces/[id]/join-requests/route.ts:33-47`

**Issue:** `existingMember`/`existingPending` 확인과 `createJoinRequest` 삽입 사이에 트랜잭션이 없다. 코드 주석("RESEARCH: app-level guard, not a DB constraint")에서 이미 인지된 트레이드오프이긴 하지만, 실제로 동시에 두 번 제출되면(더블클릭, 네트워크 재시도) 두 SELECT가 모두 "없음"을 보고 두 개의 PENDING 행이 만들어진다. 관리자가 하나를 승인하면(CR-01 수정 후에도) 나머지 하나는 영원히 대기 목록에 남고, `createJoinRequest`의 existingPending 체크가 그 잔여 행을 계속 붙잡아 재신청도 막는다.

**Fix:** `(workspace_id, user_id) WHERE status = 'PENDING'` 부분 유니크 인덱스를 스키마에 추가해 DB 레벨로 강제하고, 위반 시 409/400으로 매핑한다. (documents.ts의 TagLimitError 패턴처럼 unique violation → 커스텀 에러 클래스로 잡으면 기존 에러 매핑 관례와 일관됨.)

### WR-04: 초대 토큰 원문이 서버 콘솔 로그에 평문으로 남는다

**File:** `src/lib/mailer.ts:5-8`

**Issue:** `sendInvitationEmail`이 accept 링크(토큰 포함)를 `console.log`로 출력한다. 코드 주석과 07-CONTEXT.md가 이 phase 범위를 dev 콘솔 메일러로 명시적으로 좁혔다는 점은 확인했고 설계상 알려진 제약이지만, 이 상태 그대로 배포되면 서버 로그(수집기·모니터링 서비스 등)에 접근 가능한 누구나 미사용 초대 토큰으로 해당 계정 최초 로그인 없이도(로그인은 필요하지만 wrong-user 검사가 있으므로 실제로는 invitee 본인만 사용 가능) 토큰을 획득해 재전송 없이 사용할 수 있는 표면이 생긴다. 마일스톤 마감 시점에 "프로덕션 SMTP 전환"이 이 함수 교체만으로 끝나야 한다는 설계 의도가 실제로 지켜지는지(즉, 이 로그 라인이 프로덕션 빌드에도 그대로 남는지) 확인이 필요하다.

**Fix:** 이번 phase 스코프상 즉시 수정 대상은 아니지만, 마일스톤 종료 전에 "프로덕션 전환 전 필수 확인" 항목으로 changelog/backlog에 명시적으로 남겨 둘 것을 권한다.

## Info

### IN-01: `acceptInvitation`이 UPDATE 영향 행 수를 검증하지 않는다

**File:** `src/lib/invitations.ts:70-73`

**Issue:** 트랜잭션 내 `usedAt` 가드-업데이트가 실제로 몇 행을 갱신했는지 확인하지 않고 항상 `{status:"success"}`를 반환한다. 동일 사용자가 거의 동시에 두 번 accept를 호출하면 두 번째 호출의 UPDATE는 0행을 갱신하지만(첫 번째가 이미 usedAt을 세팅) 응답은 여전히 "success"다. 멤버십은 idempotent라 실질적 피해는 없지만, 의미상으로는 "already-used"에 더 가깝다.

**Fix:** 필요하다면 `.returning()`으로 갱신된 행 수를 확인해 0이면 "already-used"로 응답을 정정한다. 우선순위는 낮음(동작상 무해).

### IN-02: `PendingRequestRow.tsx`의 `formatRequestedAt` 중복은 이미 추적 중

**File:** `src/components/members/PendingRequestRow.tsx:31-40`

**Issue:** `TrashList.tsx`의 상대시간 포맷 로직을 그대로 복제했다. 코드에 `ponytail:` 주석으로 "세 번째 호출처가 생기면 추출"이라고 명시돼 있어 의도된 단계이며 별도 조치는 불필요하다. 리뷰 완결성을 위해 기록만 남긴다.

---

_Reviewed: 2026-08-09T04:16:30Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
