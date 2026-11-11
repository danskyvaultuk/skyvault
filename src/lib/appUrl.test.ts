import { describe, it, expect } from "vitest";
import { appBaseUrl, appBaseUrlWithSource } from "./appUrl";

describe("appBaseUrl", () => {
  it("uses NEXT_PUBLIC_APP_URL when set", () => {
    expect(
      appBaseUrl({ NEXT_PUBLIC_APP_URL: "https://www.skyvault.test", VERCEL_PROJECT_PRODUCTION_URL: "sv.vercel.app" })
    ).toBe("https://www.skyvault.test");
  });

  it("falls back to the Vercel production address", () => {
    expect(appBaseUrl({ VERCEL_PROJECT_PRODUCTION_URL: "sv.vercel.app" })).toBe("https://sv.vercel.app");
  });

  it("falls back to localhost when neither is set", () => {
    expect(appBaseUrl({})).toBe("http://localhost:3000");
  });

  it("treats an empty setting as unset", () => {
    expect(appBaseUrl({ NEXT_PUBLIC_APP_URL: "", VERCEL_PROJECT_PRODUCTION_URL: "sv.vercel.app" })).toBe(
      "https://sv.vercel.app"
    );
  });

  it("removes a trailing slash", () => {
    expect(appBaseUrl({ NEXT_PUBLIC_APP_URL: "https://www.skyvault.test/" })).toBe("https://www.skyvault.test");
  });
});

describe("appBaseUrlWithSource (BL-069)", () => {
  it("names NEXT_PUBLIC_APP_URL when it supplied the address", () => {
    expect(appBaseUrlWithSource({ NEXT_PUBLIC_APP_URL: "https://www.skyvault.test/", VERCEL_PROJECT_PRODUCTION_URL: "sv.vercel.app" })).toEqual({
      url: "https://www.skyvault.test",
      source: "NEXT_PUBLIC_APP_URL",
    });
  });

  it("names Vercel's production address when the setting is unset or empty", () => {
    const expected = { url: "https://sv.vercel.app", source: "VERCEL_PROJECT_PRODUCTION_URL" };
    expect(appBaseUrlWithSource({ VERCEL_PROJECT_PRODUCTION_URL: "sv.vercel.app" })).toEqual(expected);
    expect(appBaseUrlWithSource({ NEXT_PUBLIC_APP_URL: "", VERCEL_PROJECT_PRODUCTION_URL: "sv.vercel.app" })).toEqual(expected);
  });

  it("names the localhost default when neither is set", () => {
    expect(appBaseUrlWithSource({})).toEqual({ url: "http://localhost:3000", source: "localhost-default" });
  });
});
