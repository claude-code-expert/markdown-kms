import { expect, test } from "@playwright/test";
import { signUpAndLogin } from "./helpers";

test.describe("login", () => {
  test("logs in an existing user and lands on the dashboard", async ({ page }) => {
    const email = `e2e-login-${Date.now()}@example.com`;

    await signUpAndLogin(page, email);

    await page.goto("/login");
    await page.getByLabel("이메일").fill(email);
    await page.getByLabel("비밀번호").fill("password123");
    await page.getByRole("button", { name: "로그인", exact: true }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("shows the single generic error on a wrong password", async ({ page }) => {
    const email = `e2e-login-wrong-${Date.now()}@example.com`;

    await signUpAndLogin(page, email);

    await page.goto("/login");
    await page.getByLabel("이메일").fill(email);
    await page.getByLabel("비밀번호").fill("wrongpassword");
    await page.getByRole("button", { name: "로그인", exact: true }).click();

    await expect(page.getByText("이메일 또는 비밀번호가 올바르지 않습니다.")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });
});
