import { describe, it, expect } from "vitest";
import {
  RoofContextSchema,
  sanitizeRoofContext,
  buildRoofContextPromptBlock,
} from "./roofContext";

describe("RoofContextSchema", () => {
  it("accepts an empty object — every field is optional", () => {
    const result = RoofContextSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts a fully answered context", () => {
    const result = RoofContextSchema.safeParse({
      ageBand: "5-15",
      ageNote: "Re-tiled front slope in 2019",
      material: "tile",
      shape: "pitched",
      slopeCount: 2,
      problemAreas: "Leak near chimney",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid enum value", () => {
    const result = RoofContextSchema.safeParse({ material: "thatch" });
    expect(result.success).toBe(false);
  });

  it("rejects free text over the max length", () => {
    const result = RoofContextSchema.safeParse({ problemAreas: "x".repeat(501) });
    expect(result.success).toBe(false);
  });

  it("rejects a negative slope count", () => {
    const result = RoofContextSchema.safeParse({ slopeCount: -1 });
    expect(result.success).toBe(false);
  });
});

describe("sanitizeRoofContext", () => {
  it("strips control characters from free-text fields", () => {
    const sanitized = sanitizeRoofContext({
      ageNote: "Re-roofed\x00 in 2018",
      problemAreas: "Gutter\x0B issue",
    });
    expect(sanitized.ageNote).toBe("Re-roofed in 2018");
    expect(sanitized.problemAreas).toBe("Gutter issue");
  });

  it("leaves enum/number fields untouched", () => {
    const sanitized = sanitizeRoofContext({ ageBand: "15+", material: "slate", slopeCount: 3 });
    expect(sanitized).toEqual({ ageBand: "15+", material: "slate", slopeCount: 3 });
  });

  it("passes through an empty object unchanged", () => {
    expect(sanitizeRoofContext({})).toEqual({});
  });
});

describe("buildRoofContextPromptBlock", () => {
  it("returns null when context is null or undefined", () => {
    expect(buildRoofContextPromptBlock(null)).toBeNull();
    expect(buildRoofContextPromptBlock(undefined)).toBeNull();
  });

  it("returns null when context is an empty object — fully skipped", () => {
    expect(buildRoofContextPromptBlock({})).toBeNull();
  });

  it("includes only the fields that were answered", () => {
    const block = buildRoofContextPromptBlock({ material: "felt" });
    expect(block).toContain("Material: felt");
    expect(block).not.toContain("Roof age");
    expect(block).not.toContain("Shape");
    expect(block).not.toContain("problem areas");
  });

  it("includes all answered fields when fully populated", () => {
    const block = buildRoofContextPromptBlock({
      ageBand: "0-5",
      material: "tile",
      shape: "pitched",
      slopeCount: 4,
      problemAreas: "Damp patch in loft",
    });
    expect(block).toContain("0–5 years old");
    expect(block).toContain("Material: tile");
    expect(block).toContain("pitched");
    expect(block).toContain("4 slope(s)");
    expect(block).toContain("Damp patch in loft");
  });
});
