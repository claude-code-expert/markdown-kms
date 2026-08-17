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

// 04-03 Task 2: soft-delete via the tree's 1-item document menu ("삭제") — right-click and the
// hover kebab converge on the same menu (folder-tree.spec.ts precedent). Deleting the document
// that's currently open navigates away to the workspace's empty index (UI-SPEC Interaction
// Contract "문서 삭제").
test("deletes the open document via the tree menu, confirms, and navigates to the empty state", async ({ page }) => {
  const seed = `${Date.now()}-delete`;
  const docTitle = `E2E Delete Doc ${seed}`;

  await signupAndOpenWorkspace(page, seed);

  await page.getByRole("button", { name: "새 문서" }).click();
  await page.getByPlaceholder("새 문서").fill(docTitle);
  await page.getByPlaceholder("새 문서").press("Enter");
  await expect(page).toHaveURL(/\/w\/[^/]+\/d\/[^/]+$/);
  const workspaceUrl = page.url().replace(/\/d\/[^/]+$/, "");

  // The layout's tree is server-rendered (getWorkspaceDocuments) and router.refresh()'s RSC
  // re-fetch timing isn't guaranteed relative to the immediately-following router.push — a
  // hard reload (same /d/docId route, still "open") deterministically shows the new leaf.
  await page.reload();
  await page.getByText(docTitle).click({ button: "right" });
  // Document menu is 2 items (".md 내보내기" + "삭제") — no rename/move entries (unlike the
  // folder's 4-item menu). Stale assertion fixed: this was `toHaveCount(1)` from before EXP-01
  // (Phase 6) added the export entry to the same docMenuItems array (FolderTree.tsx).
  await expect(page.getByRole("menuitem")).toHaveCount(2);
  await page.getByRole("menuitem", { name: "삭제" }).click();
  await expect(page.getByText(`'${docTitle}' 문서를 삭제할까요?`)).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "삭제", exact: true }).click();

  // Currently-open document was the delete target — navigates back to the empty index.
  await expect(page).toHaveURL(`${workspaceUrl}`);
  await expect(page.getByText("문서를 선택해 주세요")).toBeVisible();
  await expect(page.getByText(docTitle)).toHaveCount(0);
});

// Manual save button (TagBar 우측, 50% 분할) — 새 문서(savedSeq=0)엔 "저장"만, 이미 저장된
// 문서를 다시 열면(page.tsx가 갱신된 savedSeq를 RSC로 재조회) "수정"+"삭제"로 전환된다.
// initialSeq는 DocumentWorkspace가 마운트 시 1회 읽는 prop이라 저장 직후에도 리로드 전까지는
// 여전히 "저장" — 이번 세션 내 즉시 전환이 아니라 다음 로드부터 "조회"로 넘어간다는 뜻.
test("shows 저장 only on a brand-new document, flips to 수정/삭제 after the first save is reloaded", async ({
  page,
}) => {
  const seed = `${Date.now()}-save-btn`;
  const docTitle = `E2E Save Btn Doc ${seed}`;
  const bodyText = `수동 저장 본문 ${seed}`;

  await signupAndOpenWorkspace(page, seed);

  await page.getByRole("button", { name: "새 문서" }).click();
  await page.getByPlaceholder("새 문서").fill(docTitle);
  await page.getByPlaceholder("새 문서").press("Enter");
  await expect(page).toHaveURL(/\/w\/[^/]+\/d\/[^/]+$/);

  // 새 문서 — 저장만, 수정/삭제는 아직 없다.
  await expect(page.getByRole("button", { name: "저장" })).toBeVisible();
  await expect(page.getByRole("button", { name: "수정" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "삭제", exact: true })).toHaveCount(0);

  const editor = page.locator(".cm-content");
  await editor.click();
  await editor.pressSequentially(bodyText);

  // Rename before saving — proves the left tree (server-rendered FolderTree) picks up the new
  // title via router.refresh() right after a successful manual save, no page reload needed.
  const renamedTitle = `${docTitle} (수정됨)`;
  await page.getByLabel("문서 제목").fill(renamedTitle);
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByText("저장됨")).toBeVisible({ timeout: 5000 });
  await expect(page.getByText(renamedTitle, { exact: true })).toBeVisible();

  // DB round-trip proof: reload discards all local React state, so a value that survives can
  // only have come from the server (RSC re-fetches via lib/documents.getDocument) — savedSeq는
  // 이제 0보다 커서 "조회" 버튼 세트로 전환된다.
  await page.reload();
  await expect(page.locator(".cm-content")).toContainText(bodyText);
  await expect(page.getByRole("button", { name: "저장" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "수정", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "삭제", exact: true })).toBeVisible();
});

// Document-view delete button (TagBar 우측) — a second entry point to the same
// DELETE /api/documents/:id route as the tree menu's "삭제" item above, for deleting without
// leaving the editor. "조회" 상태에서만 노출되므로 먼저 한 번 저장 + 리로드해 그 상태로 만든다.
test("deletes the open document via the document-view delete button", async ({ page }) => {
  const seed = `${Date.now()}-delete-btn`;
  const docTitle = `E2E Delete Btn Doc ${seed}`;

  await signupAndOpenWorkspace(page, seed);

  await page.getByRole("button", { name: "새 문서" }).click();
  await page.getByPlaceholder("새 문서").fill(docTitle);
  await page.getByPlaceholder("새 문서").press("Enter");
  await expect(page).toHaveURL(/\/w\/[^/]+\/d\/[^/]+$/);
  const workspaceUrl = page.url().replace(/\/d\/[^/]+$/, "");

  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByText("저장됨")).toBeVisible({ timeout: 5000 });
  await page.reload();

  await page.getByRole("button", { name: "삭제", exact: true }).click();
  await expect(page.getByText(`'${docTitle}' 문서를 삭제할까요?`)).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "삭제", exact: true }).click();

  await expect(page).toHaveURL(workspaceUrl);
  await expect(page.getByText("문서를 선택해 주세요")).toBeVisible();
});
