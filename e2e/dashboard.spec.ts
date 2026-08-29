import { expect, test } from "@playwright/test";
import { signUpAndLogin } from "./helpers";

test("shows the default workspace card after signup", async ({ page }) => {
  const email = `e2e-dashboard-${Date.now()}@example.com`;

  await signUpAndLogin(page, email);
  await expect(page.getByText("기본 워크스페이스")).toBeVisible();
});
