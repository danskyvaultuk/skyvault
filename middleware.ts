import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";
import { journeys } from "@/lib/journeys";
import { JourneyGuard } from "@/lib/journeyGuard";

const { auth } = NextAuth(authConfig);

const ROLE_PREFIXES: Record<string, string> = {
  "/roofer": "roofer",
  "/drone": "drone",
  "/admin": "admin",
};

const CUSTOMER_PATHS = ["/dashboard", "/properties", "/surveys", "/quotes"];

// Launch scope (BL-058): the drone and roofer journeys are switched off by default.
const guard = new JourneyGuard(journeys);


export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (guard.apiDecision(pathname) === "not-found") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isPublic =
    pathname === "/" ||
    pathname.startsWith("/blog") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/verify") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/stripe/webhook") ||
    pathname.startsWith("/auth/redirect");

  if (isPublic) return NextResponse.next();

  try {
    const session = req.auth;

    if (!session) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const role = session.user.role as string;

    if (!pathname.startsWith("/api/")) {
      const decision = guard.pageDecision(pathname, role);
      if (decision.kind === "redirect") {
        return NextResponse.redirect(new URL(decision.to, req.url));
      }
    }

    for (const [prefix, requiredRole] of Object.entries(ROLE_PREFIXES)) {
      if (pathname.startsWith(prefix)) {
        if (role !== requiredRole && role !== "admin") {
          return NextResponse.redirect(new URL(guard.homeFor(role), req.url));
        }
      }
    }

    const isCustomerPath = CUSTOMER_PATHS.some((p) => pathname.startsWith(p));
    if (isCustomerPath && role !== "customer" && role !== "admin") {
      return NextResponse.redirect(new URL(guard.homeFor(role), req.url));
    }

    return NextResponse.next();
  } catch (err) {
    console.error("[middleware] error:", err);
    return NextResponse.redirect(new URL("/login", req.url));
  }
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
