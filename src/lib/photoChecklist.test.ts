import { describe, it, expect } from "vitest";
import { CHECKLIST, checklistStatus, checklistSummary, missingLabels } from "./photoChecklist";

const photo = (...roofParts: string[]) => ({ roofParts });

describe("CHECKLIST", () => {
  it("lists the seven shots in order with the roof parts that cover them, the original five first and unchanged", () => {
    expect(CHECKLIST.map((i) => [i.id, i.roofParts])).toEqual([
      ["ridge", ["ridge"]],
      ["front_slope", ["front"]],
      ["rear_slope", ["back"]],
      ["gutters", ["gutter"]],
      ["chimney_flashings", ["chimney", "flashing"]],
      ["side_slopes", ["side"]],
      ["secondary_roofs", ["secondary_roof"]],
    ]);
    for (const item of CHECKLIST) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.hint.length).toBeGreaterThan(0);
    }
  });
});

describe("checklistStatus", () => {
  it("marks every item missing with no photos", () => {
    expect(checklistStatus([], []).map((s) => s.state)).toEqual(Array(7).fill("missing"));
  });

  it("marks an item done when any photo carries one of its parts, however it was labelled", () => {
    const status = checklistStatus([photo("front"), photo("overview", "flashing")], []);
    expect(Object.fromEntries(status.map((s) => [s.item.id, s.state]))).toEqual({
      ridge: "missing",
      front_slope: "done",
      rear_slope: "missing",
      gutters: "missing",
      chimney_flashings: "done",
      side_slopes: "missing",
      secondary_roofs: "missing",
    });
  });

  it("marks an item not applicable when chosen, and done again once a photo covers it", () => {
    expect(checklistStatus([], ["chimney_flashings"])[4].state).toBe("not-applicable");
    expect(checklistStatus([photo("chimney")], ["chimney_flashings"])[4].state).toBe("done");
  });
});

describe("checklistSummary and missingLabels", () => {
  it("summarises progress, counting not-applicable as settled", () => {
    const status = checklistStatus([photo("ridge"), photo("front")], ["chimney_flashings", "side_slopes", "secondary_roofs"]);
    expect(checklistSummary(status)).toBe("5 of 7 done — missing: rear slope, gutters");
    expect(missingLabels(status)).toEqual(["Rear slope", "Gutters"]);
  });

  it("says everything is covered when nothing is missing", () => {
    const status = checklistStatus(
      [photo("ridge"), photo("front"), photo("back"), photo("gutter"), photo("side"), photo("secondary_roof")],
      ["chimney_flashings"]
    );
    expect(checklistSummary(status)).toBe("7 of 7 done — every shot covered");
    expect(missingLabels(status)).toEqual([]);
  });
});

describe("side slopes and other roof parts (BL-076 / SPEC-023)", () => {
  const item = (id: string) => CHECKLIST.find((i) => i.id === id)!;
  const stateOf = (id: string, photos: { roofParts: string[] }[], na: Parameters<typeof checklistStatus>[1] = []) =>
    checklistStatus(photos, na).find((s) => s.item.id === id)!.state;

  it("A1: side slopes asks hipped roofs for each side, and lets walls or mid-terrace mark it not applicable", () => {
    const { label, hint } = item("side_slopes");
    expect(label).toBe("Side slopes");
    expect(hint).toMatch(/hipped/i);
    expect(hint).toMatch(/each side/i);
    expect(hint).toMatch(/brick walls/i);
    expect(hint).toMatch(/mid-terrace/i);
    expect(hint).toMatch(/not applicable/i);
  });

  it("A1/A2: a side photo covers side slopes; without one it is needed, or not applicable when chosen", () => {
    expect(stateOf("side_slopes", [photo("side")])).toBe("done");
    expect(stateOf("side_slopes", [photo("front")])).toBe("missing");
    expect(stateOf("side_slopes", [], ["side_slopes"])).toBe("not-applicable");
  });

  it("A2: a missing side slope is named in the warning before analysis", () => {
    expect(missingLabels(checklistStatus([], []))).toContain("Side slopes");
  });

  it("B1: the other-parts item names flat roofs, dormers, bay windows and porches, and not applicable", () => {
    const { label, hint } = item("secondary_roofs");
    expect(label).toBe("Flat roofs, dormers, bays and porches");
    for (const part of [/flat roof/i, /dormer/i, /bay window/i, /porch/i, /not applicable/i]) expect(hint).toMatch(part);
  });

  it("B1/B2: a secondary_roof photo covers it; without one it is needed, or not applicable when chosen", () => {
    expect(stateOf("secondary_roofs", [photo("secondary_roof")])).toBe("done");
    expect(stateOf("secondary_roofs", [photo("side")])).toBe("missing");
    expect(stateOf("secondary_roofs", [], ["secondary_roofs"])).toBe("not-applicable");
    expect(missingLabels(checklistStatus([], []))).toContain("Flat roofs, dormers, bays and porches");
  });
});
