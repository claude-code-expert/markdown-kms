import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listMembershipsForUser } from "@/lib/db-membership";
import { WorkspaceCard } from "@/components/workspace/WorkspaceCard";
import { CreateWorkspaceButton } from "@/components/workspace/CreateWorkspaceButton";
import { JoinWorkspaceInput } from "@/components/workspace/JoinWorkspaceInput";
import styles from "./page.module.css";

// D-11: card dashboard landing screen. D-12: showing the workspace here satisfies AUTH-03's
// "표시된다" — the persistent folder sidebar arrives with Phase 4's three-pane layout.
// AUTH-03 guarantees a default-workspace membership, so there is no zero-card empty state.
export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    // WR-09: an expired session is the common case here — send back to /login, not /signup,
    // since the visitor most likely already has an account.
    redirect("/login");
  }

  const memberships = await listMembershipsForUser(session.user.id);

  return (
    <main className={styles.page}>
      {/* UI-SPEC Visual Hierarchy — 워크스페이스 카드 리스트(680px 중앙 정렬 컨테이너)가 1차 앵커 */}
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>내 워크스페이스</h1>
          <CreateWorkspaceButton />
        </div>
        <div className={styles.grid}>
          {memberships.map((membership) => (
            <WorkspaceCard
              key={membership.id}
              id={membership.id}
              name={membership.name}
              role={membership.role}
              ownerName={membership.ownerName}
              createdAt={membership.createdAt}
              docCount={membership.docCount}
              folderCount={membership.folderCount}
            />
          ))}
        </div>
        <div className={styles.joinSection}>
          <span className={styles.joinLabel}>워크스페이스 참여 신청</span>
          <JoinWorkspaceInput />
        </div>
      </div>
    </main>
  );
}
