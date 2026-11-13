// Baseline security headers for every response (BL-066 / SPEC-021 Part A).
// Applied to all paths by next.config.ts, which also turns off X-Powered-By.

export type SecurityHeader = { key: string; value: string };

/**
 * The Content-Security-Policy admits only what the launch journey uses:
 * - scripts and styles from this site (Next.js needs inline bootstrap code;
 *   development tooling also needs eval);
 * - photos shown from the storage bucket, uploaded to it from the browser
 *   (src/lib/r2.ts signs AWS S3 URLs, <bucket>.s3.<region>.amazonaws.com);
 * - browser errors sent to Sentry's EU ingest;
 * - address and postcode lookup on the add-a-property page;
 * - Google sign-in, which the login form redirects to.
 */
export function contentSecurityPolicy(env: { NODE_ENV?: string }): string {
  const scriptSrc = ["'self'", "'unsafe-inline'", ...(env.NODE_ENV === "production" ? [] : ["'unsafe-eval'"])];
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": scriptSrc,
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "font-src": ["'self'", "data:"],
    "connect-src": [
      "'self'",
      "https://*.amazonaws.com",
      "https://*.ingest.de.sentry.io",
      "https://nominatim.openstreetmap.org",
      "https://api.postcodes.io",
    ],
    "worker-src": ["'self'", "blob:"],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'", "https://accounts.google.com"],
  };
  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(" ")}`)
    .join("; ");
}

export function securityHeaders(env: { NODE_ENV?: string }): SecurityHeader[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(env) },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  ];
}
