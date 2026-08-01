// O1: minimal in-memory login brute-force limiter — 5 failed attempts / 10 min per email+IP.
// authorize() itself only runs inside Auth.js's own request pipeline (not independently
// unit-testable, per 01-02-SUMMARY's D4 precedent) — this tests the exported, directly
// testable policy functions authorize() calls into. Committed before src/lib/rate-limit.ts
// exists (TDD).
import { afterEach, describe, expect, it, vi } from "vitest";
import { checkLoginRateLimit, recordLoginFailure } from "@/lib/rate-limit";

describe("login rate limit (O1)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("still allows an attempt right up to the 5th failure", () => {
    const key = `under-threshold@example.com:127.0.0.1`;
    for (let i = 0; i < 4; i += 1) {
      expect(checkLoginRateLimit(key)).toBe(true);
      recordLoginFailure(key);
    }
    expect(checkLoginRateLimit(key)).toBe(true);
  });

  it("rejects the 6th attempt within the window after 5 failures", () => {
    const key = `over-threshold@example.com:127.0.0.1`;
    for (let i = 0; i < 5; i += 1) {
      recordLoginFailure(key);
    }
    expect(checkLoginRateLimit(key)).toBe(false);
  });

  it("resets after the 10-minute window expires", () => {
    vi.useFakeTimers();
    const key = `expiring@example.com:127.0.0.1`;
    for (let i = 0; i < 5; i += 1) {
      recordLoginFailure(key);
    }
    expect(checkLoginRateLimit(key)).toBe(false);

    vi.advanceTimersByTime(10 * 60 * 1000 + 1);

    expect(checkLoginRateLimit(key)).toBe(true);
  });

  it("keys are isolated per email+IP — a different IP for the same email is unaffected", () => {
    const keyA = `shared@example.com:1.1.1.1`;
    const keyB = `shared@example.com:2.2.2.2`;
    for (let i = 0; i < 5; i += 1) {
      recordLoginFailure(keyA);
    }
    expect(checkLoginRateLimit(keyA)).toBe(false);
    expect(checkLoginRateLimit(keyB)).toBe(true);
  });
});
