export const runtime = "nodejs";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { canResend, issueVerificationCode } from "@/lib/email-verification";
import { sendVerificationEmail } from "@/lib/mailer";
import { checkLoginRateLimit, recordLoginFailure } from "@/lib/rate-limit";
import { resendCodeSchema } from "@/lib/validation";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const parsed = resendCodeSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "올바른 이메일 형식이 아닙니다." }, { status: 400 });
  }

  const { email } = parsed.data;

  // 이 라우트는 인증 없이 열려 있고 이메일만 있으면 남의 메일함으로 메일을 쏠 수 있다.
  // rate-limit.ts의 인메모리 카운터를 네임스페이스 키로 재사용한다(로그인 카운터와 분리).
  const key = `verify-resend:${email}`;
  if (!checkLoginRateLimit(key)) return Response.json({ ok: true });
  recordLoginFailure(key);

  try {
    const [found] = await db
      .select({ id: user.id, emailVerified: user.emailVerified })
      .from(user)
      .where(eq(user.email, email));

    // 계정이 없든, 이미 인증됐든, 쿨다운에 걸렸든 응답은 항상 같다. 여기서 분기하면 임의
    // 이메일의 가입·인증 여부를 확인해주는 열거 oracle이 된다.
    if (found && !found.emailVerified && (await canResend(found.id))) {
      await sendVerificationEmail(email, await issueVerificationCode(found.id));
    }
  } catch (err) {
    // 실패도 사용자에겐 같은 응답이다 — 로그로만 남긴다.
    console.error("verification resend failed", err);
  }

  return Response.json({ ok: true });
}
