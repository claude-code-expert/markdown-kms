"use client";

// UI-SPEC Tree Node Contract (Phase 4 extension) — a document leaf reuses FolderTreeNode's row
// styling verbatim (FolderTreeNode.module.css) but strips everything folder-specific: no
// draggable/DnD (documents aren't move targets or sources, YAGNI — Tree Node Contract). The
// row itself is a plain div (not the whole node's clickable target) so an inner <Link> can own
// navigation semantics while a sibling kebab button stays a separate interactive element —
// nesting a <button> inside an <a> is invalid HTML (04-03: added the 1-item "삭제" menu).
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEvent as ReactMouseEvent } from "react";
import { FileText, MoreHorizontal } from "lucide-react";
import type { DocumentRow } from "./tree-utils";
import styles from "./FolderTreeNode.module.css";

interface DocumentTreeLeafProps {
  doc: DocumentRow;
  depth: number;
  workspaceId: string;
  onOpenMenu: (event: ReactMouseEvent, docId: string, docTitle: string) => void;
}

export function DocumentTreeLeaf({ doc, depth, workspaceId, onOpenMenu }: DocumentTreeLeafProps) {
  const pathname = usePathname();
  const href = `/w/${workspaceId}/d/${doc.id}`;
  const isActive = pathname === href;
  const paddingLeft = 8 + 16 * depth;
  const title = doc.title || "제목 없음";

  return (
    <div
      className={[styles.node, isActive ? styles.selected : ""].filter(Boolean).join(" ")}
      style={{ paddingLeft }}
      onContextMenu={(event) => {
        event.preventDefault();
        onOpenMenu(event, doc.id, title);
      }}
    >
      <span className={styles.chevronSpace} />
      <Link href={href} className={styles.docLink}>
        <FileText size={16} className={styles.folderIcon} />
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
        <MoreHorizontal size={16} />
      </button>
    </div>
  );
}
