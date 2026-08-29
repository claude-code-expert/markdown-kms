// HMAC(node:crypto) + DB — Edge 런타임 대상 아님(signup route와 같은 이유).
export const runtime = "nodejs";

import { verifyEmailCode } from "@/lib/email-verification";
import { verifyEmailSchema } from "@/lib/validation";

// 원인별 문구는 사용자가 **다음에 할 행동**이 다를 때만 나눈다. invalid는 "코드를 다시 확인",
// expired/too-many-attempts는 "재발송" — 그 셋만 구분하고 나머지는 합친다.
const MESSAGES: Record<string, string> = {
  invalid: "인증 코드가 올바르지 않습니다.",
  expired: "인증 코드가 만료되었어요. 코드를 다시 받아 주세요.",
  "too-many-attempts": "시도 횟수를 초과했어요. 코드를 다시 받아 주세요.",
};

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const parsed = verifyEmailSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.";
    return Response.json({ error: message }, { status: 400 });
  }

  const { email, code } = parsed.data;

  try {
    const result = await verifyEmailCode(email, code);

    // 이미 인증된 계정에 코드를 또 넣는 건 실패가 아니다(재시도·뒤로가기). 그대로 통과시켜
    // 클라이언트가 로그인 단계로 넘어가게 한다.
    if (result.status === "success" || result.status === "already-verified") {
      return Response.json({ ok: true });
    }

    return Response.json({ error: MESSAGES[result.status] ?? MESSAGES.invalid }, { status: 400 });
  } catch (err) {
    console.error("verify-email failed", err);
    return Response.json(
      { error: "일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }
}
