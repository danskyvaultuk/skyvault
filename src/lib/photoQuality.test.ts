import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { assessPhotoQuality, photoQualityLimits, PHOTO_GUIDANCE } from "./photoQuality";

// A checkerboard has crisp edges, like a well-focused photo of tiles.
function checkerboard(width: number, height: number): Buffer {
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#888"/>`;
  for (let y = 0; y < height; y += 40) {
    for (let x = ((y / 40) % 2) * 40; x < width; x += 80) svg += `<rect x="${x}" y="${y}" width="40" height="40" fill="#222"/>`;
  }
  return Buffer.from(`${svg}</svg>`);
}

const LIMITS = photoQualityLimits({});

async function jpeg(input: Buffer, blur?: number): Promise<Buffer> {
  const img = sharp(input);
  return (blur ? img.blur(blur) : img).jpeg().toBuffer();
}

describe("assessPhotoQuality", () => {
  it("accepts a sharp, large photo and reports its measurements", async () => {
    const result = await assessPhotoQuality(await jpeg(checkerboard(2000, 1500)), LIMITS);
    expect(result.outcome).toBe("accepted");
    expect(result).toMatchObject({ width: 2000, height: 1500 });
    if (result.outcome === "accepted") expect(result.sharpness).toBeGreaterThan(LIMITS.minSharpness);
  });

  it("rejects the same photo heavily blurred as too-blurry", async () => {
    const result = await assessPhotoQuality(await jpeg(checkerboard(2000, 1500), 12), LIMITS);
    expect(result).toMatchObject({ outcome: "rejected", reason: "too-blurry" });
  });

  it("measures sharpness the same way whatever the resolution", async () => {
    const big = await assessPhotoQuality(await jpeg(checkerboard(4000, 3000)), LIMITS);
    const small = await assessPhotoQuality(await jpeg(checkerboard(2000, 1500)), LIMITS);
    expect(big.outcome).toBe("accepted");
    expect(small.outcome).toBe("accepted");
  });

  it("rejects a small photo as too-small", async () => {
    const result = await assessPhotoQuality(await jpeg(checkerboard(640, 480)), LIMITS);
    expect(result).toMatchObject({ outcome: "rejected", reason: "too-small", width: 640, height: 480 });
  });

  it("rejects bytes that are not an image as unreadable", async () => {
    const result = await assessPhotoQuality(Buffer.from("this is not an image"), LIMITS);
    expect(result).toMatchObject({ outcome: "rejected", reason: "unreadable" });
  });

  it("has guidance for every reason", () => {
    for (const reason of ["too-small", "too-blurry", "unreadable"] as const) {
      expect(PHOTO_GUIDANCE[reason].length).toBeGreaterThan(20);
    }
  });
});

describe("photoQualityLimits", () => {
  it("uses the defaults when no setting is given", () => {
    expect(photoQualityLimits({})).toEqual({ minSide: 720, minSharpness: 8 });
  });

  it("reads the limits from settings", () => {
    expect(
      photoQualityLimits({ SKYVAULT_PHOTO_MIN_SIDE: "1000", SKYVAULT_PHOTO_MIN_SHARPNESS: "25" })
    ).toEqual({ minSide: 1000, minSharpness: 25 });
  });

  it("ignores a setting that is not a positive number", () => {
    expect(photoQualityLimits({ SKYVAULT_PHOTO_MIN_SIDE: "big", SKYVAULT_PHOTO_MIN_SHARPNESS: "-3" })).toEqual({
      minSide: 720,
      minSharpness: 8,
    });
  });
});
