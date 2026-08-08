// Factory for document tests: real DB row (document), mirrors tests/rbac/helpers.ts's
// createTestWorkspace pattern — plain db.insert(...).returning(), no session mocking (documents.ts
// service functions don't touch requireRole/auth).
import { db } from "@/db";
import { document } from "@/db/schema";

export async function createTestDocument(
  workspaceId: string,
  folderId: string | null,
  overrides: Partial<{ title: string; content: string; savedSeq: number }> = {},
) {
  const [created] = await db
    .insert(document)
    .values({ workspaceId, folderId, ...overrides })
    .returning();
  return created;
}
