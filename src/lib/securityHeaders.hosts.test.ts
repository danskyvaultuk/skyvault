// The CSP's connect-src admits the real browser destinations (BL-066 / SPEC-021 A2):
// the signed photo upload URL that src/lib/r2.ts produces (AWS S3, no custom
// endpoint) and SkyVault's Sentry DSN host.
import { describe, it, expect, beforeAll } from "vitest";
import { contentSecurityPolicy } from "./securityHeaders";

// Turns a connect-src source such as https://*.amazonaws.com into a host test.
function admitted(url: string): boolean {
  const csp = contentSecurityPolicy({ NODE_ENV: "production" });
  const sources = (csp.split("; ").find((d) => d.startsWith("connect-src ")) ?? "").split(" ").slice(1);
  const { protocol, host } = new URL(url);
  return sources.some((source) => {
    if (!source.startsWith("https://")) return false;
    const pattern = source.slice("https://".length);
    if (protocol !== "https:") return false;
    return pattern.startsWith("*.") ? host.endsWith(pattern.slice(1)) : host === pattern;
  });
}

let uploadUrl = "";

beforeAll(async () => {
  process.env.AWS_REGION = "eu-west-2";
  process.env.AWS_ACCESS_KEY_ID = "AKIAEXAMPLEEXAMPLE00";
  process.env.AWS_SECRET_ACCESS_KEY = "example-secret-for-signing-only";
  process.env.AWS_S3_BUCKET_NAME = "skyvault-example-bucket";
  const { getPresignedUploadUrl } = await import("./r2");
  uploadUrl = await getPresignedUploadUrl("surveys/s1/images/a.jpg", "image/jpeg");
});

describe("connect-src admits the launch journey's browser destinations", () => {
  it("admits the signed photo upload URL the storage client produces", () => {
    expect(new URL(uploadUrl).host).toMatch(/amazonaws\.com$/);
    expect(admitted(uploadUrl)).toBe(true);
  });

  it("admits SkyVault's Sentry DSN host (EU region)", () => {
    expect(admitted("https://o4512419371352064.ingest.de.sentry.io/api/4512419433611344/envelope/")).toBe(true);
  });

  it("does not admit an unlisted host", () => {
    expect(admitted("https://evil.example/collect")).toBe(false);
  });
});
