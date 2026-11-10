import { describe, it, expect } from "vitest";
import { appBaseUrl } from "./appUrl";

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
