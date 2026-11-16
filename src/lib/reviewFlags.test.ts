import { describe, expect, it } from "vitest";
import {
  ReviewFlagSchema,
  customerAssessmentGaps,
  reviewFlagPromptSection,
  storedReviewFlags,
  withLowConfidenceFlag,
  type ReviewFlag,
} from "./reviewFlags";

const SHADOW: ReviewFlag = { reason: "low_light", description: "Rear slope in deep shadow", image_index: 2 };
const UNSEEN: ReviewFlag = { reason: "unassessable_area", description: "Chimney stack not in any photo", image_index: null };
const UNSURE: ReviewFlag = { reason: "ambiguous", description: "Dark patch may be staining or a hole", image_index: 0 };

describe("ReviewFlagSchema", () => {
  it("accepts a flag with a photo and one without", () => {
    expect(ReviewFlagSchema.safeParse(SHADOW).success).toBe(true);
    expect(ReviewFlagSchema.safeParse(UNSEEN).success).toBe(true);
  });

  it("refuses an unknown reason", () => {
    expect(ReviewFlagSchema.safeParse({ ...SHADOW, reason: "bored" }).success).toBe(false);
  });

  it("accepts a description up to 300 characters unchanged, and shortens a longer one (BL-079 / SPEC-026)", () => {
    const upTo = ReviewFlagSchema.parse({ ...SHADOW, description: "x".repeat(300) });
    expect(upTo.description).toBe("x".repeat(300));
    const longer = ReviewFlagSchema.parse({ ...SHADOW, description: "word ".repeat(80).trim() });
    expect(longer.description.length).toBeLessThanOrEqual(300);
    expect(longer.description.endsWith("…")).toBe(true);
  });
});

describe("withLowConfidenceFlag", () => {
  it("adds one low_confidence flag when confidence is low and none was raised", () => {
    const result = withLowConfidenceFlag({ confidence: "low", review_flags: [SHADOW] });
    expect(result.review_flags.map((f) => f.reason)).toEqual(["low_light", "low_confidence"]);
  });

  it("does not add a second one when the AI already raised it", () => {
    const own: ReviewFlag = { reason: "low_confidence", description: "Photos are distant", image_index: null };
    const result = withLowConfidenceFlag({ confidence: "low", review_flags: [own] });
    expect(result.review_flags).toEqual([own]);
  });

  it("leaves medium and high confidence answers alone", () => {
    const answer = { confidence: "medium" as const, review_flags: [] };
    expect(withLowConfidenceFlag(answer)).toBe(answer);
  });
});

describe("storedReviewFlags", () => {
  it("reads the flags from a stored answer", () => {
    expect(storedReviewFlags({ condition_score: 6, review_flags: [SHADOW, UNSURE] })).toEqual([SHADOW, UNSURE]);
  });

  it("answers no flags for a report made before flags existed, or an unreadable answer", () => {
    expect(storedReviewFlags({ condition_score: 6 })).toEqual([]);
    expect(storedReviewFlags(null)).toEqual([]);
    expect(storedReviewFlags({ review_flags: [{ reason: "bored" }] })).toEqual([]);
  });
});

describe("customerAssessmentGaps", () => {
  it("shows the customer only areas that could not be assessed or were too dark, with photo numbers", () => {
    const gaps = customerAssessmentGaps([SHADOW, UNSURE, UNSEEN, { reason: "low_confidence", description: "Blurry", image_index: 1 }]);
    expect(gaps).toEqual([
      { description: "Rear slope in deep shadow", photoText: "Photo 3" },
      { description: "Chimney stack not in any photo", photoText: null },
    ]);
  });

  it("is empty when there are no such flags", () => {
    expect(customerAssessmentGaps([UNSURE])).toEqual([]);
    expect(customerAssessmentGaps([])).toEqual([]);
  });
});

describe("reviewFlagPromptSection", () => {
  it("tells the AI to flag rather than guess, and that shadow is not felt or a flat roof", () => {
    const text = reviewFlagPromptSection();
    for (const reason of ["low_confidence", "ambiguous", "unassessable_area", "low_light"]) expect(text).toContain(reason);
    expect(text).toMatch(/shadow/i);
    expect(text).toMatch(/felt or a flat roof/);
    expect(text).toMatch(/rather than (guess|classify)/);
  });
});

describe("storedReviewFlags and long text (BL-079 / SPEC-026 A3)", () => {
  it("reads back a stored flag with a 300-character description, as the report page does", () => {
    const flag = { reason: "unassessable_area", description: "z".repeat(300), image_index: null };
    expect(storedReviewFlags({ review_flags: [flag] })).toEqual([flag]);
  });
});
