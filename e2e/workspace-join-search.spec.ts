import { expect, test, type Page } from "@playwright/test";

// WS-03 개정 — 워크스페이스 ID 직접 입력 대신 이름 검색 → 결과 목록에서 신청하는 플로우.
// folder-tree.spec.ts의 signupAndOpenWorkspace 패턴 재사용, label로 계정을 구분한다.
async function signupAndOpenWorkspace(page: Page, seed: string, label: string) {
  const email = `e2e-join-${label}-${seed}@example.com`;
  const workspaceName = `E2E Join WS ${label} ${seed}`;

  await page.goto("/signup");
  await page.getByLabel("이름").fill(`E2E Join ${label}`);
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill("password123");
  await page.getByRole("button", { name: "가입하기" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("button", { name: "워크스페이스 만들기" }).click();
  await page.getByLabel("이름").fill(workspaceName);
  await page.getByRole("button", { name: "만들기", exact: true }).click();
  await expect(page).toHaveURL(/\/w\/[^/]+$/);

  return workspaceName;
}

test("searches a workspace by name and submits a join request from the dashboard", async ({ page, browser }) => {
  const seed = `${Date.now()}`;

  // 대상 워크스페이스는 다른 계정(B) 소유 -- A는 아직 멤버가 아니어야 "신청" 버튼이 활성화된다.
  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  const targetName = await signupAndOpenWorkspace(ownerPage, seed, "owner");
  await ownerContext.close();

  await page.goto("/signup");
  await page.getByLabel("이름").fill("E2E Join Applicant");
  await page.getByLabel("이메일").fill(`e2e-join-applicant-${seed}@example.com`);
  await page.getByLabel("비밀번호").fill("password123");
  await page.getByRole("button", { name: "가입하기" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("textbox", { name: "워크스페이스 검색" }).fill(targetName);
  const row = page.locator("li").filter({ hasText: targetName });
  await expect(row).toBeVisible();

  await row.getByRole("button").click();
  await expect(page.getByText("참여 신청을 보냈어요. 관리자 승인을 기다려 주세요.")).toBeVisible();
  await expect(row.getByRole("button", { name: "신청됨" })).toBeDisabled();
});

test("shows the searcher's own workspace as already a member (disabled)", async ({ page }) => {
  const seed = `${Date.now()}-self`;
  const ownName = await signupAndOpenWorkspace(page, seed, "self");

  await page.goto("/dashboard");
  await page.getByRole("textbox", { name: "워크스페이스 검색" }).fill(ownName);
  const row = page.locator("li").filter({ hasText: ownName });
  await expect(row.getByRole("button", { name: "이미 멤버예요" })).toBeDisabled();
});

test("shows a no-results message for a name that matches nothing", async ({ page }) => {
  const seed = `${Date.now()}-empty`;
  await signupAndOpenWorkspace(page, seed, "empty");

  await page.goto("/dashboard");
  const nonsense = `zzz-no-such-workspace-${seed}`;
  await page.getByRole("textbox", { name: "워크스페이스 검색" }).fill(nonsense);
  await expect(page.getByText(`'${nonsense}'에 대한 검색 결과가 없어요`)).toBeVisible();
});
