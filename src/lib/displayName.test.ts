import { describe, expect, it } from "vitest";
import { DisplayNameSchema } from "./displayName";

describe("DisplayNameSchema (BL-081 / SPEC-030 B2)", () => {
  it("trims and accepts 1 to 60 characters", () => {
    expect(DisplayNameSchema.parse("  Jane  ")).toBe("Jane");
    expect(DisplayNameSchema.parse("J")).toBe("J");
    expect(DisplayNameSchema.parse("x".repeat(60))).toBe("x".repeat(60));
  });

  it("refuses an empty name, a blank one and one over 60 characters, with a plain message", () => {
    for (const bad of ["", "   ", "x".repeat(61)]) {
      const result = DisplayNameSchema.safeParse(bad);
      expect(result.success).toBe(false);
      expect(result.success ? "" : result.error.issues[0].message).toMatch(/^Please /);
    }
  });
});
