import { describe, expect, it } from "vitest";
import { formatUkPostcode } from "./ukPostcode";

describe("formatUkPostcode (BL-074)", () => {
  it("formats a valid postcode in upper case with one space", () => {
    expect(formatUkPostcode("tq95qh")).toBe("TQ9 5QH");
    expect(formatUkPostcode("  sw1a   2aa ")).toBe("SW1A 2AA");
    expect(formatUkPostcode("M1 1AE")).toBe("M1 1AE");
  });

  it("refuses something that is not a UK postcode", () => {
    expect(formatUkPostcode("")).toBeNull();
    expect(formatUkPostcode("12345")).toBeNull();
    expect(formatUkPostcode("TQ9 5Q")).toBeNull();
    expect(formatUkPostcode("TQ9/5QH")).toBeNull();
  });
});
