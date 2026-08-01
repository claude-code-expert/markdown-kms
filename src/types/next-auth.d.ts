import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

// Note: JWT's `id` is read via a `typeof token.id === "string"` guard in src/auth.ts
// rather than a module augmentation — @auth/core (which declares the JWT interface
// callbacks actually resolve to) isn't hoisted to root node_modules under pnpm, so an
// ambient `declare module "@auth/core/jwt"` here can't be resolved and silently fails
// to merge. JWT already extends Record<string, unknown>, so untyped keys are fine to
// read with a type guard and fine to write without one.
