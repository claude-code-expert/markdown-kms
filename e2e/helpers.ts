import { expect, type Page } from "@playwright/test";
import postgres from "postgres";

// e2e는 `pnpm dev`가 띄운 서버를 상대하므로 .env.local의 DATABASE_URL(테스트 DB가 아니라
// 개발 DB)을 그대로 본다. drizzle.config.ts와 같은 로더 패턴.
try {
  process.loadEnvFile(".env.local");
} catch {
  // 셸 env에 이미 있으면 그만
}

export const E2E_PASSWORD = "password123";

/**
 * 가입 → 이메일 인증 → 로그인까지 끝낸 계정으로 만든다.
 *
 * 인증 코드는 랜덤이고 DB에는 HMAC 해시만 남아 되찾을 수 없다. 그렇다고 코드를 응답에
 * 흘리는 테스트 전용 백도어를 프로덕션 라우트에 심는 건 그 자체가 취약점이라, 여기서는
 * DB의 email_verified를 직접 뒤집는다. 코드 검증 흐름 자체는 tests/auth/email-verification.
 * test.ts가 실제 라우트로 커버하고, UI 단계 전환은 e2e/signup.spec.ts가 본다.
 *
 * 덤으로 UI 왕복이 사라져 계정만 필요한 스펙들이 빨라진다.
 */
export async function signUpAndLogin(page: Page, email: string) {
  // page.request는 어느 Page에서나 꺼낼 수 있어 테스트마다 request fixture를 배선하지 않아도
  // 된다. 호출부 대부분이 fixture에 접근할 수 없는 로컬 setup 함수 안이라 이게 중요하다.
  const res = await page.request.post("/api/auth/signup", {
    data: { email, password: E2E_PASSWORD, name: "E2E User" },
  });
  expect(res.status()).toBe(200);

  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
  try {
    await sql`UPDATE "user" SET email_verified = true WHERE email = ${email}`;
  } finally {
    await sql.end();
  }

  await page.goto("/login");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
