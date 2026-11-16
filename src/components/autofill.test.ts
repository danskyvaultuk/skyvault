import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("autofill hints (BL-078 / SPEC-027 D2)", () => {
  it("the sign-in email field asks for the email", () => {
    expect(read("src/app/(auth)/login/page.tsx")).toMatch(/type="email"\s+autoComplete="email"/);
  });

  it("the register name and email fields ask for the name and email", () => {
    const page = read("src/app/(auth)/register/register-form.tsx");
    expect(page).toContain('autoComplete="name"');
    expect(page).toMatch(/type="email"\s+autoComplete="email"/);
  });
});
