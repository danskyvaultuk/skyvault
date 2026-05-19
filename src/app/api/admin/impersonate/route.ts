import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encode } from "next-auth/jwt";
import { cookies } from "next/headers";

const ROLE_REDIRECT: Record<string, string> = {
  admin:    "/admin/dashboard",
  roofer:   "/roofer/dashboard",
  drone:    "/drone/dashboard",
  customer: "/dashboard",
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await req.json();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return Response.json({ error: "Not found" }, { status: 404 });

  const isSecure = process.env.NODE_ENV === "production";
  const cookieName = isSecure
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

  const token = await encode({
    token: {
      sub: user.id,
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.image,
      role: user.role,
    },
    secret: process.env.AUTH_SECRET!,
    salt: cookieName,
  });

  const cookieStore = await cookies();
  cookieStore.set(cookieName, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    maxAge: 60 * 60,
    path: "/",
  });

  return Response.json({ redirect: ROLE_REDIRECT[user.role] ?? "/dashboard" });
}
