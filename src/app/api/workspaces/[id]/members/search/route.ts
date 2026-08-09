import { z } from "zod";
import { ForbiddenError, forbiddenResponse, requireRole } from "@/lib/rbac";
import { searchUsersForInvite } from "@/lib/member-search";

export const runtime = "nodejs";

// WS-05 / T-07-04-ENUM: search/route.ts와 동일 구조지만 minRole은 ADMIN -- 회원 이메일/이름
// 열거는 초대 권한이 있는 ADMIN으로만 제한한다(비-ADMIN에게 다른 계정의 이메일을 노출하지 않음).
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id: wsId } = await context.params;
  if (!z.uuid().safeParse(wsId).success) {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  try {
    await requireRole(wsId, "ADMIN");
  } catch (err) {
    if (err instanceof ForbiddenError) return forbiddenResponse();
    throw err;
  }

  const rawQ = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  const results = rawQ ? await searchUsersForInvite(wsId, rawQ) : [];
  return Response.json({ results });
}
