// What an admin may change on a report (BL-015 / BL-061). Client-safe: the
// review form imports the lists below, so this module imports only zod.
import { z } from "zod";

export const DEFECT_TYPES = [
  "missing_tiles", "cracked_tiles", "moss_growth", "flashing_damage",
  "gutter_damage", "ridge_damage", "valley_damage", "other",
] as const;

export const DEFECT_SEVERITIES = ["critical", "high", "medium", "low"] as const;

export const CorrectedDefectSchema = z.object({
  type: z.enum(DEFECT_TYPES),
  severity: z.enum(DEFECT_SEVERITIES),
  description: z.string().trim().min(1).max(150),
  image_index: z.number().int().min(0),
});

export const ReportCorrectionSchema = z.object({
  conditionScore: z.number().int().min(1).max(10),
  defects: z.array(CorrectedDefectSchema),
  recommendations: z.array(z.string().trim().min(1)),
  adminNotes: z.string().trim().max(5000).nullable(),
});

export type CorrectedDefect = z.infer<typeof CorrectedDefectSchema>;
export type ReportCorrection = z.infer<typeof ReportCorrectionSchema>;
