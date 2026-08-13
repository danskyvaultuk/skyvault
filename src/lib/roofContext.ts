import { z } from "zod";

// ── Opt-in pre-analysis Q&A — asked once per survey, never required ───────────
// All fields optional; skipping entirely must behave identically to answering nothing.
export const RoofContextSchema = z.object({
  ageBand: z.enum(["0-5", "5-15", "15+", "not_sure"]).optional(),
  ageNote: z.string().max(300).optional(),
  material: z.enum(["slate", "tile", "felt", "shingle", "not_sure"]).optional(),
  shape: z.enum(["flat", "pitched"]).optional(),
  slopeCount: z.number().int().min(0).max(20).optional(),
  problemAreas: z.string().max(500).optional(),
});

export type RoofContext = z.infer<typeof RoofContextSchema>;

/**
 * Strips control characters and collapses whitespace on free-text fields.
 * Truncation to the schema's max length is enforced separately by Zod on write,
 * this only guards against characters that could break the XML-tag framing
 * used when the context is injected into the Claude prompt.
 */
function cleanFreeText(value: string): string {
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").trim();
}

export function sanitizeRoofContext(input: RoofContext): RoofContext {
  return {
    ...input,
    ageNote: input.ageNote ? cleanFreeText(input.ageNote) : undefined,
    problemAreas: input.problemAreas ? cleanFreeText(input.problemAreas) : undefined,
  };
}

const AGE_LABELS: Record<string, string> = {
  "0-5": "0–5 years old",
  "5-15": "5–15 years old",
  "15+": "15+ years old",
  not_sure: "age not known",
};

const MATERIAL_LABELS: Record<string, string> = {
  slate: "slate",
  tile: "tile",
  felt: "felt",
  shingle: "shingle",
  not_sure: "material not known",
};

/**
 * Builds the <roof_context> block injected into the Claude Vision prompt.
 * Returns null when there is nothing to report so the pipeline can omit the
 * block entirely — matching the existing <customer_notes> pattern.
 */
export function buildRoofContextPromptBlock(context: RoofContext | null | undefined): string | null {
  if (!context) return null;

  const lines: string[] = [];
  if (context.ageBand) {
    lines.push(`Roof age: ${AGE_LABELS[context.ageBand]}${context.ageNote ? ` — ${context.ageNote.slice(0, 300)}` : ""}`);
  }
  if (context.material) {
    lines.push(`Material: ${MATERIAL_LABELS[context.material]}`);
  }
  if (context.shape) {
    lines.push(`Shape: ${context.shape}${context.slopeCount ? `, ${context.slopeCount} slope(s)` : ""}`);
  }
  if (context.problemAreas) {
    lines.push(`Known problem areas reported by customer: ${context.problemAreas.slice(0, 500)}`);
  }

  if (lines.length === 0) return null;

  return lines.join("\n");
}

const AGE_DISPLAY_LABELS: Record<string, string> = {
  "0-5": "0–5 years",
  "5-15": "5–15 years",
  "15+": "15+ years",
  not_sure: "Not sure",
};

const MATERIAL_DISPLAY_LABELS: Record<string, string> = {
  slate: "Slate",
  tile: "Tile",
  felt: "Felt",
  shingle: "Shingle",
  not_sure: "Not sure",
};

/**
 * Human-readable "label: value" pairs for whatever the customer actually
 * answered — used to display the roof Q&A on the report page and in the PDF.
 * Returns [] when context is null/undefined/empty (fully skipped), so callers
 * can render nothing rather than an empty section.
 */
export function roofContextSummaryLines(
  context: RoofContext | null | undefined
): { label: string; value: string }[] {
  if (!context) return [];

  const lines: { label: string; value: string }[] = [];
  if (context.ageBand) {
    lines.push({
      label: "Roof age",
      value: AGE_DISPLAY_LABELS[context.ageBand] + (context.ageNote ? ` — ${context.ageNote}` : ""),
    });
  }
  if (context.material) {
    lines.push({ label: "Material", value: MATERIAL_DISPLAY_LABELS[context.material] });
  }
  if (context.shape) {
    const shapeLabel = context.shape === "flat" ? "Flat" : "Pitched";
    lines.push({
      label: "Shape",
      value: shapeLabel + (context.slopeCount ? `, ${context.slopeCount} slope(s)` : ""),
    });
  }
  if (context.problemAreas) {
    lines.push({ label: "Known problem areas", value: context.problemAreas });
  }

  return lines;
}
