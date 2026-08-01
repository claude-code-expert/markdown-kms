import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { workspace } from "@/db/schema";
import { ForbiddenError, requireRole } from "@/lib/rbac";
import styles from "./page.module.css";

interface WorkspacePageProps {
  params: Promise<{ wsId: string }>;
}

// D-14 — minimal placeholder for a created/active workspace (the "active workspace" is
// expressed via this URL param, TRD §11). No persistent folder sidebar yet — that's Phase 4's
// 3-pane layout. requireRole(wsId, "VIEWER") enforces membership server-side before rendering
// anything; a soft-deleted or non-existent workspace ID reaches the same notFound() path via
// the requireRole membership check (no row -> no membership -> ForbiddenError).
export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { wsId } = await params;

  try {
    await requireRole(wsId, "VIEWER");
  } catch (err) {
    if (err instanceof ForbiddenError) notFound();
    throw err;
  }

  const [ws] = await db.select({ name: workspace.name }).from(workspace).where(eq(workspace.id, wsId));
  if (!ws) notFound();

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{ws.name}</h1>
      <p className={styles.empty}>아직 문서가 없습니다.</p>
    </main>
  );
}
