// Factory for draft tests: real DB rows (workspace, document), mirrors tests/documents/helpers.ts's
// createTestDocument pattern — plain db.insert(...).returning(). Does NOT reuse tests/rbac/helpers.ts
// (its createTestWorkspace is fine, but importing that module pulls in "@/auth" -> next-auth, which
// requires every importing test file to `vi.mock("@/auth", ...)` at the top per its own doc comment;
// draft service tests touch no auth at all, so a local insert avoids that unrelated coupling).
import { db } from "@/db";
import { document, workspace } from "@/db/schema";

export async function createTestWorkspace(name: string) {
  const [created] = await db.insert(workspace).values({ name }).returning();
  return created;
}

export async function createTestDocument(workspaceId: string, folderId: string | null = null) {
  const [created] = await db.insert(document).values({ workspaceId, folderId }).returning();
  return created;
}
