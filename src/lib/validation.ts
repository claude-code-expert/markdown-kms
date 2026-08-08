import { z } from "zod";

// WR-07: shared by signup (schema below) and login (src/auth.ts) so both sides of the
// unique-email constraint agree on the same normalized form. Trim then lowercase — the
// signup schema pipes through the same order (trim/lowercase BEFORE the email-format check,
// since that check runs on the raw string and a leading/trailing space would fail it).
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// D-01: length-first (NIST 800-63B) — 8+ chars, no composition rules.
// Shared client+server so there is exactly one source of truth (Pitfall 5).
export const signupSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("올바른 이메일 형식이 아닙니다.")),
  // WR-08: bcrypt silently truncates beyond 72 bytes — cap so two different passwords
  // sharing a 72-byte prefix can't collide into the same hash.
  password: z
    .string()
    .min(8, "비밀번호는 8자 이상이어야 합니다.")
    .max(72, "비밀번호는 72자를 넘을 수 없습니다."),
  name: z.string().min(1, "이름을 입력해 주세요."),
});

export type SignupInput = z.infer<typeof signupSchema>;

// O2: no cap in REQUIREMENT/PRD/TRD — UI-SPEC delegates to planner. 100 chars, enforced
// identically client+server via this shared schema. DB column stays `text` (no TRD §3 change).
export const workspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "워크스페이스 이름을 입력해 주세요.")
    .max(100, "워크스페이스 이름은 100자를 넘을 수 없습니다."),
});

export type WorkspaceInput = z.infer<typeof workspaceSchema>;

// TREE-03 / CONTEXT.md lock: not empty, trimmed, max 255 chars. No sibling-name-uniqueness
// constraint (deliberately absent — see src/db/schema.ts folder table comment).
export const folderSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "폴더 이름을 입력해 주세요.")
    .max(255, "폴더 이름은 255자를 넘을 수 없습니다."),
});

export type FolderInput = z.infer<typeof folderSchema>;
