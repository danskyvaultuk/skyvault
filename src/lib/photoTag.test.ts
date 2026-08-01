import { describe, it, expect } from "vitest";
import { PhotoTagSchema, ROOF_PARTS, ROOF_PART_LABELS } from "./photoTag";

describe("PhotoTagSchema", () => {
  it("accepts every valid roof part", () => {
    for (const part of ROOF_PARTS) {
      expect(PhotoTagSchema.safeParse({ roofPart: part }).success).toBe(true);
    }
  });

  it("accepts roofPart: null — the explicit untag path", () => {
    expect(PhotoTagSchema.safeParse({ roofPart: null }).success).toBe(true);
  });

  it("rejects an invalid roofPart value", () => {
    const result = PhotoTagSchema.safeParse({ roofPart: "roof" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing roofPart entirely", () => {
    const result = PhotoTagSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts an optional free-form captureMethod string", () => {
    const result = PhotoTagSchema.safeParse({ roofPart: "front", captureMethod: "phone, hand-held" });
    expect(result.success).toBe(true);
  });

  it("accepts captureMethod: null", () => {
    const result = PhotoTagSchema.safeParse({ roofPart: "front", captureMethod: null });
    expect(result.success).toBe(true);
  });

  it("omitting captureMethod entirely is valid — it's optional, not required", () => {
    const result = PhotoTagSchema.safeParse({ roofPart: "chimney" });
    expect(result.success).toBe(true);
  });

  it("rejects an overlong captureMethod", () => {
    const result = PhotoTagSchema.safeParse({ roofPart: "front", captureMethod: "x".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("every ROOF_PARTS value has a display label", () => {
    for (const part of ROOF_PARTS) {
      expect(ROOF_PART_LABELS[part]).toBeTruthy();
    }
  });
});
