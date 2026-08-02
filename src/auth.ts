import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { verifyPassword } from "@/lib/password";
import { checkLoginRateLimit, recordLoginFailure, undoLoginFailure } from "@/lib/rate-limit";

// CR-02: fixed dummy hash so a nonexistent user still pays the same bcrypt cost as a real
// one — the DB lookup hitting 0 vs 1 rows must not be observable via response timing (T-02-01).
const DUMMY_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8G7VpTNK6H7oXBCa/6dKQvV5cD5cGO";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: "jwt", // D-07: Credentials providers cannot use DB sessions
    maxAge: 60 * 60 * 24, // D-05: 24h
    updateAge: 60 * 60, // sliding renewal granularity, kept below maxAge (Pitfall 2)
  },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        // O1: 5 failed attempts / 10 min per email — never disclose the lockout itself, just
        // fail through the same generic path as a wrong password (T-02-01). CR-01: keyed on
        // email only, not a client-suppliable header — this app has no trusted reverse proxy
        // in front of it, so `x-forwarded-for` can be spoofed per-request to dodge the limiter.
        const rateLimitKey = email;
        if (!checkLoginRateLimit(rateLimitKey)) return null;

        // WR-06: record the attempt BEFORE the expensive bcrypt gap below (undone on success),
        // closing the TOCTOU window where concurrent requests could all read "still allowed".
        recordLoginFailure(rateLimitKey);

        const [found] = await db.select().from(user).where(eq(user.email, email));
        // CR-02 / T-02-01: always pay the bcrypt cost, even when no user was found, by
        // comparing against a fixed dummy hash — keeps both branches timing-indistinguishable.
        const valid = await verifyPassword(password, found?.passwordHash ?? DUMMY_HASH);
        if (!found?.passwordHash || !valid) {
          return null;
        }

        undoLoginFailure(rateLimitKey);
        return { id: found.id, email: found.email, name: found.name };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user: authedUser }) {
      if (authedUser) {
        token.id = authedUser.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.id === "string") session.user.id = token.id;
      return session;
    },
  },
});
