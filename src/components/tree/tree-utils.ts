// No analog in the codebase (RESEARCH Pattern-map: no existing tree-traversal utility) —
// plain O(n) parent-id map, standard algorithm.
export interface FolderRow {
  id: string;
  parentId: string | null;
  name: string;
}

// Phase 4 — mirrors lib/documents.ts's getWorkspaceDocuments select shape. Documents are NOT
// merged into buildTree's folder-only algorithm (RESEARCH Pitfall 7/Anti-pattern) — callers
// group these by folderId separately (documentsByFolderId Map) and render them as leaves.
export interface DocumentRow {
  id: string;
  folderId: string | null;
  title: string;
}

export interface FolderTreeNode extends FolderRow {
  children: FolderTreeNode[];
}

export function buildTree(folders: FolderRow[]): FolderTreeNode[] {
  const byId = new Map<string, FolderTreeNode>();
  for (const f of folders) byId.set(f.id, { ...f, children: [] });

  const roots: FolderTreeNode[] = [];
  for (const f of folders) {
    const node = byId.get(f.id)!;
    const parent = f.parentId ? byId.get(f.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

// 03-05: client-side cycle pre-judgment for DnD/move-modal UX only — NOT a trust boundary.
// The server (moveFolder, 03-03/03-04) re-validates inside the same transaction as the
// rewiring (T-03-05-CLIENTTRUST). rootId === candidateId is treated as "descendant-or-self"
// so both "drop onto itself" and "drop onto its own descendant" are rejected the same way.
// Source: RESEARCH Pattern 6 (verbatim).
export function isDescendantOrSelf(
  folders: { id: string; parentId: string | null }[],
  rootId: string,
  candidateId: string,
): boolean {
  if (rootId === candidateId) return true;
  const childrenOf = (id: string) => folders.filter((f) => f.parentId === id);
  const stack = [...childrenOf(rootId)];
  while (stack.length) {
    const node = stack.pop()!;
    if (node.id === candidateId) return true;
    stack.push(...childrenOf(node.id));
  }
  return false;
}
