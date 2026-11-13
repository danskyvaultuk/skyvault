// Who runs SkyVault, for the terms and privacy notice (BL-057 / SPEC-024).
// SkyVault is not a company: it is run by a sole trader (operator decision,
// 2026-11-13). These documents are drafts for a solicitor to check before
// SkyVault charges money or launches publicly.
export const OPERATOR = {
  name: "Dan Weeks",
  description: "Dan Weeks, a sole trader trading as SkyVault",
  contactEmail: "dan@skyvaultuk.com",
} as const;

export const LEGAL_LAST_UPDATED = "13 November 2026";

/** One titled part of a legal document: paragraphs, then an optional list. */
export type LegalSection = { heading: string; paragraphs: readonly string[]; items?: readonly string[] };
