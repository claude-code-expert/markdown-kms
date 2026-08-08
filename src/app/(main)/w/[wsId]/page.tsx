// UI-SPEC Layout & Composition Contract — "문서 미열람 상태": no title input, no status bar, no
// editor — just a centered empty-state placeholder. requireRole/notFound/getWorkspaceFolders
// moved to layout.tsx (RESEARCH Pattern 3).
import { EmptyState } from "@/components/document/EmptyState";

export default function WorkspaceIndexPage() {
  return <EmptyState heading="문서를 선택해 주세요" body="왼쪽 트리에서 문서를 열거나 새 문서를 만들어 보세요." />;
}
