import { expect, test, type Page } from "@playwright/test";

// TDD RED (03-02 Task 1): the sidebar/create UI doesn't exist yet — fails until Task 2 lands.
// Pattern reused from e2e/workspace-create.spec.ts (signup → workspace flow).
async function signupAndOpenWorkspace(page: Page, seed: string) {
  const email = `e2e-folder-${seed}@example.com`;
  const workspaceName = `E2E Folder WS ${seed}`;

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
}

async function createRootFolder(page: Page, name: string) {
  await page.getByRole("button", { name: "새 폴더" }).click();
  await page.getByPlaceholder("새 폴더").fill(name);
  await page.getByPlaceholder("새 폴더").press("Enter");
  await expect(page.getByText(name)).toBeVisible();
}

test("creates a folder from the sidebar and it appears in the tree", async ({ page }) => {
  const seed = `${Date.now()}`;
  const folderName = `E2E Folder ${seed}`;
  await signupAndOpenWorkspace(page, seed);
  await createRootFolder(page, folderName);
});

// 03-05 Task 1 (RED): hierarchy — creating a child via the context menu ("새 하위 폴더")
// indents it under the parent and flips the chevron to the expanded ("접기") state.
test("shows a child folder indented under its parent, expanded via the chevron", async ({ page }) => {
  const seed = `${Date.now()}-nest`;
  const parentName = `E2E Parent ${seed}`;
  const childName = `E2E Child ${seed}`;
  await signupAndOpenWorkspace(page, seed);
  await createRootFolder(page, parentName);

  await page.getByText(parentName).click({ button: "right" });
  await page.getByRole("menuitem", { name: "새 하위 폴더" }).click();
  await page.getByPlaceholder("새 폴더").fill(childName);
  await page.getByPlaceholder("새 폴더").press("Enter");

  await expect(page.getByText(childName)).toBeVisible();
  await expect(page.getByRole("button", { name: "접기" })).toBeVisible();
});

// 03-05 Task 1 (RED): right-click and the hover kebab converge on the same context menu
// (UI-SPEC Interaction Contract).
test("opens the same context menu from right-click and the hover kebab button", async ({ page }) => {
  const seed = `${Date.now()}-menu`;
  const folderName = `E2E Menu ${seed}`;
  await signupAndOpenWorkspace(page, seed);
  await createRootFolder(page, folderName);

  await page.getByText(folderName).click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "이름 변경" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "이동..." })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "삭제" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menuitem", { name: "이름 변경" })).toHaveCount(0);

  await page.getByText(folderName).hover();
  await page.getByRole("button", { name: `${folderName} 메뉴` }).click();
  await expect(page.getByRole("menuitem", { name: "이름 변경" })).toBeVisible();
});

// 03-05 Task 1 (RED): inline rename — Enter commits after the server confirms, prefilled
// with the current name.
test("renames a folder inline after the server confirms", async ({ page }) => {
  const seed = `${Date.now()}-rename`;
  const folderName = `E2E Rename ${seed}`;
  const renamedName = `E2E Renamed ${seed}`;
  await signupAndOpenWorkspace(page, seed);
  await createRootFolder(page, folderName);

  await page.getByText(folderName).click({ button: "right" });
  await page.getByRole("menuitem", { name: "이름 변경" }).click();
  // Scoped to the sidebar — the page also hosts the CodeMirror editor, which exposes its
  // own role="textbox" contenteditable div (Phase 2 EditorPreviewLayout).
  const input = page.getByRole("navigation", { name: "폴더 트리" }).getByRole("textbox");
  await expect(input).toHaveValue(folderName);
  await input.fill(renamedName);
  await input.press("Enter");

  await expect(page.getByText(renamedName)).toBeVisible();
  await expect(page.getByText(folderName, { exact: true })).toHaveCount(0);
});

// 03-05 Task 1 (RED): native HTML5 DnD move — dropping folder A onto folder B moves A under B
// through the move API, then the tree re-fetches (RESEARCH Validation Architecture — dragTo).
test("moves a folder onto another folder via drag and drop", async ({ page }) => {
  const seed = `${Date.now()}-dnd`;
  const sourceName = `E2E Source ${seed}`;
  const targetName = `E2E Target ${seed}`;
  await signupAndOpenWorkspace(page, seed);
  await createRootFolder(page, sourceName);
  await createRootFolder(page, targetName);

  await page.getByText(sourceName).dragTo(page.getByText(targetName));

  await page.getByRole("button", { name: "펼치기" }).click();
  await expect(page.getByText(sourceName)).toBeVisible();
});

// 03-05 Task 1 (RED): delete requires confirmation, then the subtree disappears after the
// soft-delete API resolves (no optimistic UI).
test("deletes a folder after confirming and it disappears from the tree", async ({ page }) => {
  const seed = `${Date.now()}-delete`;
  const folderName = `E2E Delete ${seed}`;
  await signupAndOpenWorkspace(page, seed);
  await createRootFolder(page, folderName);

  await page.getByText(folderName).click({ button: "right" });
  await page.getByRole("menuitem", { name: "삭제" }).click();
  await expect(page.getByText("삭제할까요")).toBeVisible();
  await page.getByRole("button", { name: "삭제", exact: true }).click();

  await expect(page.getByText(folderName)).toHaveCount(0);
});
