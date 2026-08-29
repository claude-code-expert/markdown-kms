import { expect, test } from "@playwright/test";

// 코드가 맞았을 때의 해피패스는 여기서 볼 수 없다 — 코드는 랜덤이고 DB엔 HMAC 해시만 남아
// 브라우저에서 알아낼 방법이 없다. 그 경로는 tests/auth/email-verification.test.ts가 mailer를
// mock해 평문 코드를 가로채는 방식으로 실제 라우트에 대고 검증한다. 여기서는 UI 계약만 본다.
test.describe("signup", () => {
  test("moves to the verification step instead of logging in immediately", async ({ page }) => {
    const email = `e2e-signup-${Date.now()}@example.com`;

    await page.goto("/signup");
    await page.getByLabel("이름").fill("E2E Signup");
    await page.getByLabel("이메일").fill(email);
    await page.getByLabel("비밀번호").fill("password123");
    await page.getByRole("button", { name: "가입하기" }).click();

    // 인증 전에 세션이 생기면 인증 단계 자체가 무의미해진다.
    await expect(page.getByLabel("인증 코드")).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
    await expect(page).toHaveURL(/\/signup$/);
  });

  test("rejects a wrong verification code and stays on the step", async ({ page }) => {
    const email = `e2e-signup-wrong-${Date.now()}@example.com`;

    await page.goto("/signup");
    await page.getByLabel("이름").fill("E2E Wrong Code");
    await page.getByLabel("이메일").fill(email);
    await page.getByLabel("비밀번호").fill("password123");
    await page.getByRole("button", { name: "가입하기" }).click();

    await page.getByLabel("인증 코드").fill("000000");
    await page.getByRole("button", { name: "인증하고 시작하기" }).click();

    await expect(page.getByText("인증 코드가 올바르지 않습니다.")).toBeVisible();
    await expect(page).toHaveURL(/\/signup$/);
  });
});
