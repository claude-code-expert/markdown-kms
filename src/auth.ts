import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import {
  displayNameFromProfile,
  findOrCreateOAuthUser,
  isVerifiedGoogleProfile,
} from "@/lib/account";
import { verifyPassword } from "@/lib/password";
import { checkLoginRateLimit, recordLoginFailure, undoLoginFailure } from "@/lib/rate-limit";
import { normalizeEmail } from "@/lib/validation";

// CR-02: fixed dummy hash so a nonexistent user still pays the same bcrypt cost as a real
// one — the DB lookup hitting 0 vs 1 rows must not be observable via response timing (T-02-01).
const DUMMY_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8G7VpTNK6H7oXBCa/6dKQvV5cD5cGO";

// TRD §9.1. @auth/core는 CredentialsSignin 서브클래스의 `code`를 클라이언트 SignInResponse.code로
// 전달한다 — login-form이 이 값으로 "인증 필요" 안내와 재발송 버튼을 띄운다.
//
// T-03-01("원인별로 분기하지 않는다")의 예외지만 열거 oracle이 되지는 않는다: 아래에서 이 에러는
// **비밀번호가 맞은 뒤에만** 나온다. 비밀번호를 모르면 여전히 일반 실패와 구분할 수 없다.
class EmailUnverifiedError extends CredentialsSignin {
  code = "email_unverified";
}

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
        const rawEmail = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!rawEmail || !password) return null;
        // WR-07: normalize the same way signup does, so login matches regardless of case/whitespace.
        const email = normalizeEmail(rawEmail);

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

        // 비밀번호 검증 뒤에 온다 — 순서가 곧 보안 속성이다. 앞에 두면 아무나 이메일만 넣어보고
        // "미인증" 응답으로 가입 여부를 알아낼 수 있다(TRD §9.1).
        if (!found.emailVerified) throw new EmailUnverifiedError();

        return { id: found.id, email: found.email, name: found.name };
      },
    }),
    // FR-A2. clientId/clientSecret을 안 넘기는 건 실수가 아니다 — Auth.js v5가 AUTH_GOOGLE_ID /
    // AUTH_GOOGLE_SECRET 을 규칙으로 자동 주입한다(docs/oauth-google.md §요약). 어댑터는 쓰지
    // 않는다: 세션이 이미 JWT 고정(D-07)이라 account/session 테이블이 할 일이 없고, 회원 행은
    // 아래 jwt 콜백이 우리 user 테이블에 직접 만든다.
    Google,
  ],
  // 실패한 OAuth 로그인을 Auth.js 기본 에러 화면 대신 우리 로그인 페이지로 돌린다(?error=...).
  // 겸사겸사 기본 /api/auth/signin 페이지도 노출되지 않는다.
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    // Google이 이메일 소유를 검증하지 않은 프로필은 여기서 끊는다. 통과시키면 남의 이메일을
    // 주장하는 것만으로 아래 jwt 콜백의 자동 연결에 올라타 그 계정을 탈취할 수 있다.
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return true; // credentials 경로는 authorize()가 이미 판정했다
      return isVerifiedGoogleProfile(profile);
    },
    async jwt({ token, user: authedUser, account, profile }) {
      // OAuth의 authedUser.id는 Google의 sub이지 우리 user.id가 아니다. 여기서 우리 uuid로
      // 덮어쓰지 않으면 session.user.id가 sub이 되어 lib/rbac.ts의 권한 조회가 전부
      // "멤버 아님"으로 조용히 빗나간다.
      if (account?.provider === "google" && isVerifiedGoogleProfile(profile)) {
        const email = normalizeEmail(profile.email);
        const dbUser = await findOrCreateOAuthUser({
          email,
          name: displayNameFromProfile(profile.name, email),
        });
        token.id = dbUser.id;
        token.name = dbUser.name;
        return token;
      }
      if (authedUser) {
        token.id = authedUser.id;
        // 리디자인(Avatar 이니셜 배지) — 헤더/멤버 목록이 표시 이름을 필요로 하게 되면서
        // .id와 같은 방식으로 명시적으로 실어 나른다(프레임워크 기본 동작에 암묵적으로
        // 기대지 않음, 이 파일의 기존 관례).
        token.name = authedUser.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.id === "string") session.user.id = token.id;
      if (session.user && typeof token.name === "string") session.user.name = token.name;
      return session;
    },
  },
});
