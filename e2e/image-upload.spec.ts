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

// R2 자격증명 유무에 따라 도달 가능한 결말이 갈린다. 하나의 테스트에 두 결말을 or로 묶으면
// 어느 쪽도 제대로 검증하지 못하므로, 환경을 보고 각각의 계약을 따로 단언한다.
// helpers.ts가 .env.local을 이미 로드하므로 여기서 그대로 읽힌다.
const R2_CONFIGURED = Boolean(
  process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET,
);

async function pickFile(page: Page, name: string) {
  await page.getByLabel("이미지 업로드 파일 선택").setInputFiles({
    name,
    mimeType: "image/png",
    buffer: PNG_BUFFER,
  });
}

test.describe("클라우드 업로드 — R2 설정됨", () => {
  test.skip(!R2_CONFIGURED, "R2 환경변수 없음 (.env.local)");

  test("파일을 올리고 본문의 플레이스홀더를 실제 URL로 바꾼다", async ({ page }) => {
    const seed = `${Date.now()}-r2ok`;

    await signupAndOpenDefaultWorkspace(page, seed);
    await createDocument(page, `E2E R2 OK ${seed}`);

    const editor = page.locator(".cm-content");
    await editor.click();
    await pickFile(page, "cloud.png");

    // 워크스페이스 id가 키에 박힌 영구 경로 — 이게 조회 라우트의 권한 판정 근거다.
    await expect(editor).toContainText("](/api/uploads/r2/w/", { timeout: 15_000 });
    await expect(editor).toContainText("![cloud.png](/api/uploads/r2/w/");
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

    await expect(editor).toContainText("](/api/uploads/r2/w/", { timeout: 15_000 });
    await expect(editor).not.toContainText("업로드 중...");

    // 두 번째가 무시됐다면 이미지 마크다운은 하나뿐이다.
    const finalContent = await editor.textContent();
    expect(finalContent?.match(/!\[/g)?.length).toBe(1);
  });
});

test.describe("클라우드 업로드 — R2 미설정", () => {
  test.skip(R2_CONFIGURED, "R2가 설정된 환경");

  test("원인을 알리고 본문을 되돌린다", async ({ page }) => {
    const seed = `${Date.now()}-r2off`;

    await signupAndOpenDefaultWorkspace(page, seed);
    await createDocument(page, `E2E R2 OFF ${seed}`);

    const editor = page.locator(".cm-content");
    await editor.click();
    await pickFile(page, "cloud.png");

    await expect(page.getByText("클라우드 저장소가 설정되지 않았어요.")).toBeVisible({
      timeout: 10_000,
    });

    // 실패한 업로드가 플레이스홀더를 남겨 문서를 더럽히면 안 된다.
    await expect(editor).not.toContainText("업로드 중...");
  });
});
