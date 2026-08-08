"use client";

// UI-SPEC Tree Node Contract (Phase 4 extension) — a document leaf reuses FolderTreeNode's row
// styling verbatim (FolderTreeNode.module.css) but strips everything folder-specific: no
// draggable/DnD (documents aren't move targets or sources, YAGNI — Tree Node Contract), no
// chevron (always a leaf), click navigates immediately (Link) instead of toggling selection.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText } from "lucide-react";
import type { DocumentRow } from "./tree-utils";
import styles from "./FolderTreeNode.module.css";

interface DocumentTreeLeafProps {
  doc: DocumentRow;
  depth: number;
  workspaceId: string;
}

export function DocumentTreeLeaf({ doc, depth, workspaceId }: DocumentTreeLeafProps) {
  const pathname = usePathname();
  const href = `/w/${workspaceId}/d/${doc.id}`;
  const isActive = pathname === href;
  const paddingLeft = 8 + 16 * depth;

  return (
    <Link
      href={href}
      className={[styles.node, isActive ? styles.selected : ""].filter(Boolean).join(" ")}
      style={{ paddingLeft }}
    >
      <span className={styles.chevronSpace} />
      <FileText size={16} className={styles.folderIcon} />
      <span className={styles.name}>{doc.title || "제목 없음"}</span>
    </Link>
  );
}
