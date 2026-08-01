import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user, workspace } from "@/db/schema";
import { POST } from "@/app/api/auth/signup/route";

describe("signup transaction atomicity (Pitfall 3)", () => {
  it("rolls back and leaves no orphaned user when the default-workspace membership insert cannot complete", async () => {
    const [defaultWs] = await db.select().from(workspace).where(eq(workspace.isDefault, true));
    expect(defaultWs).toBeTruthy();

    // Force the signup transaction's `SELECT ... WHERE is_default = true` to find nothing,
    // simulating the mid-transaction failure the membership insert would hit.
    await db.update(workspace).set({ isDefault: false }).where(eq(workspace.id, defaultWs.id));

    try {
      const beforeCount = (await db.select().from(user)).length;
      const email = `atomicity-${Date.now()}@example.com`;

      const res = await POST(
        new Request("http://localhost/api/auth/signup", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password: "password123", name: "Atomic Test" }),
        }),
      );

      expect(res.status).toBeGreaterThanOrEqual(400);

      const afterCount = (await db.select().from(user)).length;
      expect(afterCount).toBe(beforeCount);

      const [orphan] = await db.select().from(user).where(eq(user.email, email));
      expect(orphan).toBeUndefined();
    } finally {
      await db.update(workspace).set({ isDefault: true }).where(eq(workspace.id, defaultWs.id));
    }
  });
});
