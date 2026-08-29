import { expect, test } from "@playwright/test";
import { signUpAndLogin } from "./helpers";

test("the session survives a browser reload after signup (AUTH-02)", async ({ page }) => {
  const email = `e2e-session-${Date.now()}@example.com`;

  await signUpAndLogin(page, email);

  await page.reload();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("기본 워크스페이스")).toBeVisible();
});
