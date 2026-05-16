import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";

const ROLE_PREFIXES: Record<string, Role> = {
  "/roofer": "roofer",
  "/drone": "drone",
  "/admin": "admin",
};

const CUSTOMER_PATHS = ["/dashboard", "/properties", "/surveys", "/quotes"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  const isPublic =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/verify") ||
    pathname.startsWith("/api/auth");

  if (isPublic) return NextResponse.next();

  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const role = session.user.role;

  for (const [prefix, requiredRole] of Object.entries(ROLE_PREFIXES)) {
    if (pathname.startsWith(prefix)) {
      if (role !== requiredRole && role !== "admin") {
        return NextResponse.redirect(new URL(getDashboard(role), req.url));
      }
    }
  }

  const isCustomerPath = CUSTOMER_PATHS.some((p) => pathname.startsWith(p));
  if (isCustomerPath && role !== "customer" && role !== "admin") {
    return NextResponse.redirect(new URL(getDashboard(role), req.url));
  }

  return NextResponse.next();
});

function getDashboard(role: Role): string {
  switch (role) {
    case "roofer":
      return "/roofer/dashboard";
    case "drone":
      return "/drone/dashboard";
    case "admin":
      return "/admin/dashboard";
    default:
      return "/dashboard";
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
