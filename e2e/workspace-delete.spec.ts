import { expect, test } from "@playwright/test";

test("OWNER creates then deletes a workspace via the re-type dialog", async ({ page }) => {
  const email = `e2e-ws-delete-${Date.now()}@example.com`;
  const workspaceName = `E2E Delete ${Date.now()}`;

  await page.goto("/signup");
  await page.getByLabel("이름").fill("E2E Delete");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill("password123");
  await page.getByRole("button", { name: "가입하기" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("button", { name: "워크스페이스 만들기" }).click();
  await page.getByLabel("이름").fill(workspaceName);
  await page.getByRole("button", { name: "만들기", exact: true }).click();
  await expect(page).toHaveURL(/\/w\/[^/]+$/);
  // D-14 placeholder — no sidebar, just name + empty state.
  await expect(page.getByRole("heading", { name: workspaceName })).toBeVisible();

  await page.goto("/dashboard");
  await expect(page.getByText(workspaceName)).toBeVisible();

  // Default workspace card (EDITOR-only, D-09) never exposes a delete affordance.
  await expect(page.getByRole("button", { name: "기본 워크스페이스 삭제" })).toHaveCount(0);

  await page.getByRole("button", { name: `${workspaceName} 삭제` }).click();
  const confirmButton = page.getByRole("button", { name: "삭제", exact: true });
  await expect(confirmButton).toBeDisabled();

  await page.getByLabel("워크스페이스 이름 확인").fill(workspaceName);
  await expect(confirmButton).toBeEnabled();
  await confirmButton.click();

  await expect(page.getByText(workspaceName, { exact: true })).not.toBeVisible();
});
