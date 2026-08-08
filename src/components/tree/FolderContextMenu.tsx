"use client";

import { useEffect, useRef } from "react";
import type { ComponentType } from "react";
import styles from "./FolderContextMenu.module.css";

export interface FolderMenuItem {
  label: string;
  icon: ComponentType<{ size?: number }>;
  onClick: () => void;
  destructive?: boolean;
}

interface FolderContextMenuProps {
  x: number;
  y: number;
  items: FolderMenuItem[];
  onClose: () => void;
}

// Shared by right-click and hover-kebab triggers (UI-SPEC Interaction Contract — both
// converge on the same menu). Fixed-position popup, no backdrop (03-PATTERNS.md analog:
// Modal's Escape-listener pattern, reused here without the backdrop-click-to-close half).
export function FolderContextMenu({ x, y, items, onClose }: FolderContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onPointerDown);
    };
  }, [onClose]);

  return (
    <div ref={ref} className={styles.menu} style={{ left: x, top: y }} role="menu">
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          className={item.destructive ? styles.itemDestructive : styles.item}
          onClick={() => {
            onClose();
            item.onClick();
          }}
        >
          <item.icon size={16} />
          {item.label}
        </button>
      ))}
    </div>
  );
}
