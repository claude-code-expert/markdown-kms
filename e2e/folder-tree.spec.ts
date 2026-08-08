import { expect, test } from "@playwright/test";

// TDD RED (03-02 Task 1): the sidebar/create UI doesn't exist yet — fails until Task 2 lands.
// Pattern reused from e2e/workspace-create.spec.ts (signup → workspace flow).
test("creates a folder from the sidebar and it appears in the tree", async ({ page }) => {
  const email = `e2e-folder-${Date.now()}@example.com`;
  const workspaceName = `E2E Folder WS ${Date.now()}`;
  const folderName = `E2E Folder ${Date.now()}`;

  await page.goto("/signup");
  await page.getByLabel("이름").fill("E2E Folder");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill("password123");
  await page.getByRole("button", { name: "가입하기" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("button", { name: "워크스페이스 만들기" }).click();
  await page.getByLabel("이름").fill(workspaceName);
  await page.getByRole("button", { name: "만들기", exact: true }).click();
  await expect(page).toHaveURL(/\/w\/[^/]+$/);

  await page.getByRole("button", { name: "새 폴더" }).click();
  await page.getByPlaceholder("새 폴더").fill(folderName);
  await page.getByPlaceholder("새 폴더").press("Enter");

  await expect(page.getByText(folderName)).toBeVisible();
});
