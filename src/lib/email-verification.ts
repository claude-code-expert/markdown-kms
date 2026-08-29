// src/lib/email-verification.ts — 가입 이메일 인증. invitations.ts와 같은 모양이다: DbClient
// union 주입, discriminated union 결과, 트랜잭션 내 가드-업데이트로 일회성 보장.
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { emailVerification, user } from "@/db/schema";
import { generateCode, hashCode, verifyCodeHash } from "@/lib/verification-code";

type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

// TRD §9.1. 앱 상수 — invitations/route.ts:16의 TTL_MS 관례와 같은 자리.
export const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_ATTEMPTS = 5;
export const RESEND_COOLDOWN_MS = 60 * 1000;

export type VerifyResult =
  | { status: "success" }
  | { status: "invalid" }
  | { status: "expired" }
  | { status: "too-many-attempts" }
  | { status: "already-verified" };

function requireSecret(): string {
  const secret = process.env.AUTH_SECRET;
  // invitations.ts:47-48과 동일한 fail-closed — secret 없이 검증을 흉내내면 안 된다.
  if (!secret) throw new Error("AUTH_SECRET is not configured");
  return secret;
}

/**
 * 새 코드를 발급하고 평문을 반환한다. 평문이 존재하는 곳은 이 반환값과 메일 본문뿐이다.
 *
 * 기존 미소비 행은 전부 consumed 처리한다 — 재발송했는데 옛 코드가 계속 살아있으면 유효
 * 코드가 여러 개 떠다니게 되고, 그만큼 추측 성공 확률이 올라간다.
 */
export async function issueVerificationCode(userId: string, client: DbClient = db): Promise<string> {
  const secret = requireSecret();
  const code = generateCode();

  await client
    .update(emailVerification)
    .set({ consumedAt: new Date() })
    .where(and(eq(emailVerification.userId, userId), isNull(emailVerification.consumedAt)));

  await client.insert(emailVerification).values({
    userId,
    codeHash: hashCode(code, secret),
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });

  return code;
}

/**
 * 마지막 발급이 쿨다운 안이면 false. 재발송 버튼 연타로 메일함을 채우는 걸 막는다.
 * 레이트리밋(lib/rate-limit.ts)이 인메모리라 재시작에 사라지는 것과 달리, 이건 DB 기반이라
 * 인스턴스가 여러 개여도 성립한다.
 */
export async function canResend(userId: string, client: DbClient = db): Promise<boolean> {
  const [latest] = await client
    .select({ createdAt: emailVerification.createdAt })
    .from(emailVerification)
    .where(eq(emailVerification.userId, userId))
    .orderBy(desc(emailVerification.createdAt))
    .limit(1);
  if (!latest) return true;
  return Date.now() - latest.createdAt.getTime() >= RESEND_COOLDOWN_MS;
}

/**
 * 코드 검증. 성공하면 user.email_verified = true.
 *
 * 실패 원인을 부르는 쪽에서 세밀하게 나누지 않는 것이 중요하다 — 특히 "그런 이메일 없음"을
 * invalid로 접는다(invitations.ts:45와 같은 이유: 응답 차이가 계정 열거 oracle이 된다).
 */
export async function verifyEmailCode(
  email: string,
  code: string,
  client: DbClient = db,
): Promise<VerifyResult> {
  const secret = requireSecret();

  const [found] = await client
    .select({ id: user.id, emailVerified: user.emailVerified })
    .from(user)
    .where(eq(user.email, email));
  if (!found) return { status: "invalid" };
  if (found.emailVerified) return { status: "already-verified" };

  const [row] = await client
    .select()
    .from(emailVerification)
    .where(and(eq(emailVerification.userId, found.id), isNull(emailVerification.consumedAt)))
    .orderBy(desc(emailVerification.createdAt))
    .limit(1);
  if (!row) return { status: "invalid" };

  if (row.attempts >= MAX_ATTEMPTS) return { status: "too-many-attempts" };
  if (row.expiresAt.getTime() < Date.now()) return { status: "expired" };

  if (!verifyCodeHash(code, secret, row.codeHash)) {
    // 틀린 시도를 세지 않으면 10^6 공간을 무한히 긁을 수 있다.
    await client
      .update(emailVerification)
      .set({ attempts: row.attempts + 1 })
      .where(eq(emailVerification.id, row.id));
    // 시도 소진 자체는 다음 호출에서 알린다 — 여기서 분기하면 "방금 마지막 시도였다"는 정보가 샌다.
    return { status: "invalid" };
  }

  await client.transaction(async (tx) => {
    // invitations.ts:70-73과 같은 가드-업데이트: 트랜잭션 안에서 현재 DB 상태를 다시 보고
    // 갱신한다. 위에서 읽은 row.consumedAt이 아니라 이 WHERE가 일회성의 실제 보증이다.
    await tx
      .update(emailVerification)
      .set({ consumedAt: new Date() })
      .where(and(eq(emailVerification.id, row.id), isNull(emailVerification.consumedAt)));
    await tx.update(user).set({ emailVerified: true }).where(eq(user.id, found.id));
  });

  return { status: "success" };
}
