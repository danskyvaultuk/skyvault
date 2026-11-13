import { z } from "zod";

// ── SV-046: per-photo tagging (+ multi-tag / aspect follow-up) ────────────────
// Since BL-021 (the SV-048 wiring) each photo's roofParts reach the Claude
// prompt through buildPhotoLabelsBlock below; aspect and captureMethod do not.
// Photos uploaded under a checklist item arrive already labelled.
// Tag contract:
//
//   {
//     "photoId": "string",
//     "roofParts": ["front" | "back" | "side" | "chimney" | "close_up" |
//                   "ridge" | "valley" | "gutter" | "flashing" | "overview" |
//                   "secondary_roof", ...],
//     "aspect": "north" | "south" | "east" | "west" | null,
//     "captureMethod": "string | null",
//     "taggedAt": "ISO 8601 string | null"
//   }
//
// Untagged photos have roofParts: [], aspect/captureMethod/taggedAt all null,
// and must flow through the existing analysis pipeline unchanged — SV-048
// should treat an empty roofParts array as "no tag", not as a value to branch on.
//
// roofParts and aspect are independent dimensions: roofParts answers "what does
// this photo show" (multi-select — a photo can be both front and chimney);
// aspect answers "which compass direction does it face" (single-select, since
// a single photo faces one direction). ridge/valley/gutter/flashing/overview
// deliberately mirror the defect "type" categories in claude.ts's
// RoofAnalysisSchema, so a tagged photo lines up with the AI's own vocabulary.
// secondary_roof (BL-076) marks a flat roof, dormer, bay window or porch roof:
// a smaller roof that is not one of the main slopes.

export const ROOF_PARTS = [
  "front", "back", "side", "chimney", "close_up",
  "ridge", "valley", "gutter", "flashing", "overview", "secondary_roof",
] as const;
export type RoofPart = (typeof ROOF_PARTS)[number];

export const ASPECTS = ["north", "south", "east", "west"] as const;
export type Aspect = (typeof ASPECTS)[number];

// roofParts: [] is the explicit "clear all part tags" path. aspect: null clears
// the direction. captureMethod is deliberately a free-form string, not an enum —
// wording isn't finalized yet (SV-049).
export const PhotoTagSchema = z.object({
  roofParts: z.array(z.enum(ROOF_PARTS)).max(ROOF_PARTS.length),
  aspect: z.enum(ASPECTS).nullable().optional(),
  captureMethod: z.string().max(100).nullable().optional(),
});

export type PhotoTagInput = z.infer<typeof PhotoTagSchema>;

export interface PhotoTag {
  photoId: string;
  roofParts: RoofPart[];
  aspect: Aspect | null;
  captureMethod: string | null;
  taggedAt: string | null;
}

export const ROOF_PART_LABELS: Record<RoofPart, string> = {
  front: "Front",
  back: "Back",
  side: "Side",
  chimney: "Chimney",
  close_up: "Close-up",
  ridge: "Ridge",
  valley: "Valley",
  gutter: "Gutter",
  flashing: "Flashing",
  overview: "Overview",
  secondary_roof: "Flat roof, dormer, bay or porch",
};

export const ASPECT_LABELS: Record<Aspect, string> = {
  north: "North",
  south: "South",
  east: "East",
  west: "West",
};

/**
 * The <photo_labels> block for the Claude prompt (BL-021): one line per
 * labelled photo, by its 0-based image index, e.g. "Image 2: chimney, flashing".
 * Unlabelled photos are left out; returns null when no photo is labelled.
 */
export function buildPhotoLabelsBlock(labels: readonly (readonly RoofPart[])[] | null | undefined): string | null {
  if (!labels) return null;
  const lines = labels.flatMap((parts, index) => (parts.length > 0 ? [`Image ${index}: ${parts.join(", ")}`] : []));
  return lines.length > 0 ? lines.join("\n") : null;
}
