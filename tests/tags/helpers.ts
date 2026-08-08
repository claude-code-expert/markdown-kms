// Factory for tag tests: direct DB read/write against document_tag, independent of
// replaceTags/getTags (the functions under test) — mirrors tests/documents/helpers.ts's
// "plain db.insert(...).returning()" convention, no session mocking.
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { documentTag } from "@/db/schema";

export async function insertTagRow(documentId: string, tag: string) {
  await db.insert(documentTag).values({ documentId, tag });
}

export async function getTagRows(documentId: string) {
  return db.select({ tag: documentTag.tag }).from(documentTag).where(eq(documentTag.documentId, documentId));
}
