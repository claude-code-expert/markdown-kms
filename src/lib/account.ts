// src/lib/account.ts — 계정 생성의 단일 원천. 비밀번호 가입(api/auth/signup/route.ts)과 Google
// 로그인(auth.ts의 jwt 콜백) 두 경로가 "새 회원은 기본 워크스페이스에 EDITOR로 편입된다"
// (FR-A3, PRD §2-5)를 똑같이 지켜야 하므로 그 로직을 여기 한 곳에만 둔다.
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user, workspace, workspaceMember } from "@/db/schema";

// documents.ts:8의 DbClient 별칭과 동형 — tx는 구조적으로 typeof db가 아니라 둘을 union한다.
type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface AccountRow {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

const ACCOUNT_COLUMNS = {
  id: user.id,
  email: user.email,
  name: user.name,
  emailVerified: user.emailVerified,
} as const;

async function defaultWorkspaceId(tx: DbClient): Promise<string> {
  const [defaultWs] = await tx
    .select({ id: workspace.id })
    .from(workspace)
    .where(eq(workspace.isDefault, true));
  if (!defaultWs) {
    // 문구를 바꾸지 말 것 — connect.md 3단계와 tests/auth/signup-atomicity.test.ts가 이 문자열에 의존한다.
    throw new Error("default workspace not seeded");
  }
  return defaultWs.id;
}

async function addAsDefaultEditor(tx: DbClient, workspaceId: string, userId: string): Promise<void> {
  await tx.insert(workspaceMember).values({ workspaceId, userId, role: "EDITOR" });
}

async function findByEmail(tx: DbClient, email: string): Promise<AccountRow | undefined> {
  const [found] = await tx.select(ACCOUNT_COLUMNS).from(user).where(eq(user.email, email));
  return found;
}

/**
 * user 행 + 기본 워크스페이스 EDITOR 멤버십을 만든다. 호출자가 **반드시 트랜잭션을 넘겨야**
 * 한다 — 둘 중 하나만 남으면 워크스페이스 없는 고아 계정이 된다(signup route Pitfall 3).
 *
 * 이메일 중복은 여기서 삼키지 않고 그대로 던진다. 비밀번호 가입은 그 23505를 409로 매핑해야
 * 하기 때문이다(findOrCreateOAuthUser는 반대로 기존 계정을 재사용하므로 경로가 다르다).
 */
export async function createUserInDefaultWorkspace(
  tx: DbClient,
  values: { email: string; name: string; passwordHash: string | null; emailVerified: boolean },
): Promise<AccountRow> {
  const workspaceId = await defaultWorkspaceId(tx);

  const [newUser] = await tx
    .insert(user)
    .values({
      email: values.email,
      name: values.name,
      passwordHash: values.passwordHash,
      emailVerified: values.emailVerified,
    })
    .returning(ACCOUNT_COLUMNS);

  await addAsDefaultEditor(tx, workspaceId, newUser.id);

  return newUser;
}

/**
 * Google 로그인용. 이메일이 이미 있으면 **그 계정을 재사용**하고(= 계정 자동 연결), 없으면
 * OAuth 전용 계정으로 새로 만든다. 호출 전에 isVerifiedGoogleProfile()로 email_verified를
 * 확인했다는 전제 위에서만 안전하다.
 *
 * 기존 계정이 **미인증**이면 인증됨으로 승격하면서 passwordHash를 비운다. 이게 계정 선점을
 * 막는 지점이다 — 공격자가 피해자 주소로 먼저 비밀번호 가입을 해둬도 그 비밀번호는 아무도
 * 소유를 증명하지 않은 값이고, Google이 진짜 소유자를 데려온 순간 폐기하는 것이 맞다.
 * 폐기하지 않으면 공격자가 아는 비밀번호로 그 계정에 그대로 들어올 수 있다.
 */
export async function findOrCreateOAuthUser(values: {
  email: string;
  name: string;
}): Promise<AccountRow> {
  const existing = await findByEmail(db, values.email);
  if (existing) {
    if (!existing.emailVerified) {
      await db
        .update(user)
        .set({ emailVerified: true, passwordHash: null })
        .where(eq(user.id, existing.id));
    }
    return existing;
  }

  return db.transaction(async (tx) => {
    const workspaceId = await defaultWorkspaceId(tx);

    // 두 탭에서 동시에 첫 로그인하는 경우가 있다. onConflictDoNothing이라 레이스에서 진 쪽도
    // 예외 대신 빈 결과를 받고, 그때는 먼저 커밋된 행을 그대로 쓴다(멤버십도 그쪽이 넣었다).
    const [inserted] = await tx
      .insert(user)
      // Google이 email_verified로 소유를 보증했으므로 코드 인증을 거치지 않는다(TRD §9.1).
      .values({ email: values.email, name: values.name, passwordHash: null, emailVerified: true })
      .onConflictDoNothing({ target: user.email })
      .returning(ACCOUNT_COLUMNS);

    if (!inserted) {
      const raced = await findByEmail(tx, values.email);
      if (!raced) throw new Error("oauth user vanished after conflict");
      return raced;
    }

    await addAsDefaultEditor(tx, workspaceId, inserted.id);
    return inserted;
  });
}

/**
 * Google이 이메일 소유를 검증했는지 확인하는 보안 게이트. 이게 없으면 email_verified가 false인
 * 프로필로도 로그인이 통과해, 남의 이메일을 주장하는 것만으로 그 계정에 자동 연결될 수 있다.
 *
 * auth.ts의 signIn 콜백 안에 인라인으로 두지 않고 순수 함수로 뽑은 이유는 테스트 가능성이다 —
 * authorize()가 Auth.js 파이프라인 밖에서 못 도는 탓에 유닛 테스트가 없는 선례
 * (tests/auth/rate-limit.test.ts:2-4)를 보안 경계에서까지 반복하지 않는다.
 */
export function isVerifiedGoogleProfile(
  profile: unknown,
): profile is { email: string; email_verified: true; name?: string } {
  if (typeof profile !== "object" || profile === null) return false;
  const { email, email_verified: emailVerified } = profile as {
    email?: unknown;
    email_verified?: unknown;
  };
  return typeof email === "string" && email.length > 0 && emailVerified === true;
}

/**
 * Google 프로필에서 표시 이름을 고른다. user.name은 notNull이라 빈 값이 들어가면 안 되므로,
 * 이름이 비어 있으면 이메일 로컬파트로 떨어진다.
 */
export function displayNameFromProfile(name: string | null | undefined, email: string): string {
  const trimmed = name?.trim();
  if (trimmed) return trimmed;
  return email.split("@")[0] || email;
}
