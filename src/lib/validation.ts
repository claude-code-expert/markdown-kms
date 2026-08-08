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

// TRD §3 title 컬럼 기본값과 동형('제목 없음' — DB 기본값, 빈 문자열은 여전히 허용해 UI-SPEC의
// placeholder 동작에 맡긴다). WR-01: 길이 초과는 더 이상 catch("")로 조용히 삼키지 않는다 —
// .max()가 그대로 검증 에러를 던져 safeParse가 실패하고 라우트가 400을 낸다(folderSchema와 동형).
// "빈 값 허용"과 "초과 값을 빈 값으로 뭉개기"는 다른 요구사항이므로 분리한다. content는 trim
// 없음 — CodeMirror 원문 그대로(개행/공백이 마크다운 의미를 가짐, NFR-5.2).
export const documentSchema = z.object({
  title: z.string().trim().max(255, "제목은 255자를 넘을 수 없습니다."),
  content: z.string(),
});

export type DocumentInput = z.infer<typeof documentSchema>;

// PUT 자동저장 body 전용(TRD §7) — seq는 클라 세션 단조증가 정수.
export const autosaveBodySchema = documentSchema.extend({
  seq: z.number().int().nonnegative(),
});

export type AutosaveBodyInput = z.infer<typeof autosaveBodySchema>;

// PUT 임시저장 body 전용(TRD §7) — content만, seq 없음(draft는 순서 가드 불필요, 1분 주기 upsert).
// content는 trim 없음 — documentSchema 규칙 승계(CodeMirror 원문 그대로, NFR-5.2).
export const draftBodySchema = z.object({
  content: z.string(),
});

export type DraftBodyInput = z.infer<typeof draftBodySchema>;
