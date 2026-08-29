import { expect, test } from "@playwright/test";
import { signUpAndLogin } from "./helpers";

test("OWNER creates then deletes a workspace via the re-type dialog", async ({ page }) => {
  const email = `e2e-ws-delete-${Date.now()}@example.com`;
  const workspaceName = `E2E Delete ${Date.now()}`;

  await signUpAndLogin(page, email);

  await page.getByRole("button", { name: "워크스페이스 만들기" }).click();
  await page.getByLabel("이름").fill(workspaceName);
  await page.getByRole("button", { name: "만들기", exact: true }).click();
  await expect(page).toHaveURL(/\/w\/[^/]+$/);
  // 04-02 route split — /w/[wsId] index is now the no-document-open EmptyState (workspace
  // name itself isn't rendered here anymore; the dashboard check below covers that).
  await expect(page.getByText("문서를 선택해 주세요")).toBeVisible();

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
