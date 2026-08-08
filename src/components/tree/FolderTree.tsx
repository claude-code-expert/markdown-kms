"use client";

// Minimal tracer slice (03-02 Task 2): render + create-root only. Context menu, hover
// actions, inline rename, DnD move, and soft-delete land in 03-05 on top of this verified
// skeleton (UI-SPEC Tree Node Contract covers those states too, not implemented here).
import { useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Folder, FolderPlus } from "lucide-react";
import { folderSchema } from "@/lib/validation";
import { buildTree, type FolderRow, type FolderTreeNode } from "./tree-utils";
import styles from "./FolderTree.module.css";

interface FolderTreeProps {
  folders: FolderRow[];
  workspaceId: string;
}

export function FolderTree({ folders, workspaceId }: FolderTreeProps) {
  const router = useRouter();
  const tree = buildTree(folders);
  const [creatingRoot, setCreatingRoot] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Server-confirmed only (no optimistic UI, CONTEXT.md) — the tree doesn't change until the
  // POST resolves, then router.refresh() re-runs the RSC page for the new folder list.
  async function submitCreateRoot(name: string) {
    const parsed = folderSchema.safeParse({ name });
    setCreatingRoot(false);
    if (!parsed.success) return;

    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: parsed.data.name, parentId: null, workspaceId }),
    });
    if (res.ok) router.refresh();
  }

  return (
    <nav className={styles.sidebar} aria-label="폴더 트리">
      <div className={styles.header}>
        <span className={styles.headerLabel}>폴더</span>
        <button
          type="button"
          className={styles.headerButton}
          aria-label="새 폴더"
          onClick={() => setCreatingRoot(true)}
        >
          <FolderPlus size={16} />
        </button>
      </div>
      <div className={styles.tree}>
        {creatingRoot && (
          <CreateInlineInput onSubmit={submitCreateRoot} onCancel={() => setCreatingRoot(false)} />
        )}
        {tree.length === 0 && !creatingRoot && (
          <p className={styles.empty}>
            폴더가 없어요
            <br />
            새 폴더를 만들어 문서를 정리해 보세요.
          </p>
        )}
        {tree.map((node) => (
          <FolderNodeRow key={node.id} node={node} depth={0} expanded={expanded} onToggle={toggle} />
        ))}
      </div>
    </nav>
  );
}

function CreateInlineInput({
  onSubmit,
  onCancel,
}: {
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && value.trim()) onSubmit(value);
    if (event.key === "Escape") onCancel();
  }

  return (
    <div className={styles.node} style={{ paddingLeft: 8 }}>
      <input
        className={styles.inlineInput}
        placeholder="새 폴더"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onCancel}
        autoFocus
      />
    </div>
  );
}

function FolderNodeRow({
  node,
  depth,
  expanded,
  onToggle,
}: {
  node: FolderTreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(node.id);
  const paddingLeft = 8 + 16 * depth;

  return (
    <div>
      <div className={styles.node} style={{ paddingLeft }}>
        {hasChildren ? (
          <button
            type="button"
            className={styles.chevron}
            aria-label={isOpen ? "접기" : "펼치기"}
            onClick={() => onToggle(node.id)}
          >
            <ChevronRight size={16} className={isOpen ? styles.chevronOpen : undefined} />
          </button>
        ) : (
          <span className={styles.chevronSpace} />
        )}
        <Folder size={16} className={styles.folderIcon} />
        <span className={styles.name}>{node.name}</span>
      </div>
      {hasChildren && isOpen && (
        <div>
          {node.children.map((child) => (
            <FolderNodeRow key={child.id} node={child} depth={depth + 1} expanded={expanded} onToggle={onToggle} />
          ))}
        </div>
      )}
    </div>
  );
}
