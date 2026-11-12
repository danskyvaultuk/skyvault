import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer", "sharp"],
};

// Sentry (BL-054 / SPEC-020). Source maps are uploaded only once a
// SENTRY_AUTH_TOKEN is set in Vercel; without it the build carries on as before.
export default withSentryConfig(nextConfig, {
  org: "skyvaultuk",
  project: "skyvault",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
});
