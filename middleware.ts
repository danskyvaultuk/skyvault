import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";
import { journeys } from "@/lib/journeys";
import { JourneyGuard } from "@/lib/journeyGuard";
import { loginPathFor } from "@/lib/returnPath";
import { isPublicPath } from "@/lib/publicPaths";

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

  if (isPublicPath(pathname)) return NextResponse.next();

  try {
    const session = req.auth;

    if (!session) {
      // A signed-out visitor asking for a page (say, the report linked from an
      // email) signs in and comes back to it (BL-062).
      const target = pathname.startsWith("/api/") ? "/login" : loginPathFor(pathname, req.nextUrl.search);
      return NextResponse.redirect(new URL(target, req.url));
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
