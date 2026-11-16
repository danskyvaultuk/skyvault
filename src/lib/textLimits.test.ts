import { describe, expect, it } from "vitest";
import { DESCRIPTION_LIMIT, LOCATION_LIMIT, shortenToLimit, shortenedText } from "./textLimits";

describe("text limits (BL-079 / SPEC-026)", () => {
  it("allow twice the length the AI is asked for", () => {
    expect(DESCRIPTION_LIMIT).toBe(300);
    expect(LOCATION_LIMIT).toBe(240);
  });
});

describe("shortenToLimit (BL-079 / SPEC-026 A2)", () => {
  it("leaves text within the limit unchanged, including text exactly at it", () => {
    expect(shortenToLimit("Short text", 20)).toBe("Short text");
    expect(shortenToLimit("x".repeat(20), 20)).toBe("x".repeat(20));
  });

  it("cuts over-long text at the last space within the limit and ends it with …", () => {
    const text = "Pale lichen patches widespread across the main slate slope";
    const out = shortenToLimit(text, 30);
    expect(out).toBe("Pale lichen patches…");
    expect(out.length).toBeLessThanOrEqual(30);
  });

  it("cuts at the limit itself when there is no space", () => {
    const out = shortenToLimit("y".repeat(50), 10);
    expect(out).toBe(`${"y".repeat(9)}…`);
    expect(out.length).toBe(10);
  });

  it("does not leave a trailing comma or space before the …", () => {
    expect(shortenToLimit("Flashing lifted, mortar cracked, tiles slipped badly", 34)).toBe("Flashing lifted, mortar cracked…");
  });
});

describe("shortenedText (BL-079 / SPEC-026 A1, A2)", () => {
  it("accepts text within the limit unchanged, and shortens longer text instead of refusing it", () => {
    const schema = shortenedText(30);
    expect(schema.parse("Within the limit")).toBe("Within the limit");
    const long = schema.safeParse("Pale lichen patches widespread across the main slate slope");
    expect(long.success).toBe(true);
    expect(long.success && long.data).toBe("Pale lichen patches…");
  });

  it("still refuses something that is not text", () => {
    expect(shortenedText(30).safeParse(42).success).toBe(false);
  });
});
