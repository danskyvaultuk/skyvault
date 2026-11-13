import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { LegalFooter } from "./legal-footer";

describe("LegalFooter (BL-057 / SPEC-024 D2, E1)", () => {
  it("links to the Terms and the Privacy notice, and says SkyVault without Ltd", () => {
    const html = renderToStaticMarkup(<LegalFooter />);
    expect(html).toContain('href="/terms"');
    expect(html).toContain('href="/privacy"');
    expect(html).toContain("© 2026 SkyVault. All rights reserved.");
    expect(html).not.toContain("Ltd");
  });

  it.each(["src/app/page.tsx", "src/app/blog/page.tsx", "src/app/blog/3d-roof-survey-demo/page.tsx"])(
    "is the footer of %s, which no longer says SkyVault Ltd",
    (path) => {
      const page = readFileSync(path, "utf8");
      expect(page).toContain("<LegalFooter />");
      expect(page).not.toContain("SkyVault Ltd");
    }
  );
});
