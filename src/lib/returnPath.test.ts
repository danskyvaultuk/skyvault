import { describe, it, expect } from "vitest";
import { safeReturnPath, signInReturnPath, loginPathFor } from "./returnPath";

describe("safeReturnPath", () => {
  it.each(["/surveys/abc/report", "/dashboard", "/surveys/abc/report?tab=pdf", "/"])("allows %s", (path) => {
    expect(safeReturnPath(path)).toBe(path);
  });

  it.each([
    ["a full address", "https://evil.example/surveys/abc"],
    ["a scheme without slashes", "javascript:alert(1)"],
    ["a protocol-relative address", "//evil.example/x"],
    ["a backslash trick", "/\\evil.example"],
    ["an empty value", ""],
    ["a relative path", "surveys/abc"],
    ["the login page", "/login"],
    ["the login page with a query", "/login?callbackUrl=/x"],
  ])("refuses %s", (_label, value) => {
    expect(safeReturnPath(value)).toBeNull();
  });

  it("refuses a missing value", () => {
    expect(safeReturnPath(null)).toBeNull();
    expect(safeReturnPath(undefined)).toBeNull();
  });
});

describe("signInReturnPath", () => {
  it("returns an allowed path", () => {
    expect(signInReturnPath("/surveys/abc/report")).toBe("/surveys/abc/report");
  });

  it.each([null, "", "https://evil.example", "//evil.example"])("falls back to /auth/redirect for %s", (value) => {
    expect(signInReturnPath(value)).toBe("/auth/redirect");
  });
});

describe("loginPathFor", () => {
  it("carries the requested page as the return address", () => {
    const url = new URL(loginPathFor("/surveys/abc/report", ""), "https://skyvault.test");
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("callbackUrl")).toBe("/surveys/abc/report");
  });

  it("keeps the query string", () => {
    const url = new URL(loginPathFor("/surveys/abc/report", "?tab=pdf&x=1"), "https://skyvault.test");
    expect(url.searchParams.get("callbackUrl")).toBe("/surveys/abc/report?tab=pdf&x=1");
  });
});
