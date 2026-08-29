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
  await page.locator('input[type="file"]').setInputFiles({
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
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
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
