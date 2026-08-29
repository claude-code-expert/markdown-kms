import { expect, test, type Page } from "@playwright/test";
import { signUpAndLogin } from "./helpers";

// 05-01 TRACER e2e: the phase's single end-to-end proof for image upload — toolbar image
// button -> hidden file input -> placeholder insert -> server-validated POST /api/uploads ->
// URL substitution at the placeholder's position. Reuses e2e/document-workspace.spec.ts's
// signup+workspace helper pattern (same default-workspace flow as e2e/document-trash.spec.ts,
// which is EDITOR — sufficient for this route's EDITOR+ gate).
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

// A minimal valid 1x1 PNG (real magic bytes) so storage.saveUpload's server-side sniff accepts
// it — this is the tracer's actual proof surface, not a mocked upload.
const PNG_BUFFER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

test("uploads an image via the toolbar button and inserts the markdown at the caret", async ({ page }) => {
  const seed = `${Date.now()}`;
  const docTitle = `E2E Upload Doc ${seed}`;

  await signupAndOpenDefaultWorkspace(page, seed);
  await createDocument(page, docTitle);

  const editor = page.locator(".cm-content");
  await editor.click();

  await page.getByRole("button", { name: "이미지 삽입" }).click();
  // R2 업로드 버튼이 두 번째 file input을 추가했으므로 셀렉터를 특정한다. exact:true가
  // 필요한 이유는 getByLabel이 기본 부분일치라 "클라우드 이미지 파일 선택"까지 잡기 때문이다.
  await page.getByLabel("이미지 파일 선택", { exact: true }).setInputFiles({
    name: "photo.png",
    mimeType: "image/png",
    buffer: PNG_BUFFER,
  });

  // Placeholder appears immediately (synchronous dispatch), then gets replaced by the real
  // markdown once POST /api/uploads resolves.
  await expect(editor).toContainText("![업로드 중...]()");
  await expect(editor).toContainText("](/uploads/", { timeout: 10_000 });
  await expect(editor).not.toContainText("업로드 중...");
  await expect(editor).toContainText("![photo.png](/uploads/");
});

test("ignores a second file selection while an upload is already in flight (Pitfall 2 guard)", async ({ page }) => {
  const seed = `${Date.now()}-concurrent`;
  const docTitle = `E2E Upload Concurrent ${seed}`;

  await signupAndOpenDefaultWorkspace(page, seed);
  await createDocument(page, docTitle);

  const editor = page.locator(".cm-content");
  await editor.click();
  await page.getByRole("button", { name: "이미지 삽입" }).click();

  // Two `change` events dispatched synchronously in the SAME page-context tick (not two
  // separate Playwright actions, which have enough round-trip latency for the first upload's
  // localhost fetch to finish before the second fires) — this is what actually races
  // useImageUpload's uploadingRef guard instead of just proving two sequential uploads work.
  await page.evaluate((pngBytes) => {
    // 로컬 디스크 업로드용 input. R2용 input이 나란히 있으므로 aria-label로 특정한다.
    const input = document.querySelector(
      'input[aria-label="이미지 파일 선택"]',
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

  await expect(editor).toContainText("](/uploads/", { timeout: 10_000 });

  const finalContent = await editor.textContent();
  expect(finalContent?.match(/!\[/g)?.length).toBe(1);
});

// R2 업로드 버튼. R2 자격증명은 CI·로컬에 없으므로 성공 경로는 여기서 볼 수 없다 — 대신
// "버튼이 존재하고, 전용 input으로 배선돼 있고, 설정이 없을 때 사용자에게 원인을 알린다"는
// 계약을 검증한다. 키 설계와 권한 파생은 tests/upload/storage-r2.test.ts가 다룬다.
test("클라우드 업로드 버튼은 R2 미설정 시 원인을 알리고 본문을 되돌린다", async ({ page }) => {
  const seed = `${Date.now()}-r2`;
  const docTitle = `E2E R2 ${seed}`;

  await signupAndOpenDefaultWorkspace(page, seed);
  await createDocument(page, docTitle);

  const editor = page.locator(".cm-content");
  await editor.click();

  await expect(page.getByRole("button", { name: "클라우드에 이미지 업로드" })).toBeVisible();

  await page.getByLabel("클라우드 이미지 파일 선택").setInputFiles({
    name: "cloud.png",
    mimeType: "image/png",
    buffer: PNG_BUFFER,
  });

  // 라우트가 503 + 한국어 사유를 주고, 훅이 그 문구를 그대로 배너에 띄운다.
  await expect(page.getByText("클라우드 저장소가 설정되지 않았어요.")).toBeVisible({
    timeout: 10_000,
  });

  // 실패했으면 플레이스홀더가 남아 문서를 더럽히면 안 된다.
  await expect(editor).not.toContainText("업로드 중...");
});
