import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { workspace } from "@/db/schema";
import { ForbiddenError, requireRole } from "@/lib/rbac";
import { getWorkspaceFolders } from "@/lib/closure";
import { EditorPreviewLayout } from "@/components/layout/EditorPreviewLayout";
import { FolderTree } from "@/components/tree/FolderTree";
import styles from "./page.module.css";

interface WorkspacePageProps {
  params: Promise<{ wsId: string }>;
}

// D-14 / D-P2-01 — the active workspace (expressed via this URL param, TRD §11) now
// renders the Phase 2 2-pane editor+preview host beside the Phase 3 folder sidebar
// (03-02 tracer slice — UI-SPEC 260px fixed sidebar). EditorPreviewLayout internals are
// untouched (D-P2-03). requireRole(wsId, "VIEWER") enforces membership server-side before
// rendering anything; a soft-deleted or non-existent workspace ID reaches the same
// notFound() path via the requireRole membership check (no row -> no membership ->
// ForbiddenError). getWorkspaceFolders(wsId) is a single flat query (TREE-02) — the
// initial tree is server-rendered, no client loading spinner.
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

  const folders = await getWorkspaceFolders(wsId);

  return (
    <div className={styles.page}>
      <FolderTree folders={folders} workspaceId={wsId} />
      <main className={styles.main}>
        <h1 className={styles.title}>{ws.name}</h1>
        <div className={styles.layoutWrap}>
          <EditorPreviewLayout />
        </div>
      </main>
    </div>
  );
}
