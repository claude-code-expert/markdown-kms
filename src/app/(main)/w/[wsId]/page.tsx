import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { workspace } from "@/db/schema";
import { ForbiddenError, requireRole } from "@/lib/rbac";
import { EditorPreviewLayout } from "@/components/layout/EditorPreviewLayout";
import styles from "./page.module.css";

interface WorkspacePageProps {
  params: Promise<{ wsId: string }>;
}

// D-14 / D-P2-01 — the active workspace (expressed via this URL param, TRD §11) now
// renders the Phase 2 2-pane editor+preview host in place of the Phase 1 placeholder.
// No persistent folder sidebar yet — that's Phase 4's 3-pane layout, which wraps
// EditorPreviewLayout without touching its internals (D-P2-03). requireRole(wsId,
// "VIEWER") enforces membership server-side before rendering anything; a soft-deleted
// or non-existent workspace ID reaches the same notFound() path via the requireRole
// membership check (no row -> no membership -> ForbiddenError).
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
      <div className={styles.layoutWrap}>
        <EditorPreviewLayout />
      </div>
    </main>
  );
}
