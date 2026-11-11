// The warnings beside the site addresses on the admin dashboard (BL-069). On
// 2026-11-11 stale Vercel settings sent every email link and login to a
// deleted deployment; these rules make such a setting visible to the admin.
import type { AppUrlSource, SourcedUrl } from "@/lib/appUrl";
import type { AuthUrl } from "@/lib/authUrl";

export type AddressLine = { label: string; address: string; sourceText: string; warnings: string[] };

const EMAIL_SOURCE_TEXT: Record<AppUrlSource, string> = {
  NEXT_PUBLIC_APP_URL: "the NEXT_PUBLIC_APP_URL setting",
  VERCEL_PROJECT_PRODUCTION_URL: "Vercel's production address",
  "localhost-default": "the built-in default",
};

function hostOf(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

function differsFromViewed(url: string, viewingHost: string | null): string[] {
  if (!viewingHost || hostOf(url) === viewingHost) return [];
  return [`This differs from the address you're viewing (${viewingHost}).`];
}

function emailLine(email: SourcedUrl, viewingHost: string | null): AddressLine {
  const warnings =
    email.source === "localhost-default"
      ? ["This is the localhost default: emails will link to a developer's own machine."]
      : differsFromViewed(email.url, viewingHost);
  return { label: "Email links go to", address: email.url, sourceText: EMAIL_SOURCE_TEXT[email.source], warnings };
}

function loginLine(login: AuthUrl, email: SourcedUrl, viewingHost: string | null): AddressLine {
  const label = "Login returns to";
  if (login.url === null) {
    return { label, address: "the address the visitor used", sourceText: "no setting (follows the visitor)", warnings: [] };
  }
  const warnings = [...differsFromViewed(login.url, viewingHost)];
  if (hostOf(login.url) !== hostOf(email.url)) warnings.push(`This differs from the email address (${email.url}).`);
  return { label, address: login.url, sourceText: `the ${login.source} setting`, warnings };
}

/** The email and login address lines for the admin dashboard, with their warnings. */
export function siteAddressReport(input: { email: SourcedUrl; login: AuthUrl; viewingHost: string | null }): [AddressLine, AddressLine] {
  return [emailLine(input.email, input.viewingHost), loginLine(input.login, input.email, input.viewingHost)];
}
