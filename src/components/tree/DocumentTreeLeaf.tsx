"use client";

// UI-SPEC Tree Node Contract (Phase 4 extension) — a document leaf reuses FolderTreeNode's row
// styling verbatim (FolderTreeNode.module.css). The row itself is a plain div (not the whole
// node's clickable target) so an inner <Link> can own navigation semantics while a sibling
// kebab button stays a separate interactive element — nesting a <button> inside an <a> is
// invalid HTML (04-03: added the 1-item "삭제" menu).
// 문서는 드래그 소스이지만 드롭 타겟은 아니다(문서 위에 문서/폴더를 놓는 건 의미가 없다) —
// FolderTreeNode처럼 onDragOver/onDrop/dropState는 없고, onDragStart/onDragEnd만 있다.
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { DragEvent, MouseEvent as ReactMouseEvent } from "react";
import { FileText, MoreHorizontal } from "lucide-react";
import type { DocumentRow, DraggedItem } from "./tree-utils";
import styles from "./FolderTreeNode.module.css";

interface DocumentTreeLeafProps {
  doc: DocumentRow;
  depth: number;
  workspaceId: string;
  onOpenMenu: (event: ReactMouseEvent, docId: string, docTitle: string) => void;
  dragged: DraggedItem | null;
  onDragStart: (item: DraggedItem) => void;
  onDragEnd: () => void;
  error: string | null;
}

export function DocumentTreeLeaf({
  doc,
  depth,
  workspaceId,
  onOpenMenu,
  dragged,
  onDragStart,
  onDragEnd,
  error,
}: DocumentTreeLeafProps) {
  const pathname = usePathname();
  const href = `/w/${workspaceId}/d/${doc.id}`;
  const isActive = pathname === href;
  const isDragging = dragged?.type === "document" && dragged.id === doc.id;
  const paddingLeft = 8 + 16 * depth;
  const title = doc.title || "제목 없음";

  function handleDragStart(event: DragEvent<HTMLDivElement>) {
    event.dataTransfer.setData("text/plain", doc.id); // Firefox requires setData in dragstart
    event.dataTransfer.effectAllowed = "move";
    onDragStart({ id: doc.id, type: "document" });
  }

  return (
    <div>
      <div
        className={[styles.node, isActive ? styles.selected : "", isDragging ? styles.dragging : ""]
          .filter(Boolean)
          .join(" ")}
        style={{ paddingLeft }}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={onDragEnd}
        onContextMenu={(event) => {
          event.preventDefault();
          onOpenMenu(event, doc.id, title);
        }}
      >
        <span className={styles.chevronSpace} />
        <Link href={href} className={styles.docLink}>
          <FileText size={18} className={styles.folderIcon} />
          <span className={styles.name}>{title}</span>
        </Link>
        <button
          type="button"
          className={styles.kebab}
          aria-label={`${title} 메뉴`}
          onClick={(event) => {
            event.stopPropagation();
            onOpenMenu(event, doc.id, title);
          }}
        >
          <MoreHorizontal size={19} />
        </button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
