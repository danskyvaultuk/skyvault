// Paths anyone can open without signing in. Moved out of middleware.ts so it is
// tested; /terms and /privacy added by BL-057 / SPEC-024.
const PUBLIC_PREFIXES = [
  "/blog",
  "/login",
  "/register",
  "/verify",
  "/terms",
  "/privacy",
  "/api/auth",
  "/api/stripe/webhook",
  "/auth/redirect",
] as const;

export function isPublicPath(pathname: string): boolean {
  return pathname === "/" || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
