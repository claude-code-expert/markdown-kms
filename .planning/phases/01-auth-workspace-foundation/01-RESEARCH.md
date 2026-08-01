# Phase 1: Auth & Workspace Foundation - Research

**Researched:** 2026-08-01
**Domain:** Credentials auth (Auth.js v5), server-side RBAC, Postgres/Drizzle schema, Next.js 15 App Router greenfield scaffolding
**Confidence:** MEDIUM — stack choices are TRD-locked (HIGH certainty on *what* to use), but Auth.js v5 is still in beta and most implementation detail below comes from cross-checked WebSearch (no Context7 MCP tool was available this session — see Sources), so exact API shapes are MEDIUM confidence and should be spot-checked against `node_modules/next-auth` types during Wave 0.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**가입 폼·비밀번호 정책**
- **D-01:** 비밀번호 규칙 = 8자 이상, 문자종류 복잡도 강제 없음 (NIST 800-63B — 길이 우선). 클라이언트·서버 양쪽 검증. — Reversibility: reversible
- **D-02:** 이메일 인증(확인 메일)은 v1 제외 — 가입 즉시 로그인한다. 근거: AUTH-01 인수조건 "즉시 로그인"과 정합, 메일 인프라(nodemailer)는 TRD §9상 R2 초대에서 처음 도입되어 Phase 1엔 없음. — Reversibility: reversible
- **D-03:** 가입 폼 필드 = 이메일·비밀번호·이름 3필드. `user.name`이 NOT NULL(TRD §3)이고 멤버 표시에 쓰이므로 직접 입력받는다. — Reversibility: reversible
- **D-04:** 비밀번호 해싱은 bcrypt (TRD §1 확정). — 스택 잠금, 논의 대상 아님.

**로그인 세션**
- **D-05:** 세션 유지 기간(maxAge) = 24시간, 슬라이딩 갱신(활동 시 연장, Auth.js 기본 동작 채택). AUTH-02 "새로고침 후 유지"는 자연 충족. — Reversibility: reversible
- **D-06:** "로그인 상태 유지"는 항상 유지 방식 — remember-me 체크박스 없음. 로그인하면 무조건 maxAge만큼 유지. — Reversibility: reversible
- **D-07:** 세션 전략은 JWT (Auth.js v5 credentials provider는 DB 세션 불가 — 스택 제약, 논의 대상 아님).

**기본 워크스페이스 모델·착지 화면**
- **D-08:** 기본 워크스페이스 = **단일 공용 워크스페이스**. 시스템이 1행 시드(`is_default = true`), 모든 가입자가 이 하나의 워크스페이스에 EDITOR로 자동 합류한다. 사용자별 개인 기본 워크스페이스 아님. — Reversibility: costly — 되돌리면 시드 로직·가입 시 멤버십 생성·AUTH-03 테스트가 전부 바뀐다. 프로덕션 시드 후엔 데이터 마이그레이션 필요.
- **D-09:** 기본 워크스페이스는 OWNER/ADMIN 없이 전원 EDITOR로 둔다. 시드 생성이라 생성자(OWNER)가 없고, "삭제 불가 + Phase 1에 설정 변경 없음"이라 OWNER 전용 액션이 발생하지 않아 매트릭스 위반이 아니다. — Reversibility: reversible
- **D-10:** 기본 워크스페이스 표시 이름 = "기본 워크스페이스". — Reversibility: reversible
- **D-11:** 로그인 직후 착지 화면 = 소속 워크스페이스 **카드 대시보드**(사이드바 없이 카드 목록). 상시 폴더 사이드바는 Phase 4의 3분할에서 등장. — Reversibility: reversible — Phase 4 3분할 진입 시 이 대시보드는 교체/재배치될 수 있다.
- **D-12:** AUTH-03 인수조건의 "사이드바에 표시된다"는 Phase 1에서 **카드 대시보드에 기본 워크스페이스가 보이는 것**으로 충족한 것으로 본다. planner·verifier는 문자 그대로의 "사이드바 컴포넌트" 부재를 실패로 처리하지 말 것. 상시 사이드바 = Phase 4.

**워크스페이스 생성·전환·삭제 UX**
- **D-13:** 워크스페이스 생성 = 모달 다이얼로그(이름 필드 1개). ui-kit 모달 컴포넌트 이식. — Reversibility: reversible
- **D-14:** 생성 직후 = 즉시 `/w/[newId]`로 진입해 새 워크스페이스를 활성화(Phase 1엔 빈 플레이스홀더 화면). "활성 워크스페이스"는 URL 파라미터(`w/[wsId]`, TRD §11)로 표현. — Reversibility: reversible
- **D-15:** 워크스페이스 삭제(OWNER 전용) = 이름 재입력 확인(GitHub 방식). cascade 비가역 액션이라 강한 확인 채택. — Reversibility: reversible

### Claude's Discretion
- 로그인 브루트포스 rate-limit / 계정 잠금 정책: 논의에서 확정하지 않음 — researcher/planner가 Auth.js 관례와 위험도에 맞춰 결정. **This research resolves it — see Open Question O1.**
- 세션 슬라이딩 갱신 주기(updateAge)는 Auth.js 기본값 채택. **This research resolves the default value — see Standard Stack / Pitfall 2.**

### Deferred Ideas (OUT OF SCOPE)
- **가입 신청·초대 메일 흐름** — Phase 7 (WS-03~05). Phase 1의 워크스페이스는 생성/삭제/자동가입까지만.
- **Google OAuth** — Phase 8 (AUTH-04). Auth.js credentials 구조가 provider 추가만으로 확장되는지가 그때의 인수 기준.
- **로그아웃·비밀번호 재설정 UX** — 논의에서 다루지 않음. 필요 시 Phase 1 plan 단계 또는 후속에서 별도 검토(현재 요구사항 ID 없음). **This research adds a minimal logout recommendation since Auth.js ships `signOut()` for free — see Code Examples.**
- **상시 폴더 사이드바** — Phase 4 3분할 화면에서 등장.

None deferred outside these.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | 사용자는 이메일+비밀번호로 가입하고 즉시 로그인된다 | Auth.js Credentials provider + bcrypt hash-on-signup + atomic signup transaction that also creates the JWT session (see Code Examples: signup route, auth.ts) |
| AUTH-02 | 로그인 세션이 브라우저 새로고침 후에도 유지된다 | JWT strategy with `maxAge: 24h`, Auth.js's rolling-cookie default satisfies "survives refresh" without extra code (see Standard Stack, Pitfall 2) |
| AUTH-03 | 가입 완료 시 기본 워크스페이스에 EDITOR로 자동 소속되고 사이드바에 표시된다 (D-12: 카드 대시보드로 충족) | Idempotent default-workspace seed + atomic membership insert inside the signup transaction (see Code Examples, Pitfall 5) |
| WS-01 | Owner/Admin/Editor/Viewer 권한 매트릭스대로 서버가 검증하고 위반 시 403을 반환한다 | `requireRole(workspaceId, minRole)` pattern (see Architecture Patterns, Code Examples) |
| WS-02 | 회원은 워크스페이스를 생성할 수 있고 생성자가 OWNER가 된다. 삭제는 OWNER만 가능하다 | POST/DELETE `/api/workspaces` route design gated by `requireRole` (see Code Examples) |
</phase_requirements>

