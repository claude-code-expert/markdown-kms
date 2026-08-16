import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { workspace } from "@/db/schema";
import { ForbiddenError, requireRole } from "@/lib/rbac";
import { getWorkspaceFolders } from "@/lib/closure";
import { getWorkspaceDocuments } from "@/lib/documents";
import { FolderTree } from "@/components/tree/FolderTree";
import { SiteHeader } from "@/components/site/SiteHeader";
import styles from "./layout.module.css";

interface WorkspaceLayoutProps {
  children: ReactNode;
  params: Promise<{ wsId: string }>;
}

// D-14 / D-P2-01 / RESEARCH Pattern 3 — the sidebar+requireRole+notFound logic that used to
// live directly in page.tsx now lives here, shared by the empty-state index (page.tsx) and the
// document workspace (d/[docId]/page.tsx). getWorkspaceFolders(wsId) is a single flat query
// (TREE-02) — the initial tree is server-rendered, no client loading spinner.
export default async function WorkspaceLayout({ children, params }: WorkspaceLayoutProps) {
  const { wsId } = await params;

  try {
    await requireRole(wsId, "VIEWER");
  } catch (err) {
    if (err instanceof ForbiddenError) notFound();
    throw err;
  }

  const [ws] = await db.select({ name: workspace.name }).from(workspace).where(eq(workspace.id, wsId));
  if (!ws) notFound();

  const [folders, documents] = await Promise.all([getWorkspaceFolders(wsId), getWorkspaceDocuments(wsId)]);

  return (
    <>
      <SiteHeader />
      <div className={styles.page}>
        <FolderTree folders={folders} documents={documents} workspaceId={wsId} />
        <main className={styles.main}>{children}</main>
      </div>
    </>
  );
}
