import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { SignInAgreement } from "./sign-in-agreement";

describe("SignInAgreement (BL-057 / SPEC-024 D1)", () => {
  it("says continuing means agreeing to the Terms and having read the Privacy notice, with links to both", () => {
    const html = renderToStaticMarkup(<SignInAgreement />).replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
    expect(html).toContain("By continuing, you agree to our");
    expect(html).toContain("confirm you've read our");
    expect(html).toContain('href="/terms"');
    expect(html).toContain('href="/privacy"');
  });

  it.each([["login", "src/app/(auth)/login/page.tsx"], ["register", "src/app/(auth)/register/page.tsx"]])(
    "is shown on the %s page",
    (_name, path) => {
      const page = readFileSync(path, "utf8");
      expect(page).toContain('import { SignInAgreement } from "@/components/legal/sign-in-agreement"');
      expect(page).toContain("<SignInAgreement />");
    }
  );
});
