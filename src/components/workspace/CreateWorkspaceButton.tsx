"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { CreateWorkspaceModal } from "./CreateWorkspaceModal";

// Dashboard header CTA (UI-SPEC Visual Hierarchy — right-aligned, smaller footprint than the
// card grid). Owns the modal's open/close state; the modal itself is stateless-on-mount.
export function CreateWorkspaceButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        워크스페이스 만들기
      </Button>
      <CreateWorkspaceModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
