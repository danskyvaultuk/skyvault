import { describe, expect, it } from "vitest";
import { CorrectedDefectSchema, correctionValues } from "./reportCorrection";

const DEFECT = {
  type: "moss_growth",
  severity: "low",
  description: "d".repeat(300),
  image_index: 0,
  location: "l".repeat(240),
};

describe("the admin's review form and long AI text (BL-079 / SPEC-026 Part C)", () => {
  it("C1: loads a stored defect with a 300-character description and a 240-character location", () => {
    const values = correctionValues({ conditionScore: 6, defectsJson: [DEFECT], recommendations: [], adminNotes: null });
    expect(values.defects).toHaveLength(1);
    expect(values.defects[0].description).toBe("d".repeat(300));
    expect(values.defects[0].location).toBe("l".repeat(240));
  });

  it("C2: still refuses, rather than shortens, a description or location the admin makes too long", () => {
    expect(CorrectedDefectSchema.safeParse({ ...DEFECT, description: "d".repeat(301) }).success).toBe(false);
    expect(CorrectedDefectSchema.safeParse({ ...DEFECT, location: "l".repeat(241) }).success).toBe(false);
  });
});
