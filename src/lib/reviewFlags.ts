// Review flags (BL-010 / SPEC-013): the AI says what needs a human look instead
// of guessing. Every report is already held for the admin (BL-061), so a flag
// tells the admin what to look at. The customer sees only the areas that could
// not be assessed. Flags live in the stored AI answer; nobody edits them.
import { z } from "zod";

export const REVIEW_FLAG_REASONS = ["low_confidence", "ambiguous", "unassessable_area", "low_light"] as const;

export type ReviewFlagReason = (typeof REVIEW_FLAG_REASONS)[number];

export const REVIEW_FLAG_LABELS: Record<ReviewFlagReason, string> = {
  low_confidence: "Low confidence",
  ambiguous: "Unclear finding",
  unassessable_area: "Area not assessed",
  low_light: "Too dark to judge",
};

export const ReviewFlagSchema = z.object({
  reason: z.enum(REVIEW_FLAG_REASONS),
  description: z.string().max(150),
  image_index: z.number().int().min(0).nullable(),
});

export type ReviewFlag = z.infer<typeof ReviewFlagSchema>;

/** The reasons the customer is told about: places the survey could not see. */
const CUSTOMER_REASONS: readonly ReviewFlagReason[] = ["unassessable_area", "low_light"];

export function reviewFlagPromptSection(): string {
  return `Review flags — say what needs a human look rather than guess:
- "ambiguous": a finding you cannot tell apart from something else (for example a dark patch that may be staining or a
  hole). Flag it; list it as a defect only if you are reasonably sure.
- "unassessable_area": part of the roof the photos do not show clearly enough to judge (out of frame, too distant,
  hidden behind something).
- "low_light": an area too dark or shadowed to judge. Shadow is not felt or a flat roof: never classify a shadowed
  area as a material or a defect; flag it instead.
- "low_confidence": your assessment as a whole rests on weak evidence (poor photos, little of the roof visible).
Each flag's description says where, from the photo (for example "rear slope photo, upper half in shadow"), never as a
measured slope. image_index is the photo it concerns, or null when it concerns no single photo. Use an empty list when
nothing needs flagging.`;
}

type Flaggable = { confidence: "low" | "medium" | "high"; review_flags: ReviewFlag[] };

/** Low confidence always shows as a flag, even when the AI forgot to raise one. */
export function withLowConfidenceFlag<A extends Flaggable>(analysis: A): A {
  if (analysis.confidence !== "low") return analysis;
  if (analysis.review_flags.some((f) => f.reason === "low_confidence")) return analysis;
  const added: ReviewFlag = {
    reason: "low_confidence",
    description: "The AI rated its confidence in this report as low.",
    image_index: null,
  };
  return { ...analysis, review_flags: [...analysis.review_flags, added] };
}

/** The flags in a stored AI answer; none for reports made before flags existed. */
export function storedReviewFlags(rawAiResponse: unknown): ReviewFlag[] {
  const raw = rawAiResponse && typeof rawAiResponse === "object" ? (rawAiResponse as { review_flags?: unknown }) : {};
  const parsed = z.array(ReviewFlagSchema).safeParse(raw.review_flags);
  return parsed.success ? parsed.data : [];
}

export type AssessmentGap = { description: string; photoText: string | null };

/** "Areas we couldn't assess", as the customer sees them. */
export function customerAssessmentGaps(flags: readonly ReviewFlag[]): AssessmentGap[] {
  return flags
    .filter((f) => CUSTOMER_REASONS.includes(f.reason))
    .map((f) => ({ description: f.description, photoText: f.image_index === null ? null : `Photo ${f.image_index + 1}` }));
}
