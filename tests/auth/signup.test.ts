import { afterAll, describe, expect, it } from "vitest";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user, workspace, workspaceMember } from "@/db/schema";
import { POST } from "@/app/api/auth/signup/route";

function signupRequest(body: unknown) {
  return new Request("http://localhost/api/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function deleteUserByEmail(email: string) {
  const [existing] = await db.select().from(user).where(eq(user.email, email));
  if (!existing) return;
  await db.delete(workspaceMember).where(eq(workspaceMember.userId, existing.id));
  await db.delete(user).where(eq(user.id, existing.id));
}

describe("POST /api/auth/signup", () => {
  const createdEmails: string[] = [];

  afterAll(async () => {
    await Promise.all(createdEmails.map((email) => deleteUserByEmail(email)));
  });

  it("creates a user with a bcrypt-hashed password and an EDITOR membership in the default workspace", async () => {
    const email = `signup-${Date.now()}@example.com`;
    createdEmails.push(email);

    const res = await POST(signupRequest({ email, password: "password123", name: "Signup Test" }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.email).toBe(email);

    const [createdUser] = await db.select().from(user).where(eq(user.email, email));
    expect(createdUser).toBeTruthy();
    expect(createdUser.passwordHash).not.toBe("password123");
    expect(await bcrypt.compare("password123", createdUser.passwordHash!)).toBe(true);
    // D-02 반전: 가입만으로는 인증되지 않는다. 이 값이 true로 새면 인증 단계 전체가 무의미해진다.
    expect(createdUser.emailVerified).toBe(false);

    const [defaultWs] = await db.select().from(workspace).where(eq(workspace.isDefault, true));
    expect(defaultWs).toBeTruthy();

    const [membership] = await db
      .select()
      .from(workspaceMember)
      .where(eq(workspaceMember.userId, createdUser.id));
    expect(membership).toBeTruthy();
    expect(membership.workspaceId).toBe(defaultWs.id);
    expect(membership.role).toBe("EDITOR");
  });

  it("rejects a password shorter than 8 characters with a 400", async () => {
    const email = `signup-short-pw-${Date.now()}@example.com`;

    const res = await POST(signupRequest({ email, password: "short1", name: "Short Password" }));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("8자");

    const [existing] = await db.select().from(user).where(eq(user.email, email));
    expect(existing).toBeUndefined();
  });

  it("rejects a duplicate email with a handled 409, not a 500", async () => {
    const email = `signup-dup-${Date.now()}@example.com`;
    createdEmails.push(email);

    const first = await POST(signupRequest({ email, password: "password123", name: "Original" }));
    expect(first.status).toBe(200);

    // 409는 **인증까지 끝난** 계정에만 해당한다. 미인증 계정에 대한 재가입은 중단된 가입을
    // 이어가는 정상 경로라 200 + 코드 재발송이다(email-verification.test.ts가 그쪽을 다룬다).
    await db.update(user).set({ emailVerified: true }).where(eq(user.email, email));

    const second = await POST(signupRequest({ email, password: "password456", name: "Duplicate" }));
    expect(second.status).toBe(409);

    const body = await second.json();
    expect(body.error).toContain("이미 사용 중인 이메일");

    const rows = await db.select().from(user).where(eq(user.email, email));
    expect(rows).toHaveLength(1);
  });
});
