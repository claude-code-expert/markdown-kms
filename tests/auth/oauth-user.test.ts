import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user, workspace, workspaceMember } from "@/db/schema";
import {
  displayNameFromProfile,
  findOrCreateOAuthUser,
  isVerifiedGoogleProfile,
} from "@/lib/account";
import { POST as signupPOST } from "@/app/api/auth/signup/route";

// signup.test.ts:16-21과 같은 정리 헬퍼 — 멤버십을 먼저 지워야 FK를 안 건드린다.
async function deleteUserByEmail(email: string) {
  const [existing] = await db.select().from(user).where(eq(user.email, email));
  if (!existing) return;
  await db.delete(workspaceMember).where(eq(workspaceMember.userId, existing.id));
  await db.delete(user).where(eq(user.id, existing.id));
}

/**
 * 비밀번호로 가입시킨다. 기본은 인증까지 끝낸 상태 — 코드는 랜덤이라 알 수 없으므로 DB를
 * 직접 뒤집는다(이 파일의 관심사는 OAuth 연결이지 코드 검증이 아니다. 검증 흐름 자체는
 * email-verification.test.ts가 실제 라우트로 커버한다).
 */
async function signUpVerified(email: string, opts: { verify?: boolean } = {}) {
  const res = await signupPOST(
    new Request("http://localhost/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "password123", name: "비밀번호 가입자" }),
    }),
  );
  if (res.status !== 200) throw new Error(`signup failed: ${res.status}`);
  const created = await res.json();

  if (opts.verify !== false) {
    await db.update(user).set({ emailVerified: true }).where(eq(user.id, created.id));
  }
  return created as { id: string; email: string; name: string };
}

describe("findOrCreateOAuthUser", () => {
  const createdEmails: string[] = [];

  function trackEmail(prefix: string) {
    const email = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
    createdEmails.push(email);
    return email;
  }

  afterAll(async () => {
    await Promise.all(createdEmails.map((email) => deleteUserByEmail(email)));
  });

  it("creates an OAuth-only user (null passwordHash) with an EDITOR membership in the default workspace", async () => {
    const email = trackEmail("oauth-new");

    const created = await findOrCreateOAuthUser({ email, name: "구글 사용자" });
    expect(created.email).toBe(email);
    expect(created.name).toBe("구글 사용자");

    const [row] = await db.select().from(user).where(eq(user.email, email));
    // 비밀번호가 없는 계정이라는 게 핵심 — schema.ts:19가 이걸 위해 nullable이다.
    expect(row.passwordHash).toBeNull();

    const [defaultWs] = await db.select().from(workspace).where(eq(workspace.isDefault, true));
    const memberships = await db
      .select()
      .from(workspaceMember)
      .where(eq(workspaceMember.userId, row.id));

    expect(memberships).toHaveLength(1);
    expect(memberships[0].workspaceId).toBe(defaultWs.id);
    expect(memberships[0].role).toBe("EDITOR"); // FR-A3 / PRD §2-5
  });

  it("is idempotent — a second sign-in returns the same user without duplicating rows", async () => {
    const email = trackEmail("oauth-repeat");

    const first = await findOrCreateOAuthUser({ email, name: "첫 로그인" });
    // 이름이 달라져도 새 계정을 만들지 않는다(같은 이메일 = 같은 사람).
    const second = await findOrCreateOAuthUser({ email, name: "이름 바뀜" });

    expect(second.id).toBe(first.id);

    const users = await db.select().from(user).where(eq(user.email, email));
    expect(users).toHaveLength(1);

    const memberships = await db
      .select()
      .from(workspaceMember)
      .where(eq(workspaceMember.userId, first.id));
    expect(memberships).toHaveLength(1);
  });

  it("links to an existing verified password account without touching its passwordHash", async () => {
    const email = trackEmail("oauth-link");
    const passwordUser = await signUpVerified(email);

    const linked = await findOrCreateOAuthUser({ email, name: "구글 프로필 이름" });

    // 같은 계정으로 들어와야 한다 — 갈라지면 문서·워크스페이스가 둘로 쪼개진다.
    expect(linked.id).toBe(passwordUser.id);

    const [row] = await db.select().from(user).where(eq(user.email, email));
    // 이메일 소유가 이미 증명된 계정이라 비밀번호 로그인도 계속 살아있어야 한다.
    expect(row.passwordHash).toBeTruthy();
    expect(row.name).toBe("비밀번호 가입자");

    const users = await db.select().from(user).where(eq(user.email, email));
    expect(users).toHaveLength(1);
  });

  // 계정 선점 차단의 핵심 케이스. 공격자가 피해자 주소로 먼저 가입해도 그 비밀번호는 아무도
  // 소유를 증명하지 않은 값이라, Google이 진짜 소유자를 데려오면 폐기해야 한다.
  it("takes over an unverified password account and wipes its passwordHash", async () => {
    const email = trackEmail("oauth-preempt");
    const pending = await signUpVerified(email, { verify: false });

    const [before] = await db.select().from(user).where(eq(user.email, email));
    expect(before.emailVerified).toBe(false);
    expect(before.passwordHash).toBeTruthy();

    const linked = await findOrCreateOAuthUser({ email, name: "진짜 소유자" });
    expect(linked.id).toBe(pending.id);

    const [row] = await db.select().from(user).where(eq(user.email, email));
    expect(row.emailVerified).toBe(true);
    // 비워지지 않으면 공격자가 아는 비밀번호로 그대로 로그인할 수 있다.
    expect(row.passwordHash).toBeNull();
  });
});

describe("isVerifiedGoogleProfile", () => {
  it("accepts a profile with a verified email", () => {
    expect(isVerifiedGoogleProfile({ email: "kim@example.com", email_verified: true })).toBe(true);
  });

  // 이 게이트가 뚫리면 남의 이메일을 주장하는 것만으로 그 계정에 자동 연결된다.
  it("rejects an unverified email", () => {
    expect(isVerifiedGoogleProfile({ email: "kim@example.com", email_verified: false })).toBe(false);
  });

  it("rejects a missing email_verified claim", () => {
    expect(isVerifiedGoogleProfile({ email: "kim@example.com" })).toBe(false);
  });

  // 문자열 "true"는 boolean true가 아니다 — 느슨한 비교로 바꾸면 여기서 깨진다.
  it("rejects a stringified email_verified", () => {
    expect(isVerifiedGoogleProfile({ email: "kim@example.com", email_verified: "true" })).toBe(
      false,
    );
  });

  it("rejects a missing or empty email", () => {
    expect(isVerifiedGoogleProfile({ email_verified: true })).toBe(false);
    expect(isVerifiedGoogleProfile({ email: "", email_verified: true })).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(isVerifiedGoogleProfile(undefined)).toBe(false);
    expect(isVerifiedGoogleProfile(null)).toBe(false);
    expect(isVerifiedGoogleProfile("kim@example.com")).toBe(false);
  });
});

describe("displayNameFromProfile", () => {
  it("uses the profile name when present", () => {
    expect(displayNameFromProfile("김민지", "kim@example.com")).toBe("김민지");
  });

  // user.name은 notNull이라 빈 값이 그대로 흘러가면 insert가 죽는다.
  it("falls back to the email local part when the name is empty or missing", () => {
    expect(displayNameFromProfile("   ", "kim@example.com")).toBe("kim");
    expect(displayNameFromProfile(undefined, "kim@example.com")).toBe("kim");
    expect(displayNameFromProfile(null, "kim@example.com")).toBe("kim");
  });
});