## Summary

Phase 1 is a greenfield auth+RBAC foundation with a small, fully TRD-locked stack: Next.js 15 App Router, Auth.js v5 (`next-auth@beta`) Credentials provider with JWT sessions, bcrypt hashing, and Drizzle ORM over PostgreSQL 16. Nothing here is architecturally novel — the risk is entirely in wiring detail: Auth.js v5's `authorize()` → `jwt()` → `session()` callback chain, the JWT-only constraint that Credentials providers impose, the Node-runtime requirement for bcrypt (it cannot run in Auth.js's Edge-compatible middleware), and making the signup + default-workspace-membership write atomic and idempotent against a single seeded row.

The three Phase 1 tables (`user`, `workspace`, `workspace_member`) are a direct 1:1 port of TRD §3 DDL into `src/db/schema.ts` via Drizzle's `pgTable` + `primaryKey()` + `check()` helpers — no ORM feature here is exotic. `requireRole(workspaceId, minRole)` is the single server-side gate every subsequent phase's mutating API will reuse, so its shape (role-ordering array, session lookup, `workspace_member` query, throw-or-403 contract) deserves to be gotten right once, here.

Two gaps needed resolving beyond CONTEXT.md: a workspace-name length cap (the UI-SPEC already flags this unresolved — this research recommends `varchar(100)` + matching zod schema) and a login rate-limit policy (CONTEXT.md left it to researcher's discretion — this research recommends a minimal DB-backed per-email+IP counter, not a new Redis dependency, since Redis/Upstash is not in the TRD-locked stack and would be scope creep for a single-region Phase 1 app).

**Primary recommendation:** Scaffold with `pnpm create next-app@latest . --typescript --no-tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm`, then add `next-auth@5.0.0-beta.32` (JWT/Credentials only, no adapter needed), `bcrypt@6.0.0`, `drizzle-orm@0.45.2` + `drizzle-kit@0.31.10` + `postgres@3.4.9`, and `zod@4.4.3`. Build `lib/rbac.ts` and the signup transaction first (TDD, per TRD §10), before any UI.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Signup (validate, hash, create user) | API / Backend (`POST /api/auth/signup`) | Database (`user` insert) | Password hashing and uniqueness checks must never trust the client; TRD §8 assigns this route no role requirement (public) |
| Default-workspace auto-join | API / Backend (same signup transaction) | Database (`workspace_member` insert) | AUTH-03 requires this to be atomic with user creation, not a follow-up client call |
| Login / credential verification | API / Backend (Auth.js `authorize()` callback, Node runtime) | — | bcrypt compare cannot run in Edge middleware; must execute in the Node-runtime route Auth.js's handler mounts on |
| Session issuance & persistence | API / Backend (Auth.js `jwt()`/`session()` callbacks) | Browser / Client (encrypted cookie storage) | JWT session strategy is stateless server-side (D-07); the browser is what makes AUTH-02 ("survives refresh") work, by resending the cookie |
| RBAC enforcement (403) | API / Backend (`lib/rbac.ts requireRole`) | — | NFR-3.2 + CLAUDE.md invariant: "UI 버튼 숨김은 보안이 아니다" — every mutating route re-checks server-side regardless of what the UI shows |
| Workspace create / delete | API / Backend (`POST`/`DELETE /api/workspaces`) | Database (`workspace`, `workspace_member` rows) | Role check (member / OWNER) happens before the write, not after |
| Card dashboard landing screen | Frontend Server (RSC `app/(main)/dashboard` — data fetched server-side per D-11) | Browser / Client (card grid render, modal interactivity) | Next.js App Router convention: initial list is server-fetched (also unlocks `loading.tsx`/`error.tsx` boundaries mandated by UI-SPEC) |
| Design tokens / CSS Modules | Browser / Client | — | Pure CSS, no server involvement; ui-kit tokens ported 1:1 |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 15.5.22 | App Router framework, Route Handlers | TRD §1 locked; `npm view next@15 version` confirms 15.5.22 is the newest 15.x patch (registry `latest` dist-tag has already moved to Next 16 — do not let the scaffold pull 16.x) [VERIFIED: npm registry] |
| react / react-dom | 19.2.8 | UI runtime | Next 15.5.x peerDependencies accept `^18.2.0 \|\| ^19.0.0`; 19.2.8 is current registry latest for both packages [VERIFIED: npm registry] |
| typescript | whatever `create-next-app@latest` pins (do not hardcode — scaffold skill principle 2) | Type checking | `npm view typescript version` currently resolves to `7.0.2` on the registry, a native-compiler major version; let the scaffolder choose its own bundled range rather than pinning a number here [ASSUMED — TS7's compatibility with the rest of this stack has not been individually verified this session] |
| next-auth | 5.0.0-beta.32 (`@beta` dist-tag) | Auth.js v5, Credentials provider | TRD §1 locked ("Auth.js v5 (NextAuth)"); `npm view next-auth dist-tags` confirms `beta: 5.0.0-beta.32` is the current v5 release line — `latest` tag is still v4 [VERIFIED: npm registry] |
| bcrypt | 6.0.0 | Password hashing | TRD §1 locked (D-04, "논의 대상 아님"); native module, must run in Node.js runtime not Edge (see Pitfall 1) [VERIFIED: npm registry] |
| drizzle-orm | 0.45.2 | ORM / query builder | TRD §1 locked | [VERIFIED: npm registry] |
| drizzle-kit | 0.31.10 | Migration generator/runner (dev dependency) | TRD §1 locked, companion CLI to drizzle-orm | [VERIFIED: npm registry] |
| postgres | 3.4.9 | Postgres driver (postgres.js) | TRD names "PostgreSQL 16 + Drizzle ORM" but does not pin a driver; `postgres` (postgres.js) is Drizzle's own get-started default for a plain Node/Next.js server (as opposed to `pg`, which needs `@types/pg`) — since bcrypt already forces this app onto the Node runtime, either driver works, but `postgres` needs fewer packages | [ASSUMED — driver choice not in TRD, this is this session's recommendation, not a locked decision] |
| zod | 4.4.3 | Server + client input validation | Not named in TRD §1's table row-by-row, but TRD's architecture diagram explicitly states "Route Handlers (/api/*): REST + zod 입력 검증" — zod is TRD-mandated for API validation | [VERIFIED: docs/TRD.md:34-36 — "Route Handlers (/api/*): REST + zod 입력 검증"] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | latest (let scaffold/`pnpm add` resolve) | Icons | TRD §1 + UI-SPEC locked, used on buttons/modal close icons this phase |
| vitest | 4.1.10 | Unit tests (RBAC matrix, signup transaction, seed idempotency) | TRD §1 + §10 locked; TDD tests must precede implementation this phase |
| @playwright/test | 1.62.1 | E2E (signup → login → refresh persistence → dashboard) | TRD §1 locked |
| @types/bcrypt | 6.0.0 | TS types for bcrypt | Install alongside bcrypt since bcrypt itself ships no types |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| bcrypt (native) | bcryptjs (pure JS) | bcryptjs still pulls in Node's `crypto` module (triggers Edge-runtime warnings) and is ~30% slower per hash — no actual Edge-compatibility win, so no reason to give up bcrypt's speed. TRD already locked bcrypt; this row exists only to show the alternative was considered and rejected. |
| postgres (postgres.js) driver | pg (node-postgres) | `pg` is arguably more battle-tested for very old Postgres feature edge cases, but adds `@types/pg` as a second package for the same job; postgres.js is Drizzle's documented get-started default. Either is a reversible choice — swapping the driver later touches only `db/index.ts`. |
| Minimal DB-backed rate limiter (this research's recommendation, see Open Question O1) | @upstash/ratelimit + Upstash Redis | Upstash is the community-standard answer for serverless rate limiting, but it is a new external managed-service dependency not present anywhere in TRD's stack table — disproportionate for a single-Postgres-instance Phase 1 app. Revisit if the app moves to genuinely serverless/multi-region deploy. |

**Installation:**
```bash
pnpm add next-auth@5.0.0-beta.32 bcrypt@6.0.0 drizzle-orm@0.45.2 postgres@3.4.9 zod@4.4.3 lucide-react
pnpm add -D drizzle-kit@0.31.10 @types/bcrypt@6.0.0 vitest @playwright/test
```

**Version verification:** All versions above were checked this session with `npm view <pkg> version` / `npm view <pkg> dist-tags --json` against the live npm registry (2026-08-01). Re-run these commands at execution time — `next-auth@beta` in particular moves fast (10 beta releases visible between beta.23 and beta.32 in recent history) and a newer beta may exist by the time Phase 1 executes.

## Package Legitimacy Audit

| Package | Registry | Age (latest publish) | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----------------------|-----------|--------------|---------|-------------|
| next | npm | published 2026-07-25 | 54.9M/wk | github.com/vercel/next.js | SUS (`too-new`) | Flagged — see note below |
| react | npm | published 2026-07-21 | 161.7M/wk | github.com/react/react | SUS (`too-new`) | Flagged — see note below |
| react-dom | npm | published 2026-07-21 | 138.6M/wk | github.com/react/react | SUS (`too-new`) | Flagged — see note below |
| typescript | npm | published 2026-07-08 | 254.7M/wk | github.com/microsoft/TypeScript | SUS (`too-new`) | Flagged — see note below |
| next-auth | npm | published 2026-07-20 | 5.65M/wk | github.com/nextauthjs/next-auth | SUS (`too-new`) | Flagged — see note below |
| @auth/drizzle-adapter | npm | published 2026-07-20 | 281.9K/wk | github.com/nextauthjs/next-auth | SUS (`too-new`) | **Not installed this phase** — see "Don't need" note below |
| bcrypt | npm | published 2025-05-11 | 5.21M/wk | github.com/kelektiv/node.bcrypt.js | OK | Approved |
| drizzle-orm | npm | published 2026-03-27 | 17.6M/wk | github.com/drizzle-team/drizzle-orm | OK | Approved |
| drizzle-kit | npm | published 2026-03-17 | 14.8M/wk | github.com/drizzle-team/drizzle-orm | OK | Approved |
| postgres | npm | published 2026-04-05 | 12.3M/wk | github.com/porsager/postgres | OK | Approved |
| zod | npm | published 2026-05-04 | 247.7M/wk | github.com/colinhacks/zod | OK | Approved |

**Note on the `too-new` SUS cluster (next, react, react-dom, typescript, next-auth):** the automated legitimacy gate's `too-new` signal fires on *most recent publish date* of the newest version, not package age — these are five of the most downloaded packages on npm (5M–254M weekly downloads each), all resolving to their canonical, officially-owned GitHub org (vercel, react, microsoft, nextauthjs). This is a textbook heuristic false positive for actively-maintained mega-packages that ship frequent patch releases, not a slopsquatting signal. Per protocol these are still formally `SUS` and the planner must add a `checkpoint:human-verify` step before install — treat that checkpoint as a fast rubber-stamp for this specific group, not a deep investigation.

**Packages removed due to `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** next, react, react-dom, typescript, next-auth (all five: high-confidence false positives per the note above — planner still adds the checkpoint per protocol).
**Don't need — not installed this phase:** `@auth/drizzle-adapter`. Auth.js only needs a database Adapter to *persist accounts/sessions itself* (typically for OAuth flows or database session strategy). Phase 1 uses Credentials + JWT sessions (D-07) and writes to the `user`/`workspace_member` tables directly via the app's own signup route + Drizzle — Auth.js never touches the database in this phase. Revisit when Phase 8 adds Google OAuth (AUTH-04); even then, JWT sessions can keep working without an adapter if OAuth account persistence is handled the same way as credentials, but that call belongs to Phase 8's own research.

## Architecture Patterns

### System Architecture Diagram

```
Browser
  │  1. POST /api/auth/signup { email, password, name }
  ▼
Route Handler (Node runtime)
  │  2. zod validate → bcrypt.hash(password) → BEGIN TRANSACTION
  │       INSERT user
  │       INSERT workspace_member (default workspace id, EDITOR)
  │     COMMIT
  ▼
Auth.js signIn("credentials", {...}) — called from the same signup flow
  │  3. authorize() re-verifies via bcrypt.compare → returns user
  │  4. jwt() callback persists { id, email, name } onto token
  │  5. session() callback copies token → session.user
  ▼
Browser
  │  6. Encrypted JWT cookie stored (Auth.js sets it on the signIn response)
  │  7. Redirect → GET /dashboard (RSC)
  ▼
Frontend Server (RSC)
  │  8. auth() reads session from cookie (no DB call — JWT strategy)
  │  9. SELECT workspace.* JOIN workspace_member WHERE user_id = session.user.id
  ▼
Card Dashboard (rendered to Browser)

─────────────────────────────────────────────────────────

Any later mutating request (e.g. DELETE /api/workspaces/:id)
Browser → Route Handler
             │  auth() → session.user.id
             │  requireRole(workspaceId, "OWNER")
             │     SELECT role FROM workspace_member WHERE workspace_id=:id AND user_id=:uid
             │     role < OWNER? → throw 403
             │     else → proceed to DELETE
             ▼
          Database
```

### Recommended Project Structure
```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── (main)/
│   │   ├── dashboard/            # D-11 card dashboard, loading.tsx + error.tsx per UI-SPEC
│   │   └── w/[wsId]/page.tsx     # D-14 placeholder screen for a freshly created workspace
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── auth/signup/route.ts
│       └── workspaces/
│           ├── route.ts          # POST (create)
│           └── [id]/route.ts     # DELETE
├── auth.ts                       # NextAuth({...}) config, root-level per v5 convention
├── db/
│   ├── schema.ts                 # 1:1 Drizzle port of TRD §3 (Phase 1 subset)
│   └── index.ts                  # drizzle(postgres(...)) instance
├── lib/
│   ├── rbac.ts                   # requireRole(workspaceId, minRole)
│   └── password.ts               # bcrypt hash/compare wrapper
├── components/
│   ├── auth/                     # login/signup form components
│   └── workspace/                # card grid, create modal, delete dialog
drizzle.config.ts
drizzle/                          # generated SQL migrations (drizzle-kit generate output)
tests/
├── rbac/                         # role x route matrix, 403 assertions
└── auth/                         # signup transaction, seed idempotency
```

### Pattern 1: `requireRole` server gate
**What:** A single function every mutating Route Handler calls first. Looks up the caller's role in `workspace_member` for the target workspace, throws (mapped to HTTP 403) if the role doesn't meet the route's minimum.
**When to use:** Every Route Handler under `/api/*` except `POST /api/auth/signup` (public, TRD §8 marks its minimum role as `-`).
**Example:**
```ts
// lib/rbac.ts
import { auth } from "@/auth";
import { db } from "@/db";
import { workspaceMember } from "@/db/schema";
import { and, eq } from "drizzle-orm";

const ROLE_RANK = { VIEWER: 0, EDITOR: 1, ADMIN: 2, OWNER: 3 } as const;
type Role = keyof typeof ROLE_RANK;

export class ForbiddenError extends Error {}

export async function requireRole(workspaceId: string, minRole: Role) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("no session");

  const [member] = await db
    .select({ role: workspaceMember.role })
    .from(workspaceMember)
    .where(
      and(
        eq(workspaceMember.workspaceId, workspaceId),
        eq(workspaceMember.userId, session.user.id),
      ),
    );

  if (!member || ROLE_RANK[member.role as Role] < ROLE_RANK[minRole]) {
    throw new ForbiddenError(`requires ${minRole}`);
  }
  return { userId: session.user.id, role: member.role as Role };
}
```
Route handlers catch `ForbiddenError` and return `NextResponse.json({ error: "..." }, { status: 403 })` — the exact 403 copy is UI-SPEC's "이 작업을 수행할 권한이 없습니다." for the client-visible cases.
`[ASSUMED — this exact function shape is this session's design, not lifted verbatim from a single source; the role-rank/throw/403 pattern itself is a standard, well-established RBAC idiom]`

### Pattern 2: Atomic signup + default-workspace join
**What:** One DB transaction creates the `user` row and the `workspace_member` row (role EDITOR, workspace = the seeded `is_default = true` row) together, so AUTH-01 and AUTH-03 can never diverge (e.g. user created but membership insert fails silently).
**When to use:** `POST /api/auth/signup` only.
**Example:**
```ts
// app/api/auth/signup/route.ts (Node runtime — bcrypt requires it)
export const runtime = "nodejs";

import bcrypt from "bcrypt";
import { db } from "@/db";
import { user, workspace, workspaceMember } from "@/db/schema";
import { signupSchema } from "@/lib/validation";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  const body = signupSchema.parse(await req.json()); // zod — throws 400 on failure

  const passwordHash = await bcrypt.hash(body.password, 10);

  const created = await db.transaction(async (tx) => {
    const [defaultWs] = await tx
      .select({ id: workspace.id })
      .from(workspace)
      .where(eq(workspace.isDefault, true));
    if (!defaultWs) throw new Error("default workspace not seeded");

    const [newUser] = await tx
      .insert(user)
      .values({ email: body.email, name: body.name, passwordHash })
      .returning({ id: user.id, email: user.email, name: user.name });

    await tx.insert(workspaceMember).values({
      workspaceId: defaultWs.id,
      userId: newUser.id,
      role: "EDITOR",
    });

    return newUser;
  });

  return Response.json(created);
}
```
`[ASSUMED — application code, not sourced from a doc]`. The bcrypt cost factor `10` is bcrypt's own documented default and industry-standard baseline for interactive login paths `[CITED: bcrypt npm README default rounds = 10]`.

### Pattern 3: Idempotent default-workspace seed
**What:** A seed step that is safe to run every deploy without ever producing two `is_default = true` rows.
**When to use:** Once, in a migration or a dedicated `db/seed.ts` run after `drizzle-kit migrate`.
**Example:**
```ts
// db/seed.ts
import { db } from "@/db";
import { workspace } from "@/db/schema";
import { eq } from "drizzle-orm";

async function seedDefaultWorkspace() {
  const [existing] = await db
    .select({ id: workspace.id })
    .from(workspace)
    .where(eq(workspace.isDefault, true));
  if (existing) return existing;

  const [created] = await db
    .insert(workspace)
    .values({ name: "기본 워크스페이스", isDefault: true })
    .returning({ id: workspace.id });
  return created;
}
```
`[ASSUMED — application code]`. Workspace name "기본 워크스페이스" is D-10, locked verbatim.

### Anti-Patterns to Avoid
- **Calling `bcrypt.compare`/`bcrypt.hash` from Auth.js middleware or any Edge-runtime file:** bcrypt is a native C++ addon; Edge runtime has no Node.js bindings. Keep all bcrypt calls inside Route Handlers/Server Actions that are implicitly or explicitly on the Node runtime (see Pitfall 1).
- **Trusting client-side role checks:** hiding a "Delete workspace" button for non-OWNERs is a UX nicety, never a substitute for the server's `requireRole` call — explicit CLAUDE.md invariant.
- **Reaching for `drizzle-kit push` for anything beyond local iteration:** it has no migration history and can silently drop columns; Phase 1 must use `generate` + `migrate` per TRD §10's TDD/reviewable-migration expectation.
- **Adding a DB session strategy "just in case":** Credentials providers in Auth.js v5 are JWT-only by design (D-07) — configuring `session.strategy: "database"` alongside a Credentials provider is a configuration error, not an option.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Password hashing | Custom salted-SHA loop | `bcrypt` | TRD-locked; bcrypt's adaptive cost factor is the standard defense against offline hash cracking — a hand-rolled hash is a security bug by construction |
| Session cookie signing/parsing, CSRF token, JWT encryption | Custom cookie + JWT library glue | Auth.js `jwt()`/`session()` callbacks, `auth()` helper | Auth.js already implements encrypted JWT cookies, CSRF protection on the built-in signin/signout POST endpoints, and secure cookie flags — reimplementing any of this is a security surface for no functional gain |
| Request body/query validation | Hand-written `if (!body.email) ...` chains | `zod` | TRD's architecture diagram mandates zod at the Route Handler boundary; schema-as-code also documents the contract instead of scattering ad hoc checks |
| SQL schema diffing / migration files | Hand-written `ALTER TABLE` scripts | `drizzle-kit generate` + `migrate` | Diffing `schema.ts` against the last migration snapshot is exactly what drizzle-kit exists to automate correctly, including composite PKs and CHECK constraints |
| Login brute-force defense | A bespoke IP-blocklist middleware | A small DB-backed counter reusing the already-provisioned Postgres (see Open Question O1) — not a new library | The *policy* (5 attempts / 10 min, keyed by email+IP) is simple enough to not need a dedicated dependency; but the storage and cleanup logic should still live in one small shared module, not duplicated per route |

**Key insight:** Every "don't hand-roll" item above already has its answer inside the TRD-locked stack (bcrypt, Auth.js, zod, drizzle-kit) except rate limiting, which TRD is silent on — resist the urge to add a new dependency (Upstash/Redis) for that one gap; see Open Question O1.

## Common Pitfalls

### Pitfall 1: bcrypt called from Edge runtime
**What goes wrong:** `authorize()` (or the signup route) throws a runtime error like "Module not found: Can't resolve 'bcrypt'" or a `crypto` module warning when Next.js tries to bundle it for Edge middleware.
**Why it happens:** Next.js's default middleware/proxy runtime is Edge, which has no Node.js native-module support; bcrypt is a native addon `[CITED: WebSearch synthesis of vercel/next.js discussion #77584 + Drizzle/Auth.js community troubleshooting threads]`.
**How to avoid:** Add `export const runtime = "nodejs"` to any Route Handler that calls bcrypt (signup route, and Auth.js's own `[...nextauth]` route if it isn't already Node by default), and never call bcrypt from `middleware.ts`. Auth.js's Edge-safe JWT verification (signature check only, no bcrypt) is what middleware should rely on for route protection instead.
**Warning signs:** Build succeeds locally with `next dev` but Edge-specific bundling errors appear only on `next build` or on deploy — a classic dev/prod skew for this exact issue `[CITED: WebSearch synthesis, vercel/next.js discussion #77584]`.

### Pitfall 2: Session doesn't actually survive refresh because maxAge/updateAge are misconfigured
**What goes wrong:** AUTH-02 fails intermittently — session appears to "log out" sooner than the intended 24h, or session never re-issues.
**Why it happens:** Auth.js JWT sessions use a *rolling* expiry: each time the session is read, the token is re-issued and the idle window is extended by `maxAge` `[CITED: WebSearch synthesis of authjs.dev/getting-started/migrating-to-v5]`. If `updateAge` is left at Auth.js's own default (24h) while `maxAge` is set to D-05's 24h, the two values collide (`updateAge >= maxAge` effectively disables sliding renewal — the session would expire at a fixed point instead of extending on activity, contradicting "슬라이딩 갱신" in D-05).
**How to avoid:** Explicitly set both in `auth.ts`: `session: { strategy: "jwt", maxAge: 60 * 60 * 24, updateAge: 60 * 60 } ` (e.g., re-issue at most once per hour of activity) — do not leave `updateAge` at whatever Auth.js's own default happens to be, since that default is tuned for a 30-day `maxAge`, not a 24h one.
**Warning signs:** A Playwright/E2E test that waits past `updateAge` but well under `maxAge` and expects the session to still be valid on the next request.

### Pitfall 3: Non-atomic signup breaks AUTH-03
**What goes wrong:** A user is created but never gets the default-workspace `EDITOR` membership (e.g., the app crashes or a validation error occurs between the two inserts), leaving an orphaned user who can log in but sees an empty dashboard.
**Why it happens:** Treating "create user" and "join default workspace" as two separate calls (e.g., one from the signup route, one triggered client-side after redirect) instead of one transaction.
**How to avoid:** Wrap both inserts in a single `db.transaction()` (see Code Examples, Pattern 2). This is also the "atomic transaction" already noted in `01-CONTEXT.md`'s Integration Points section.
**Warning signs:** A test that kills the process (or forces a DB error) between the two inserts and asserts the user row does not exist afterward, or exists with zero workspace memberships.

### Pitfall 4: Default-workspace seed runs twice
**What goes wrong:** Two rows with `is_default = true` exist after a second deploy/migration run, and the signup transaction's `SELECT ... WHERE is_default = true` becomes ambiguous (which one gets the new member?).
**Why it happens:** A seed script written as a bare `INSERT` instead of a check-then-insert (or `ON CONFLICT`), run again by CI/CD on a redeploy.
**How to avoid:** Query for an existing `is_default = true` row before inserting (see Code Examples, Pattern 3), or add a partial unique index (`CREATE UNIQUE INDEX ON workspace (is_default) WHERE is_default = true`) as defense-in-depth — note this index is not in TRD §3's DDL, so if added it should be proposed as a TRD addendum, not silently introduced (see the "schema is single-source-of-truth" invariant in CLAUDE.md).
**Warning signs:** `SELECT * FROM workspace WHERE is_default = true` returning more than one row in any environment.

### Pitfall 5: Client-only validation bypassed via direct API call
**What goes wrong:** A 9-character-but-numeric-only password, or a 5th duplicate workspace, gets through because only the React form validated it.
**Why it happens:** Treating zod schemas in a client component as sufficient, forgetting the *same* schema (or an equivalent one) must run again server-side in the Route Handler — TRD's explicit "zod 입력 검증" is scoped to Route Handlers, not forms.
**How to avoid:** Define validation schemas once (e.g. `lib/validation.ts`) and import them in both the client form and the Route Handler, so there is exactly one source of truth for "password ≥ 8 chars" and any workspace-name length cap (see Open Question O2).
**Warning signs:** A test that calls the API route directly (bypassing the form) with invalid input and expects a 400, written before the form exists — natural consequence of TDD ordering here.

### Pitfall 6: Forgetting `AUTH_SECRET`
**What goes wrong:** App throws at boot (or silently fails to sign JWTs) once `NODE_ENV=production`.
**Why it happens:** Auth.js v5 requires `AUTH_SECRET` in production; local dev sometimes works without it due to a dev-mode fallback, masking the gap until deploy `[CITED: WebSearch synthesis of authjs.dev env var docs]`.
**How to avoid:** Generate and set `AUTH_SECRET` in `.env.local` (and the deploy environment) from the start of Phase 1 scaffolding — `npx auth secret` is Auth.js's own generator command — and add it to whatever `.env.example` the scaffold produces.
**Warning signs:** Works on `next dev`, breaks only in a production build/deploy.

## Code Examples

### `auth.ts` — Auth.js v5 root config
```ts
// auth.ts (project root, per v5 convention)
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { db } from "@/db";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: "jwt",       // D-07: Credentials provider requires JWT, DB sessions unsupported
    maxAge: 60 * 60 * 24,  // D-05: 24h
    updateAge: 60 * 60,    // sliding renewal granularity — see Pitfall 2
  },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const [found] = await db.select().from(user).where(eq(user.email, email));
        if (!found?.passwordHash) return null;

        const valid = await bcrypt.compare(password, found.passwordHash);
        if (!valid) return null;

        return { id: found.id, email: found.email, name: found.name };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user: authedUser }) {
      if (authedUser) {
        token.id = authedUser.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.id = token.id as string;
      return session;
    },
  },
});
```
`[ASSUMED — application code assembled from the WebSearch synthesis of authjs.dev's Credentials + callbacks documentation, not copy-pasted from a single verified source this session]`. The `authorize()` → `jwt()` → `session()` call order and the module structure (`export const { handlers, auth, signIn, signOut } = NextAuth({...})`) are `[CITED: WebSearch synthesis of authjs.dev/reference/nextjs and authjs.dev/getting-started/migrating-to-v5]`.

### `app/api/auth/[...nextauth]/route.ts`
```ts
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
```
`[CITED: WebSearch synthesis of authjs.dev/reference/nextjs — this exact re-export pattern is the documented v5 App Router wiring]`

### `db/schema.ts` — Phase 1 tables (1:1 port of TRD §3)
```ts
// db/schema.ts
import { pgTable, uuid, text, boolean, timestamptz as _unused, timestamp, check, primaryKey } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const user = pgTable("user", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"), // nullable — OAuth-only accounts in R3
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workspace = pgTable("workspace", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workspaceMember = pgTable(
  "workspace_member",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.userId] }),
    check("workspace_member_role_check", sql`${table.role} IN ('OWNER','ADMIN','EDITOR','VIEWER')`),
  ],
);
```
The `primaryKey({ columns: [...] })` and `check(name, sql\`...\`)` syntax is `[CITED: WebSearch synthesis of orm.drizzle.team/docs/indexes-constraints]`. Column-for-column, this schema is `[VERIFIED: docs/TRD.md:47-68]` against:
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
```
(quoted verbatim from `docs/TRD.md` lines 47-68, read this session). Note: the `import { ... timestamptz as _unused ... }` line above is a placeholder — Drizzle's pg-core export for a `timestamptz` column is actually named `timestamp` with a `{ withTimezone: true }` option, not a separate `timestamptz` symbol; the real import line should just be `timestamp` as used in the column definitions `[ASSUMED — Drizzle pg-core API naming, not independently re-verified against the installed package this session; confirm against `node_modules/drizzle-orm/pg-core` types during Wave 0]`.

### `drizzle.config.ts`
```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```
`[CITED: WebSearch synthesis of orm.drizzle.team/docs/get-started/postgresql-new]`

### `db/index.ts`
```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const client = postgres(process.env.DATABASE_URL!);
export const db = drizzle(client);
```
`[CITED: WebSearch synthesis of orm.drizzle.team/docs get-started guide]`

### Scaffold command
```bash
pnpm create next-app@latest . \
  --typescript --no-tailwind --eslint --app --src-dir \
  --import-alias "@/*" --use-pnpm
```
`--no-tailwind` is commander.js's automatic negation of the boolean `--tailwind` flag (which defaults to `true`) `[ASSUMED — inferred from commander.js conventions per WebSearch synthesis; the create-next-app --help output itself does not explicitly document `--no-tailwind` as of this session's search, confirm with `pnpm create next-app@latest --help` before running]`. TRD §11 mandates CSS Modules over Tailwind, and UI-SPEC confirms "shadcn 미도입" for the same reason — Tailwind must not be scaffolded in.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-------------------|---------------|--------|
| NextAuth v4 (`pages/api/auth/[...nextauth].ts`, `getServerSession(authOptions)`) | Auth.js v5 (`auth.ts` at project root, unified `auth()` helper usable in Server Components/Route Handlers/middleware) | v5 beta line (current: `5.0.0-beta.32`) | Simpler API surface, but still beta — no v5 GA/stable release exists on the registry as of this session; `latest` dist-tag is still v4.24.15 |
| `NEXTAUTH_SECRET` / `NEXTAUTH_URL` env vars | `AUTH_SECRET` / `AUTH_URL` (with back-compat aliasing) | v5 | Use the new names in `.env.example`; old names still work but are deprecated |
| `middleware.ts` | Next.js 16 renames this to `proxy.ts` | Next.js 16 (not relevant to this phase — TRD locks Next 15, where `middleware.ts` is still correct) `[CITED: WebSearch synthesis, noted in passing while researching Auth.js middleware usage]` | None for Phase 1 — flagged only so nobody copies a Next-16-flavored tutorial's `proxy.ts` filename into this Next-15 project |

**Deprecated/outdated:** Create React App and `@vue/cli` are irrelevant here (Next.js project), noted only because the scaffold skill's anti-pattern list calls them out generally — not applicable to this phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | `postgres` (postgres.js) is the recommended driver over `pg` | Standard Stack | Low — swapping drivers only touches `db/index.ts`; both are peer-optional in drizzle-orm |
| A2 | `requireRole` function shape (role-rank object, throw-based, `ForbiddenError`) | Architecture Patterns / Code Examples | Low — this is a design choice for this codebase, not a documented external contract; planner/executor can adjust the exact shape as long as the server-403-on-violation contract holds |
| A3 | Minimal DB-backed rate limiter (no new dependency) is the right call for login brute-force defense | Open Question O1, Don't Hand-Roll | Medium — if the app later deploys multi-instance/serverless, an in-DB counter needs `SELECT ... FOR UPDATE` care or a proper atomic upsert to avoid race conditions under concurrent requests; revisit if deploy topology changes |
| A4 | Workspace name cap of `varchar(100)` + matching zod max | Open Question O2 | Low — cosmetic; not specified anywhere in REQUIREMENT/PRD/TRD, UI-SPEC explicitly delegates this decision to planner |
| A5 | `--no-tailwind` is a valid create-next-app flag (commander auto-negation) | Code Examples (scaffold command) | Low-Medium — if wrong, `next dev`/build would still work but Tailwind config would be scaffolded in; verify with `--help` before running, and manually strip `tailwind.config`/`postcss.config` + Tailwind CSS import from `globals.css` if the flag doesn't take |
| A6 | `db/schema.ts` `timestamp(..., { withTimezone: true })` is the correct Drizzle pg-core API for a `timestamptz` column (not a separate `timestamptz` export) | Code Examples | Low — this is a well-known, stable part of Drizzle's pg-core API from training knowledge, but was not independently re-verified against the installed package version (0.45.2) this session because Context7 was unavailable; a quick check against `node_modules/drizzle-orm/pg-core/columns` during Wave 0 resolves this in under a minute |
| A7 | TypeScript version should be left to whatever `create-next-app@latest` pins, given the registry's `latest` tag has moved to a major-version-7 native compiler | Standard Stack | Low-Medium — if create-next-app pins TS7 and something in the stack (e.g. a type-heavy Drizzle inference pattern) hits a TS7 regression, this surfaces as a typecheck failure early in Wave 0, not silently later |

## Open Questions

1. **O1 — Login brute-force rate-limit / lockout policy (RESOLVED)**
   - What we know: Auth.js's Credentials provider intentionally ships with zero built-in brute-force protection — the maintainers' stated position is that consumers of Credentials must implement this themselves `[CITED: WebSearch synthesis of nextauthjs/next-auth discussion #3479]`. CONTEXT.md explicitly deferred this to researcher/planner discretion. TRD's stack has no Redis/Upstash anywhere.
   - What's unclear: exact threshold numbers (community sources converge on "~5 attempts / 10-15 min" but this is not a hard standard).
   - **Recommendation:** implement a minimal DB-backed counter, not a new dependency. Key by `email + IP` (not IP alone, to stop distributed slow attacks against one account; not email alone, to avoid a trivial DoS-by-lockout against a known victim email). Store `(key, failed_count, first_failed_at)` in a small table (or reuse a `login_attempt` table added this phase, separate from TRD §3's Phase-1 tables — flag this as a TRD addendum candidate if the planner decides to persist it in Postgres rather than in-memory). Threshold: 5 failed attempts / 10 minutes, then reject with the UI-SPEC's existing generic "이메일 또는 비밀번호가 올바르지 않습니다." copy (never reveal that a lockout, specifically, is in effect — that itself would leak information). This is a Phase 1 scope call the planner should make explicit as its own task, since it is not covered by any locked D-01..D-15 decision.

2. **O2 — Workspace name maximum length (RESOLVED)**
   - What we know: UI-SPEC §"UI Considerations" already flags this as `⚠ unresolved` and explicitly instructs the planner to "assume a reasonable cap (e.g. `maxlength=100`) and note it in the plan." REQUIREMENT/PRD/TRD all leave `workspace.name` as unconstrained `text`.
   - What's unclear: no numeric answer exists anywhere upstream.
   - **Recommendation:** cap at 100 characters, enforced identically client-side (`maxLength={100}` on the input, matching UI-SPEC's own suggested number) and server-side (zod `.max(100)` in the shared validation schema — see Pitfall 5). Do **not** add a DB-level `varchar(100)` column constraint unless the planner also updates TRD §3 — the DDL there specifies `text` for `workspace.name`, and CLAUDE.md's schema-single-source invariant means the DB type change would need a TRD update first, not a silent divergence in `schema.ts`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Node.js | Runtime | ✓ | v24.2.0 | — |
| pnpm | Package manager (TRD-locked) | ✓ | 10.18.3 | — |
| PostgreSQL 16 | Data layer (TRD §1) | ✗ | — | No local Postgres and no Docker found on this machine. Two viable fallbacks: (a) `brew install postgresql@16` (Homebrew is present: 6.0.11) and run it locally, or (b) provision a free-tier hosted Postgres 16 (e.g. Neon/Supabase) and point `DATABASE_URL` at it for dev. Planner should pick one explicitly as a Wave 0 setup task — this blocks every DB-touching test in Phase 1 otherwise. |
| Docker | Optional convenience for running Postgres | ✗ | — | Not required if using Homebrew Postgres or a hosted dev DB (see above); no Phase 1 requirement mandates Docker specifically |
| git | Version control | ✓ | 2.54.0 | — |

**Missing dependencies with no fallback:** none — Postgres has two documented fallback paths above.
**Missing dependencies with fallback:** PostgreSQL 16 (local install via Homebrew, or hosted dev instance), Docker (not needed given the Postgres fallback).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (unit/integration) + Playwright 1.62.1 (E2E) — TRD §1/§10 locked |
| Config file | none yet — greenfield; Wave 0 must add `vitest.config.ts` and `playwright.config.ts` |
| Quick run command | `pnpm vitest run tests/rbac/matrix.test.ts` (single file, per CLAUDE.md's documented pattern) |
| Full suite command | `pnpm vitest run && pnpm exec playwright test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| AUTH-01 | Signup with email+password → immediately logged in (session cookie present) | integration | `pnpm vitest run tests/auth/signup.test.ts` | ❌ Wave 0 |
| AUTH-01 | Full signup → land on dashboard | e2e | `pnpm exec playwright test e2e/signup.spec.ts` | ❌ Wave 0 |
| AUTH-02 | Session persists across browser refresh | e2e | `pnpm exec playwright test e2e/session-persistence.spec.ts` (reload page, assert still authenticated) | ❌ Wave 0 |
| AUTH-03 | New user auto-joined to default workspace as EDITOR, visible on dashboard | integration + e2e | `pnpm vitest run tests/auth/signup.test.ts -t "default workspace membership"` + `playwright test e2e/dashboard.spec.ts` | ❌ Wave 0 |
| WS-01 | Server rejects out-of-role actions with 403 per matrix | integration | `pnpm vitest run tests/rbac/matrix.test.ts` (role × Phase-1-actionable-route matrix, per TRD §10: "역할 4종 × 주요 API 매트릭스 통합 테스트, 미달 요청 403 확인") | ❌ Wave 0 |
| WS-02 | Any member can create a workspace, becomes OWNER | integration | `pnpm vitest run tests/workspace/create.test.ts` | ❌ Wave 0 |
| WS-02 | Only OWNER can delete a workspace | integration | `pnpm vitest run tests/workspace/delete.test.ts` (assert ADMIN/EDITOR/VIEWER all get 403, OWNER succeeds) | ❌ Wave 0 |
| — | Default-workspace seed is idempotent across repeated runs | unit | `pnpm vitest run tests/db/seed.test.ts` | ❌ Wave 0 |
| — | Signup transaction is atomic (partial failure leaves no orphan user) | unit | `pnpm vitest run tests/auth/signup-atomicity.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the single relevant Vitest file for the plugin/route just touched (per CLAUDE.md's `pnpm vitest run tests/editor/bold.test.ts` pattern, applied here to auth/rbac/workspace test files)
- **Per wave merge:** `pnpm vitest run` (full unit/integration suite)
- **Phase gate:** `pnpm vitest run && pnpm exec playwright test` green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` — no test framework config exists yet (greenfield)
- [ ] `playwright.config.ts` — same
- [ ] `tests/rbac/matrix.test.ts` — the WS-01 role×route matrix test must be committed *before* `lib/rbac.ts` per TRD §10's TDD mandate
- [ ] `tests/auth/signup.test.ts` — must be committed before the signup route per the same mandate
- [ ] A test-DB strategy: either a disposable schema/database per test run (e.g. a dedicated `DATABASE_URL_TEST` against the same Postgres instance) or transactional rollback per test — decide during Wave 0, not per-test, since every integration test above hits Postgres directly

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|-------------------|
| V2 Authentication | yes | Auth.js v5 Credentials + bcrypt (cost factor 10), NIST 800-63B length-first password policy (D-01) — no composition rules, no forced rotation |
| V3 Session Management | yes | Auth.js JWT session, `httpOnly`/`secure` cookie flags (Auth.js default), `maxAge`/`updateAge` per D-05 (see Pitfall 2) |
| V4 Access Control | yes | `lib/rbac.ts requireRole` server-side gate on every mutating route (WS-01), enum-constrained roles via Postgres CHECK constraint as defense-in-depth against an application-layer role-string typo |
| V5 Input Validation | yes | zod schemas shared between client forms and Route Handlers (TRD architecture diagram mandate) |
| V6 Cryptography | yes | bcrypt for password hashing (never hand-rolled); Auth.js's own JWT signing/encryption for sessions (`AUTH_SECRET`) — never hand-roll session token crypto |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Credential stuffing / brute-force login | Spoofing | Rate limiting (Open Question O1) + bcrypt's inherent cost factor slowing offline attempts |
| Privilege escalation via missing/forgotten `requireRole` call on a new route | Elevation of Privilege | TDD-first RBAC matrix test (TRD §10) that enumerates every Phase-1-actionable route × all 4 roles, so a missing check fails a test rather than shipping silently |
| Session fixation / cookie tampering | Tampering | Auth.js's signed+encrypted JWT cookie (HMAC via `AUTH_SECRET`) makes tampering detectable; rotate `AUTH_SECRET` compromises invalidate all sessions, which is the correct fail-safe |
| SQL injection via workspace name / user name fields | Tampering | Drizzle's parameterized query builder (never raw string concatenation into `sql\`...\`` templates without parameter binding) |
| Information disclosure via differentiated login error messages ("no such user" vs "wrong password") | Information Disclosure | UI-SPEC already locks this: single generic copy "이메일 또는 비밀번호가 올바르지 않습니다." for both cases — `authorize()` must return `null` (not throw a distinguishing error) for both "user not found" and "wrong password" |
| Orphaned user (created but no workspace membership) leaking a broken account state | Denial of Service (self-inflicted data integrity issue) | Atomic transaction (Pitfall 3) |

## Sources

### Primary (HIGH confidence)
- `npm view` against the live npm registry (2026-08-01) for every pinned version in Standard Stack and the Package Legitimacy Audit — [VERIFIED: npm registry]
- `docs/TRD.md` (read this session, lines 1-291) — stack table §1, architecture §2, DDL §3, API table §8, directory structure §11 — [VERIFIED: docs/TRD.md]
- `docs/PRD.md` (read this session) — §2 gap interpretations #1/#4/#5, §3 permission matrix — [VERIFIED: docs/PRD.md]
- `.planning/phases/01-auth-workspace-foundation/01-CONTEXT.md` and `01-UI-SPEC.md` (read this session) — locked decisions and design contract — [VERIFIED: read this session]

### Secondary (MEDIUM confidence)
- WebSearch results synthesizing authjs.dev/reference/nextjs, authjs.dev/getting-started/migrating-to-v5, orm.drizzle.team/docs (indexes-constraints, sql-schema-declaration, drizzle-kit-generate/migrate, get-started/postgresql-new) — Context7 MCP tool was unavailable this session (`mcp__context7__resolve-library-id` returned "No such tool available"), so these official-docs citations are WebSearch-mediated summaries, not direct doc fetches. Flagged `[CITED]` throughout, not `[VERIFIED]`, per the provenance rules.

### Tertiary (LOW confidence)
- WebSearch synthesis of community blog posts and GitHub discussions for: bcrypt/bcryptjs Edge-runtime behavior (vercel/next.js discussion #77584), login rate-limiting patterns (multiple blog sources, no single canonical spec), nextauthjs/next-auth discussion #3479 on Credentials provider's lack of built-in brute-force protection. Marked `[ASSUMED]`/`[CITED: WebSearch synthesis...]` and reflected in the Assumptions Log where they inform a recommendation rather than a directly-quoted fact.

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH for version numbers (registry-verified this session), MEDIUM for exact Auth.js v5 API shapes (WebSearch-mediated, Context7 unavailable)
- Architecture: MEDIUM — `requireRole` pattern and transaction structure are this session's design applying standard, well-understood idioms (not lifted from a single authoritative source), but they are simple enough that the risk of a hidden gotcha is low
- Pitfalls: MEDIUM — bcrypt/Edge-runtime incompatibility and Auth.js `AUTH_SECRET` requirement are well-corroborated across multiple independent WebSearch sources; the rate-limiting and TypeScript-7 items are lower-confidence and captured explicitly in the Assumptions Log

**Research date:** 2026-08-01
**Valid until:** 2026-08-15 (14 days) — shorter than the default 30-day window because `next-auth@beta` is an actively-moving pre-release line (10 beta releases observed in recent history) and `typescript`'s registry `latest` tag reflects a major-version transition (TS7) that may still be stabilizing; re-run `npm view next-auth dist-tags` and `npm view typescript dist-tags` before executing if this research is more than two weeks old.
