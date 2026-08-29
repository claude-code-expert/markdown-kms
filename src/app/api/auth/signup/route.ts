// bcrypt is a native addon — cannot run on the Edge runtime (Pitfall 1).
export const runtime = "nodejs";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { createUserInDefaultWorkspace } from "@/lib/account";
import { issueVerificationCode } from "@/lib/email-verification";
import { sendVerificationEmail } from "@/lib/mailer";
import { signupSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/password";

function pgErrorCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const code = (err as { code?: string }).code;
  if (code) return code;
  // Drizzle wraps the driver error as DrizzleQueryError with the original postgres.js
  // PostgresError (which carries `.code`) on `.cause`.
  return pgErrorCode((err as { cause?: unknown }).cause);
}

function isUniqueViolation(err: unknown): boolean {
  // postgres.js (postgres) surfaces Postgres error codes on `.code` — 23505 = unique_violation.
  return pgErrorCode(err) === "23505";
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.";
    return Response.json({ error: message }, { status: 400 });
  }

  const { email, password, name } = parsed.data;
  const passwordHash = await hashPassword(password);

  try {
    // 미인증 상태로 남은 계정은 "이미 사용 중"이 아니라 **중단된 가입**이다. 409를 내면 인증
    // 코드 입력 전에 탭을 닫은 사용자가 영영 그 이메일을 못 쓰는 막다른 길이 된다. 코드를 다시
    // 보내고 입력 단계로 돌려보낸다.
    //
    // 이때 비밀번호·이름을 지금 값으로 덮는다. 아직 아무도 소유를 증명하지 않은 계정이라
    // 덮어써도 잃을 게 없고, 이래야 "비밀번호를 잘못 적었으니 다시 가입"이 복구 경로가 된다.
    const [existing] = await db
      .select({ id: user.id, emailVerified: user.emailVerified })
      .from(user)
      .where(eq(user.email, email));

    if (existing && !existing.emailVerified) {
      await db.update(user).set({ passwordHash, name }).where(eq(user.id, existing.id));
      await sendVerificationEmail(email, await issueVerificationCode(existing.id));
      return Response.json({ id: existing.id, email, name, emailVerified: false });
    }

    // AUTH-01 + AUTH-03 in one transaction — a partial failure must leave no orphaned user (Pitfall 3).
    // 트랜잭션 본문은 lib/account.ts와 공유한다 — Google 로그인도 같은 "기본 워크스페이스 EDITOR
    // 편입"을 거쳐야 하므로 규칙의 원천이 하나여야 한다.
    const created = await db.transaction((tx) =>
      createUserInDefaultWorkspace(tx, { email, name, passwordHash, emailVerified: false }),
    );

    // 메일 발송은 트랜잭션 **밖**이다. Resend 장애로 계정 생성까지 롤백되면 사용자는 아무것도
    // 못 하지만, 계정만 남으면 재발송으로 복구할 수 있다. 그래서 발송 실패는 가입을 깨지 않는다.
    try {
      await sendVerificationEmail(email, await issueVerificationCode(created.id));
    } catch (mailErr) {
      console.error("verification email failed", mailErr);
    }

    return Response.json(created);
  } catch (err) {
    if (isUniqueViolation(err)) {
      return Response.json(
        { error: "이미 사용 중인 이메일이에요. 다른 이메일로 시도하거나 로그인해 주세요." },
        { status: 409 },
      );
    }
    console.error("signup failed", err);
    return Response.json(
      { error: "일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }
}
