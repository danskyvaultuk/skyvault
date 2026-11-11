import { describe, it, expect } from "vitest";
import { customerDefects } from "./defectDisplay";
import type { StoredDefect } from "./claude";

const base = { type: "flashing_damage", severity: "high", description: "Lifted flashing", image_index: 2 } as const;
const PHOTOS = [["ridge"], [], ["front"], ["overview"]] as const;

describe("customerDefects", () => {
  it("labels each defect by priority, most urgent first", () => {
    const defects: StoredDefect[] = [
      { ...base, priority: "low", category: "cosmetic", extent: "small", location: "a" },
      { ...base, priority: "urgent", category: "functional", extent: "small", location: "b" },
      { ...base, priority: "medium", category: "functional", extent: "small", location: "c" },
      { ...base, priority: "high", category: "functional", extent: "small", location: "d" },
    ];
    expect(customerDefects(defects, PHOTOS).map((d) => d.label)).toEqual(["Urgent", "High", "Medium", "Low"]);
  });

  it("never shows severity when the defect has a priority", () => {
    const [shown] = customerDefects([{ ...base, severity: "critical", priority: "low", category: "cosmetic", extent: "small", location: "x" }], PHOTOS);
    expect(JSON.stringify(shown)).not.toMatch(/critical/i);
  });

  it("phrases the location from the photo, crediting the customer's checklist label", () => {
    const [shown] = customerDefects([{ ...base, priority: "high", category: "functional", extent: "small", location: "lower left, near the gutter" }], PHOTOS);
    expect(shown.locationText).toBe("Seen in photo 3 (your front slope photo): lower left, near the gutter");
  });

  it("uses the photo's own label when it is not a checklist shot, and none when unlabelled", () => {
    const at = (image_index: number) =>
      customerDefects([{ ...base, image_index, priority: "low", category: "cosmetic", extent: "small", location: "top edge" }], PHOTOS)[0].locationText;
    expect(at(3)).toBe("Seen in photo 4 (your overview photo): top edge");
    expect(at(1)).toBe("Seen in photo 2: top edge");
  });

  it("never phrases a location as a measured slope", () => {
    const shown = customerDefects([{ ...base, priority: "high", category: "functional", extent: "small", location: "middle" }], PHOTOS);
    expect(shown[0].locationText).not.toMatch(/on the (front|rear|back) slope/i);
  });

  it("says whether a defect is cosmetic or functional", () => {
    const shown = customerDefects(
      [
        { ...base, priority: "high", category: "functional", extent: "small", location: "x" },
        { ...base, priority: "low", category: "cosmetic", extent: "large", location: "y" },
      ],
      PHOTOS
    );
    expect(shown.map((d) => d.categoryText)).toEqual(["Functional — affects how the roof works", "Cosmetic — appearance only"]);
  });

  it("still shows a defect from before BL-009, labelled by severity, with the missing parts left out", () => {
    const [shown] = customerDefects([{ ...base, severity: "medium", image_index: 0 }], PHOTOS);
    expect(shown.label).toBe("Medium");
    expect(shown.categoryText).toBeNull();
    expect(shown.locationText).toBe("Seen in photo 1 (your ridge photo)");
    expect(shown.description).toBe("Lifted flashing");
  });
});
