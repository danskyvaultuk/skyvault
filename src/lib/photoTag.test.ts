import { describe, it, expect } from "vitest";
import { PhotoTagSchema, ROOF_PARTS, ROOF_PART_LABELS, ASPECTS, ASPECT_LABELS } from "./photoTag";

describe("PhotoTagSchema", () => {
  it("accepts an empty roofParts array with no aspect — the untag state", () => {
    expect(PhotoTagSchema.safeParse({ roofParts: [] }).success).toBe(true);
  });

  it("accepts every valid roof part individually", () => {
    for (const part of ROOF_PARTS) {
      expect(PhotoTagSchema.safeParse({ roofParts: [part] }).success).toBe(true);
    }
  });

  it("accepts multiple roof parts on the same photo — the multi-tag case", () => {
    const result = PhotoTagSchema.safeParse({ roofParts: ["front", "chimney", "close_up"] });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid roofParts value", () => {
    const result = PhotoTagSchema.safeParse({ roofParts: ["attic"] });
    expect(result.success).toBe(false);
  });

  it("requires roofParts to be present (even if empty)", () => {
    const result = PhotoTagSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts every valid aspect", () => {
    for (const aspect of ASPECTS) {
      expect(PhotoTagSchema.safeParse({ roofParts: [], aspect }).success).toBe(true);
    }
  });

  it("accepts aspect: null — clears direction independently of roofParts", () => {
    expect(PhotoTagSchema.safeParse({ roofParts: ["front"], aspect: null }).success).toBe(true);
  });

  it("omitting aspect entirely is valid — it's optional", () => {
    expect(PhotoTagSchema.safeParse({ roofParts: ["front"] }).success).toBe(true);
  });

  it("rejects an invalid aspect value", () => {
    const result = PhotoTagSchema.safeParse({ roofParts: [], aspect: "northeast" });
    expect(result.success).toBe(false);
  });

  it("accepts an optional free-form captureMethod string", () => {
    const result = PhotoTagSchema.safeParse({ roofParts: ["front"], captureMethod: "phone, hand-held" });
    expect(result.success).toBe(true);
  });

  it("rejects an overlong captureMethod", () => {
    const result = PhotoTagSchema.safeParse({ roofParts: ["front"], captureMethod: "x".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("every ROOF_PARTS value has a display label", () => {
    for (const part of ROOF_PARTS) {
      expect(ROOF_PART_LABELS[part]).toBeTruthy();
    }
  });

  it("every ASPECTS value has a display label", () => {
    for (const aspect of ASPECTS) {
      expect(ASPECT_LABELS[aspect]).toBeTruthy();
    }
  });

  it("roofParts and aspect are independent — combining them is valid", () => {
    const result = PhotoTagSchema.safeParse({ roofParts: ["front", "chimney"], aspect: "north" });
    expect(result.success).toBe(true);
  });
});
