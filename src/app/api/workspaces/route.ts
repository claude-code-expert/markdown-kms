import { auth } from "@/auth";
import { db } from "@/db";
import { workspace, workspaceMember } from "@/db/schema";
import { forbiddenResponse } from "@/lib/rbac";
import { workspaceSchema } from "@/lib/validation";

export const runtime = "nodejs";

// WS-02 / PRD §2-1: any logged-in member can create a workspace — role-independent, so this
// checks only for a session (no requireRole call, there is no existing workspace to check a
// role against yet). The creator becomes OWNER of the new workspace.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return forbiddenResponse();
  const userId = session.user.id;

  // WR-04: guard malformed JSON so it maps to a clean 400 instead of an uncaught throw
  // (signup/route.ts already does this; this route was missing the same guard).
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const parsed = workspaceSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "잘못된 요청입니다." },
      { status: 400 },
    );
  }

  const created = await db.transaction(async (tx) => {
    const [ws] = await tx.insert(workspace).values({ name: parsed.data.name }).returning();
    await tx.insert(workspaceMember).values({ workspaceId: ws.id, userId, role: "OWNER" });
    return ws;
  });

  return Response.json({ id: created.id, name: created.name }, { status: 201 });
}
