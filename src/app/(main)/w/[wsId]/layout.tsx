import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { workspace } from "@/db/schema";
import { ForbiddenError, requireRole } from "@/lib/rbac";
import { getWorkspaceFolders } from "@/lib/closure";
import { getWorkspaceDocuments } from "@/lib/documents";
import { SiteHeader } from "@/components/site/SiteHeader";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
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

  // no-FOUC: RSC가 쿠키로 초기 폭/접힘 상태를 읽어 첫 렌더부터 반영한다(splitRatio/layoutMode와
  // 동일한 관례, EditorPreviewLayout 참고). 값이 없거나 손상됐으면 기본값(236px, 펼침 —
  // 리디자인 목업 기본폭)으로 폴백. clampSidebarWidth는 "use client" 파일(WorkspaceShell.tsx)의
  // export라 서버에서 직접 호출할 수 없다(splitRatio도 같은 이유로 RSC는 안 부르고 클라이언트가
  // 재클램프) — 원값만 넘기고 범위 보정은 WorkspaceShell의 useState 초기화가 그대로 맡는다.
  const cookieStore = await cookies();
  const widthCookie = Number(cookieStore.get("sidebarWidth")?.value);
  const initialWidth = Number.isFinite(widthCookie) ? widthCookie : 236;
  const initialCollapsed = cookieStore.get("sidebarCollapsed")?.value === "true";

  return (
    <>
      <SiteHeader />
      <div className={styles.page}>
        <WorkspaceShell
          folders={folders}
          documents={documents}
          workspaceId={wsId}
          initialWidth={initialWidth}
          initialCollapsed={initialCollapsed}
        >
          {children}
        </WorkspaceShell>
      </div>
    </>
  );
}
