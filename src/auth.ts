import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { verifyPassword } from "@/lib/password";

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

        const [found] = await db.select().from(user).where(eq(user.email, email));
        // One indistinguishable failure path for both "no such user" and "wrong password" (T-02-01).
        if (!found?.passwordHash) return null;

        const valid = await verifyPassword(password, found.passwordHash);
        if (!valid) return null;

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
