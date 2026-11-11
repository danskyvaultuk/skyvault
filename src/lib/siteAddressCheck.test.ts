import { describe, expect, it } from "vitest";
import { siteAddressReport } from "./siteAddressCheck";

const LIVE = "skyvault-7341.vercel.app";
const EMAIL_OK = { url: `https://${LIVE}`, source: "NEXT_PUBLIC_APP_URL" } as const;
const VISITOR = { url: null, source: "visitor" } as const;

describe("siteAddressReport (BL-069)", () => {
  it("gives two lines with addresses and sources, and no warnings when everything matches the live site", () => {
    const [email, login] = siteAddressReport({ email: EMAIL_OK, login: { url: `https://${LIVE}`, source: "AUTH_URL" }, viewingHost: LIVE });
    expect(email).toEqual({ label: "Email links go to", address: `https://${LIVE}`, sourceText: "the NEXT_PUBLIC_APP_URL setting", warnings: [] });
    expect(login).toEqual({ label: "Login returns to", address: `https://${LIVE}`, sourceText: "the AUTH_URL setting", warnings: [] });
  });

  it("warns about the localhost default email address", () => {
    const [email] = siteAddressReport({ email: { url: "http://localhost:3000", source: "localhost-default" }, login: VISITOR, viewingHost: null });
    expect(email.sourceText).toBe("the built-in default");
    expect(email.warnings).toEqual(["This is the localhost default: emails will link to a developer's own machine."]);
  });

  it("warns when the email address differs from the address being viewed", () => {
    const [email] = siteAddressReport({
      email: { url: "https://skyvault-steel.vercel.app", source: "NEXT_PUBLIC_APP_URL" },
      login: VISITOR,
      viewingHost: LIVE,
    });
    expect(email.warnings).toEqual([`This differs from the address you're viewing (${LIVE}).`]);
  });

  it("names Vercel's production address as a source", () => {
    const [email] = siteAddressReport({ email: { url: `https://${LIVE}`, source: "VERCEL_PROJECT_PRODUCTION_URL" }, login: VISITOR, viewingHost: LIVE });
    expect(email.sourceText).toBe("Vercel's production address");
  });

  it("warns when a fixed login address differs from the viewed address and from the email address", () => {
    const [, login] = siteAddressReport({
      email: EMAIL_OK,
      login: { url: "https://skyvault-steel.vercel.app", source: "NEXTAUTH_URL" },
      viewingHost: LIVE,
    });
    expect(login.sourceText).toBe("the NEXTAUTH_URL setting");
    expect(login.warnings).toEqual([
      `This differs from the address you're viewing (${LIVE}).`,
      `This differs from the email address (https://${LIVE}).`,
    ]);
  });

  it("does not warn about a login address that follows the visitor", () => {
    const [, login] = siteAddressReport({ email: EMAIL_OK, login: VISITOR, viewingHost: "anything.example" });
    expect(login).toEqual({ label: "Login returns to", address: "the address the visitor used", sourceText: "no setting (follows the visitor)", warnings: [] });
  });

  it("skips the viewed-address rules when the viewing host is unknown", () => {
    const [email, login] = siteAddressReport({
      email: { url: "https://skyvault-steel.vercel.app", source: "NEXT_PUBLIC_APP_URL" },
      login: { url: "https://skyvault-steel.vercel.app", source: "AUTH_URL" },
      viewingHost: null,
    });
    expect(email.warnings).toEqual([]);
    expect(login.warnings).toEqual([]);
  });
});
