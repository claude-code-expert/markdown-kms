import { expect, test } from "@playwright/test";

test("signing up logs the user in and lands on the dashboard showing the default workspace", async ({
  page,
}) => {
  const email = `e2e-signup-${Date.now()}@example.com`;

  await page.goto("/signup");
  await page.getByLabel("이름").fill("E2E Signup");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill("password123");
  await page.getByRole("button", { name: "가입하기" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("기본 워크스페이스")).toBeVisible();
});
