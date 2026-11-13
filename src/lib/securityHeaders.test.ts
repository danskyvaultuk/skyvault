import { describe, it, expect } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "./securityHeaders";
import nextConfig from "../../next.config";

function header(key: string, env = { NODE_ENV: "production" }): string | undefined {
  return securityHeaders(env).find((h) => h.key === key)?.value;
}

describe("securityHeaders", () => {
  it("sets the baseline headers", () => {
    expect(header("X-Frame-Options")).toBe("DENY");
    expect(header("X-Content-Type-Options")).toBe("nosniff");
    expect(header("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("sets a CSP that forbids framing, plugins and base changes", () => {
    const csp = header("Content-Security-Policy") ?? "";
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
  });

  it("admits the launch journey's storage, Sentry and Google sign-in", () => {
    const csp = contentSecurityPolicy({ NODE_ENV: "production" });
    expect(csp).toMatch(/connect-src [^;]*https:\/\/\*\.amazonaws\.com/);
    expect(csp).toMatch(/connect-src [^;]*https:\/\/\*\.ingest\.de\.sentry\.io/);
    expect(csp).toMatch(/img-src [^;]*https:/);
    expect(csp).toMatch(/form-action [^;]*https:\/\/accounts\.google\.com/);
  });

  it("admits no address lookup host: the browser only calls SkyVault's own route (BL-074 / SPEC-022 C2)", () => {
    const connectSrc = /connect-src ([^;]*)/.exec(contentSecurityPolicy({ NODE_ENV: "production" }))?.[1] ?? "";
    expect(connectSrc).not.toContain("nominatim.openstreetmap.org");
    expect(connectSrc).not.toContain("api.postcodes.io");
    expect(connectSrc).not.toContain("ideal-postcodes");
  });

  it("allows eval only outside production", () => {
    expect(contentSecurityPolicy({ NODE_ENV: "production" })).not.toContain("'unsafe-eval'");
    expect(contentSecurityPolicy({ NODE_ENV: "development" })).toContain("'unsafe-eval'");
  });
});

describe("next.config", () => {
  it("turns off X-Powered-By", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it("applies the security headers to every path", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const all = rules.find((r) => r.source === "/:path*");
    const keys = all?.headers.map((h) => h.key) ?? [];
    expect(keys).toEqual(
      expect.arrayContaining(["Content-Security-Policy", "X-Frame-Options", "X-Content-Type-Options", "Referrer-Policy"])
    );
  });
});
