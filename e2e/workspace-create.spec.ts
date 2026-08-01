import { expect, test } from "@playwright/test";

test("creates a workspace via the modal and it reappears on the dashboard", async ({ page }) => {
  const email = `e2e-ws-create-${Date.now()}@example.com`;
  const workspaceName = `E2E Workspace ${Date.now()}`;

  await page.goto("/signup");
  await page.getByLabel("이름").fill("E2E Create");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill("password123");
  await page.getByRole("button", { name: "가입하기" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("button", { name: "워크스페이스 만들기" }).click();
  await page.getByLabel("이름").fill(workspaceName);
  await page.getByRole("button", { name: "만들기", exact: true }).click();

  // D-14: navigates to the new workspace's placeholder screen.
  await expect(page).toHaveURL(/\/w\/[^/]+$/);

  await page.goto("/dashboard");
  await expect(page.getByText(workspaceName)).toBeVisible();
});
