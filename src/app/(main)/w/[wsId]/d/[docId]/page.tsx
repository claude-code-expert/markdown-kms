// RESEARCH Pattern 3 / Anti-pattern warning: this RSC calls lib/documents.getDocument directly
// — it never fetches its own /api/documents/:id route (no HTTP round-trip for its own render).
import { notFound } from "next/navigation";
import { getDocument } from "@/lib/documents";
import { ForbiddenError, requireRole } from "@/lib/rbac";
import { DocumentWorkspace } from "@/components/document/DocumentWorkspace";

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
  // content to a member of wsId.
  const doc = await getDocument(docId, wsId);
  if (!doc) notFound();

  return (
    <DocumentWorkspace
      key={doc.id}
      docId={doc.id}
      initialTitle={doc.title}
      initialContent={doc.content}
      initialSeq={doc.savedSeq}
    />
  );
}
