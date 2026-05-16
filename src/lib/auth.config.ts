// Edge-safe auth config — no Prisma, no database adapter.
// Used by middleware only. The full config (with PrismaAdapter) lives in auth.ts.
import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    verifyRequest: "/verify",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // @ts-expect-error role is added by the full auth config
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        // @ts-expect-error role is added by the full auth config
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  providers: [], // providers are not needed in middleware
  trustHost: true,
};
