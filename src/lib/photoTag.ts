import { z } from "zod";

// ── SV-046: per-photo tagging ──────────────────────────────────────────────
// Output contract for SV-048 (Claude Vision prompt wiring — not built yet):
//
//   {
//     "photoId": "string",
//     "roofPart": "front" | "back" | "side" | "chimney" | "close_up" | null,
//     "captureMethod": "string | null",
//     "taggedAt": "ISO 8601 string | null"
//   }
//
// Untagged photos have roofPart/captureMethod/taggedAt all null and must flow
// through the existing analysis pipeline unchanged — SV-048 should treat a
// null roofPart as "no tag", not as a value to branch on.

export const ROOF_PARTS = ["front", "back", "side", "chimney", "close_up"] as const;
export type RoofPart = (typeof ROOF_PARTS)[number];

// roofPart: null is the explicit untag path. captureMethod is deliberately a
// free-form string, not an enum — wording isn't finalized yet (SV-049).
export const PhotoTagSchema = z.object({
  roofPart: z.enum(ROOF_PARTS).nullable(),
  captureMethod: z.string().max(100).nullable().optional(),
});

export type PhotoTagInput = z.infer<typeof PhotoTagSchema>;

export interface PhotoTag {
  photoId: string;
  roofPart: RoofPart | null;
  captureMethod: string | null;
  taggedAt: string | null;
}

export const ROOF_PART_LABELS: Record<RoofPart, string> = {
  front: "Front",
  back: "Back",
  side: "Side",
  chimney: "Chimney",
  close_up: "Close-up",
};
