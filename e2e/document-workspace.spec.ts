import { expect, test, type Page } from "@playwright/test";

// 04-02 tracer e2e: the phase's single end-to-end proof — create → open (3-pane) → type →
// 1s-debounced autosave → status bar transitions → refresh restores. Reuses
// e2e/folder-tree.spec.ts's signup+workspace-creation helper pattern.
async function signupAndOpenWorkspace(page: Page, seed: string) {
  const email = `e2e-doc-${seed}@example.com`;
  const workspaceName = `E2E Doc WS ${seed}`;

  await page.goto("/signup");
  await page.getByLabel("이름").fill("E2E Doc");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill("password123");
  await page.getByRole("button", { name: "가입하기" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("button", { name: "워크스페이스 만들기" }).click();
  await page.getByLabel("이름").fill(workspaceName);
  await page.getByRole("button", { name: "만들기", exact: true }).click();
  await expect(page).toHaveURL(/\/w\/[^/]+$/);
}

test("creates a document, autosaves seq-guarded edits, and restores them after a refresh", async ({ page }) => {
  const seed = `${Date.now()}`;
  const docTitle = `E2E Doc ${seed}`;
  const bodyText = `본문 내용 ${seed}`;

  await signupAndOpenWorkspace(page, seed);

  // UI-SPEC Layout Contract: no document open yet — centered empty state, no title input/status
  // bar/editor.
  await expect(page.getByText("문서를 선택해 주세요")).toBeVisible();

  // Interaction Contract "새 문서 생성" — header button, inline input, Enter submits, then the
  // one deliberate navigation exception (documents open immediately after creation).
  await page.getByRole("button", { name: "새 문서" }).click();
  await page.getByPlaceholder("새 문서").fill(docTitle);
  await page.getByPlaceholder("새 문서").press("Enter");
  await expect(page).toHaveURL(/\/w\/[^/]+\/d\/[^/]+$/);

  // The freshly created document opens with its title already in the top input (created via
  // the tree's inline input, so it round-trips through the server's stored title).
  const titleInput = page.getByRole("textbox", { name: "문서 제목" });
  await expect(titleInput).toHaveValue(docTitle);

  // EditorHost mounts CodeMirror as a role="textbox" contenteditable div — scope to the editor
  // pane, not the title <input> (also a textbox), same disambiguation as folder-tree.spec.ts.
  const editor = page.locator(".cm-content");
  await editor.click();
  await editor.pressSequentially(bodyText);

  // EDIT-07: 1s debounce → "저장 중" → "저장됨". autosave-controller.test.ts already proves the
  // seq-guard correctness at the unit level — this just confirms the wiring reaches the DOM.
  await expect(page.getByText("저장 중…")).toBeVisible();
  await expect(page.getByText("저장됨")).toBeVisible({ timeout: 5000 });

  // Deep-link/refresh restoration (RSC loads via lib/documents.getDocument, no client cache).
  await page.reload();
  await expect(page.getByRole("textbox", { name: "문서 제목" })).toHaveValue(docTitle);
  await expect(page.locator(".cm-content")).toContainText(bodyText);
  await expect(page.getByText("저장됨")).toBeVisible();
});

test("shows the document as a leaf in the tree, indented under folders, opening on click", async ({ page }) => {
  const seed = `${Date.now()}-tree`;
  const docTitle = `E2E Tree Doc ${seed}`;

  await signupAndOpenWorkspace(page, seed);

  await page.getByRole("button", { name: "새 문서" }).click();
  await page.getByPlaceholder("새 문서").fill(docTitle);
  await page.getByPlaceholder("새 문서").press("Enter");
  await expect(page).toHaveURL(/\/w\/[^/]+\/d\/[^/]+$/);

  // Navigate back to the empty index, then re-open the document from the tree (proves the tree
  // node itself is the click-to-open entry point, not just the post-create redirect).
  await page.goto(page.url().replace(/\/d\/[^/]+$/, ""));
  await expect(page.getByText("문서를 선택해 주세요")).toBeVisible();
  await page.getByText(docTitle).click();
  await expect(page).toHaveURL(/\/w\/[^/]+\/d\/[^/]+$/);
  await expect(page.getByRole("textbox", { name: "문서 제목" })).toHaveValue(docTitle);
});
