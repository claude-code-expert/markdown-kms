import { eq } from "drizzle-orm";
import { z } from "zod";
import { ZipArchive } from "archiver";
import { Readable } from "node:stream";
import { db } from "@/db";
import { folder } from "@/db/schema";
import { resolveActiveWorkspaceId } from "@/lib/closure";
import { buildZipEntries, contentDispositionHeader, sanitizeZipSegment } from "@/lib/export";
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
  // CR-01: archive.finalize()'s Promise rejects on any stream error (zlib error, client abort,
  // etc — node_modules/archiver/lib/core.js), not just double-finalize/abort. Left unhandled,
  // Node crashes the whole process on an unhandled rejection. The `error` listener covers the
  // stream side (Readable.toWeb() already forwards stream errors to the response), the `.catch`
  // covers finalize()'s own Promise so neither path can escape as an unhandled rejection.
  archive.on("error", (err) => {
    console.error("zip archive error", err);
  });
  archive.finalize().catch((err) => {
    console.error("zip finalize error", err);
  });

  const webStream = Readable.toWeb(archive) as ReadableStream;
  const filename = `${folderName}.zip`;
  return new Response(webStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": contentDispositionHeader(filename),
    },
  });
}
