import { z } from "zod";

// ── SV-046: per-photo tagging (+ multi-tag / aspect follow-up) ────────────────
// Output contract for SV-048 (Claude Vision prompt wiring — not built yet):
//
//   {
//     "photoId": "string",
//     "roofParts": ["front" | "back" | "side" | "chimney" | "close_up" |
//                   "ridge" | "valley" | "gutter" | "flashing" | "overview", ...],
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

export const ROOF_PARTS = [
  "front", "back", "side", "chimney", "close_up",
  "ridge", "valley", "gutter", "flashing", "overview",
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
};

export const ASPECT_LABELS: Record<Aspect, string> = {
  north: "North",
  south: "South",
  east: "East",
  west: "West",
};
