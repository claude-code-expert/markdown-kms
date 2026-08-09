// src/lib/join-requests.ts — createJoinRequest/decideJoinRequest. DbClient union type copied from
// documents.ts:1-8 (tx isn't structurally typeof db, so the alias unions both).
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { workspaceJoinRequest, workspaceMember } from "@/db/schema";

type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

// documents.ts's TagLimitError analog: a custom error class the route catches and maps to a
// specific status code (409 — the decision has already been made, not a validation failure).
export class AlreadyDecidedError extends Error {}

// WR-03: mirrors signup/route.ts's isUniqueViolation — postgres.js surfaces Postgres error codes
// on `.code`, drizzle wraps the driver error as DrizzleQueryError with the original on `.cause`.
function pgErrorCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const code = (err as { code?: string }).code;
  if (code) return code;
  return pgErrorCode((err as { cause?: unknown }).cause);
}

function isUniqueViolation(err: unknown): boolean {
  return pgErrorCode(err) === "23505";
}

// documents.ts's TagLimitError analog again: the route catches this and maps it to the same
// 400 already used for the pre-check (existingPending). Backed by drizzle/0008's partial unique
// index (workspace_id, user_id) WHERE status='PENDING' — the route's SELECT-then-INSERT pre-check
// is now a fast-path UX improvement, not the only thing standing between two concurrent
// submissions and a duplicate PENDING row (WR-03).
export class DuplicatePendingRequestError extends Error {}

// Requester identity comes from the caller's session (route enforces this, see Task 2) — this
// function trusts its userId argument, it never re-derives it. No transaction needed: a single
// INSERT with the schema's default('PENDING') status. The route's existingMember/existingPending
// SELECTs give a friendly early exit; the partial unique index is what actually prevents a
// duplicate PENDING row under concurrent submission (WR-03).
export async function createJoinRequest(workspaceId: string, userId: string, client: DbClient = db) {
  try {
    const [created] = await client
      .insert(workspaceJoinRequest)
      .values({ workspaceId, userId })
      .returning();
    return created;
  } catch (err) {
    if (isUniqueViolation(err)) throw new DuplicatePendingRequestError();
    throw err;
  }
}

// RESEARCH Pattern 2 / Pitfall 4: the WHERE status='PENDING' guard lives on the UPDATE itself,
// re-checked at transaction-execution time — not a pre-transaction SELECT — so two concurrent
// decisions on the same reqId can't both succeed (2nd sees 0 rows -> AlreadyDecidedError).
export async function decideJoinRequest(
  workspaceId: string,
  reqId: string,
  decision: "APPROVED" | "REJECTED",
  adminUserId: string,
  client: DbClient = db,
) {
  return client.transaction(async (tx) => {
    const decided = await tx
      .update(workspaceJoinRequest)
      .set({ status: decision, decidedBy: adminUserId, decidedAt: new Date() })
      .where(
        and(
          eq(workspaceJoinRequest.id, reqId),
          eq(workspaceJoinRequest.workspaceId, workspaceId), // CR-01: reqId alone isn't enough — scope to the caller's authorized workspace
          eq(workspaceJoinRequest.status, "PENDING"),
        ),
      )
      .returning({ userId: workspaceJoinRequest.userId, workspaceId: workspaceJoinRequest.workspaceId });

    if (decided.length === 0) throw new AlreadyDecidedError();
    // CR-01: destructured as decidedWorkspaceId (not workspaceId) — shadowing the outer
    // workspaceId param here would put it in TDZ for the WHERE clause above (same block scope).
    const { userId, workspaceId: decidedWorkspaceId } = decided[0];

    if (decision === "APPROVED") {
      // acceptInvitation's admission idiom: onConflictDoNothing keeps this idempotent even if the
      // applicant is already a member (with any role) by the time an ADMIN approves.
      await tx
        .insert(workspaceMember)
        .values({ workspaceId: decidedWorkspaceId, userId, role: "EDITOR" })
        .onConflictDoNothing();
    }

    return { userId, workspaceId: decidedWorkspaceId, decision };
  });
}
