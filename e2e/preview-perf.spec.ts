import { expect, test, type Page } from "@playwright/test";
import { signUpAndLogin } from "./helpers";

// EDIT-06 / TRD §5: keystroke -> sanitized preview mutation must stay p95 <= 60ms for a
// 10,000-code-unit document. RESEARCH Common Pitfalls #4 + Open Question #4: no
// off-the-shelf Playwright recipe exists for this measurement, so the harness below is a
// purpose-built construction whose own validity is proven by a self-sanity control BEFORE
// trusting its numbers against the real editor (a broken harness must fail loudly, not
// silently pass/fail EDIT-06).
//
// `.cm-content` (CodeMirror's own DOM class, guaranteed by @codemirror/view regardless of
// theme) and `[data-testid="preview-pane"]` (PreviewPane's root-element contract) live on the
// document route `/w/[wsId]/d/[docId]` (04-02 route split) — `/w/[wsId]` itself is now an
// EmptyState with no editor.

interface MeasureOptions {
  typeTarget: string;
  observeTarget: string;
  keystrokeCount: number;
  text: string;
}

/**
 * Types one character at a time into `typeTarget`, observing DOM mutations on
 * `observeTarget` via an injected MutationObserver, and returns the per-keystroke
 * keystroke-dispatch -> first-subsequent-mutation delta (ms) for each keystroke that
 * produced an observed mutation within the timeout.
 */
async function measureKeystrokeLatencies(page: Page, opts: MeasureOptions): Promise<number[]> {
  const { typeTarget, observeTarget, keystrokeCount, text } = opts;

  await page.evaluate((selector) => {
    const target = document.querySelector(selector);
    if (!target) throw new Error(`observe target not found: ${selector}`);
    (window as unknown as { __mutationTimestamps: number[] }).__mutationTimestamps = [];
    const observer = new MutationObserver(() => {
      (window as unknown as { __mutationTimestamps: number[] }).__mutationTimestamps.push(
        performance.now()
      );
    });
    observer.observe(target, { childList: true, characterData: true, subtree: true });
  }, observeTarget);

  await page.click(typeTarget);

  const deltas: number[] = [];
  for (let i = 0; i < keystrokeCount; i++) {
    const char = text[i % text.length];
    const start: number = await page.evaluate(() => performance.now());
    await page.keyboard.type(char);

    const mutationTime = await page
      .waitForFunction(
        (since) => {
          const stamps = (window as unknown as { __mutationTimestamps: number[] })
            .__mutationTimestamps;
          const found = stamps.find((t) => t >= since);
          return found ?? null;
        },
        start,
        { timeout: 2000 }
      )
      .then((handle) => handle.jsonValue())
      .catch(() => null);

    if (typeof mutationTime === "number") {
      deltas.push(mutationTime - start);
    }
  }

  return deltas;
}

/**
 * p95 = sorted[floor(0.95 * n)]. Guards the n=0/single-keystroke divide-by-zero edge
 * (spec-less edge EDIT-06/empty, this plan's must_haves).
 */
function p95(sortedAscending: number[]): number {
  if (sortedAscending.length === 0) return 0;
  if (sortedAscending.length === 1) return sortedAscending[0];
  const idx = Math.min(sortedAscending.length - 1, Math.floor(0.95 * sortedAscending.length));
  return sortedAscending[idx];
}

test.describe("preview p95 latency (EDIT-06)", () => {
  test("self-sanity control: the harness reports near-zero latency on a static, non-reactive element", async ({
    page,
  }) => {
    // A bare contenteditable div: typing mutates its OWN textContent synchronously via the
    // browser, with no framework reconcile step in between. If the harness itself cannot
    // report near-zero latency here, it cannot be trusted against the real app below.
    await page.setContent(
      `<!doctype html><html><body><div id="probe" contenteditable="true" style="width:400px;height:200px;border:1px solid #000"></div></body></html>`
    );

    const deltas = await measureKeystrokeLatencies(page, {
      typeTarget: "#probe",
      observeTarget: "#probe",
      keystrokeCount: 20,
      text: "abcdefghijklmnopqrst",
    });

    deltas.sort((a, b) => a - b);
    const sanityP95 = p95(deltas);

    expect(deltas.length).toBeGreaterThan(0);
    // Sanity threshold is deliberately looser than the 60ms production budget below --
    // this only proves the harness measures something close to zero, not that it is
    // perfectly noise-free.
    expect(sanityP95).toBeLessThan(20);
  });

  test("keystroke-to-preview-mutation p95 stays within the 60ms budget for a 10,000-code-unit document", async ({
    page,
  }) => {
    const email = `e2e-perf-${Date.now()}@example.com`;
    const workspaceName = `E2E Perf ${Date.now()}`;

    await signUpAndLogin(page, email);

    // Reuse the proven workspace-create flow (e2e/workspace-create.spec.ts) to land on a
    // real /w/[wsId] host route (D-P2-01) -- the dashboard's default-workspace card has no
    // click-to-navigate affordance yet, but workspace creation already does.
    await page.getByRole("button", { name: "워크스페이스 만들기" }).click();
    await page.getByLabel("이름").fill(workspaceName);
    await page.getByRole("button", { name: "만들기", exact: true }).click();
    await expect(page).toHaveURL(/\/w\/[^/]+$/);

    // 04-02 route split: the editor+preview host now lives at /w/[wsId]/d/[docId] -- create a
    // document to reach it (mirrors e2e/document-workspace.spec.ts).
    await page.getByRole("button", { name: "새 문서" }).click();
    await page.getByPlaceholder("새 문서").fill(`Perf Doc ${Date.now()}`);
    await page.getByPlaceholder("새 문서").press("Enter");
    await expect(page).toHaveURL(/\/w\/[^/]+\/d\/[^/]+$/);

    await page.waitForSelector(".cm-content", { timeout: 5000 });
    await page.waitForSelector('[data-testid="preview-pane"]', { timeout: 5000 });

    // "Code unit" = JS String.length / UTF-16 code units (spec-less edge EDIT-06/encoding),
    // NOT grapheme clusters or bytes. A 10,000-char ASCII string is exactly 10,000 code units.
    const seed = "a".repeat(10_000);
    expect(seed.length).toBe(10_000);

    await page.click(".cm-content");
    await page.keyboard.insertText(seed);

    const deltas = await measureKeystrokeLatencies(page, {
      typeTarget: ".cm-content",
      observeTarget: '[data-testid="preview-pane"]',
      keystrokeCount: 100,
      text: "b",
    });

    deltas.sort((a, b) => a - b);
    const observedP95 = p95(deltas);

    // Recorded for the 02-05 SUMMARY / future regression comparison -- not an
    // assertion, just a visible measurement in the test log (EDIT-06 / TRD §5).
    console.log(`EDIT-06 keystroke->preview p95: ${observedP95.toFixed(2)}ms (n=${deltas.length})`);

    // Guard against n=0/single-keystroke division edge (EDIT-06/empty spec-less edge).
    expect(deltas.length).toBeGreaterThan(0);
    expect(observedP95).toBeLessThanOrEqual(60);
  });
});
