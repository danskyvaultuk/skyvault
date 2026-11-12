// Error monitoring with Sentry (BL-054 / SPEC-020). Switched on only by the
// public DSN setting; without it nothing is initialised or sent. SkyVault sends
// errors only: no tracing, no session replay, and none of the personal data the
// SDK would otherwise collect (its AI integration, for one, would record the
// customer's photos and notes sent to Claude).
import * as Sentry from "@sentry/nextjs";

type MonitoringEnv = {
  NEXT_PUBLIC_SENTRY_DSN?: string;
  VERCEL_ENV?: string;
};

export type SentryOptions = {
  dsn: string;
  environment: string;
  sendDefaultPii: false;
  dataCollection: NonNullable<Parameters<typeof Sentry.init>[0]>["dataCollection"];
};

export function sentryOptions(env: MonitoringEnv): SentryOptions | null {
  const dsn = env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn) return null;
  return {
    dsn,
    environment: env.VERCEL_ENV || "development",
    sendDefaultPii: false,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      mcp: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
    },
  };
}

/** What failed, and ids that locate it. Never an email address, a name or a photo. */
export type ErrorContext = { what: string } & Record<string, string | number | undefined>;

/** Logs a failure as before and, when Sentry is on, reports it there too (SPEC-020 B1). */
export function reportError(error: unknown, context: ErrorContext): void {
  const { what, ...ids } = context;
  console.error(`[${what}]`, ids, error);
  const reported = error instanceof Error ? error : new Error(String(error));
  Sentry.captureException(reported, { tags: { what }, extra: ids });
}
