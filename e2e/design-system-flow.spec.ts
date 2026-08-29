import { expect, test, type Page } from "@playwright/test";
import { signUpAndLogin } from "./helpers";

// Phase 9 마감 플랜(09-04): 랜딩(로그인/회원가입)·워크스페이스 메인·에디터 3개 화면이 모두
// 리스킨된 뒤, 로그인부터 문서 CRUD까지 전체 사용자 여정을 새 UI에서 단일 e2e로 회귀
// 검증한다(ROADMAP Phase 9 성공기준 4). spec-less 프로브의 6개 unresolved 요구
// (AUTH-01/02, WS-01/02, DOC-01/02)를 이 단일 경로에서 최종 재확인한다.
//
// 헬퍼는 기존 스펙(document-workspace.spec.ts의 signupAndOpenWorkspace, folder-tree.spec.ts의
// createRootFolder, document-trash.spec.ts의 trashRow)과 동일한 셀렉터 관례를 재사용한다 —
// 09-01/09-02/09-03이 CSS-only 리스킨이라 .tsx 마크업(role/label/placeholder)이 무변경이므로
// 셀렉터를 새로 맞출 필요가 없었다.

async function signupAndCreateWorkspace(page: Page, seed: string) {
  const email = `e2e-design-flow-${seed}@example.com`;
  const workspaceName = `E2E 디자인 플로우 WS ${seed}`;

  // AUTH-01: 가입 즉시 로그인 (랜딩 리스킨 후 회귀 확인 — 09-01)
  await signUpAndLogin(page, email);

  // WS-02: 워크스페이스 생성(생성자=OWNER) — 워크스페이스 메인 리스킨 후 회귀 확인 (09-02)
  await page.getByRole("button", { name: "워크스페이스 만들기" }).click();
  await page.getByLabel("이름").fill(workspaceName);
  await page.getByRole("button", { name: "만들기", exact: true }).click();
  await expect(page).toHaveURL(/\/w\/[^/]+$/);
}

function trashRow(page: Page, title: string) {
  return page.locator('[class*="TrashList_row"]').filter({ hasText: title });
}

test("로그인 → 워크스페이스 생성 → 폴더 생성 → 문서 생성/수정/삭제 → 휴지통까지 전체 플로우가 새 UI에서 회귀 없이 통과한다", async ({
  page,
}) => {
  const seed = `${Date.now()}`;
  const folderName = `E2E 폴더 ${seed}`;
  const docTitle = `E2E 문서 ${seed}`;
  const bodyText = `본문 내용 ${seed}`;

  await signupAndCreateWorkspace(page, seed);
  const workspaceUrl = page.url();

  // WS-01: 폴더 생성 (에디터 사이드바 리스킨 후 회귀 확인 — 09-03)
  await page.getByRole("button", { name: "새 폴더" }).click();
  await page.getByPlaceholder("새 폴더").fill(folderName);
  await page.getByPlaceholder("새 폴더").press("Enter");
  await expect(page.getByText(folderName)).toBeVisible();

  // DOC-01: 문서 생성
  await page.getByRole("button", { name: "새 문서" }).click();
  await page.getByPlaceholder("새 문서").fill(docTitle);
  await page.getByPlaceholder("새 문서").press("Enter");
  await expect(page).toHaveURL(/\/w\/[^/]+\/d\/[^/]+$/);
  await expect(page.getByRole("textbox", { name: "문서 제목" })).toHaveValue(docTitle);

  // DOC-01: 문서 수정 — EDIT-07 자동저장 seq-guard가 리스킨 후에도 "저장 중" -> "저장됨"으로 배선됨
  const editor = page.locator(".cm-content");
  await editor.click();
  await editor.pressSequentially(bodyText);
  await expect(page.getByText("저장 중…")).toBeVisible();
  await expect(page.getByText("저장됨")).toBeVisible({ timeout: 5000 });

  // DOC-02: 문서 소프트 삭제 (트리 메뉴 경로)
  await page.reload();
  await page.getByText(docTitle).click({ button: "right" });
  await page.getByRole("menuitem", { name: "삭제" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "삭제", exact: true }).click();
  await expect(page).toHaveURL(workspaceUrl);
  await expect(page.getByText("문서를 선택해 주세요")).toBeVisible();

  // DOC-02: 휴지통 확인 — 소프트 삭제된 문서가 휴지통에 노출됨
  await page.getByRole("link", { name: "휴지통" }).click();
  await expect(page).toHaveURL(`${workspaceUrl}/trash`);
  await expect(trashRow(page, docTitle)).toBeVisible();
});
