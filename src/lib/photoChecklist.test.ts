import { describe, it, expect } from "vitest";
import { CHECKLIST, checklistStatus, checklistSummary, missingLabels } from "./photoChecklist";

const photo = (...roofParts: string[]) => ({ roofParts });

describe("CHECKLIST", () => {
  it("lists the five shots in order with the roof parts that cover them", () => {
    expect(CHECKLIST.map((i) => [i.id, i.roofParts])).toEqual([
      ["ridge", ["ridge"]],
      ["front_slope", ["front"]],
      ["rear_slope", ["back"]],
      ["gutters", ["gutter"]],
      ["chimney_flashings", ["chimney", "flashing"]],
    ]);
    for (const item of CHECKLIST) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.hint.length).toBeGreaterThan(0);
    }
  });
});

describe("checklistStatus", () => {
  it("marks every item missing with no photos", () => {
    expect(checklistStatus([], []).map((s) => s.state)).toEqual(Array(5).fill("missing"));
  });

  it("marks an item done when any photo carries one of its parts, however it was labelled", () => {
    const status = checklistStatus([photo("front"), photo("overview", "flashing")], []);
    expect(Object.fromEntries(status.map((s) => [s.item.id, s.state]))).toEqual({
      ridge: "missing",
      front_slope: "done",
      rear_slope: "missing",
      gutters: "missing",
      chimney_flashings: "done",
    });
  });

  it("marks an item not applicable when chosen, and done again once a photo covers it", () => {
    expect(checklistStatus([], ["chimney_flashings"])[4].state).toBe("not-applicable");
    expect(checklistStatus([photo("chimney")], ["chimney_flashings"])[4].state).toBe("done");
  });
});

describe("checklistSummary and missingLabels", () => {
  it("summarises progress, counting not-applicable as settled", () => {
    const status = checklistStatus([photo("ridge"), photo("front")], ["chimney_flashings"]);
    expect(checklistSummary(status)).toBe("3 of 5 done — missing: rear slope, gutters");
    expect(missingLabels(status)).toEqual(["Rear slope", "Gutters"]);
  });

  it("says everything is covered when nothing is missing", () => {
    const status = checklistStatus([photo("ridge"), photo("front"), photo("back"), photo("gutter")], ["chimney_flashings"]);
    expect(checklistSummary(status)).toBe("5 of 5 done — every shot covered");
    expect(missingLabels(status)).toEqual([]);
  });
});
