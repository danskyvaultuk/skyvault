// Sentry in the customer's browser (BL-054 / SPEC-020); options and data rules in src/lib/monitoring.ts.
import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/monitoring";

const options = sentryOptions({
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
});
if (options) Sentry.init(options);

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
