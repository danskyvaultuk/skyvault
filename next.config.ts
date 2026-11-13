import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import { securityHeaders } from "./src/lib/securityHeaders";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer", "sharp"],
  // Security hardening (BL-066 / SPEC-021 Part A).
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders({ NODE_ENV: process.env.NODE_ENV }) }];
  },
};

// Sentry (BL-054 / SPEC-020). Source maps are uploaded only once a
// SENTRY_AUTH_TOKEN is set in Vercel; without it the build carries on as before.
export default withSentryConfig(nextConfig, {
  org: "skyvaultuk",
  project: "skyvault",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
});
