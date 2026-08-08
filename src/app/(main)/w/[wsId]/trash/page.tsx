// RESEARCH Pattern 3 analog (d/[docId]/page.tsx) — requireRole is called again here even though
// layout.tsx already gates the whole /w/[wsId] subtree, because this route needs the caller's
// *role* (not just membership) to drive TrashList's permission gating (disabled+hint, not
// hidden — CLAUDE.md "UI 버튼 숨김은 보안이 아니다"). getTrashItems is called directly, no
// self-fetch (Anti-pattern warning, same as every other RSC in this phase).
import { notFound } from "next/navigation";
import { getTrashItems } from "@/lib/closure";
import { ForbiddenError, requireRole, ROLE_RANK } from "@/lib/rbac";
import { TrashList } from "@/components/trash/TrashList";

interface TrashPageProps {
  params: Promise<{ wsId: string }>;
}

export default async function TrashPage({ params }: TrashPageProps) {
  const { wsId } = await params;

  let role;
  try {
    ({ role } = await requireRole(wsId, "VIEWER"));
  } catch (err) {
    if (err instanceof ForbiddenError) notFound();
    throw err;
  }

  const items = await getTrashItems(wsId);
  // Rank check happens here (server), not in the client component — TrashList only ever
  // receives the resulting booleans (see TrashList.tsx's comment on why).
  const canRestore = ROLE_RANK[role] >= ROLE_RANK.EDITOR;
  const canPermanentDelete = ROLE_RANK[role] >= ROLE_RANK.ADMIN;

  return <TrashList items={items} canRestore={canRestore} canPermanentDelete={canPermanentDelete} wsId={wsId} />;
}
