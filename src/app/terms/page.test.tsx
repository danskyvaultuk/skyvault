import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import TermsPage from "./page";

const html = renderToStaticMarkup(<TermsPage />).replace(/&#x27;/g, "'").replace(/&amp;/g, "&");

describe("/terms (BL-057 / SPEC-024 Part B)", () => {
  it("B1: identifies the sole trader and the last-updated date", () => {
    expect(html).toContain("Terms & Conditions");
    expect(html).toContain("Dan Weeks, a sole trader trading as SkyVault");
    expect(html).toContain("Last updated 13 November 2026");
  });

  it("B2: says a report is an AI-assisted visual assessment, not a survey or inspection, to be checked by a roofer", () => {
    expect(html).toContain("AI-assisted visual assessment of the photos you upload");
    expect(html).toContain("not a professional or structural survey");
    expect(html).toContain("not a physical inspection");
    expect(html).toContain("A qualified roofer should check your roof before you decide on or commission any work");
  });

  it("B3: sets the customer's responsibilities, including never climbing onto a roof", () => {
    expect(html).toContain("photos you are entitled to share, of a property you own or have permission to survey");
    expect(html).toContain("You will never climb onto a roof or put yourself or anyone else at risk to take photos");
  });

  it("B4: limits liability within the law, keeps statutory rights, and names English law", () => {
    expect(html).toContain("we are not responsible for decisions you make");
    expect(html).toContain("death or personal injury caused by our negligence, or for fraud");
    expect(html).toContain("Your statutory rights as a consumer are not affected");
    expect(html).toContain("law of England and Wales");
  });
});
