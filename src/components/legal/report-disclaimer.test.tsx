import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { REPORT_DISCLAIMER } from "@/content/legal/disclaimer";
import { ReportDisclaimer } from "./report-disclaimer";

describe("REPORT_DISCLAIMER (BL-057 / SPEC-024 C1)", () => {
  it("says the report is an AI-assisted visual assessment of the customer's photos, not a survey, may miss defects, and needs a roofer", () => {
    expect(REPORT_DISCLAIMER).toContain("AI-assisted visual assessment based only on the photos you provided");
    expect(REPORT_DISCLAIMER).toContain("not a professional survey or a physical inspection");
    expect(REPORT_DISCLAIMER).toContain("may miss defects your photos do not show");
    expect(REPORT_DISCLAIMER).toContain("qualified roofer check your roof before deciding on any work");
  });
});

describe("ReportDisclaimer on the report page (BL-057 / SPEC-024 C1)", () => {
  it("shows the disclaimer with a link to the Terms", () => {
    const html = renderToStaticMarkup(<ReportDisclaimer />);
    expect(html).toContain("AI-assisted visual assessment");
    expect(html).toContain('href="/terms"');
  });

  it("is what the report page renders, in place of the old one-line disclaimer", () => {
    const page = readFileSync("src/app/(customer)/surveys/[id]/report/page.tsx", "utf8");
    expect(page).toContain("<ReportDisclaimer />");
    expect(page).not.toContain("intended as a guide only");
  });
});
