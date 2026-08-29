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

// TRD §9.1. 이메일은 signupSchema와 같은 정규화(trim→lowercase)를 거쳐야 저장된 값과 매칭된다.
// 코드는 자릿수까지 서버에서 막는다 — 형식이 틀린 입력에 DB·HMAC 비용을 쓰지 않는다.
export const verifyEmailSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("올바른 이메일 형식이 아닙니다.")),
  code: z.string().trim().regex(/^\d{6}$/, "인증 코드는 6자리 숫자입니다."),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const resendCodeSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("올바른 이메일 형식이 아닙니다.")),
});

export type ResendCodeInput = z.infer<typeof resendCodeSchema>;

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

// DOC-04: pg_trgm GIN 인덱스(document.title/content)는 plain 컬럼 위에 있다(함수형 인덱스 아님,
// TRD §3 리터럴 SQL). 한국어 NFC/NFD 코드포인트 불일치를 인덱스 모양 변경 없이 해소하는 유일한
// 경로가 "저장 시점에 항상 NFC로 컬럼을 채우는 것"이다(06-RESEARCH Pattern 2). normalizeEmail과
// 같은 순수 헬퍼 관례.
export function normalizeNFC(text: string): string {
  return text.normalize("NFC");
}

// TRD §3 title 컬럼 기본값과 동형('제목 없음' — DB 기본값, 빈 문자열은 여전히 허용해 UI-SPEC의
// placeholder 동작에 맡긴다). WR-01: 길이 초과는 더 이상 catch("")로 조용히 삼키지 않는다 —
// .max()가 그대로 검증 에러를 던져 safeParse가 실패하고 라우트가 400을 낸다(folderSchema와 동형).
// "빈 값 허용"과 "초과 값을 빈 값으로 뭉개기"는 다른 요구사항이므로 분리한다. content는 trim
// 없음 — CodeMirror 원문 그대로(개행/공백이 마크다운 의미를 가짐, NFR-5.2). normalizeNFC는 trim이
// 아니다(공백 보존) — content에 .trim()을 절대 추가하지 않는다(06-RESEARCH Anti-Pattern).
export const documentSchema = z.object({
  title: z.string().trim().max(255, "제목은 255자를 넘을 수 없습니다.").transform(normalizeNFC),
  content: z.string().transform(normalizeNFC),
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

// DOC-03: PUT /api/documents/:id/tags body 전용. 클라 계약(빠른 실패용) — 서버 최종 권위는
// 06-02의 replaceTags COUNT 검증(트랜잭션 내, 이 스키마를 우회한 직접 API 호출도 방어).
export const tagsBodySchema = z.object({
  tags: z.array(z.string().trim().min(1, "태그를 입력해 주세요.")).max(3, "태그는 최대 3개까지 저장할 수 있습니다."),
});

export type TagsBodyInput = z.infer<typeof tagsBodySchema>;
