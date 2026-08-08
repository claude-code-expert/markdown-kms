// EXP-02 zip-building helpers. Deliberately archiver-free (06-PATTERNS "No Analog" —
// buildZipEntries/sanitizeZipSegment): this file only computes {zipPath, content} pairs, so
// folder-hierarchy/collision/zip-slip behavior stays unit-testable without spinning up real zip
// I/O. The actual archiver stream lives in src/app/api/folders/[id]/export/route.ts.
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { document } from "@/db/schema";
import { getSubtree } from "@/lib/closure";

type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

// T-06-ZIPSLIP: every path segment (folder name or document title) is funneled through here
// before becoming part of a zip entry name. Slashes/backslashes would introduce extra directory
// levels, ".." would let a crafted title climb out of the export root — both are neutralized
// into a flat, harmless token rather than rejecting the whole title (a folder literally named
// "../../etc" still exports, just flattened to a safe single segment).
export function sanitizeZipSegment(name: string): string {
  const cleaned = name
    .replace(/[/\\]/g, "-")
    .replace(/\.\./g, "_")
    // WR-02: `:` is the Windows drive-letter/ADS separator (e.g. "C:\Windows"); control chars
    // are stripped alongside it.
    .replace(/[\x00-\x1f:]/g, "")
    .trim()
    // WR-02: leading/trailing dots are invalid on Windows filenames — also covers the odd-dot-run
    // leftover ("....." -> "__." after the pair-replace above, minus a straggler dot).
    .replace(/^\.+|\.+$/g, "");
  return cleaned || "제목 없음";
}

// WR-01: shared Content-Disposition builder for both export routes. The real (possibly non-ASCII)
// name always travels via the RFC 5987 filename* parameter; the ASCII filename="..." fallback is
// only for legacy clients, so it just needs to be a structurally safe quoted-string. CR/LF is
// stripped defensively (encodeURIComponent already neutralizes it in filename*, and the
// \x20-\x7E filter already drops it from the fallback, but a raw value must never reach a header
// setter). `"` and `\` would otherwise break out of the quoted-string and corrupt the header.
export function contentDispositionHeader(filename: string): string {
  const safe = filename.replace(/[\r\n]/g, "");
  const asciiSafe = safe.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${asciiSafe}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}

export interface ZipEntry {
  zipPath: string;
  content: string;
}

// EXP-02 / RESEARCH Open Question 1 (adopted): the root folder itself becomes the zip's single
// top-level directory, not flattened away — unzipping doesn't scatter files loose at the
// archive's root.
export async function buildZipEntries(folderId: string, client: DbClient = db): Promise<ZipEntry[]> {
  const folders = await getSubtree(folderId, client);
  const byId = new Map(folders.map((f) => [f.id, f]));
  const ids = folders.map((f) => f.id);
  if (ids.length === 0) return [];

  const pathCache = new Map<string, string[]>();
  function folderPath(id: string): string[] {
    const cached = pathCache.get(id);
    if (cached) return cached;
    const row = byId.get(id);
    if (!row) return [];
    // A row's parentId only resolves within this subtree for non-root members — the root
    // folder's real parent lives outside the subtree (not in `byId`), so it naturally stops
    // recursion and becomes the single top-level path segment.
    const parentPath = row.parentId && byId.has(row.parentId) ? folderPath(row.parentId) : [];
    const path = [...parentPath, sanitizeZipSegment(row.name)];
    pathCache.set(id, path);
    return path;
  }

  const docs = await client
    .select({ folderId: document.folderId, title: document.title, content: document.content })
    .from(document)
    .where(and(inArray(document.folderId, ids), eq(document.isDeleted, false)));

  // T-06-ZIPSLIP collision handling (CONTEXT.md lock): same-directory sanitized-title collisions
  // get a -1/-2 suffix, counted per directory (not globally) so identically-named docs in
  // different subfolders don't affect each other's numbering.
  const countersByDir = new Map<string, Map<string, number>>();
  const entries: ZipEntry[] = [];
  for (const doc of docs) {
    const dirPath = folderPath(doc.folderId as string);
    const dirKey = dirPath.join("/");
    const baseName = sanitizeZipSegment(doc.title);
    let counter = countersByDir.get(dirKey);
    if (!counter) {
      counter = new Map();
      countersByDir.set(dirKey, counter);
    }
    const seen = counter.get(baseName) ?? 0;
    counter.set(baseName, seen + 1);
    const fileName = seen === 0 ? `${baseName}.md` : `${baseName}-${seen}.md`;
    entries.push({ zipPath: [...dirPath, fileName].join("/"), content: doc.content });
  }
  return entries;
}
