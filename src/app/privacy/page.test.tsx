import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import PrivacyPage from "./page";

// Apostrophes are HTML-escaped in markup; compare against readable text.
const html = renderToStaticMarkup(<PrivacyPage />).replace(/&#x27;/g, "'").replace(/&amp;/g, "&");

describe("/privacy (BL-057 / SPEC-024 Part A)", () => {
  it("A1: names the sole trader responsible, the privacy contact and the last-updated date", () => {
    expect(html).toContain("Dan Weeks, a sole trader trading as SkyVault");
    expect(html).toContain("controller");
    expect(html).toContain("dan@skyvaultuk.com");
    expect(html).toContain("Last updated 13 November 2026");
  });

  it("A2: lists each kind of personal data, its purpose and its lawful basis", () => {
    for (const data of [
      "name and email address",
      "Google account",
      "Property addresses and postcodes",
      "Roof photos",
      "survey notes",
      "answers about the roof",
      "reports we produce",
      "Roofer introduction requests",
    ]) expect(html).toContain(data);
    expect(html).toContain("Lawful basis: to provide the service you asked for (contract)");
    expect(html).toContain("Lawful basis: our legitimate interest");
  });

  it("A3: names each outside service and what it receives", () => {
    for (const service of [
      "Anthropic (AI analysis): your roof photos, survey notes and roof answers",
      "Amazon Web Services: storage for your photos and report PDFs",
      "Neon: our database",
      "Ideal Postcodes: the postcode you search for",
      "Resend: your email address",
      "Google: your sign-in",
      "Vercel: hosting",
      "Sentry: error reports, set up to leave out personal data",
    ]) expect(html).toContain(service);
  });

  it("A3: says data may be processed outside the UK, and roofer introductions pass details to the roofer", () => {
    expect(html).toContain("outside the UK");
    expect(html).toContain("we pass your name, contact details, the property address and your report to the roofer");
  });

  it("A4: states retention, the UK GDPR rights, the ICO and the cookie position", () => {
    expect(html).toContain("while your account exists");
    expect(html).toContain("we delete it within 30 days");
    for (const right of ["access", "rectification", "erasure", "Restrict or object", "portability"]) expect(html).toContain(right);
    expect(html).toContain("Information Commissioner's Office (ICO)");
    expect(html).toContain("only the cookies needed to sign you in and keep you signed in");
  });
});
