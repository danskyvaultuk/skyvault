import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";
import { refreshSessionToken } from "@/lib/sessionRole";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET ? [
      Google({
        clientId: process.env.AUTH_GOOGLE_ID,
        clientSecret: process.env.AUTH_GOOGLE_SECRET,
        // Kept on deliberately (BL-066 / SPEC-021 B3): Google hands over only
        // addresses it has verified, and turning this off would lock a customer
        // who first signed in by magic link out of the Google button.
        allowDangerousEmailAccountLinking: true,
      }),
    ] : []),
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY ?? "",
      from: process.env.RESEND_FROM_EMAIL ?? "noreply@skyvaultuk.com",
    }),
  ],
  session: {
    // JWT strategy lets the Credentials provider work alongside the database adapter
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user }) {
      const email = user.email ?? "";
      const role = (user as { role?: string }).role;
      // Only admins are restricted to the company domain
      if (role === "admin" && !email.endsWith("@skyvaultuk.com")) {
        return false;
      }
      return true;
    },
    async jwt({ token, user }) {
      // The role comes from the database on every check, so a role change or a
      // deleted account takes effect at once (BL-066 / SPEC-021 B1).
      return refreshSessionToken(token, user, (id) =>
        prisma.user.findUnique({ where: { id }, select: { role: true } })
      );
    },
    async session({ session, token }) {
      // Every request, copy from token into session so pages can read it
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
  trustHost: true,
  pages: {
    signIn: "/login",
    verifyRequest: "/verify",
  },
});
