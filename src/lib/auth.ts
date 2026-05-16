import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    // ── DEV ONLY: sign in with just an email (no password, no external service)
    // Remove this provider before going to production
    Credentials({
      id: "dev-login",
      name: "Dev Login",
      credentials: {
        email: { label: "Email", type: "email" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email) {
            console.log("[dev-login] No email provided");
            return null;
          }
          const email = credentials.email as string;
          console.log("[dev-login] Looking up:", email);
          // Look up the user in the database by email
          const user = await prisma.user.findUnique({
            where: { email },
          });
          console.log("[dev-login] Found user:", user ? user.email : "null");
          // Only allow sign-in if the user already exists (you created them in Prisma Studio)
          return user ?? null;
        } catch (err) {
          console.error("[dev-login] authorize() threw:", err);
          return null;
        }
      },
    }),

    // ── PRODUCTION providers (add credentials before deploying) ──
    Google({
      clientId: process.env.AUTH_GOOGLE_ID ?? "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? "",
    }),
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY ?? "",
      from: process.env.RESEND_FROM_EMAIL ?? "noreply@skyvault.co.uk",
    }),
  ],
  session: {
    // JWT strategy lets the Credentials provider work alongside the database adapter
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user }) {
      const email = user.email ?? "";
      return email.endsWith("@skyvaultuk.com");
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
