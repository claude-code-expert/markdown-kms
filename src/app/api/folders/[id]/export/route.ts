import { eq } from "drizzle-orm";
import { z } from "zod";
import { ZipArchive } from "archiver";
import { Readable } from "node:stream";
import { db } from "@/db";
import { folder } from "@/db/schema";
import { resolveActiveWorkspaceId } from "@/lib/closure";
import { buildZipEntries, sanitizeZipSegment } from "@/lib/export";
import { ForbiddenError, forbiddenResponse, requireRole } from "@/lib/rbac";

export const runtime = "nodejs"; // archiver is a Node API — no edge runtime (RESEARCH Pattern 3).

// EXP-02: streams the folder subtree as a structure-preserving zip. IDOR shape mirrors
// folders/[id]/route.ts (resolveActiveWorkspaceId + requireRole), gated at VIEWER (read-only
// export) rather than EDITOR.
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const target = await resolveActiveWorkspaceId(id);
  if (!target) return forbiddenResponse();

  try {
    await requireRole(target.workspaceId, "VIEWER");
  } catch (err) {
    if (err instanceof ForbiddenError) return forbiddenResponse();
    throw err;
  }

  const [folderRow] = await db.select({ name: folder.name }).from(folder).where(eq(folder.id, id));
  const folderName = sanitizeZipSegment(folderRow?.name ?? "내보내기");

  const entries = await buildZipEntries(id);
  // archiver 8.0.0 dropped the archiver(format, opts) factory function RESEARCH assumed (older
  // major) — it's a pure-ESM package exporting only the Archiver/ZipArchive/TarArchive classes
  // now, so this constructs the zip variant directly instead.
  const archive = new ZipArchive({ zlib: { level: 9 } });
  for (const entry of entries) {
    archive.append(entry.content, { name: entry.zipPath });
  }
  // Pitfall 3: fire-and-forget — finalize() (now Promise<void>-returning in 8.0.0) triggers
  // stream close asynchronously; all append() calls above are already queued synchronously
  // before this point, so awaiting isn't needed before handing the stream to Response.
  void archive.finalize();

  const webStream = Readable.toWeb(archive) as ReadableStream;
  const filename = `${folderName}.zip`;
  const asciiSafe = filename.replace(/[^\x20-\x7E]/g, "_");
  return new Response(webStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${asciiSafe}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
