import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { emailVerification, user, workspaceMember } from "@/db/schema";

// 라우트가 코드를 랜덤 생성하고 해시만 저장하므로, mock의 호출 인자가 평문 코드를 얻는 유일한
// 경로다. 실제 발송도 함께 막힌다.
vi.mock("@/lib/mailer", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendInvitationEmail: vi.fn().mockResolvedValue(undefined),
}));

const { sendVerificationEmail } = await import("@/lib/mailer");
const { POST: signupPOST } = await import("@/app/api/auth/signup/route");
const { POST: verifyPOST } = await import("@/app/api/auth/verify-email/route");
const { POST: resendPOST } = await import("@/app/api/auth/verify-email/resend/route");
const { MAX_ATTEMPTS } = await import("@/lib/email-verification");

const mockedSend = vi.mocked(sendVerificationEmail);

function post(handler: (req: Request) => Promise<Response>, url: string, body: unknown) {
  return handler(
    new Request(`http://localhost${url}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

const createdEmails: string[] = [];

function freshEmail(prefix: string) {
  const email = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  createdEmails.push(email);
  return email;
}

/** 가입시키고 메일로 나간 평문 코드를 돌려준다. */
async function signUp(email: string, password = "password123") {
  mockedSend.mockClear();
  const res = await post(signupPOST, "/api/auth/signup", { email, password, name: "인증 테스트" });
  expect(res.status).toBe(200);
  expect(mockedSend).toHaveBeenCalledTimes(1);
  return mockedSend.mock.calls[0][1];
}

async function findUser(email: string) {
  const [row] = await db.select().from(user).where(eq(user.email, email));
  return row;
}

beforeEach(() => {
  mockedSend.mockClear();
});

afterAll(async () => {
  for (const email of createdEmails) {
    const row = await findUser(email);
    if (!row) continue;
    // signup.test.ts:16-21과 같은 순서 — emailVerification은 ON DELETE CASCADE지만
    // workspaceMember는 아니라 먼저 지운다.
    await db.delete(workspaceMember).where(eq(workspaceMember.userId, row.id));
    await db.delete(user).where(eq(user.id, row.id));
  }
});

describe("signup + email verification", () => {
  it("creates the account unverified and emails a 6-digit code", async () => {
    const email = freshEmail("verify-new");
    const code = await signUp(email);

    expect(code).toMatch(/^\d{6}$/);
    expect(mockedSend.mock.calls[0][0]).toBe(email);

    const row = await findUser(email);
    expect(row.emailVerified).toBe(false);
  });

  it("marks the user verified on the correct code and consumes it", async () => {
    const email = freshEmail("verify-ok");
    const code = await signUp(email);

    const res = await post(verifyPOST, "/api/auth/verify-email", { email, code });
    expect(res.status).toBe(200);

    const row = await findUser(email);
    expect(row.emailVerified).toBe(true);

    const [record] = await db
      .select()
      .from(emailVerification)
      .where(eq(emailVerification.userId, row.id))
      .orderBy(desc(emailVerification.createdAt));
    expect(record.consumedAt).not.toBeNull();
  });

  // 일회성이 깨지면 유출된 코드가 계속 유효해진다.
  it("rejects the same code a second time", async () => {
    const email = freshEmail("verify-reuse");
    const code = await signUp(email);

    expect((await post(verifyPOST, "/api/auth/verify-email", { email, code })).status).toBe(200);

    // 이미 인증된 계정이라 200이지만, 코드가 다시 소비되지는 않는다.
    const second = await post(verifyPOST, "/api/auth/verify-email", { email, code });
    expect(second.status).toBe(200);

    const rows = await db
      .select()
      .from(emailVerification)
      .where(
        and(eq(emailVerification.userId, (await findUser(email)).id), isNull(emailVerification.consumedAt)),
      );
    expect(rows).toHaveLength(0);
  });

  it("counts wrong attempts and locks out after the limit", async () => {
    const email = freshEmail("verify-attempts");
    const code = await signUp(email);
    const wrong = code === "000000" ? "111111" : "000000";

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const res = await post(verifyPOST, "/api/auth/verify-email", { email, code: wrong });
      expect(res.status).toBe(400);
    }

    // 시도를 다 쓰면 **맞는 코드도** 더는 통하지 않는다 — 그래야 무한 추측이 막힌다.
    const res = await post(verifyPOST, "/api/auth/verify-email", { email, code });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("시도 횟수");
    expect((await findUser(email)).emailVerified).toBe(false);
  });

  it("rejects an expired code", async () => {
    const email = freshEmail("verify-expired");
    const code = await signUp(email);
    const row = await findUser(email);

    await db
      .update(emailVerification)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(emailVerification.userId, row.id));

    const res = await post(verifyPOST, "/api/auth/verify-email", { email, code });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("만료");
    expect((await findUser(email)).emailVerified).toBe(false);
  });

  it("rejects a malformed code without touching the database", async () => {
    const email = freshEmail("verify-malformed");
    await signUp(email);

    const res = await post(verifyPOST, "/api/auth/verify-email", { email, code: "abc" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("6자리");
  });

  // 없는 이메일과 틀린 코드가 다른 응답을 주면 가입 여부를 확인하는 oracle이 된다.
  it("gives an unknown email the same response as a wrong code", async () => {
    const email = freshEmail("verify-known");
    const code = await signUp(email);
    const wrong = code === "000000" ? "111111" : "000000";

    const unknown = await post(verifyPOST, "/api/auth/verify-email", {
      email: "nobody-here@example.com",
      code: "123456",
    });
    const wrongCode = await post(verifyPOST, "/api/auth/verify-email", { email, code: wrong });

    expect(unknown.status).toBe(wrongCode.status);
    expect(await unknown.json()).toEqual(await wrongCode.json());
  });
});

describe("resuming an abandoned signup", () => {
  // 코드를 넣기 전에 탭을 닫은 사용자가 409로 막히면 그 이메일을 영영 못 쓴다.
  it("re-sends a code instead of 409 when the pending account is unverified", async () => {
    const email = freshEmail("verify-resume");
    await signUp(email);

    mockedSend.mockClear();
    const res = await post(signupPOST, "/api/auth/signup", {
      email,
      password: "newpassword456",
      name: "다시 시도",
    });

    expect(res.status).toBe(200);
    expect(mockedSend).toHaveBeenCalledTimes(1);

    // 새 코드로 인증되고, 그때 넣은 비밀번호가 실제로 반영돼 있어야 복구가 완결된다.
    const newCode = mockedSend.mock.calls[0][1];
    expect((await post(verifyPOST, "/api/auth/verify-email", { email, code: newCode })).status).toBe(200);

    const row = await findUser(email);
    expect(row.emailVerified).toBe(true);
    expect(row.name).toBe("다시 시도");
    const bcrypt = (await import("bcrypt")).default;
    expect(await bcrypt.compare("newpassword456", row.passwordHash!)).toBe(true);
  });

  it("still returns 409 once the account is verified", async () => {
    const email = freshEmail("verify-dup");
    const code = await signUp(email);
    await post(verifyPOST, "/api/auth/verify-email", { email, code });

    const res = await post(signupPOST, "/api/auth/signup", {
      email,
      password: "password123",
      name: "중복",
    });
    expect(res.status).toBe(409);
  });
});

describe("POST /api/auth/verify-email/resend", () => {
  it("issues a new code for an unverified account", async () => {
    const email = freshEmail("resend-ok");
    const first = await signUp(email);
    const row = await findUser(email);

    // 쿨다운(60초)을 넘긴 것처럼 만든다 — 방금 발급한 행이라 그대로면 거부된다.
    await db
      .update(emailVerification)
      .set({ createdAt: new Date(Date.now() - 5 * 60 * 1000) })
      .where(eq(emailVerification.userId, row.id));

    mockedSend.mockClear();
    const res = await post(resendPOST, "/api/auth/verify-email/resend", { email });
    expect(res.status).toBe(200);
    expect(mockedSend).toHaveBeenCalledTimes(1);

    // 옛 코드는 무효가 돼야 한다 — 유효 코드가 여러 개면 추측 성공 확률이 그만큼 올라간다.
    const newCode = mockedSend.mock.calls[0][1];
    expect(newCode).not.toBe(first);
    expect((await post(verifyPOST, "/api/auth/verify-email", { email, code: first })).status).toBe(400);
    expect((await post(verifyPOST, "/api/auth/verify-email", { email, code: newCode })).status).toBe(200);
  });

  it("returns 200 without sending for an unknown email", async () => {
    mockedSend.mockClear();
    const res = await post(resendPOST, "/api/auth/verify-email/resend", {
      email: "nobody-at-all@example.com",
    });
    expect(res.status).toBe(200);
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it("returns 200 without sending while still inside the cooldown", async () => {
    const email = freshEmail("resend-cooldown");
    await signUp(email);

    mockedSend.mockClear();
    const res = await post(resendPOST, "/api/auth/verify-email/resend", { email });
    expect(res.status).toBe(200);
    expect(mockedSend).not.toHaveBeenCalled();
  });
});
