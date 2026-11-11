// What an admin may change on a report (BL-015 / BL-061). Client-safe: the
// review form imports the lists below, so this module imports only zod.
import { z } from "zod";

export const DEFECT_TYPES = [
  "missing_tiles", "cracked_tiles", "moss_growth", "flashing_damage",
  "gutter_damage", "ridge_damage", "valley_damage", "other",
] as const;

export const DEFECT_SEVERITIES = ["critical", "high", "medium", "low"] as const;
export const DEFECT_PRIORITIES = ["urgent", "high", "medium", "low"] as const;
export const DEFECT_CATEGORIES = ["functional", "cosmetic"] as const;
export const DEFECT_EXTENTS = ["small", "moderate", "large"] as const;

export const CorrectedDefectSchema = z.object({
  type: z.enum(DEFECT_TYPES),
  severity: z.enum(DEFECT_SEVERITIES),
  description: z.string().trim().min(1).max(150),
  image_index: z.number().int().min(0),
  // BL-009. Optional, because reports made before BL-009 have none of these.
  priority: z.enum(DEFECT_PRIORITIES).optional(),
  category: z.enum(DEFECT_CATEGORIES).optional(),
  extent: z.enum(DEFECT_EXTENTS).optional(),
  location: z.string().trim().max(120).optional(),
});

export const ReportCorrectionSchema = z.object({
  conditionScore: z.number().int().min(1).max(10),
  defects: z.array(CorrectedDefectSchema),
  recommendations: z.array(z.string().trim().min(1)),
  adminNotes: z.string().trim().max(5000).nullable(),
});

export type CorrectedDefect = z.infer<typeof CorrectedDefectSchema>;
export type ReportCorrection = z.infer<typeof ReportCorrectionSchema>;

/**
 * A stored report as the review form edits it. Defects from before BL-009
 * parse too, since their new fields are optional; a stored value that fits no
 * rule falls back to an empty list rather than crashing the page.
 */
export function correctionValues(report: {
  conditionScore: number;
  defectsJson: unknown;
  recommendations: unknown;
  adminNotes: string | null;
}): ReportCorrection {
  const defects = ReportCorrectionSchema.shape.defects.safeParse(report.defectsJson);
  const recommendations = ReportCorrectionSchema.shape.recommendations.safeParse(report.recommendations);
  return {
    conditionScore: report.conditionScore,
    defects: defects.success ? defects.data : [],
    recommendations: recommendations.success ? recommendations.data : [],
    adminNotes: report.adminNotes,
  };
}
