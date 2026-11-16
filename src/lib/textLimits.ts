// Length limits for the text the AI writes into a report (BL-079 / SPEC-026).
// The limits are SkyVault's own. The prompt asks for 150 characters (120 for a
// location), but a model cannot count characters exactly, so the code accepts
// twice that untouched and shortens anything longer instead of failing the
// whole analysis.
import { z } from "zod";

export const DESCRIPTION_LIMIT = 300;
export const LOCATION_LIMIT = 240;

const ELLIPSIS = "…";

/** The text unchanged if it fits; otherwise cut at the last word that fits, ending with "…", within the limit. */
export function shortenToLimit(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const room = text.slice(0, limit - ELLIPSIS.length);
  const lastSpace = room.lastIndexOf(" ");
  const cut = lastSpace > 0 ? room.slice(0, lastSpace) : room;
  return `${cut.replace(/[\s,;:.\-–—]+$/, "")}${ELLIPSIS}`;
}

/** A string that is shortened to the limit rather than refused for being too long. */
export function shortenedText(limit: number) {
  return z.string().transform((text) => shortenToLimit(text, limit));
}
