import { describe, expect, it } from "vitest";
import { authBaseUrl } from "./authUrl";

describe("authBaseUrl (BL-069)", () => {
  it("uses AUTH_URL first", () => {
    expect(authBaseUrl({ AUTH_URL: "https://a.test/", NEXTAUTH_URL: "https://b.test" })).toEqual({ url: "https://a.test", source: "AUTH_URL" });
  });

  it("falls back to NEXTAUTH_URL", () => {
    expect(authBaseUrl({ NEXTAUTH_URL: "https://b.test" })).toEqual({ url: "https://b.test", source: "NEXTAUTH_URL" });
    expect(authBaseUrl({ AUTH_URL: "  ", NEXTAUTH_URL: "https://b.test" })).toEqual({ url: "https://b.test", source: "NEXTAUTH_URL" });
  });

  it("follows the visitor's address when neither is set", () => {
    expect(authBaseUrl({})).toEqual({ url: null, source: "visitor" });
    expect(authBaseUrl({ AUTH_URL: "", NEXTAUTH_URL: "" })).toEqual({ url: null, source: "visitor" });
  });
});
