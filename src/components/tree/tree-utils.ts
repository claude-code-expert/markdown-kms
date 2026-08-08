// No analog in the codebase (RESEARCH Pattern-map: no existing tree-traversal utility) —
// plain O(n) parent-id map, standard algorithm.
export interface FolderRow {
  id: string;
  parentId: string | null;
  name: string;
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
