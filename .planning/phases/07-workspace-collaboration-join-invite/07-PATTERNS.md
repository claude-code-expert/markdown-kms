# Phase 7: Workspace Collaboration (Join & Invite) - Pattern Map

**Mapped:** 2026-08-09
**Files analyzed:** 17 new/modified
**Analogs found:** 17 / 17

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/db/schema.ts` (+`invitation`, +`workspaceJoinRequest`) | model | CRUD | `src/db/schema.ts` (`document`, `workspaceMember` 테이블) | exact |
| `src/lib/invitation-token.ts` | utility | transform | `components/editor/plugins/*.ts`(순수 함수 관례) + `src/lib/storage.ts`(sniffImageType, 순수 바이트 판정) | role-match |
| `src/lib/mailer.ts` | service | request-response | `src/lib/storage.ts` | exact |
| `src/lib/invitations.ts` (createInvitation, acceptInvitation) | service | CRUD + transaction | `src/lib/documents.ts` (`autosaveDocument`, `replaceTags` — 가드-업데이트+트랜잭션) | exact |
| `src/lib/join-requests.ts` (createJoinRequest, decideJoinRequest) | service | CRUD + transaction | `src/lib/documents.ts` (`softDeleteDocument`/`restoreDocument`의 가드-업데이트) | exact |
| `src/lib/member-search.ts` (searchUsersForInvite) | service | CRUD | `src/lib/search.ts` (`searchWorkspace`) | exact |
| `src/lib/members.ts` (getWorkspaceMembers, getPendingJoinRequests) | service | CRUD | `src/lib/db-membership.ts` (`listMembershipsForUser`) | exact |
| `src/app/api/workspaces/[id]/invitations/route.ts` (POST) | route | request-response | `src/app/api/workspaces/[id]/search/route.ts` + `src/app/api/workspaces/route.ts`(트랜잭션 INSERT) | exact |
| `src/app/api/workspaces/[id]/join-requests/route.ts` (POST) | route | request-response | `src/app/api/workspaces/route.ts` (POST — `auth()`만, `requireRole` 아님) | exact |
| `src/app/api/workspaces/[id]/join-requests/[reqId]/route.ts` (PATCH) | route | request-response | `src/app/api/workspaces/[id]/route.ts` (DELETE — requireRole + zod uuid 파라미터 가드) | role-match |
| `src/app/api/workspaces/[id]/members/search/route.ts` (GET) | route | request-response | `src/app/api/workspaces/[id]/search/route.ts` | exact |
| `src/app/(auth)/invitations/accept/page.tsx` | route (RSC page) | request-response | `src/app/(main)/w/[wsId]/trash/page.tsx` (requireRole 후 lib 직접 호출·notFound) + `src/app/(auth)/login/page.tsx`(셸) | role-match |
| `src/app/(main)/w/[wsId]/members/page.tsx` | route (RSC page) | request-response | `src/app/(main)/w/[wsId]/trash/page.tsx` | exact |
| `src/app/(main)/dashboard/page.tsx` (+ join 섹션) | route (RSC page, 수정) | request-response | 자기 자신(기존 파일 확장) | exact |
| `src/components/members/MembersView.tsx` / `PendingRequestRow.tsx` / `MemberRow.tsx` / `InviteSearch.tsx` | component | event-driven | `src/components/trash/TrashList.tsx` (+`ConfirmDialog`, per-row 상태) | exact |
| `src/components/workspace/JoinWorkspaceInput.tsx`(대시보드 섹션) | component | event-driven | `src/components/workspace/CreateWorkspaceModal.tsx` (zod client-validate + fetch + 인라인 에러) | exact |
| `src/components/tree/FolderTree.tsx` (수정: membersLink 행 추가) | component | event-driven | 자기 자신의 기존 `trashLink` 블록(415-425행) | exact |

## Pattern Assignments

### `src/db/schema.ts` (신규 `invitation`, `workspaceJoinRequest` 테이블)

**Analog:** `document`/`workspaceMember` 테이블 정의 (`src/db/schema.ts:32-48, 97-120`)

핵심 관례: FK는 `.references(() => X.id, { onDelete: "cascade" })`, `role`류 enum 컬럼은 `text()` + `check(sql...)`, 가드-업데이트 대상 컬럼(`usedAt`, `status`)엔 별도 unique/partial index 없이 애플리케이션 레벨 `WHERE` 가드로 처리(TRD/RESEARCH가 이미 확정 — DDL에 partial unique index 추가하지 않음).

```typescript
// document.savedSeq(가드용 컬럼)와 동형 — nullable timestamp가 "미사용" 상태를 표현
savedSeq: bigint("saved_seq", { mode: "number" }).notNull().default(0),
// → invitation.usedAt: timestamp(..., { withTimezone: true })  // nullable, 가드는 `isNull(invitation.usedAt)`
```

`workspaceMember`의 role check 패턴을 `workspaceJoinRequest.status`(`'PENDING'|'APPROVED'|'REJECTED'`)에 그대로 적용:
```typescript
check("workspace_join_request_status_check", sql`${table.status} IN ('PENDING','APPROVED','REJECTED')`),
```

---

### `src/lib/invitation-token.ts` (순수 HMAC 헬퍼)

**Analog:** 07-RESEARCH.md의 Code Examples(HMAC 헬퍼) — 이미 정확한 구현이 리서치 문서에 리터럴로 제공되어 있음 (07-RESEARCH.md:237-286). 코드베이스 내 가장 가까운 정신적 analog는 `src/lib/storage.ts`의 `sniffImageType`(입출력만 있는 순수 함수, DB/세션 없음) 및 `components/editor/plugins/*`의 `run(state)` 순수 함수 관례.

**Imports 패턴:**
```typescript
import { createHmac, timingSafeEqual } from "node:crypto";
```

**핵심 패턴 (research 문서 그대로 복붙 대상):** `computeMac`/`encodeInvitationToken`/`parseInvitationToken`/`verifyMac` — DB·세션 의존성 0. `timingSafeEqual` 앞에 길이 비교 필수(길이 다르면 예외 throw).

**격리 원칙 (storage.ts 방식):** 이 파일은 `AUTH_SECRET`을 인자로만 받는다 — `process.env` 직접 참조는 호출부(`invitations.ts`, 라우트)에서만 한다(순수성 유지, storage.ts가 `UPLOAD_DIR`을 모듈 상수로 갖는 것과 달리 secret은 caller-injected — 테스트에서 임의 secret 문자열로 검증 가능해야 하므로).

---

### `src/lib/mailer.ts`

**Analog:** `src/lib/storage.ts` 전체(90줄)

```typescript
// storage.ts:1-3의 "저장 함수 하나 교체로 끝나도록 한 모듈에 가둔다" 원칙 그대로
// saveUpload가 유일한 export인 것처럼 sendInvitationEmail이 유일한 export.
export async function sendInvitationEmail(to: string, acceptLink: string): Promise<void> {
  console.log(`[mailer] invitation email → ${to}: ${acceptLink}`);
}
```
`storage.ts`가 `MAX_UPLOAD_BYTES`를 export해 라우트가 재사용하듯, `mailer.ts`는 추가 export 없이 함수 하나로 끝낸다(TTL_MS는 `invitations.ts`가 소유).

---

### `src/lib/invitations.ts` (createInvitation, acceptInvitation)

**Analog:** `src/lib/documents.ts` — `DbClient` 유니언 타입 선언(1-8행), `autosaveDocument`의 가드-업데이트(110-123행), `replaceTags`의 `client.transaction` + throw-to-rollback(172-204행)

**DbClient 주입 패턴 (그대로 복사):**
```typescript
type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];
```

**트랜잭션+가드-업데이트 패턴** — `replaceTags`의 "트랜잭션 내부에서 advisory lock/재확인" 구조를 `acceptInvitation`에 적용(07-RESEARCH.md:504-515 코드 그대로):
```typescript
await client.transaction(async (tx) => {
  await tx.insert(workspaceMember)
    .values({ workspaceId: row.workspaceId, userId: currentUserId, role: "EDITOR" })
    .onConflictDoNothing(); // documents.ts:132-135 upsertDraft의 onConflictDoUpdate 자매 API
  await tx.update(invitation)
    .set({ usedAt: new Date() })
    .where(and(eq(invitation.id, row.id), isNull(invitation.usedAt))); // TOCTOU 가드
});
```

**5-상태 판정 함수 시그니처** — `isDraftNewer`(documents.ts:152-158, 순수·DB 없음)와 동일하게 상태 판정 로직은 유니언 리턴 타입으로 표현:
```typescript
export type AcceptResult =
  | { status: "success"; workspaceId: string; workspaceName: string }
  | { status: "expired" } | { status: "already-used" }
  | { status: "invalid-signature" } | { status: "wrong-user" };
```

---

### `src/lib/join-requests.ts` (createJoinRequest, decideJoinRequest)

**Analog:** `src/lib/documents.ts`의 `softDeleteDocument`(60-65행, "AND 조건이 있어 재호출이 no-op") + `replaceTags`의 트랜잭션 패턴

**가드-업데이트 (07-RESEARCH.md:297-305 그대로):**
```typescript
const decided = await tx.update(workspaceJoinRequest)
  .set({ status: decision, decidedBy: adminUserId, decidedAt: new Date() })
  .where(and(eq(workspaceJoinRequest.id, reqId), eq(workspaceJoinRequest.status, "PENDING")))
  .returning({ userId: workspaceJoinRequest.userId, workspaceId: workspaceJoinRequest.workspaceId });
if (decided.length === 0) throw new AlreadyDecidedError(); // documents.ts의 TagLimitError와 동형 커스텀 에러 클래스
```
`decision === "APPROVED"`이면 같은 트랜잭션 안에서 `workspaceMember` INSERT `.onConflictDoNothing()` — `acceptInvitation`과 동일 관용구.

`createJoinRequest`는 중복/이미-멤버 사전 체크 후 단순 INSERT(트랜잭션 불필요, `workspaces/route.ts` POST의 `db.insert` 스타일).

---

### `src/lib/member-search.ts` (searchUsersForInvite)

**Analog:** `src/lib/search.ts` 전체 — ILIKE 이스케이프·`sql` 템플릿·`ESCAPE '\\'` 패턴 그대로 재사용(Don't Hand-Roll 표, 07-RESEARCH.md:334)

```typescript
// search.ts:43-44 그대로 복사
const escaped = q.replace(/[\\%_]/g, "\\$&");
const pattern = `%${escaped}%`;
// search.ts:46-61의 sql 템플릿 구조를 user.email/user.name ILIKE + EXISTS(workspace_member) 조인으로 변형
```
`SearchResult`/`SearchRow` 타입 선언 관례(search.ts:15-27)를 `MemberSearchResult`(email/name/isMember)로 그대로 미러링.

---

### `src/lib/members.ts` (getWorkspaceMembers, getPendingJoinRequests)

**Analog:** `src/lib/db-membership.ts`(`listMembershipsForUser`, 21줄 전체) — innerJoin + `is_deleted=false` 필터 관례

```typescript
// db-membership.ts:11-19 구조 그대로, 대상만 workspace_member+user 조인으로 반전
export async function getWorkspaceMembers(workspaceId: string, client: DbClient = db) {
  return client.select({ userId: user.id, name: user.name, email: user.email, role: workspaceMember.role })
    .from(workspaceMember).innerJoin(user, eq(workspaceMember.userId, user.id))
    .where(eq(workspaceMember.workspaceId, workspaceId));
}
```
`getPendingJoinRequests`는 동일 조인 형태를 `workspaceJoinRequest`(+`eq(status, "PENDING")`) 대상으로 반복.

---

### `src/app/api/workspaces/[id]/invitations/route.ts` (POST)

**Analog:** 07-RESEARCH.md Code Examples의 완성 코드(391-451행) — `requireRole(ADMIN)` → zod parse → invitee 존재/기존멤버 체크 → INSERT → 토큰 인코드 → 메일 발송 → 201. 구조는 `src/app/api/workspaces/route.ts`(POST — 트랜잭션 INSERT + 201)와 `src/app/api/workspaces/[id]/search/route.ts`(zod uuid 파라미터 가드 + requireRole)의 결합.

**Imports 패턴 (route.ts류 공통):**
```typescript
import { z } from "zod";
import { ForbiddenError, forbiddenResponse, requireRole } from "@/lib/rbac";
```

**Auth 패턴 (search/route.ts:12-23 / route.ts DELETE:13-28):**
```typescript
if (!z.uuid().safeParse(wsId).success) return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
try { await requireRole(wsId, "ADMIN"); }
catch (err) { if (err instanceof ForbiddenError) return forbiddenResponse(); throw err; }
```

**에러 핸들링 패턴 (workspaces/route.ts:19-24 — malformed JSON 가드):**
```typescript
let body: unknown;
try { body = await req.json(); } catch { return Response.json({ error: "잘못된 요청입니다." }, { status: 400 }); }
```

---

### `src/app/api/workspaces/[id]/join-requests/route.ts` (POST)

**Analog:** `src/app/api/workspaces/route.ts`(POST) — **`requireRole` 아님**, `auth()` 세션 존재만 확인(신청자는 아직 멤버가 아니므로 `requireRole`은 항상 403). Anti-pattern 경고(07-RESEARCH.md:325) 그대로 준수.

```typescript
const session = await auth();
if (!session?.user?.id) return forbiddenResponse();
// 이미 멤버? SELECT workspace_member → 400. 이미 PENDING? SELECT workspace_join_request WHERE status='PENDING' → 400.
```

---

### `src/app/api/workspaces/[id]/join-requests/[reqId]/route.ts` (PATCH)

**Analog:** `src/app/api/workspaces/[id]/route.ts`(DELETE) — `requireRole(wsId, "ADMIN")` + 이중 uuid 파라미터(`wsId`, `reqId`) 검증 + `AlreadyDecidedError` → 409 매핑(TagLimitError → 400 매핑 관례와 동형, `06-PATTERNS`식 커스텀 에러 catch).

---

### `src/app/api/workspaces/[id]/members/search/route.ts` (GET)

**Analog:** `src/app/api/workspaces/[id]/search/route.ts` 전체(29줄) — `requireRole(wsId, "ADMIN")`으로 minRole만 바뀌고 나머지(zod uuid 가드, `q` 파라미터 trim, 빈 쿼리→빈 배열) 100% 동일 구조.

---

### `src/app/(auth)/invitations/accept/page.tsx`

**Analog:** `src/app/(main)/w/[wsId]/trash/page.tsx`(requireRole 후 lib 함수 직접 호출, 에러를 `notFound()`/status로 매핑) + `src/app/(auth)/login/page.tsx`(카드 셸, UI-SPEC이 명시).

```typescript
// trash/page.tsx의 "requireRole 후 lib 직접 호출" 골격을 세션체크+acceptInvitation()으로 대체
const session = await auth();
if (!session?.user?.id) redirect(`/login?callbackUrl=${encodeURIComponent(`/invitations/accept?token=${token}`)}`);
const result = await acceptInvitation(token, session.user.id); // GET 라우트 파일 없음 (Pitfall 6)
```
5개 상태 → 5개 렌더 분기는 `d/[docId]/page.tsx`가 `lib/documents.getDocument` 직접 호출하는 "RSC가 lib를 직접 부른다" 원칙의 반복(별도 API 라우트 없음).

---

### `src/app/(main)/w/[wsId]/members/page.tsx`

**Analog:** `src/app/(main)/w/[wsId]/trash/page.tsx` 전체(34줄) — `requireRole(wsId, "VIEWER")` 호출로 role을 얻고, `ROLE_RANK[role] >= ROLE_RANK.ADMIN`으로 `canManage` boolean만 클라이언트 컴포넌트에 넘긴다(TrashList의 `canRestore`/`canPermanentDelete` boolean-전달 관례와 완전 동형, RBAC 모듈이 클라이언트 번들에 섞이지 않도록).

```typescript
let role;
try { ({ role } = await requireRole(wsId, "VIEWER")); }
catch (err) { if (err instanceof ForbiddenError) notFound(); throw err; }
const canManage = ROLE_RANK[role] >= ROLE_RANK.ADMIN;
const members = await getWorkspaceMembers(wsId);
const pending = canManage ? await getPendingJoinRequests(wsId) : [];
return <MembersView members={members} pending={pending} canManage={canManage} wsId={wsId} />;
```

---

### `src/app/(main)/dashboard/page.tsx` (join 섹션 추가)

**Analog:** 자기 자신 — 기존 `.grid` 아래 `JoinWorkspaceInput` 컴포넌트 삽입만, RSC 데이터 로딩 로직(`listMembershipsForUser`) 변경 없음.

---

### `src/components/members/*.tsx` (MembersView, PendingRequestRow, MemberRow, InviteSearch)

**Analog:** `src/components/trash/TrashList.tsx`(+`ConfirmDialog`, `Button`)

**Mutation 패턴 (TrashList.tsx:67-93 그대로):**
```typescript
"use client";
const router = useRouter();
async function handleDecide(reqId: string, decision: "APPROVED" | "REJECTED") {
  setSubmitting(reqId); setError(null);
  const res = await fetch(`/api/workspaces/${wsId}/join-requests/${reqId}`, {
    method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision }),
  });
  setSubmitting(null);
  if (!res.ok) { setError("승인하지 못했어요. 다시 시도해 주세요."); return; }
  router.refresh(); // TrashList와 동일 — 토스트 없음, per-row 상태만
}
```

**ConfirmDialog 재사용 (TrashList.tsx:137-153, ConfirmDialog.tsx 전체):** 승인=`destructive={false}`, 거절=`destructive={true}` — 신규 variant 발명 없이 기존 binary prop 그대로(UI-SPEC 명시).

**Per-row 상태 (TrashList.tsx의 `restoringId`/`restoreError` 패턴):** `InviteSearch`의 "보내는 중…" per-row 버튼 전환은 `restoringId === item.id ? "복원하는 중…" : "복원"` 패턴을 `sendingId`로 그대로 복제.

**검색 디바운스/레이스 가드 (InviteSearch):** `src/components/tree/SearchBox.tsx`의 `useSearchResults`(38-89행) — `seqRef` 비교로 늦은 응답 무시, 300ms debounce, `idle/loading/results/no-results/error` 상태 머신을 그대로 재사용(대상 엔드포인트만 `/api/workspaces/${wsId}/members/search`로 교체).

**Members 페이지 조립:** `MembersView`는 3섹션(승인 대기 → 멤버 목록 → 회원 초대)을 `canManage` 조건부로 렌더 — ADMIN 아니면 승인 대기/회원초대 섹션 자체를 렌더하지 않음(UI-SPEC 명시, TrashList의 "버튼 disabled+hint" 방식과 다름에 주의).

---

### `src/components/workspace/JoinWorkspaceInput.tsx`

**Analog:** `src/components/workspace/CreateWorkspaceModal.tsx`(89줄 전체) — zod client-validate(단, 이 케이스는 `z.uuid()` 단일 필드) + fetch + 인라인 에러 상태 머신을 그대로 재사용하되 Modal이 아닌 인라인 입력행(UI-SPEC "입력 행" 명시)으로 감싼다.

```typescript
// CreateWorkspaceModal.tsx:34-67의 handleSubmit 골격 재사용
const [wsIdInput, setWsIdInput] = useState("");
const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
const [submitting, setSubmitting] = useState(false);
async function handleSubmit(event: FormEvent) {
  event.preventDefault();
  setSubmitting(true);
  const res = await fetch(`/api/workspaces/${wsIdInput}/join-requests`, { method: "POST" });
  setSubmitting(false);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    setFeedback({ type: "error", message: body?.error ?? "이미 멤버이거나 이미 신청한 워크스페이스예요." });
    return;
  }
  setWsIdInput("");
  setFeedback({ type: "success", message: "참여 신청을 보냈어요. 관리자 승인을 기다려 주세요." });
}
```
UI-SPEC 규칙(다음 keystroke에 문구 사라짐, 타이머 없음)은 `onChange`에서 `setFeedback(null)` 한 줄로 구현(`TagBar`의 중복-에러 관례와 동일, 07-UI-SPEC.md:183).

---

### `src/components/tree/FolderTree.tsx` (수정: membersLink 추가)

**Analog:** 자기 자신의 기존 `trashLink` 블록(415-425행)

```typescript
// FolderTree.tsx:418-425 바로 아래, ThemeToggle 위에 동일 구조로 삽입
<Link
  href={`/w/${workspaceId}/members`}
  className={[styles.membersLink, pathname === `/w/${workspaceId}/members` ? styles.membersLinkActive : ""]
    .filter(Boolean).join(" ")}
>
  <Users size={16} />
  <span>멤버</span>
</Link>
```
CSS Module 클래스(`membersLink`/`membersLinkActive`)는 `trashLink`/`trashLinkActive`의 선언을 그대로 복제(hover `--surface-2`, active `--accent-weak` 배경 + `--accent` 텍스트) — 신규 스타일 값 없음(UI-SPEC 명시).

## Shared Patterns

### 서버 전용 RBAC 게이트
**Source:** `src/lib/rbac.ts` (`requireRole`, `ROLE_RANK`, `ForbiddenError`, `forbiddenResponse`)
**Apply to:** `invitations/route.ts`(POST), `join-requests/[reqId]/route.ts`(PATCH), `members/search/route.ts`(GET) — 전부 `try { await requireRole(wsId, "ADMIN"...) } catch (err) { if (err instanceof ForbiddenError) return forbiddenResponse(); throw err; }`. `join-requests/route.ts`(POST)만 예외 — `auth()` 세션 체크만(신청자는 비멤버).
```typescript
// src/lib/rbac.ts:33-58 requireRole 전체 그대로 재사용, 신규 role 값 추가 없음(ROLE_RANK 불변)
```

### zod 파라미터/바디 검증
**Source:** `src/lib/validation.ts` (스키마 선언 관례) + 각 route.ts의 `z.uuid().safeParse(id)` 가드
**Apply to:** 모든 신규 라우트의 wsId/reqId 파라미터, `invitations` POST의 `{ inviteeId: z.uuid() }`, `join-requests/[reqId]` PATCH의 `{ decision: z.enum(["APPROVED","REJECTED"]) }`
```typescript
// workspaces/[id]/route.ts:19 WR-05 패턴 그대로
if (!z.uuid().safeParse(id).success) return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
```

### 가드-업데이트 낙관적 잠금
**Source:** `src/lib/documents.ts`(`autosaveDocument` 110-123행, `softDeleteDocument` 60-65행)
**Apply to:** `invitations.ts`의 `usedAt IS NULL` 가드, `join-requests.ts`의 `status='PENDING'` 가드 — 둘 다 `WHERE <조건>`을 트랜잭션 내부의 실제 UPDATE 문에 걸어 TOCTOU를 막는다(사전 SELECT로 판단하지 않음).

### DbClient 주입 + 트랜잭션
**Source:** `src/lib/documents.ts:1-8` (`type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]`), `src/lib/closure.ts`
**Apply to:** `invitations.ts`, `join-requests.ts`, `members.ts`, `member-search.ts` — 모든 신규 lib 함수는 `client: DbClient = db` 마지막 인자를 받아 테스트에서 트랜잭션 롤백 격리가 가능하게 한다.

### ILIKE 검색 이스케이프
**Source:** `src/lib/search.ts:43-44` (`.replace(/[\\%_]/g, "\\$&")` + `ESCAPE '\\'`)
**Apply to:** `member-search.ts`의 `searchUsersForInvite` — search.ts 함수 시그니처·`sql` 템플릿 구조를 그대로 복제, 대상 컬럼만 `user.email`/`user.name`으로 교체.

### 모듈 격리("교체 하나로 끝나는" 패턴)
**Source:** `src/lib/storage.ts` 전체
**Apply to:** `src/lib/mailer.ts` — `sendInvitationEmail`이 유일한 export, 프로덕션 SMTP 전환 시 이 함수 본문만 교체.

### ConfirmDialog + per-row 클라이언트 mutation
**Source:** `src/components/trash/TrashList.tsx` (+ `src/components/ui/ConfirmDialog.tsx`, `src/components/ui/Button.tsx`)
**Apply to:** `PendingRequestRow`(승인/거절), `InviteSearch`(초대 발송의 sending/success/fail per-row 상태) — `fetch → 실패시 인라인 에러 → 성공시 router.refresh()`, 옵티미스틱 UI 없음, 토스트 없음(Phase 4 "저장 완료 무강조" 원칙 계승).

### RSC가 lib 함수 직접 호출(GET API 라우트 없음)
**Source:** `src/app/(main)/w/[wsId]/trash/page.tsx`, `src/app/api/documents/[id]/route.ts`의 코드 주석(RESEARCH 인용)
**Apply to:** `members/page.tsx`(getWorkspaceMembers/getPendingJoinRequests 직접 await), `invitations/accept/page.tsx`(acceptInvitation 직접 await) — `/api/invitations/accept` 라우트 파일을 만들지 않는다(Pitfall 6).

## No Analog Found

없음 — 17개 신규/수정 파일 전부 강한 analog를 찾음. 유일하게 코드베이스 내 직접 선례가 없는 조각은 HMAC 토큰 encode/verify(`invitation-token.ts`)이나, TRD §9가 알고리즘을 리터럴로 고정하고 07-RESEARCH.md가 이미 실행 가능한 구현을 제공하므로 "analog 없음"이 아니라 "research 문서 자체가 analog" 상태.

## Metadata

**Analog search scope:** `src/db/`, `src/lib/`, `src/app/api/workspaces/`, `src/app/(main)/`, `src/app/(auth)/`, `src/components/{trash,ui,tree,workspace}/`
**Files scanned:** 17 (schema.ts, documents.ts, closure.ts 미참조, storage.ts, search.ts, rbac.ts, validation.ts, auth.ts, workspaces/route.ts×3, dashboard/page.tsx, trash/page.tsx, TrashList.tsx, ConfirmDialog.tsx, SearchBox.tsx, db-membership.ts, CreateWorkspaceModal.tsx)
**Pattern extraction date:** 2026-08-09
