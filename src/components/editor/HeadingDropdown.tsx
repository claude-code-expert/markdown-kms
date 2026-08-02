"use client";

// ui-kit dropdown-trigger/dropdown-menu pattern (docs/ui-kit.html #10 "Dropdown"),
// ported to React state instead of DOM classList toggling. 5 items: 제목1-4 + 본문
// (heading levels 1-4 + 0/paragraph), each dispatching heading(level).run(view.state)
// through the live EditorView (same dispatch contract as Toolbar.tsx).
import { useEffect, useRef, useState } from "react";
import type { EditorView } from "@codemirror/view";
import { ChevronDown, Heading as HeadingIcon } from "lucide-react";
import { heading } from "./plugins/heading";
import styles from "./HeadingDropdown.module.css";

interface HeadingDropdownProps {
  getView: () => EditorView | null;
}

const LEVELS = [1, 2, 3, 4, 0] as const;

export function HeadingDropdown({ getView }: HeadingDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocumentClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, [open]);

  return (
    <div className={styles.dropdown} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-label="제목 서식"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <HeadingIcon size={16} />
        <ChevronDown size={14} className={styles.caret} />
      </button>
      {open && (
        <div className={styles.menu}>
          {LEVELS.map((level) => {
            const plugin = heading(level);
            return (
              <button
                key={plugin.id}
                type="button"
                className={styles.item}
                // Same caret-preservation guard as Toolbar.tsx: don't let the menu item's
                // mousedown blur the EditorView, or the dispatched heading prefix lands with the
                // caret restored to its pre-edit spot instead of where the TransactionSpec put it.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  const view = getView();
                  if (view) {
                    view.dispatch(plugin.run(view.state));
                    view.focus();
                  }
                  setOpen(false);
                }}
              >
                {plugin.tooltip}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
