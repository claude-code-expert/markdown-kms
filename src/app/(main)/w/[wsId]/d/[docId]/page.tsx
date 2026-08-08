// RESEARCH Pattern 3 / Anti-pattern warning: this RSC calls lib/documents.getDocument directly
// — it never fetches its own /api/documents/:id route (no HTTP round-trip for its own render).
import { cookies } from "next/headers"; // [CITED: nextjs.org/docs/app/api-reference/functions/cookies]
import { notFound } from "next/navigation";
import { getDocument, getDraft, getTags, isDraftNewer } from "@/lib/documents";
import { ForbiddenError, requireRole } from "@/lib/rbac";
import { DocumentWorkspace } from "@/components/document/DocumentWorkspace";
import type { LayoutMode } from "@/components/layout/EditorPreviewLayout";

const LAYOUT_MODES: LayoutMode[] = ["split", "editor-only", "preview-only"];

interface DocumentPageProps {
  params: Promise<{ wsId: string; docId: string }>;
}

export default async function DocumentPage({ params }: DocumentPageProps) {
  const { wsId, docId } = await params;

  try {
    await requireRole(wsId, "VIEWER");
  } catch (err) {
    if (err instanceof ForbiddenError) notFound();
    throw err;
  }

  // getDocument scopes by workspaceId as well as documentId (RESEARCH Pitfall 6 / T-04-02-IDOR)
  // — a docId belonging to a different workspace 404s here, never leaking cross-workspace
  // content to a member of wsId. getDraft is fetched in the SAME Promise.all so isDraftNewer's
  // comparison uses two timestamps read in the same request context (05-05 Pitfall 7 — no
  // client-clock-skew exposure, the client only ever sees the boolean result below).
  const [doc, draft, tags] = await Promise.all([getDocument(docId, wsId), getDraft(docId), getTags(docId)]);
  if (!doc) notFound();

  const hasNewerDraft = isDraftNewer(draft, doc);
  const draftContent = hasNewerDraft ? (draft?.content ?? null) : null;

  // RSC reads layoutMode/splitRatio so the first render already matches the
  // saved state (no-FOUC) — RESEARCH Pattern 6, same non-API-route cookie
  // pattern as the theme cookie (05-07). requireRole already made this route
  // dynamic (Pitfall 9), so cookies() here adds no extra rendering cost.
  // Missing/tampered values fall back to the pre-05-08 defaults (split/50);
  // EditorPreviewLayout's clampRatio re-clamps splitRatio regardless
  // (T-05-08-COOKIE).
  const cookieStore = await cookies();
  const layoutModeCookie = cookieStore.get("layoutMode")?.value;
  const layoutMode: LayoutMode = LAYOUT_MODES.includes(layoutModeCookie as LayoutMode)
    ? (layoutModeCookie as LayoutMode)
    : "split";
  const splitRatioCookie = Number(cookieStore.get("splitRatio")?.value);
  const splitRatio = Number.isFinite(splitRatioCookie) ? splitRatioCookie : 50;

  return (
    <DocumentWorkspace
      key={doc.id}
      docId={doc.id}
      initialTitle={doc.title}
      initialContent={doc.content}
      initialSeq={doc.savedSeq}
      initialLayoutMode={layoutMode}
      initialSplitRatio={splitRatio}
      hasNewerDraft={hasNewerDraft}
      draftContent={draftContent}
      initialTags={tags}
    />
  );
}
