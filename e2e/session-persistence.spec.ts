import { expect, test } from "@playwright/test";

test("the session survives a browser reload after signup (AUTH-02)", async ({ page }) => {
  const email = `e2e-session-${Date.now()}@example.com`;

  await page.goto("/signup");
  await page.getByLabel("이름").fill("E2E Session");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill("password123");
  await page.getByRole("button", { name: "가입하기" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);

  await page.reload();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("기본 워크스페이스")).toBeVisible();
});
