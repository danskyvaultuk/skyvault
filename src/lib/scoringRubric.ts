// The condition scoring rubric (BL-003) and the code-side safety caps
// (SPEC-010). The AI scores against the rubric; the caps then keep a serious
// functional defect from sitting beside a generous score. Calibrating the
// rubric against reviewed surveys is SEED-024.

export const RUBRIC_BANDS = [
  { score: 10, description: "As new: no defects; coverings, ridge, flashings and gutters all sound." },
  { score: 9, description: "Very good: only trivial cosmetic marks (light staining, a few moss spots); routine checks only." },
  { score: 8, description: "Good: minor cosmetic issues (moss, lichen, staining) and no functional defects." },
  { score: 7, description: "Fair to good: cosmetic issues plus at most a few low-priority functional defects over a small area (a single slipped tile, a partly blocked gutter)." },
  { score: 6, description: "Fair: several low or medium functional defects, or one medium defect over a moderate area; repairs advisable within a year." },
  { score: 5, description: "Below average: several medium functional defects, or cosmetic growth so heavy it hides the covering; repairs needed within months." },
  { score: 4, description: "Poor: a high-priority functional defect, or medium defects over a large area; water getting in is likely without repair." },
  { score: 3, description: "Very poor: urgent functional defects (missing tiles over a section, failed flashing, exposed felt) or high defects over large areas; repair or partial replacement soon." },
  { score: 2, description: "Failing: widespread functional failure (sagging, extensive exposed felt, many missing tiles); replacement likely." },
  { score: 1, description: "Failed: structural risk or active failure over most of the roof; replace." },
] as const;

export function rubricPromptSection(): string {
  const bands = RUBRIC_BANDS.map((b) => `  ${b.score} = ${b.description}`).join("\n");
  return `Condition scoring rubric — choose the score whose description best fits the roof as a whole:
${bands}

How to weigh defects:
- category: "functional" defects stop the roof keeping water out or keeping itself together (missing, cracked or
  slipped tiles, failed or lifted flashing, exposed felt, ridge or valley damage, sagging, blocked or broken
  gutters). "cosmetic" defects do not (moss, lichen, staining, weathering). Functional defects lower the score far
  more than cosmetic ones; cosmetic growth alone never takes the score below 5.
- priority is how soon to act: "urgent" = within weeks (water getting in, or anything at risk of falling),
  "high" = within 3 months, "medium" = within a year, "low" = monitor or routine maintenance.
- extent is how much of the visible roof the defect affects: "small", "moderate" or "large". A defect over a large
  area weighs more than the same defect in one spot.
- Weigh each defect by its category, priority and extent together; one urgent functional defect outweighs many
  low cosmetic ones.`;
}

type Cappable = { condition_score: number; defects: readonly { priority?: string; category?: string }[] };

/** The highest score allowed given the defects, or null when nothing caps it. */
function scoreCap(defects: Cappable["defects"]): number | null {
  const functional = defects.filter((d) => d.category === "functional");
  if (functional.some((d) => d.priority === "urgent")) return 3;
  if (functional.some((d) => d.priority === "high")) return 6;
  return null;
}

/**
 * Caps the score when serious functional defects are present: at most 3 for an
 * urgent one, at most 6 for a high one. When the cap lowers the score the AI's
 * own score is kept as `ai_condition_score`.
 */
export function applyScoreCaps<A extends Cappable>(analysis: A): A & { ai_condition_score?: number } {
  const cap = scoreCap(analysis.defects);
  if (cap === null || analysis.condition_score <= cap) return analysis;
  return { ...analysis, condition_score: cap, ai_condition_score: analysis.condition_score };
}
