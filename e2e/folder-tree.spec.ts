import { expect, test, type Page } from "@playwright/test";
import { signUpAndLogin } from "./helpers";

// TDD RED (03-02 Task 1): the sidebar/create UI doesn't exist yet — fails until Task 2 lands.
// Pattern reused from e2e/workspace-create.spec.ts (signup → workspace flow).
async function signupAndOpenWorkspace(page: Page, seed: string) {
  const email = `e2e-folder-${seed}@example.com`;
  const workspaceName = `E2E Folder WS ${seed}`;

  await signUpAndLogin(page, email);

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
  // Named lookup (not a bare role="textbox" scope) — the sidebar also hosts SearchBox's
  // "문서 검색" input (06-03) in the same <nav>, which would otherwise strict-mode-collide here.
  const input = page.getByRole("textbox", { name: "이름 변경" });
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

async function createRootDocument(page: Page, title: string) {
  await page.getByRole("button", { name: "새 문서" }).click();
  await page.getByPlaceholder("새 문서").fill(title);
  await page.getByPlaceholder("새 문서").press("Enter");
  await expect(page).toHaveURL(/\/w\/[^/]+\/d\/[^/]+$/);
  await expect(page.getByText(title)).toBeVisible();
}

// 사이드바 전체 D&D 확장 — 문서도 드래그 소스가 된다(기존엔 폴더만). 폴더 DnD 테스트와
// 동일 패턴(dragTo), moveDocument API가 실제로 불려 트리가 재조회되는지까지 확인.
test("moves a document into a folder via drag and drop", async ({ page }) => {
  const seed = `${Date.now()}-doc-dnd`;
  const folderName = `E2E DocDnD Folder ${seed}`;
  const docTitle = `E2E DocDnD Doc ${seed}`;
  await signupAndOpenWorkspace(page, seed);
  await createRootFolder(page, folderName);
  await createRootDocument(page, docTitle);

  await page.getByText(docTitle).dragTo(page.getByText(folderName));

  await page.getByRole("button", { name: "펼치기" }).click();
  await expect(page.getByText(docTitle)).toBeVisible();
});

// 드래그 중에만 보이는 루트 드롭존 — 하위 폴더를 다시 워크스페이스 루트로 빼낸다.
test("moves a nested folder back to the workspace root via the root drop zone", async ({ page }) => {
  const seed = `${Date.now()}-root-drop`;
  const parentName = `E2E RootDrop Parent ${seed}`;
  const childName = `E2E RootDrop Child ${seed}`;
  await signupAndOpenWorkspace(page, seed);
  await createRootFolder(page, parentName);
  await page.getByText(parentName).click({ button: "right" });
  await page.getByRole("menuitem", { name: "새 하위 폴더" }).click();
  await page.getByPlaceholder("새 폴더").fill(childName);
  await page.getByPlaceholder("새 폴더").press("Enter");
  await expect(page.getByText(childName)).toBeVisible();

  await page.getByText(childName).dragTo(page.getByText("워크스페이스 루트로 이동"), { force: true });

  // 루트로 옮겨졌으면 부모를 접어도(또는 애초에 부모 아래가 아니라 트리 최상단에) 계속 보인다 —
  // 부모의 하위 항목이었다면 챕터가 다시 접혔을 때 사라졌을 것.
  await expect(page.getByText(childName)).toBeVisible();
});

// WorkspaceShell — 접기(폭 0, main이 공간을 넘겨받음) → 펼치기(마지막 폭 복원)가 왕복한다.
test("collapses and expands the sidebar via the toggle button", async ({ page }) => {
  const seed = `${Date.now()}-collapse`;
  const folderName = `E2E Collapse ${seed}`;
  await signupAndOpenWorkspace(page, seed);
  await createRootFolder(page, folderName);

  await expect(page.getByText(folderName)).toBeVisible();
  await page.getByRole("button", { name: "사이드바 숨기기" }).click();
  await expect(page.getByText(folderName)).toBeHidden();

  await page.getByRole("button", { name: "사이드바 보이기" }).click();
  await expect(page.getByText(folderName)).toBeVisible();
});

// WorkspaceShell — 핸들 드래그로 48~400px 범위 안에서 폭이 실제로 바뀐다.
test("resizes the sidebar by dragging the resize handle", async ({ page }) => {
  const seed = `${Date.now()}-resize`;
  await signupAndOpenWorkspace(page, seed);

  const sidebar = page.getByRole("navigation", { name: "폴더 트리" });
  const before = await sidebar.evaluate((el) => el.getBoundingClientRect().width);

  const handle = page.locator('[class*="WorkspaceShell_resizeHandle"]');
  const box = await handle.boundingBox();
  if (!box) throw new Error("resize handle not found");

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();

  const after = await sidebar.evaluate((el) => el.getBoundingClientRect().width);
  expect(after).toBeGreaterThan(before);
});

// WorkspaceShell MAX_WIDTH — 핸들을 아주 멀리 끌어도 400px에서 clamp된다(clampSidebarWidth).
test("clamps the sidebar width at 400px when dragged far past the max", async ({ page }) => {
  const seed = `${Date.now()}-max-clamp`;
  await signupAndOpenWorkspace(page, seed);

  const sidebar = page.getByRole("navigation", { name: "폴더 트리" });
  const handle = page.locator('[class*="WorkspaceShell_resizeHandle"]');
  const box = await handle.boundingBox();
  if (!box) throw new Error("resize handle not found");

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 2000, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();

  const width = await sidebar.evaluate((el) => el.getBoundingClientRect().width);
  expect(width).toBe(400);
});

// FolderTree.module.css @container 압축 모드 — 최소 폭(48px)까지 줄이면 폴더 이름 텍스트가
// 사라지고 아이콘만 남는다(.name/.kebab display:none, WorkspaceShell MIN_WIDTH와 짝).
test("collapses to icon-only when dragged down to the minimum width", async ({ page }) => {
  const seed = `${Date.now()}-icon-only`;
  const folderName = `E2E IconOnly ${seed}`;
  await signupAndOpenWorkspace(page, seed);
  await createRootFolder(page, folderName);

  const nameLabel = page.getByText(folderName);
  await expect(nameLabel).toBeVisible();

  const handle = page.locator('[class*="WorkspaceShell_resizeHandle"]');
  const box = await handle.boundingBox();
  if (!box) throw new Error("resize handle not found");

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 2000, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();

  const sidebar = page.getByRole("navigation", { name: "폴더 트리" });
  await expect(sidebar).toHaveCSS("width", "48px");
  await expect(nameLabel).toBeHidden();
  // 폴더 아이콘 자체는 계속 보인다 — 텍스트만 걷혔을 뿐 트리 자체가 사라진 게 아니다.
  await expect(page.locator(".lucide-folder").first()).toBeVisible();
});
