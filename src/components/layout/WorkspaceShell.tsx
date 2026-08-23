"use client";

// FolderTree(사이드바)를 감싸 리사이즈(20~280px)·접기/펼치기를 담당한다. FolderTree 자체는
// 폭 개념을 모르는 채 그대로 두고(단일 책임), 폭/접힘은 이 컴포넌트가 소유한다.
// EditorPreviewLayout의 리사이즈 핸들 드래그 로직(RESEARCH Pattern 7)과 같은 패턴:
// mousemove/mouseup은 window에 붙여 6px 히트 영역을 벗어난 빠른 드래그도 놓치지 않고,
// 쿠키는 mouseup 시점에 1회만 쓴다.
//
// 접힘은 두 겹으로 처리한다 — 바깥(sidebarWrap)의 width만 0으로 트랜지션해 "슬라이드"
// 시각효과를 내고, 안쪽(sidebarInner)은 항상 원래 폭을 유지한 채 visibility만 토글한다.
// overflow:hidden으로 잘리는 것만으론 안 된다 — 여전히 실제 크기를 가진 채 화면 밖으로
// 밀려날 뿐이라 키보드 포커스·스크린리더에 그대로 남고, Playwright의 가시성 판정도
// (bounding box가 0이 아니라) 통과시켜 버린다.

import { useRef, useState, type ReactNode, type MouseEvent as ReactMouseEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { FolderTree } from "@/components/tree/FolderTree";
import type { WorkspaceOption } from "@/components/tree/WorkspaceSwitcher";
import type { DocumentRow, FolderRow } from "@/components/tree/tree-utils";
import styles from "./WorkspaceShell.module.css";

// MIN_WIDTH은 아이콘 전용 레일(FolderTree.module.css의 @container 압축 규칙)이 실제로
// 그려지는 최소 폭이다 — 원래 20px였지만 그 값으론 chevron+아이콘 한 줄도 못 들어가 아무
// 것도 안 보이는 빈 칸이 됐다(48px = chevron 16 + gap 4 + icon 16 + 우측 padding 8+4 여유).
const MIN_WIDTH = 48;
const MAX_WIDTH = 400;

export function clampSidebarWidth(px: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, px));
}

interface WorkspaceShellProps {
  folders: FolderRow[];
  documents: DocumentRow[];
  workspaceId: string;
  workspaceName: string;
  workspaces: WorkspaceOption[];
  initialWidth?: number;
  initialCollapsed?: boolean;
  children: ReactNode;
}

export function WorkspaceShell({
  folders,
  documents,
  workspaceId,
  workspaceName,
  workspaces,
  initialWidth = 236,
  initialCollapsed = false,
  children,
}: WorkspaceShellProps) {
  const [width, setWidth] = useState(() => clampSidebarWidth(initialWidth));
  const widthRef = useRef(width);
  widthRef.current = width;
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [resizing, setResizing] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);

  function handleResizeMouseDown(event: ReactMouseEvent<HTMLDivElement>) {
    event.preventDefault();
    const container = shellRef.current;
    if (!container) return;
    setResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    function onMove(moveEvent: MouseEvent) {
      const rect = container!.getBoundingClientRect();
      setWidth(clampSidebarWidth(moveEvent.clientX - rect.left));
    }

    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setResizing(false);
      document.cookie = `sidebarWidth=${widthRef.current}; path=/; max-age=31536000; samesite=lax`;
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `sidebarCollapsed=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <div className={styles.shell} ref={shellRef}>
      <div
        className={styles.sidebarWrap}
        style={{
          width: collapsed ? 0 : width,
          transition: resizing ? "none" : undefined,
        }}
      >
        {/* overflow:hidden은 이 안쪽 clip 레이어에만 건다 — sidebarWrap 자체에 걸면
            right:-3px로 경계 밖까지 걸치는 resizeHandle의 절반이 함께 잘려나가
            히트 영역이 사실상 없어진다(실측: elementFromPoint가 .main 콘텐츠를 반환). */}
        <div className={styles.sidebarClip}>
          <div
            className={styles.sidebarInner}
            style={{ width, visibility: collapsed ? "hidden" : "visible" }}
          >
            <FolderTree
              folders={folders}
              documents={documents}
              workspaceId={workspaceId}
              workspaceName={workspaceName}
              workspaces={workspaces}
            />
          </div>
        </div>
        {!collapsed && (
          <>
            <div className={styles.resizeHandle} onMouseDown={handleResizeMouseDown} aria-hidden="true" />
            <button
              type="button"
              className={styles.collapseToggle}
              onClick={toggleCollapsed}
              aria-label="사이드바 숨기기"
            >
              <ChevronLeft size={14} />
            </button>
          </>
        )}
      </div>
      {collapsed && (
        <button
          type="button"
          className={styles.expandToggle}
          onClick={toggleCollapsed}
          aria-label="사이드바 보이기"
        >
          <ChevronRight size={14} />
        </button>
      )}
      <main className={styles.main}>{children}</main>
    </div>
  );
}
