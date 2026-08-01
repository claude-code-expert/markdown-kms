import { z } from "zod";

// D-01: length-first (NIST 800-63B) — 8+ chars, no composition rules.
// Shared client+server so there is exactly one source of truth (Pitfall 5).
export const signupSchema = z.object({
  email: z.email("올바른 이메일 형식이 아닙니다."),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다."),
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
