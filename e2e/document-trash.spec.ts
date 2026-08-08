import { expect, test, type Page } from "@playwright/test";

// 04-05 Task 3 e2e coverage split (see 04-05-PLAN.md action note): a fresh signup joins the
// seeded default workspace ("기본 워크스페이스") as EDITOR (signup/route.ts), not OWNER/ADMIN —
// unlike e2e/folder-tree.spec.ts and e2e/document-workspace.spec.ts, which create a brand-new
// workspace (making the creator OWNER). Using the default workspace here is deliberate: it's
// what lets this file prove the "완전 삭제" ADMIN-gating (disabled+hint, not hidden) without a
// separate role seed. The full round trip (delete → trash → restore → tree) and the EDITOR
// permanent-delete gate are both covered automatically here; the actual physical deletion by an
// ADMIN is already covered by 04-04's tests/trash/permanent-delete.test.ts (lib-level) and
// tests/trash/rbac.test.ts (route-level ADMIN check) — not re-proven at the e2e layer.
async function signupAndOpenDefaultWorkspace(page: Page, seed: string) {
  const email = `e2e-trash-${seed}@example.com`;

  await page.goto("/signup");
  await page.getByLabel("이름").fill("E2E Trash");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill("password123");
  await page.getByRole("button", { name: "가입하기" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("link", { name: "기본 워크스페이스" }).click();
  await expect(page).toHaveURL(/\/w\/[^/]+$/);
}

async function createDocument(page: Page, title: string) {
  await page.getByRole("button", { name: "새 문서" }).click();
  await page.getByPlaceholder("새 문서").fill(title);
  await page.getByPlaceholder("새 문서").press("Enter");
  await expect(page).toHaveURL(/\/w\/[^/]+\/d\/[^/]+$/);
}

async function deleteDocumentFromTree(page: Page, title: string) {
  // Tree is server-rendered; reload so the just-created leaf is present before right-clicking it
  // (same convention as e2e/document-workspace.spec.ts's delete test).
  await page.reload();
  await page.getByText(title).click({ button: "right" });
  await page.getByRole("menuitem", { name: "삭제" }).click();
  await page.getByRole("button", { name: "삭제", exact: true }).click();
}

// The seeded default workspace is shared across every signup (D-08) — trash items from other
// e2e runs/users can already be sitting in it, so every check below is scoped to this test's
// own row (matched by its unique seeded title) rather than assuming an otherwise-empty list.
function trashRow(page: Page, title: string) {
  return page.locator('[class*="TrashList_row"]').filter({ hasText: title });
}

test("deletes a document, restores it from the trash, and it reappears in the tree", async ({ page }) => {
  const seed = `${Date.now()}-roundtrip`;
  const docTitle = `E2E Trash Doc ${seed}`;

  await signupAndOpenDefaultWorkspace(page, seed);
  const workspaceUrl = page.url();

  await createDocument(page, docTitle);
  await deleteDocumentFromTree(page, docTitle);
  await expect(page.getByText("문서를 선택해 주세요")).toBeVisible();

  await page.getByRole("link", { name: "휴지통" }).click();
  await expect(page).toHaveURL(`${workspaceUrl}/trash`);
  const row = trashRow(page, docTitle);
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: "복원" }).click();
  await expect(row).toHaveCount(0);

  await page.goto(workspaceUrl);
  await expect(page.getByText(docTitle)).toBeVisible();
});

// UI-SPEC Trash Contract "권한 게이팅" — an EDITOR (the default workspace's role) sees "완전
// 삭제" disabled with an explanatory hint, never hidden (CLAUDE.md "UI 버튼 숨김은 보안이
// 아니다"); "복원" stays enabled since EDITOR+ can restore.
test("shows the permanent-delete button gated (disabled + hint) for an EDITOR, restore stays enabled", async ({
  page,
}) => {
  const seed = `${Date.now()}-gate`;
  const docTitle = `E2E Gate Doc ${seed}`;

  await signupAndOpenDefaultWorkspace(page, seed);
  await createDocument(page, docTitle);
  await deleteDocumentFromTree(page, docTitle);

  await page.getByRole("link", { name: "휴지통" }).click();
  const row = trashRow(page, docTitle);
  await expect(row).toBeVisible();

  await expect(row.getByRole("button", { name: "완전 삭제" })).toBeDisabled();
  await expect(row.getByText("관리자만 완전 삭제할 수 있어요.")).toBeVisible();
  await expect(row.getByRole("button", { name: "복원" })).toBeEnabled();
});
