// 05-01 Task 1 (TDD RED first, CLAUDE.md/TRD §10): saveUpload's server-side magic-byte gate.
// EDIT-09 / Pitfall 1 — the fixture that matters most here is the spoofed one: a file named
// ".png" and labelled "image/png" whose BYTES are plain text must still be rejected, because
// saveUpload never looks at file.name/file.type to decide the outcome.
import { describe, expect, it, vi } from "vitest";
import { saveUpload } from "@/lib/storage";

function fixture(bytes: number[], name: string, type: string) {
  return new File([new Uint8Array(bytes)], name, { type });
}

// Signatures padded with a couple of trailing filler bytes so each fixture clears the sniffer's
// minimum-length check (png>=8, jpeg>=3, gif>=6, webp>=12) without asserting on real image data.
const PNG_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00];
const JPEG_BYTES = [0xff, 0xd8, 0xff, 0x00, 0x00];
const GIF87_BYTES = [0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0x00, 0x00];
const GIF89_BYTES = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00];
const WEBP_BYTES = [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];

describe("saveUpload — magic-byte sniffing (EDIT-09)", () => {
  it("accepts a png signature and returns a server-generated .png url", async () => {
    const res = await saveUpload(fixture(PNG_BYTES, "photo.png", "image/png"));
    expect("url" in res).toBe(true);
    if ("url" in res) expect(res.url).toMatch(/^\/uploads\/[0-9a-f-]{36}\.png$/);
  });

  it("accepts a jpeg signature and returns a .jpg url", async () => {
    const res = await saveUpload(fixture(JPEG_BYTES, "photo.jpg", "image/jpeg"));
    expect("url" in res).toBe(true);
    if ("url" in res) expect(res.url).toMatch(/^\/uploads\/[0-9a-f-]{36}\.jpg$/);
  });

  it("accepts a gif87a signature and returns a .gif url", async () => {
    const res = await saveUpload(fixture(GIF87_BYTES, "photo.gif", "image/gif"));
    expect("url" in res).toBe(true);
    if ("url" in res) expect(res.url).toMatch(/^\/uploads\/[0-9a-f-]{36}\.gif$/);
  });

  it("accepts a gif89a signature and returns a .gif url", async () => {
    const res = await saveUpload(fixture(GIF89_BYTES, "photo.gif", "image/gif"));
    expect("url" in res).toBe(true);
    if ("url" in res) expect(res.url).toMatch(/^\/uploads\/[0-9a-f-]{36}\.gif$/);
  });

  it("accepts a webp (RIFF....WEBP) signature and returns a .webp url", async () => {
    const res = await saveUpload(fixture(WEBP_BYTES, "photo.webp", "image/webp"));
    expect("url" in res).toBe(true);
    if ("url" in res) expect(res.url).toMatch(/^\/uploads\/[0-9a-f-]{36}\.webp$/);
  });

  it("rejects a spoofed file — text bytes labelled image/png with a .png name", async () => {
    const fake = new File([new TextEncoder().encode("not an image, just text bytes")], "fake.png", {
      type: "image/png",
    });
    const res = await saveUpload(fake);
    expect(res).toEqual({ error: "BAD_TYPE" });
  });

  it("rejects an oversized file (>5MB) BEFORE reading its bytes — size cap runs first (Pitfall 3)", async () => {
    const file = fixture(PNG_BYTES, "big.png", "image/png");
    Object.defineProperty(file, "size", { value: 6 * 1024 * 1024 });
    const arrayBufferSpy = vi.spyOn(file, "arrayBuffer");

    const res = await saveUpload(file);

    expect(res).toEqual({ error: "TOO_LARGE" });
    expect(arrayBufferSpy).not.toHaveBeenCalled();
  });
});
