"use client";

import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from "react";
import { ChevronRight, Folder, MoreHorizontal } from "lucide-react";
import { folderSchema } from "@/lib/validation";
import { DocumentTreeLeaf } from "./DocumentTreeLeaf";
import { isDescendantOrSelf, type DocumentRow, type FolderRow, type FolderTreeNode as TreeNode } from "./tree-utils";
import styles from "./FolderTreeNode.module.css";

// Shared callbacks/state threaded through the recursive node tree — bundled into one object
// so recursive calls stay a one-line prop spread instead of re-listing a dozen props per level.
export interface FolderTreeNodeCtx {
  folders: FolderRow[];
  workspaceId: string;
  // Phase 4 — documents grouped by their folderId (RESEARCH Pitfall 7: buildTree stays
  // folder-only, documents are merged in at render time via this Map instead).
  documentsByFolderId: Map<string | null, DocumentRow[]>;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  renamingId: string | null;
  onRenameSubmit: (id: string, name: string) => void;
  onRenameCancel: () => void;
  pendingId: string | null;
  draggedId: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDropOn: (targetId: string) => void;
  creatingChildOf: string | null;
  onSubmitCreateChild: (parentId: string, name: string) => void;
  onCancelCreateChild: () => void;
  onOpenMenu: (event: MouseEvent, folderId: string, folderName: string) => void;
  // 04-03 — separate trigger for the document leaf's 1-item menu (folders and documents render
  // different menuItems arrays off the same FolderContextMenu component).
  onOpenDocMenu: (event: MouseEvent, docId: string, docTitle: string) => void;
  errorFor: (id: string) => string | null;
}

interface FolderTreeNodeProps {
  node: TreeNode;
  depth: number;
  ctx: FolderTreeNodeCtx;
}

// Row + DnD + inline rename for one folder node (WorkspaceCard row/action-button analog,
// RESEARCH Pattern 6/7 for the native HTML5 drag handlers). One node = one component
// instance; recursion renders children directly (no virtualization — trees here are small).
export function FolderTreeNode({ node, depth, ctx }: FolderTreeNodeProps) {
  const [dropState, setDropState] = useState<"none" | "valid" | "rejected">("none");
  const documentsHere = ctx.documentsByFolderId.get(node.id) ?? [];
  // A folder with only documents (no subfolders) still needs a chevron to be expandable
  // (otherwise its documents would be permanently unreachable behind chevronSpace).
  const hasChildren = node.children.length > 0 || documentsHere.length > 0;
  const isOpen = ctx.expanded.has(node.id);
  const isRenaming = ctx.renamingId === node.id;
  const isPending = ctx.pendingId === node.id;
  const isCreatingChildHere = ctx.creatingChildOf === node.id;
  const showChildren = (hasChildren && isOpen) || isCreatingChildHere;
  const paddingLeft = 8 + 16 * depth;
  const error = ctx.errorFor(node.id);

  function handleDragStart(event: DragEvent<HTMLDivElement>) {
    event.dataTransfer.setData("text/plain", node.id); // Firefox requires setData in dragstart
    event.dataTransfer.effectAllowed = "move";
    ctx.onDragStart(node.id);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    if (!ctx.draggedId) return;
    if (isDescendantOrSelf(ctx.folders, ctx.draggedId, node.id)) {
      setDropState("rejected"); // no preventDefault -> browser's native "forbidden" cursor
      return;
    }
    event.preventDefault(); // required for drop to fire (MDN, RESEARCH Pitfall 7)
    setDropState("valid");
  }

  function handleDragLeave() {
    setDropState("none");
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDropState("none");
    if (ctx.draggedId && ctx.draggedId !== node.id) ctx.onDropOn(node.id);
  }

  function handleDragEnd() {
    setDropState("none");
    ctx.onDragEnd();
  }

  const rowClasses = [
    styles.node,
    ctx.selectedId === node.id ? styles.selected : "",
    dropState === "valid" ? styles.dropValid : "",
    dropState === "rejected" ? styles.dropRejected : "",
    isPending ? styles.pending : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div>
      <div
        className={rowClasses}
        style={{ paddingLeft }}
        draggable={!isRenaming && !isPending}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onDragEnd={handleDragEnd}
        onClick={() => ctx.onSelect(node.id)}
        onContextMenu={(event) => {
          event.preventDefault();
          ctx.onOpenMenu(event, node.id, node.name);
        }}
      >
        {hasChildren ? (
          <button
            type="button"
            className={styles.chevron}
            aria-label={isOpen ? "접기" : "펼치기"}
            onClick={(event) => {
              event.stopPropagation();
              ctx.onToggle(node.id);
            }}
          >
            <ChevronRight size={16} className={isOpen ? styles.chevronOpen : undefined} />
          </button>
        ) : (
          <span className={styles.chevronSpace} />
        )}
        <Folder size={16} className={styles.folderIcon} />
        {isRenaming ? (
          <RenameInput
            initialName={node.name}
            onSubmit={(name) => ctx.onRenameSubmit(node.id, name)}
            onCancel={ctx.onRenameCancel}
          />
        ) : (
          <span className={styles.name}>{node.name}</span>
        )}
        {!isRenaming && (
          <button
            type="button"
            className={styles.kebab}
            aria-label={`${node.name} 메뉴`}
            onClick={(event) => {
              event.stopPropagation();
              ctx.onOpenMenu(event, node.id, node.name);
            }}
          >
            <MoreHorizontal size={16} />
          </button>
        )}
        {isPending && <span className={styles.spinner} aria-hidden="true" />}
      </div>
      {error && <p className={styles.error}>{error}</p>}
      {showChildren && (
        <div>
          {isCreatingChildHere && (
            <CreateInlineRow
              depth={depth + 1}
              onSubmit={(name) => ctx.onSubmitCreateChild(node.id, name)}
              onCancel={ctx.onCancelCreateChild}
            />
          )}
          {node.children.map((child) => (
            <FolderTreeNode key={child.id} node={child} depth={depth + 1} ctx={ctx} />
          ))}
          {documentsHere.map((doc) => (
            <DocumentTreeLeaf
              key={doc.id}
              doc={doc}
              depth={depth + 1}
              workspaceId={ctx.workspaceId}
              onOpenMenu={ctx.onOpenDocMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// UI-SPEC Tree Node Contract — Enter/blur submit, Escape cancels back to the original name,
// server-confirmed only (no optimistic label swap before PATCH resolves).
function RenameInput({
  initialName,
  onSubmit,
  onCancel,
}: {
  initialName: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function commit() {
    if (cancelledRef.current) return;
    const parsed = folderSchema.safeParse({ name: value });
    if (!parsed.success || parsed.data.name === initialName) {
      onCancel();
      return;
    }
    onSubmit(parsed.data.name);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") commit();
    if (event.key === "Escape") {
      cancelledRef.current = true;
      onCancel();
    }
  }

  return (
    <input
      ref={inputRef}
      className={styles.inlineInput}
      value={value}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={onKeyDown}
      onBlur={commit}
    />
  );
}

// Inline "새 하위 폴더" input, rendered as the target node's next child row until the server
// confirms (no optimistic node insertion — CONTEXT.md).
function CreateInlineRow({
  depth,
  onSubmit,
  onCancel,
}: {
  depth: number;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const paddingLeft = 8 + 16 * depth;

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && value.trim()) onSubmit(value);
    if (event.key === "Escape") onCancel();
  }

  return (
    <div className={styles.node} style={{ paddingLeft }}>
      <span className={styles.chevronSpace} />
      <Folder size={16} className={styles.folderIcon} />
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
