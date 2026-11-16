import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("form fields on phones (BL-078 / SPEC-027 D1)", () => {
  it("are at least 16px below the tablet width, so iOS does not zoom when one is tapped", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toMatch(/@media \(max-width: 767px\) \{\s*input,\s*select,\s*textarea \{\s*font-size: 16px !important;/);
  });
});

describe("the 16px rule beats each field's own size class (BL-078 / SPEC-027 D1)", () => {
  it("is !important, so a field's text-sm (as on the sign-in email field) cannot shrink it below 16px", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toContain("font-size: 16px !important;");
    expect(readFileSync("src/app/(auth)/login/page.tsx", "utf8")).toContain("text-sm");
  });
});
