import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listMembershipsForUser } from "@/lib/db-membership";
import { WorkspaceCard } from "@/components/workspace/WorkspaceCard";
import styles from "./page.module.css";

// D-11: card dashboard landing screen. D-12: showing the workspace here satisfies AUTH-03's
// "표시된다" — the persistent folder sidebar arrives with Phase 4's three-pane layout.
// AUTH-03 guarantees a default-workspace membership, so there is no zero-card empty state.
export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signup");
  }

  const memberships = await listMembershipsForUser(session.user.id);

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>내 워크스페이스</h1>
      <div className={styles.grid}>
        {memberships.map((membership) => (
          <WorkspaceCard key={membership.id} name={membership.name} />
        ))}
      </div>
    </main>
  );
}
