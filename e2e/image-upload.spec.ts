import { expect, test, type Page } from "@playwright/test";
import { signUpAndLogin } from "./helpers";

// 툴바의 이미지 관련 버튼은 둘이고 역할이 완전히 다르다.
//   "이미지 삽입"            → 마크다운 문법 `![alt](url)`만 넣는 서식 버튼. 파일을 올리지 않는다
//   "클라우드에 이미지 업로드" → 파일을 R2로 올리고 그 URL을 본문에 넣는다
async function signupAndOpenDefaultWorkspace(page: Page, seed: string) {
  const email = `e2e-upload-${seed}@example.com`;

  await signUpAndLogin(page, email);

  await page.getByRole("link", { name: "기본 워크스페이스" }).click();
  await expect(page).toHaveURL(/\/w\/[^/]+$/);
}

async function createDocument(page: Page, title: string) {
  await page.getByRole("button", { name: "새 문서" }).click();
  await page.getByPlaceholder("새 문서").fill(title);
  await page.getByPlaceholder("새 문서").press("Enter");
  await expect(page).toHaveURL(/\/w\/[^/]+\/d\/[^/]+$/);
}

// 실제 매직바이트를 가진 최소 PNG — 서버가 바이트를 직접 스니핑하므로 가짜로는 통과하지 못한다.
const PNG_BUFFER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

test("이미지 삽입 버튼은 파일을 올리지 않고 마크다운 문법만 넣는다", async ({ page }) => {
  const seed = `${Date.now()}-syntax`;

  await signupAndOpenDefaultWorkspace(page, seed);
  await createDocument(page, `E2E Image Syntax ${seed}`);

  const editor = page.locator(".cm-content");
  await editor.click();

  await page.getByRole("button", { name: "이미지 삽입" }).click();

  // 링크 버튼과 같은 스켈레톤 삽입 — 파일 선택창도, 업로드 요청도 없다.
  await expect(editor).toContainText("![alt](url)");
  await expect(editor).not.toContainText("업로드 중...");

  // alt 자리가 선택돼 있어 바로 덮어쓸 수 있다(D-P2-09 Insert UX Contract).
  await page.keyboard.type("고양이");
  await expect(editor).toContainText("![고양이](url)");
});

test("클라우드 업로드 버튼이 이미지 삽입 버튼 옆에 있다", async ({ page }) => {
  const seed = `${Date.now()}-present`;

  await signupAndOpenDefaultWorkspace(page, seed);
  await createDocument(page, `E2E Cloud Button ${seed}`);

  await expect(page.getByRole("button", { name: "이미지 삽입" })).toBeVisible();
  await expect(page.getByRole("button", { name: "클라우드에 이미지 업로드" })).toBeVisible();
});

// R2 자격증명은 CI·로컬에 없으므로 업로드 성공 경로는 여기서 볼 수 없다 — 대신 "파일이 전용
// input으로 배선돼 있고, 실패하면 사용자에게 원인을 알리고 본문을 되돌린다"는 계약을 본다.
// 라우트의 인가·크기 가드는 tests/upload/rbac.test.ts가, 키 설계는 storage-r2.test.ts가 다룬다.
test("클라우드 업로드는 R2 미설정 시 원인을 알리고 본문을 되돌린다", async ({ page }) => {
  const seed = `${Date.now()}-r2`;

  await signupAndOpenDefaultWorkspace(page, seed);
  await createDocument(page, `E2E R2 ${seed}`);

  const editor = page.locator(".cm-content");
  await editor.click();

  await page.getByLabel("이미지 업로드 파일 선택").setInputFiles({
    name: "cloud.png",
    mimeType: "image/png",
    buffer: PNG_BUFFER,
  });

  await expect(page.getByText("클라우드 저장소가 설정되지 않았어요.")).toBeVisible({
    timeout: 10_000,
  });

  // 실패한 업로드가 플레이스홀더를 남겨 문서를 더럽히면 안 된다.
  await expect(editor).not.toContainText("업로드 중...");
});

test("업로드 중에는 두 번째 파일 선택을 무시한다 (Pitfall 2 가드)", async ({ page }) => {
  const seed = `${Date.now()}-concurrent`;

  await signupAndOpenDefaultWorkspace(page, seed);
  await createDocument(page, `E2E Upload Concurrent ${seed}`);

  const editor = page.locator(".cm-content");
  await editor.click();

  // 두 change 이벤트를 같은 틱에 동기로 쏜다 — Playwright 액션 두 번은 왕복 지연이 있어
  // 첫 업로드가 끝난 뒤 두 번째가 발사되므로 uploadingRef 가드를 실제로 경합시키지 못한다.
  await page.evaluate((pngBytes) => {
    const input = document.querySelector(
      'input[aria-label="이미지 업로드 파일 선택"]',
    ) as HTMLInputElement;
    function fire(name: string) {
      const dt = new DataTransfer();
      dt.items.add(new File([new Uint8Array(pngBytes)], name, { type: "image/png" }));
      input.files = dt.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    fire("first.png");
    fire("second.png");
  }, Array.from(PNG_BUFFER));

  // 두 번째가 무시됐다면 플레이스홀더도 배너도 하나뿐이다.
  await expect(page.getByText("클라우드 저장소가 설정되지 않았어요.")).toBeVisible({
    timeout: 10_000,
  });
  await expect(editor).not.toContainText("업로드 중...");
});
