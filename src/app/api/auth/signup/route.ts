// bcrypt is a native addon — cannot run on the Edge runtime (Pitfall 1).
export const runtime = "nodejs";

import { db } from "@/db";
import { createUserInDefaultWorkspace } from "@/lib/account";
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
    // AUTH-01 + AUTH-03 in one transaction — a partial failure must leave no orphaned user (Pitfall 3).
    // 트랜잭션 본문은 lib/account.ts와 공유한다 — Google 로그인도 같은 "기본 워크스페이스 EDITOR
    // 편입"을 거쳐야 하므로 규칙의 원천이 하나여야 한다.
    const created = await db.transaction((tx) =>
      createUserInDefaultWorkspace(tx, { email, name, passwordHash }),
    );

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
