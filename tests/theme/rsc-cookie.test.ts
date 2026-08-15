// 05-07 Task 2: RootLayout (RSC) reads the `theme` cookie via next/headers
// cookies() and bakes data-theme into the first HTML render (no-FOUC).
// next/headers is server-only — stub it so this stays a pure render-logic
// test (no real request/cookie jar needed).
import { describe, expect, it, vi } from "vitest";

const mockCookieValue: { value: string | undefined } = { value: undefined };

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "theme" ? { value: mockCookieValue.value } : undefined),
  }),
}));

// next/font/local relies on a Next.js build-time loader (webpack/SWC) that isn't
// present under vitest — stub the default export layout.tsx calls with a plain function.
// Phase 9 D-05: layout.tsx swapped next/font/google (IBM Plex) for next/font/local (DM
// Sans/Mono self-hosted), variable names kept unchanged.
vi.mock("next/font/local", () => ({
  default: (opts: { variable: string }) => ({ variable: opts.variable }),
}));

describe("RootLayout theme cookie -> data-theme", () => {
  it("renders no data-theme attribute when the theme cookie is absent (first visit, @media fallback)", async () => {
    mockCookieValue.value = undefined;
    const { default: RootLayout } = await import("@/app/layout");
    const element = await RootLayout({ children: null });
    expect(element.props["data-theme"]).toBeUndefined();
  });

  it('renders data-theme="light" when the theme cookie is "light"', async () => {
    mockCookieValue.value = "light";
    const { default: RootLayout } = await import("@/app/layout");
    const element = await RootLayout({ children: null });
    expect(element.props["data-theme"]).toBe("light");
  });

  it('renders data-theme="dark" when the theme cookie is "dark"', async () => {
    mockCookieValue.value = "dark";
    const { default: RootLayout } = await import("@/app/layout");
    const element = await RootLayout({ children: null });
    expect(element.props["data-theme"]).toBe("dark");
  });

  // WR-04 (05-REVIEW): unlike layoutMode/splitRatio, the theme cookie was read without an
  // allow-list — a tampered/typo'd value (e.g. "Dark") silently matched neither CSS rule and
  // fell through to the light theme with no signal to the user. Treat it the same as an
  // absent cookie (undefined -> @media prefers-color-scheme fallback), not a forced "light".
  it('renders no data-theme attribute when the theme cookie is an invalid value (e.g. "Dark")', async () => {
    mockCookieValue.value = "Dark";
    const { default: RootLayout } = await import("@/app/layout");
    const element = await RootLayout({ children: null });
    expect(element.props["data-theme"]).toBeUndefined();
  });
});
