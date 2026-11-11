import { describe, it, expect } from "vitest";
import { applyScoreCaps, rubricPromptSection, RUBRIC_BANDS } from "./scoringRubric";

type Defect = { priority: "low" | "medium" | "high" | "urgent"; category: "cosmetic" | "functional" };
const analysis = (score: number, ...defects: Defect[]) => ({ condition_score: score, defects });

describe("applyScoreCaps", () => {
  it("caps the score at 3 when a functional defect is urgent, keeping the AI's own score", () => {
    const capped = applyScoreCaps(analysis(8, { priority: "urgent", category: "functional" }));
    expect(capped.condition_score).toBe(3);
    expect(capped.ai_condition_score).toBe(8);
  });

  it("caps the score at 6 when a functional defect is high", () => {
    const capped = applyScoreCaps(analysis(8, { priority: "high", category: "functional" }, { priority: "low", category: "functional" }));
    expect(capped.condition_score).toBe(6);
    expect(capped.ai_condition_score).toBe(8);
  });

  it("uses the tighter cap when both apply", () => {
    const capped = applyScoreCaps(analysis(9, { priority: "high", category: "functional" }, { priority: "urgent", category: "functional" }));
    expect(capped.condition_score).toBe(3);
  });

  it("never caps for a cosmetic defect, however urgent", () => {
    const result = applyScoreCaps(analysis(8, { priority: "urgent", category: "cosmetic" }));
    expect(result.condition_score).toBe(8);
    expect(result).not.toHaveProperty("ai_condition_score");
  });

  it("leaves a score already within the cap unchanged", () => {
    const result = applyScoreCaps(analysis(2, { priority: "urgent", category: "functional" }));
    expect(result.condition_score).toBe(2);
    expect(result).not.toHaveProperty("ai_condition_score");
  });
});

describe("rubricPromptSection", () => {
  it("describes every score from 1 to 10 and the cosmetic/functional rule", () => {
    const text = rubricPromptSection();
    expect(RUBRIC_BANDS.map((b) => b.score)).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    for (const band of RUBRIC_BANDS) expect(text).toContain(`${band.score} = ${band.description}`);
    expect(text).toMatch(/cosmetic/i);
    expect(text).toMatch(/functional/i);
    expect(text).toMatch(/priority/i);
    expect(text).toMatch(/extent/i);
  });
});
