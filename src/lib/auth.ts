import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET ? [
      Google({
        clientId: process.env.AUTH_GOOGLE_ID,
        clientSecret: process.env.AUTH_GOOGLE_SECRET,
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
      // On first sign-in, `user` is populated — copy id and role into the token
      if (user) {
        token.id = user.id;
        token.role = (user as { role: Role }).role;
      }
      return token;
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
