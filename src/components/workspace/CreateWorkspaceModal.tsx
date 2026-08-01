"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Form, FormField, FormLabel, FormError, FormSubmit } from "@/components/ui/Form";
import { Input } from "@/components/ui/Input";
import { workspaceSchema } from "@/lib/validation";

const CREATE_ERROR = "워크스페이스를 만들지 못했어요. 잠시 후 다시 시도해 주세요.";

interface CreateWorkspaceModalProps {
  open: boolean;
  onClose: () => void;
}

// E4 — D-13 single-field create modal. Client-validates with the same workspaceSchema the
// server re-validates (100-char cap, O2 — Pitfall 5 parity, same pattern as SignupForm).
// On success navigates to /w/[newId] (D-14); on failure stays open with inline error.
export function CreateWorkspaceModal({ open, onClose }: CreateWorkspaceModalProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = workspaceSchema.safeParse({ name });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? CREATE_ERROR);
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: parsed.data.name }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? CREATE_ERROR);
        setSubmitting(false);
        return;
      }

      const created = (await res.json()) as { id: string };
      onClose();
      router.push(`/w/${created.id}`);
    } catch {
      setError(CREATE_ERROR);
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="워크스페이스 만들기">
      <Form onSubmit={handleSubmit}>
        <FormField>
          <FormLabel htmlFor="workspace-name">이름</FormLabel>
          <Input
            id="workspace-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={100}
            required
            autoFocus
          />
        </FormField>
        {error && <FormError>{error}</FormError>}
        <FormSubmit disabled={submitting}>{submitting ? "만드는 중…" : "만들기"}</FormSubmit>
      </Form>
    </Modal>
  );
}
