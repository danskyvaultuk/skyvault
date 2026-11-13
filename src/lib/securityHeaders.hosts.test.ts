// The CSP's connect-src admits the real browser destinations (BL-066 / SPEC-021 A2):
// the signed photo upload URL that src/lib/r2.ts produces (AWS S3, no custom
// endpoint) and SkyVault's Sentry DSN host.
import { describe, it, expect, beforeAll } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { contentSecurityPolicy } from "./securityHeaders";

function directive(name: string): string[] {
  const csp = contentSecurityPolicy({ NODE_ENV: "production" });
  return (csp.split("; ").find((d) => d.startsWith(`${name} `)) ?? "").split(" ").slice(1);
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

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
let readUrl = "";

beforeAll(async () => {
  process.env.AWS_REGION = "eu-west-2";
  process.env.AWS_ACCESS_KEY_ID = "AKIAEXAMPLEEXAMPLE00";
  process.env.AWS_SECRET_ACCESS_KEY = "example-secret-for-signing-only";
  process.env.AWS_S3_BUCKET_NAME = "skyvault-example-bucket";
  const { getPresignedUploadUrl, getPresignedReadUrl } = await import("./r2");
  uploadUrl = await getPresignedUploadUrl("surveys/s1/images/a.jpg", "image/jpeg");
  readUrl = await getPresignedReadUrl("surveys/s1/report.pdf", 3600);
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

describe("the report page's photos and PDF download", () => {
  it("shows photos from signed storage URLs, which img-src admits", () => {
    expect(new URL(readUrl).protocol).toBe("https:");
    expect(directive("img-src")).toContain("https:");
  });

  it("downloads the PDF through a plain link, which the policy does not restrict", () => {
    const page = readFileSync(join(process.cwd(), "src/app/(customer)/surveys/[id]/report/page.tsx"), "utf8");
    expect(page).toMatch(/href=\{pdfUrl\}/);
    const csp = contentSecurityPolicy({ NODE_ENV: "production" });
    expect(csp).not.toMatch(/navigate-to/);
  });

  it("embeds no frame, PDF viewer or plugin anywhere, so blocking them breaks nothing", () => {
    const embedding = sourceFiles(join(process.cwd(), "src")).filter((file) =>
      /<(iframe|embed|object)[\s>]/.test(readFileSync(file, "utf8"))
    );
    expect(embedding).toEqual([]);
  });
});
