import { describe, expect, it } from "vitest";
import { isPublicPath } from "./publicPaths";

describe("isPublicPath", () => {
  it("lets anyone read the terms and privacy notice (BL-057 / SPEC-024 A1, B1)", () => {
    expect(isPublicPath("/terms")).toBe(true);
    expect(isPublicPath("/privacy")).toBe(true);
  });

  it("keeps the existing public paths public", () => {
    for (const path of ["/", "/blog", "/blog/a-post", "/login", "/register", "/verify", "/api/auth/session", "/api/stripe/webhook", "/auth/redirect"]) {
      expect(isPublicPath(path)).toBe(true);
    }
  });

  it("keeps signed-in paths private", () => {
    for (const path of ["/dashboard", "/surveys/1", "/properties/new", "/admin/surveys", "/api/surveys", "/api/address-lookup"]) {
      expect(isPublicPath(path)).toBe(false);
    }
  });
});
