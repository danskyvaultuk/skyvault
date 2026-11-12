// Sentry on the server (BL-054 / SPEC-020); options and data rules in src/lib/monitoring.ts.
import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/monitoring";

const options = sentryOptions({
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  VERCEL_ENV: process.env.VERCEL_ENV,
});
if (options) Sentry.init(options);
