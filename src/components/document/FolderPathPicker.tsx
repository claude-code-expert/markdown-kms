"use client";

// HeadingDropdown.tsx와 같은 트리거+메뉴+click-outside 패턴. 폴더 목록은 tree-utils의
// buildTree(폴더 사이드바와 동일 알고리즘)로 들여쓰기 트리를 만들고, 클릭 즉시 이동(모달의
// "선택 후 확인" 2단계 대신 FolderTree DnD와 같은 1단계 즉시 반영) — 서버 확정 후에만 로컬
// 상태를 갱신한다(CONTEXT.md "서버 확정만, optimistic UI 없음" 그대로).
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Folder } from "lucide-react";
import { buildTree, getAncestorPath, type FolderRow, type FolderTreeNode as TreeNode } from "@/components/tree/tree-utils";
import styles from "./FolderPathPicker.module.css";

const MOVE_ERROR = "폴더를 옮기지 못했어요. 다시 시도해 주세요.";

interface FolderPathPickerProps {
  documentId: string;
  folders: FolderRow[];
  initialFolderId: string | null;
}

export function FolderPathPicker({ documentId, folders, initialFolderId }: FolderPathPickerProps) {
  const router = useRouter();
  const [folderId, setFolderId] = useState(initialFolderId);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocumentClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, [open]);

  async function selectFolder(next: string | null) {
    if (next === folderId) {
      setOpen(false);
      return;
    }
    setError(null);
    setSubmitting(true);
    const res = await fetch(`/api/documents/${documentId}/move`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ newFolderId: next }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(MOVE_ERROR);
      return;
    }
    setFolderId(next);
    setOpen(false);
    router.refresh(); // 좌측 폴더 트리의 문서 배치도 함께 갱신 (moveFolderTo와 동일 관례)
  }

  const path = getAncestorPath(folders, folderId);
  const tree = buildTree(folders);

  return (
    <div className={styles.picker} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-label="상위 폴더 선택"
        disabled={submitting}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <Folder size={14} className={styles.icon} />
        <span className={styles.crumbs}>
          워크스페이스
          {path.map((folder) => (
            <span key={folder.id}> / {folder.name}</span>
          ))}
        </span>
        <ChevronDown size={14} className={styles.caret} />
      </button>
      {open && (
        <div className={styles.menu}>
          <button
            type="button"
            className={folderId === null ? styles.itemActive : styles.item}
            style={{ paddingLeft: 12 }}
            onClick={() => selectFolder(null)}
          >
            워크스페이스 루트
          </button>
          {tree.map((node) => (
            <PickerItem
              key={node.id}
              node={node}
              depth={0}
              activeId={folderId}
              onSelect={(id) => selectFolder(id)}
            />
          ))}
        </div>
      )}
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}

function PickerItem({
  node,
  depth,
  activeId,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <button
        type="button"
        className={node.id === activeId ? styles.itemActive : styles.item}
        style={{ paddingLeft: 12 + 16 * depth }}
        onClick={() => onSelect(node.id)}
      >
        {node.name}
      </button>
      {node.children.map((child) => (
        <PickerItem key={child.id} node={child} depth={depth + 1} activeId={activeId} onSelect={onSelect} />
      ))}
    </>
  );
}
