// How long an analysis took and which model wrote it (BL-023 / SPEC-015),
// read back from the stored AI answer for the admin. 60 seconds is the target.
import { z } from "zod";

const TARGET_MS = 60_000;

const AnalysisMetaSchema = z.object({
  model: z.string(),
  ai_ms: z.number().int().nonnegative(),
  total_ms: z.number().int().nonnegative(),
});

export type AnalysisMeta = z.infer<typeof AnalysisMetaSchema>;

export type AnalysisTiming = { model: string; aiSeconds: number; totalSeconds: number; slow: boolean };

/** The timing of a report's analysis, or null for reports made before it was recorded. */
export function analysisTiming(rawAiResponse: unknown): AnalysisTiming | null {
  const raw = rawAiResponse && typeof rawAiResponse === "object" ? (rawAiResponse as { analysis_meta?: unknown }) : {};
  const meta = AnalysisMetaSchema.safeParse(raw.analysis_meta);
  if (!meta.success) return null;
  return {
    model: meta.data.model,
    aiSeconds: Math.round(meta.data.ai_ms / 1000),
    totalSeconds: Math.round(meta.data.total_ms / 1000),
    slow: meta.data.total_ms > TARGET_MS,
  };
}
