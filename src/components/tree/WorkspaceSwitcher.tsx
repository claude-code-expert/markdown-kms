"use client";

// FolderPathPicker.tsx와 같은 트리거+메뉴+click-outside 패턴 — 검색창 바로 위, 사이드바
// 최상단에서 현재 워크스페이스명을 보여주고 클릭하면 내 워크스페이스 목록
// (listMembershipsForUser)으로 전환한다. 이동은 즉시 네비게이션(/w/{id})이라 서버 확정을
// 기다릴 뮤테이션이 없다.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";
import styles from "./WorkspaceSwitcher.module.css";

export interface WorkspaceOption {
  id: string;
  name: string;
}

interface WorkspaceSwitcherProps {
  workspaceId: string;
  workspaceName: string;
  workspaces: WorkspaceOption[];
}

export function WorkspaceSwitcher({ workspaceId, workspaceName, workspaces }: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocumentClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, [open]);

  return (
    <div className={styles.switcher} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-label="워크스페이스 전환"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <span className={styles.name}>{workspaceName}</span>
        <ChevronDown size={14} className={styles.caret} />
      </button>
      {open && (
        <div className={styles.menu}>
          {workspaces.map((ws) => (
            <Link
              key={ws.id}
              href={`/w/${ws.id}`}
              className={ws.id === workspaceId ? styles.itemActive : styles.item}
              onClick={() => setOpen(false)}
            >
              <span className={styles.itemName}>{ws.name}</span>
              {ws.id === workspaceId && <Check size={14} className={styles.check} />}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
