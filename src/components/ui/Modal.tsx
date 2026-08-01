"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import styles from "./Modal.module.css";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

// Ported from docs/ui-kit.html id:'modal' (#19). Title weight follows UI-SPEC Typography's
// unified Heading token (16px/600) rather than ui-kit's literal 700 — the spec explicitly
// re-rounds the create-modal/delete-dialog titles onto its 2-weight (400/600) rule.
export function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={styles.backdrop}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.box} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className={styles.header}>
          <h3 className={styles.title} id="modal-title">
            {title}
          </h3>
          <button type="button" className={styles.close} onClick={onClose} aria-label="닫기">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
