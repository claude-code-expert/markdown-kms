import { auth } from "@/auth";
import { forbiddenResponse } from "@/lib/rbac";
import { searchWorkspacesByName } from "@/lib/workspace-search";

export const runtime = "nodejs";

// WS-03 개정 — members/search/route.ts와 달리 requireRole이 없다: 아직 멤버가 아닌
// 워크스페이스를 "찾아서" 가입 신청하는 게 목적이라, 특정 워크스페이스 권한을 요구하면
// 애초에 검색 자체가 불가능해진다(join-requests/route.ts가 이미 같은 이유로 세션만 검사).
// 로그인 여부만 확인하고, 이름이 겹치는 전체 워크스페이스를 검색 범위로 둔다.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return forbiddenResponse();

  const rawQ = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  const results = rawQ ? await searchWorkspacesByName(session.user.id, rawQ) : [];
  return Response.json({ results });
}
