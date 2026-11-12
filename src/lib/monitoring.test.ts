import { describe, expect, it, vi, beforeEach } from "vitest";

const mockCapture = vi.fn();
vi.mock("@sentry/nextjs", () => ({ captureException: (...args: unknown[]) => mockCapture(...args) }));

const { reportError, sentryOptions } = await import("./monitoring");

const DSN = "https://abc@o1.ingest.de.sentry.io/123";

describe("sentryOptions (SPEC-020 A)", () => {
  it("is null without a DSN, so nothing is initialised or sent", () => {
    expect(sentryOptions({})).toBeNull();
    expect(sentryOptions({ NEXT_PUBLIC_SENTRY_DSN: "  " })).toBeNull();
  });

  it("carries the DSN and the deployment's environment", () => {
    const options = sentryOptions({ NEXT_PUBLIC_SENTRY_DSN: DSN, VERCEL_ENV: "production" });
    expect(options?.dsn).toBe(DSN);
    expect(options?.environment).toBe("production");
    expect(sentryOptions({ NEXT_PUBLIC_SENTRY_DSN: DSN })?.environment).toBe("development");
  });

  it("turns off every automatic personal-data category", () => {
    expect(sentryOptions({ NEXT_PUBLIC_SENTRY_DSN: DSN })?.dataCollection).toEqual({
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
    });
  });

  it("sends no performance traces and no session replay", () => {
    const options = sentryOptions({ NEXT_PUBLIC_SENTRY_DSN: DSN });
    expect(options).not.toHaveProperty("tracesSampleRate");
    expect(options).not.toHaveProperty("tracesSampler");
    expect(options).not.toHaveProperty("replaysSessionSampleRate");
    expect(options).not.toHaveProperty("replaysOnErrorSampleRate");
    expect(options?.sendDefaultPii).toBe(false);
  });
});

describe("reportError (SPEC-020 B1)", () => {
  beforeEach(() => mockCapture.mockReset());

  it("logs the error and sends it to Sentry with its context", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("boom");

    reportError(err, { what: "analysis", surveyId: "survey-1" });

    expect(log).toHaveBeenCalledWith("[analysis]", { surveyId: "survey-1" }, err);
    expect(mockCapture).toHaveBeenCalledWith(err, { tags: { what: "analysis" }, extra: { surveyId: "survey-1" } });
    log.mockRestore();
  });

  it("wraps a non-error value so Sentry still gets a stack", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    reportError("email provider said 422", { what: "email" });
    expect(mockCapture.mock.calls[0][0]).toBeInstanceOf(Error);
    expect((mockCapture.mock.calls[0][0] as Error).message).toBe("email provider said 422");
  });
});
