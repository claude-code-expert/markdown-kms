// RESEARCH Pattern 3 analog (trash/page.tsx) — requireRole is called again here even though
// layout.tsx already gates the whole /w/[wsId] subtree, because this route needs the caller's
// *role* (not just membership) to drive canManage. Only the resulting boolean crosses into the
// client component tree — @/lib/rbac never gets imported by a "use client" file (07-PATTERNS).
import { notFound } from "next/navigation";
import { getPendingJoinRequests, getWorkspaceMembers } from "@/lib/members";
import { ForbiddenError, requireRole, ROLE_RANK } from "@/lib/rbac";
import { MembersView } from "@/components/members/MembersView";

interface MembersPageProps {
  params: Promise<{ wsId: string }>;
}

export default async function MembersPage({ params }: MembersPageProps) {
  const { wsId } = await params;

  let role;
  try {
    ({ role } = await requireRole(wsId, "VIEWER"));
  } catch (err) {
    if (err instanceof ForbiddenError) notFound();
    throw err;
  }

  const canManage = ROLE_RANK[role] >= ROLE_RANK.ADMIN;
  const members = await getWorkspaceMembers(wsId);
  const pending = canManage ? await getPendingJoinRequests(wsId) : [];

  return <MembersView members={members} pending={pending} canManage={canManage} wsId={wsId} />;
}
